-- ARA REÇETE VE ÜRETİM — "salsa sos".
--
-- Mutfakta hazırlanan malzemenin (sos, hamur, marine) kendi reçetesi var.
-- Kararlar (27 Eyl 2026, Ramazan):
--
--   * Satışta sosun reçetesi açılır, HAMMADDELER düşer. Mutfak üretimi hiç
--     girmese de domatesin stoğu doğru kalır.
--   * Satışta sosun kendi stoğu da kullanılan kadar düşer.
--   * Üretim ("5 kg salsa yaptık") yalnız sosun stoğunu artırır, hammaddeye
--     dokunmaz — aksi hâlde domates hem üretimde hem satışta düşerdi.
--   * Sos stoğu "hazırda ne kadar var" bilgisidir: eksi stok engeli ona
--     uygulanmaz, eksiye düşmesi "üretim girilmemiş" demektir.
--
-- Adisyo'da (KÜLBASTI SOS) üretim yok; sos satıldıkça eksiye gidiyor ve
-- hammaddeler hiç düşmüyor.
--
-- Bu dosya 2026-09-27-recete-degisimi.sql'den SONRA çalışır.

-- 1) Tarif miktarı -----------------------------------------------------------
-- Doluysa malzeme ara reçetelidir: reçetesi bu kadar sos çıkarır (en küçük
-- birimde; "2 kg" = 2000). Mutfak tarifi parti olarak biliyor — "1,4 kg
-- domatesten 2 kg salsa" — 1 kg'a bölüp yazdırmak hata getirirdi.
alter table malzemeler add column if not exists tarif_miktari bigint
  check (tarif_miktari is null or tarif_miktari > 0);

grant update (tarif_miktari) on malzemeler to authenticated;

-- 2) Hareket tipi: üretim ----------------------------------------------------
alter table stok_belgeleri drop constraint if exists stok_belgeleri_tip_check;
alter table stok_belgeleri add constraint stok_belgeleri_tip_check
  check (tip in ('giris', 'sayim', 'fire', 'cikis', 'satis', 'uretim'));

alter table stok_hareketleri drop constraint if exists stok_hareketleri_tip_check;
alter table stok_hareketleri add constraint stok_hareketleri_tip_check
  check (tip in ('giris', 'sayim', 'fire', 'cikis', 'satis', 'uretim'));

-- 3) Tek kat --------------------------------------------------------------
-- Sosun içinde sos olmaz: hesap tek kat açılıyor, iç içe zincir hem düşümü
-- hem maliyeti okunmaz hâle getirirdi.
create or replace function ara_recete_denetimi()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.sahip_malzeme_id is null then
    return new;
  end if;

  if new.malzeme_id = new.sahip_malzeme_id then
    raise exception 'Malzeme kendi tarifinde kullanılamaz.' using errcode = 'P0001';
  end if;

  if exists (select 1 from malzemeler where id = new.malzeme_id and tarif_miktari is not null) then
    raise exception 'Mutfakta hazırlanan bir malzeme başka bir tarifin içine yazılamaz.'
      using errcode = 'P0001';
  end if;

  return new;
end $fn$;

drop trigger if exists ara_recete_denetimi_t on recete_satirlari;
create trigger ara_recete_denetimi_t
  before insert or update on recete_satirlari
  for each row execute function ara_recete_denetimi();

create or replace function tarif_miktari_denetimi()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.tarif_miktari is not null and old.tarif_miktari is null
     and exists (select 1 from recete_satirlari where malzeme_id = new.id and sahip_malzeme_id is not null) then
    raise exception '*%* başka bir tarifin içinde kullanılıyor, kendi tarifi olamaz.', new.ad
      using errcode = 'P0001';
  end if;

  return new;
end $fn$;

drop trigger if exists tarif_miktari_denetimi_t on malzemeler;
create trigger tarif_miktari_denetimi_t
  before update of tarif_miktari on malzemeler
  for each row execute function tarif_miktari_denetimi();

-- 4) Sosun maliyeti tarifinden -------------------------------------------
-- Sosun alış fiyatı yok; en küçük birim başına maliyeti tarifinden çıkıyor.
-- Porsiyon maliyeti, kalem maliyeti ve fire tutarı bu sütunu okuduğu için
-- sos onlara sıradan bir malzeme gibi giriyor. Hammaddelerden biri fiyatsızsa
-- sosun maliyeti de bilinmiyor (null) — yarım rakam yanlış karar getirir.
create or replace function ara_birim_maliyeti(p_malzeme_id bigint)
returns numeric
language sql
stable
security definer
set search_path = public
as $fn$
  select case when bool_or(h.ortalama_maliyet is null) then null
              else sum(s.miktar * h.ortalama_maliyet) / m.tarif_miktari end
    from malzemeler m
    join recete_satirlari s on s.sahip_malzeme_id = m.id
    join malzemeler h       on h.id = s.malzeme_id
   where m.id = p_malzeme_id
     and m.tarif_miktari is not null
   group by m.tarif_miktari
