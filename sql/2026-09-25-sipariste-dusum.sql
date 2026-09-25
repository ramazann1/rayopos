-- STOK SİPARİŞTE DÜŞÜYOR (kapanışta değil).
--
-- Aynı gün önce "adisyon kapanınca düş" kurulmuştu (2026-09-25-otomatik-dusum).
-- Eksi stok engeli gelince bu model "depodaki miktar eksi açık masalarda
-- bekleyen ihtiyaç" diye ikinci bir hesap istedi; Ramazan "çok karmaşık"
-- dedi ve karar değişti (25 Eyl 2026):
--
--   * Kalem kaydedildiği an reçetesi düşer.
--   * Adet değişince, kalem iptal edilince / iptalden dönünce, kalem
--     silinince ya da adisyon iptal edilince fark kadar düzelir.
--   * İkram düşülmüş kalır: malzeme harcandı.
--   * Kapanış stoğa dokunmaz.
--
-- Yöntem aynı kalıyor: "düşmesi gereken − bugüne kadar düşülen = fark".
-- Değişen yalnız hesabın ne zaman yapıldığı. Artık malzemenin miktarı her an
-- gerçeği gösteriyor, eksi stok kontrolü de tek rakama bakıyor.
--
-- Bu dosya 2026-09-25-otomatik-dusum.sql, -kalem-maliyeti.sql ve
-- -eksi-stok-engeli.sql'den SONRA çalışır; onların fonksiyonlarını değiştirir.

-- 1) Maliyet kaydı adedi de tutsun --------------------------------------
-- Maliyet sipariş anında donuyor; adet sonradan değişirse birim maliyet
-- korunup adetle ölçekleniyor — süt arada zamlandıysa eski latte zamlanmasın.
alter table kalem_maliyetleri add column if not exists adet numeric(10,3);

-- 2) Eski satır bazlı denetim kalkıyor -----------------------------------
drop trigger if exists kalem_stok_denetimi_t on adisyon_kalemleri;
drop function if exists kalem_stok_denetimi();

-- 3) Maliyet ------------------------------------------------------------
create or replace function kalem_maliyetlerini_yaz(p_adisyon_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- İptal edilen kalemin ya da iptal edilen adisyonun maliyeti yok.
  delete from kalem_maliyetleri km
   using adisyon_kalemleri k, adisyonlar a
   where km.kalem_id = k.id
     and km.adisyon_id = p_adisyon_id
     and a.id = p_adisyon_id
     and (k.durum = 'iptal' or a.durum = 'iptal');

  -- Adedi değişen kalem: donmuş birim maliyetle yeniden ölçekleniyor.
  update kalem_maliyetleri km
     set maliyet = km.maliyet / km.adet * k.adet,
         adet = k.adet
    from adisyon_kalemleri k
   where km.kalem_id = k.id
     and km.adisyon_id = p_adisyon_id
     and km.adet is not null and km.adet > 0
     and km.adet <> k.adet;

  -- Yeni kalem: bugünkü ortalama maliyetle donduruluyor.
  insert into kalem_maliyetleri (kalem_id, isletme_id, adisyon_id, maliyet, eksik, adet)
  select k.id, a.isletme_id, a.id,
         sum(r.miktar * coalesce(m.ortalama_maliyet, 0)) * k.adet,
         bool_or(m.ortalama_maliyet is null),
         k.adet
    from adisyonlar a
    join turlar t            on t.adisyon_id = a.id
    join adisyon_kalemleri k on k.tur_id = t.id
    join recete_satirlari r  on r.porsiyon_id = k.porsiyon_id
    join malzemeler m        on m.id = r.malzeme_id
   where a.id = p_adisyon_id
     and a.durum <> 'iptal'
     and k.durum is distinct from 'iptal'
     and r.tip in ('normal', 'cikarilabilir')
     and not exists (select 1 from kalem_maliyetleri x where x.kalem_id = k.id)
   group by k.id, a.isletme_id, a.id, k.adet;
end $fn$;

-- 4) Düşüm + eksi stok denetimi ----------------------------------------
-- p_denetle: eksi stok ayarı kapalıysa yetmeyen düşümü reddet. Çevrimdışı
-- kuyruktan gelen kayıt ve adisyon iptali (stok geri geliyor) denetlenmez.
drop function if exists stok_satis_dusumu(bigint);

