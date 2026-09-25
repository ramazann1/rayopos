-- STOK MODÜLÜ — 4. adım: OTOMATİK DÜŞÜM.
--
-- Adisyon kapanınca satılan porsiyonların reçetesindeki malzemeler stoktan
-- düşüyor. Kararlar (Ramazan, 25 Eyl 2026):
--
-- 1) DÜŞÜM KAPANIŞTA, SİPARİŞTE DEĞİL. Adisyo sipariş kaydedildiği an
--    düşüyor; o zaman her kalem iptalinde geri ekleme gerekiyor ve açık masa
--    saatlerce hareket üretiyor. Kapanışta düşünce defter sade ve kesin.
--
-- 2) VERİTABANI DÜŞÜYOR, TARAYICI DEĞİL. Adisyonu kasa, telefon, Hızlı Öde
--    ya da açık hesaba aktarma kapatabiliyor; hepsi aynı durum değişikliğinden
--    geçiyor. Tetikleyici orada durursa hiçbir yol atlanmıyor.
--
-- 3) FARK YAZILIYOR, TOPLAM DEĞİL. Yeniden açılıp tekrar kapanan adisyonda
--    her kapanış "düşmesi gereken" ile "bugüne kadar düşülen"i karşılaştırıp
--    yalnız farkı yazıyor. Sonradan eklenen kahve düşüyor, eski kalemler iki
--    kez düşmüyor; iptal edilen kalemin malzemesi geri ekleniyor. İptal
--    edilen adisyonda hedef sıfır, yani daha önce düşülen ne varsa geri geliyor.
--
-- İptal kalem düşmüyor (mal çıkmadı; pişip atıldıysa fire girilir). İkram
-- düşüyor: malzeme gerçekten harcandı. Reçetesi olmayan ürün hiçbir şey
-- düşürmüyor, hata da vermiyor. Eksi stoğa her hâlükârda izin veriliyor —
-- satış engeli ayrı bir iş (bkz. tasarım, stok küçük işleri).

-- 1) Belge adisyonu tanısın ----------------------------------------------
-- Bir adisyonun bugüne kadar ne düşürdüğü bu bağdan okunuyor. Adisyon
-- silinirse belge kalıyor: stok gerçekten çıktı, defterde durmalı.
alter table stok_belgeleri
  add column if not exists adisyon_id bigint references adisyonlar (id) on delete set null;

create index if not exists stok_belgeleri_adisyon
  on stok_belgeleri (adisyon_id) where adisyon_id is not null;

-- 2) Düşüm ------------------------------------------------------------------
create or replace function stok_satis_dusumu(p_adisyon_id bigint)
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

  for v_satir in
    select m.id, m.ad, -coalesce(h.hedef, 0) - coalesce(d.dusulen, 0) as fark
      from malzemeler m
      left join (
        -- Düşmesi gereken: iptal olmayan kalemlerin adedi × reçete miktarı.
        -- Yuvarlama malzeme toplamında bir kez yapılıyor; yarım adetler kalem
        -- kalem yuvarlansaydı artık birikirdi.
        select r.malzeme_id, round(sum(r.miktar * k.adet))::bigint as hedef
          from adisyon_kalemleri k
          join turlar t           on t.id = k.tur_id
          join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and v_adisyon.durum = 'kapali'
           and k.durum is distinct from 'iptal'
           and r.tip in ('normal', 'cikarilabilir')
         group by r.malzeme_id
      ) h on h.malzeme_id = m.id
      left join (
        -- Bugüne kadar düşülen; işaretli, yani eksi.
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

    -- Belge ilk farkta açılıyor: değişmeyen yeniden kapanışta boş fiş yok.
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
end $fn$;

revoke all on function stok_satis_dusumu(bigint) from public, anon, authenticated;

-- 3) Kapanışta ve iptalde çalışsın ---------------------------------------
create or replace function adisyon_stok_dusumu()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform stok_satis_dusumu(new.id);
  return null;
end $fn$;

drop trigger if exists adisyon_stok_dusumu_t on adisyonlar;
create trigger adisyon_stok_dusumu_t
  after update of durum on adisyonlar
  for each row
  when (old.durum is distinct from new.durum and new.durum in ('kapali', 'iptal'))
  execute function adisyon_stok_dusumu();