$fn$;

create or replace function ara_maliyet_tazele(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update malzemeler
     set ortalama_maliyet = round(ara_birim_maliyeti(p_malzeme_id), 6)
   where id = p_malzeme_id
     and tarif_miktari is not null;
end $fn$;

-- Yürüyen ortalama (2026-09-25-fire-maliyeti.sql) ile aynı; iki ek:
--   * sosun yürüyüşü yok, maliyeti tarifinden; fiyatsız fire/çıkış satırı
--     o anki tarif maliyetini alıyor.
--   * hammaddenin ortalaması değişince onu kullanan soslar tazeleniyor.
create or replace function stok_ortalama_maliyet(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  satir    record;
  eldeki   numeric := 0;
  ortalama numeric;
  taban    numeric;
  sos      record;
begin
  if exists (select 1 from malzemeler where id = p_malzeme_id and tarif_miktari is not null) then
    perform ara_maliyet_tazele(p_malzeme_id);
    update stok_hareketleri sh
       set birim_maliyet = m.ortalama_maliyet
      from malzemeler m
     where m.id = p_malzeme_id
       and sh.malzeme_id = p_malzeme_id
       and sh.tip in ('fire', 'cikis')
       and sh.birim_maliyet is null;
    return;
  end if;

  for satir in
    select id, tip, miktar, birim_maliyet
      from stok_hareketleri
     where malzeme_id = p_malzeme_id
     order by zaman, id
  loop
    if satir.tip = 'giris' and satir.miktar > 0 and satir.birim_maliyet is not null then
      taban := case when ortalama is null then 0 else greatest(eldeki, 0) end;

      ortalama := (taban * coalesce(ortalama, satir.birim_maliyet)
                   + satir.miktar * satir.birim_maliyet)
                  / (taban + satir.miktar);
    elsif satir.tip in ('fire', 'cikis')
          and satir.birim_maliyet is distinct from round(ortalama, 6) then
      update stok_hareketleri
         set birim_maliyet = round(ortalama, 6)
       where id = satir.id;
    end if;

    eldeki := eldeki + satir.miktar;
  end loop;

  update malzemeler
     set ortalama_maliyet = round(ortalama, 6)
   where id = p_malzeme_id;

  for sos in
    select distinct sahip_malzeme_id as id
      from recete_satirlari
     where malzeme_id = p_malzeme_id
       and sahip_malzeme_id is not null
  loop
    perform ara_maliyet_tazele(sos.id);
  end loop;
end $fn$;

revoke all on function stok_ortalama_maliyet(bigint) from public, anon, authenticated;
revoke all on function ara_maliyet_tazele(bigint) from public, anon, authenticated;
revoke all on function ara_birim_maliyeti(bigint) from public, anon, authenticated;

-- Tarif değişince (satır ya da tarif miktarı) sosun maliyeti tazeleniyor.
create or replace function tarif_degisti()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_table_name = 'malzemeler' then
    -- Tarif kapatılınca satırları da kalkıyor; yoksa görünmeyen satırlar
    -- anahtar yeniden açıldığında geri gelirdi.
    if new.tarif_miktari is null then
      delete from recete_satirlari where sahip_malzeme_id = new.id;
      update malzemeler set ortalama_maliyet = null where id = new.id;
    else
      perform ara_maliyet_tazele(new.id);
    end if;
    return null;
  end if;

  if tg_op <> 'INSERT' and old.sahip_malzeme_id is not null then
    perform ara_maliyet_tazele(old.sahip_malzeme_id);
  end if;
  if tg_op <> 'DELETE' and new.sahip_malzeme_id is not null then
    perform ara_maliyet_tazele(new.sahip_malzeme_id);
  end if;
  return null;
end $fn$;

drop trigger if exists tarif_degisti_t on recete_satirlari;
create trigger tarif_degisti_t
  after insert or update or delete on recete_satirlari
  for each row execute function tarif_degisti();

drop trigger if exists tarif_miktari_degisti_t on malzemeler;
create trigger tarif_miktari_degisti_t
  after update of tarif_miktari on malzemeler
  for each row
  when (old.tarif_miktari is distinct from new.tarif_miktari)
  execute function tarif_degisti();

-- 5) Reçetenin açılımı ------------------------------------------------------
-- Satışta düşen her şey: porsiyonun kendi satırları (sos dahil) ve sosun
-- tarifinden gelen hammaddeler. `secim_id` üst satırın malzemesi: müşteri
-- "salsasız" dediğinde sosla birlikte domates de düşmemeli, tip ve
-- çıkarılma sosun satırından okunuyor.
-- Yalnız aşağıdaki güvenli fonksiyonlar okuyor; kişiye açılmıyor.
create or replace view recete_acilimi as
  select r.porsiyon_id,
         r.malzeme_id               as secim_id,
         r.tip,
         r.malzeme_id,
         r.miktar::numeric          as miktar,
         (m.tarif_miktari is not null) as ara
    from recete_satirlari r
    join malzemeler m on m.id = r.malzeme_id
   where r.porsiyon_id is not null
  union all
  select r.porsiyon_id,
         r.malzeme_id,
         r.tip,
         s.malzeme_id,
         r.miktar::numeric * s.miktar / m.tarif_miktari,
         false
    from recete_satirlari r
    join malzemeler m       on m.id = r.malzeme_id and m.tarif_miktari is not null
    join recete_satirlari s on s.sahip_malzeme_id = m.id
   where r.porsiyon_id is not null;

revoke all on recete_acilimi from public, anon, authenticated;

-- 6) Düşüm -----------------------------------------------------------------
-- recete-degisimi.sql'deki ile aynı; reçete yerine açılımı okuyor, sosa
-- eksi stok engeli uygulanmıyor.
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
           (m.tarif_miktari is not null) as ara,
           -coalesce(h.hedef, 0) - coalesce(d.dusulen, 0) as fark
      from malzemeler m
      left join (
        select r.malzeme_id, round(sum(r.miktar * k.adet))::bigint as hedef
          from adisyon_kalemleri k
          join turlar t         on t.id = k.tur_id
          join recete_acilimi r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and v_adisyon.durum <> 'iptal'
           and k.durum is distinct from 'iptal'
           and recete_girer(r.tip, r.secim_id, k.cikan_malzemeler, k.eklenen_malzemeler)
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

    if p_denetle and not coalesce(v_izin, true) and not v_satir.ara
       and v_satir.fark < 0 and v_satir.stok + v_satir.fark < 0 then
      if v_urun is null then
        select k.ad into v_urun
          from adisyon_kalemleri k
          join turlar t         on t.id = k.tur_id
          join recete_acilimi r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and r.malzeme_id = v_satir.id
           and k.durum is distinct from 'iptal'
           and recete_girer(r.tip, r.secim_id, k.cikan_malzemeler, k.eklenen_malzemeler)
         order by k.id desc
         limit 1;
      end if;

      v_eksikler := coalesce(v_eksikler, '') || E'\n' ||
        '*' || v_satir.ad || '*: ' ||
        stok_miktar_metni(v_satir.stok, v_satir.birim) || ' var, ' ||
        stok_miktar_metni(-v_satir.fark, v_satir.birim) || ' gerekiyor';
      continue;
    end if;

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

  if v_eksikler is not null then
    raise exception '*%* için stok yetersiz%', v_urun, v_eksikler
      using errcode = 'P0001';
  end if;

  perform kalem_maliyetlerini_yaz(p_adisyon_id);
end $fn$;

revoke all on function stok_satis_dusumu(bigint, boolean) from public, anon, authenticated;

-- 7) Ön denetim ------------------------------------------------------------
create or replace function stok_on_denetim(p_kalemler jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_isletme  bigint := oturum_isletmesi();
  v_urun     text;
  v_eksikler text;
  v_satir    record;
begin
  if v_isletme is null then
    return null;
  end if;

  if coalesce((select eksi_stok_izin from isletme_ayarlari where isletme_id = v_isletme), true) then
    return null;
  end if;

  for v_satir in
    with kalemler as (
      select (e->>'porsiyon_id')::bigint as porsiyon_id,
             (e->>'adet')::numeric       as adet,
             e->>'ad'                    as ad,
             array(select jsonb_array_elements_text(coalesce(e->'cikan', '[]')))::bigint[]   as cikan,
             array(select jsonb_array_elements_text(coalesce(e->'eklenen', '[]')))::bigint[] as eklenen,
             ord
        from jsonb_array_elements(p_kalemler) with ordinality as x(e, ord)
    ),
    ihtiyac as (
      select r.malzeme_id,
             round(sum(r.miktar * k.adet))::bigint as gereken,
             (array_agg(k.ad order by k.ord desc))[1] as urun
        from kalemler k
        join recete_acilimi r on r.porsiyon_id = k.porsiyon_id
       where recete_girer(r.tip, r.secim_id, k.cikan, k.eklenen)
         and not r.ara
       group by r.malzeme_id
    )
    select m.ad, m.birim, m.miktar as stok, i.gereken, i.urun
      from ihtiyac i
      join malzemeler m on m.id = i.malzeme_id
     where m.isletme_id = v_isletme
       and m.miktar - i.gereken < 0
     order by m.ad
  loop
    v_urun := coalesce(v_urun, v_satir.urun);
    v_eksikler := coalesce(v_eksikler, '') || E'\n' ||
      '*' || v_satir.ad || '*: ' ||
      stok_miktar_metni(v_satir.stok, v_satir.birim) || ' var, ' ||
      stok_miktar_metni(v_satir.gereken, v_satir.birim) || ' gerekiyor';
  end loop;

  if v_eksikler is null then
    return null;
  end if;

  return '*' || v_urun || '* için stok yetersiz' || v_eksikler;
end $fn$;

revoke all on function stok_on_denetim(jsonb) from public, anon;
grant execute on function stok_on_denetim(jsonb) to authenticated;