create or replace function stok_satis_dusumu(p_adisyon_id bigint, p_denetle boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_adisyon record;
  v_satir   record;
  v_belge   bigint;
  v_kisi    bigint := oturum_personeli();
  v_izin    boolean;
  v_urun    text;
  v_eksikler text;
begin
  select a.id, a.isletme_id, a.durum, a.adisyon_no,
         coalesce(ms.ad, a.masa_ad) as masa_ad
    into v_adisyon
    from adisyonlar a
    left join masalar ms on ms.id = a.masa_id
   where a.id = p_adisyon_id;

  if not found then
    return;
  end if;

  select eksi_stok_izin into v_izin
    from isletme_ayarlari
   where isletme_id = v_adisyon.isletme_id;

  for v_satir in
    select m.id, m.ad, m.birim, m.miktar as stok,
           -coalesce(h.hedef, 0) - coalesce(d.dusulen, 0) as fark
      from malzemeler m
      left join (
        -- Düşmesi gereken: iptal olmayan kalemlerin adedi × reçete miktarı.
        -- Yuvarlama malzeme toplamında bir kez yapılıyor.
        select r.malzeme_id, round(sum(r.miktar * k.adet))::bigint as hedef
          from adisyon_kalemleri k
          join turlar t           on t.id = k.tur_id
          join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and v_adisyon.durum <> 'iptal'
           and k.durum is distinct from 'iptal'
           and r.tip in ('normal', 'cikarilabilir')
         group by r.malzeme_id
      ) h on h.malzeme_id = m.id
      left join (
        select sh.malzeme_id, sum(sh.miktar)::bigint as dusulen
          from stok_hareketleri sh
          join stok_belgeleri b on b.id = sh.belge_id
         where b.adisyon_id = p_adisyon_id
           and b.tip = 'satis'
         group by sh.malzeme_id
      ) d on d.malzeme_id = m.id
     where m.isletme_id = v_adisyon.isletme_id
       and (h.hedef is not null or d.dusulen is not null)
     order by m.ad
  loop
    continue when v_satir.fark = 0;

    -- Eksi stok kapalıysa yetmeyen düşüm reddediliyor. Hepsi toplanıp tek
    -- mesajda alt alta söyleniyor: ilk yetmeyende durulsaydı garson süt
    -- sorununu çözüp tekrar denediğinde bu kez çekirdeği öğrenirdi.
    if p_denetle and not coalesce(v_izin, true)
       and v_satir.fark < 0 and v_satir.stok + v_satir.fark < 0 then
      if v_urun is null then
        select k.ad into v_urun
          from adisyon_kalemleri k
          join turlar t           on t.id = k.tur_id
          join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and r.malzeme_id = v_satir.id
           and k.durum is distinct from 'iptal'
         order by k.id desc
         limit 1;
      end if;

      v_eksikler := coalesce(v_eksikler, '') || E'\n' ||
        '*' || v_satir.ad || '*: ' ||
        stok_miktar_metni(v_satir.stok, v_satir.birim) || ' var, ' ||
        stok_miktar_metni(-v_satir.fark, v_satir.birim) || ' gerekiyor';
      continue;
    end if;

    -- Belge ilk farkta açılıyor: değişmeyen kayıtta boş fiş yok.
    if v_belge is null then
      insert into stok_belgeleri (isletme_id, tip, aciklama, kisi_id, kisi_ad, adisyon_id)
      values (
        v_adisyon.isletme_id,
        'satis',
        'Adisyon #' || v_adisyon.adisyon_no || coalesce(' · ' || v_adisyon.masa_ad, ''),
        v_kisi,
        (select ad from personel where id = v_kisi),
        p_adisyon_id
      )
      returning id into v_belge;
    end if;

    insert into stok_hareketleri
      (isletme_id, belge_id, malzeme_id, malzeme_ad, tip, miktar, onceki, sonraki, kisi_id)
    values
      (v_adisyon.isletme_id, v_belge, v_satir.id, v_satir.ad, 'satis', v_satir.fark, 0, 0, v_kisi);
  end loop;

  -- Hata bütün işlemi geri alıyor: bu döngüde yazılan hareketler de silinir.
  if v_eksikler is not null then
    raise exception '*%* için stok yetersiz%', v_urun, v_eksikler
      using errcode = 'P0001';
  end if;

  perform kalem_maliyetlerini_yaz(p_adisyon_id);
end $fn$;

revoke all on function stok_satis_dusumu(bigint, boolean) from public, anon, authenticated;

-- 5) Kalem değişince ------------------------------------------------------
-- Satır başına değil İSTEK başına çalışıyor: garson on ürünü tek Kaydet'le
-- gönderince tek belge yazılsın, on ayrı belge değil. Olay başına ayrı
-- tetikleyici, çünkü PostgreSQL geçiş tablosunu tek olayda veriyor.
create or replace function kalem_stok_eklendi()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id       bigint;
  v_denetle  boolean;
begin
  -- Çevrimdışı kuyruktan gelen kayıtta ürün müşteriye çoktan gitti.
  select not bool_or(stok_denetimsiz) into v_denetle from yeni;

  for v_id in select distinct t.adisyon_id from yeni join turlar t on t.id = yeni.tur_id loop
    perform stok_satis_dusumu(v_id, coalesce(v_denetle, true));
  end loop;
  return null;
end $fn$;

create or replace function kalem_stok_degisti()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id bigint;
begin
  for v_id in select distinct t.adisyon_id from yeni join turlar t on t.id = yeni.tur_id loop
    perform stok_satis_dusumu(v_id, true);
  end loop;
  return null;
end $fn$;

create or replace function kalem_stok_silindi()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id bigint;
begin
  -- Silinen kalem stoğu geri veriyor; geri vermek hiç reddedilmez.
  for v_id in select distinct t.adisyon_id from eski join turlar t on t.id = eski.tur_id loop
    perform stok_satis_dusumu(v_id, false);
  end loop;
  return null;
end $fn$;

drop trigger if exists kalem_stok_eklendi_t on adisyon_kalemleri;
create trigger kalem_stok_eklendi_t
  after insert on adisyon_kalemleri
  referencing new table as yeni
  for each statement execute function kalem_stok_eklendi();

drop trigger if exists kalem_stok_degisti_t on adisyon_kalemleri;
create trigger kalem_stok_degisti_t
  after update on adisyon_kalemleri
  referencing new table as yeni
  for each statement execute function kalem_stok_degisti();

drop trigger if exists kalem_stok_silindi_t on adisyon_kalemleri;
create trigger kalem_stok_silindi_t
  after delete on adisyon_kalemleri
  referencing old table as eski
  for each statement execute function kalem_stok_silindi();

-- 6) Adisyon iptali stoğu geri veriyor ----------------------------------
-- Kapanış artık stoğa dokunmuyor; fark hesabı kapanışta sıfır çıkıyor ama
-- boşuna çalışmasın diye tetikleyici yalnız iptalde.
create or replace function adisyon_stok_dusumu()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform stok_satis_dusumu(new.id, false);
  return null;
end $fn$;

drop trigger if exists adisyon_stok_dusumu_t on adisyonlar;
create trigger adisyon_stok_dusumu_t
  after update of durum on adisyonlar
  for each row
  when (old.durum is distinct from new.durum and new.durum = 'iptal')
  execute function adisyon_stok_dusumu();

-- 7) Şu an açık masalar ---------------------------------------------------
-- Yeni kurala göre açık masadaki reçeteli ürünler çoktan düşmüş olmalıydı.
-- Denetimsiz: geçmiş satış reddedilemez.
do $$
declare
  a record;
begin
  for a in select id from adisyonlar where durum = 'acik' loop
    perform stok_satis_dusumu(a.id, false);
  end loop;
end $$;
