-- STOK MODÜLÜ — 5. adım: SATIŞ MALİYETİ (kârlılık raporunun kaynağı).
--
-- Adisyon kapanırken her kalemin reçete maliyeti o günkü ortalama maliyetten
-- hesaplanıp DONDURULUYOR. Rapor açılırken bugünkü fiyattan hesaplansaydı
-- süt zamlandığında geçen haftanın kârı sessizce değişirdi.
--
-- Maliyet kalemin kendi satırına değil ayrı tabloya yazılıyor: adisyon
-- kalemlerindeki her güncelleme açık ekranlara canlı mesaj gönderiyor, canlı
-- mesaj da faturanın en pahalı kalemi. Bu tablo canlı yayında değil.
--
-- Reçetesi olmayan kalemin satırı yok — "maliyet sıfır" ile "maliyet
-- bilinmiyor" aynı şey değil. Fiyatı girilmemiş malzemesi olan reçetede
-- toplam eksik kalıyor; `eksik` bunu raporda söylüyor.

create table if not exists kalem_maliyetleri (
  kalem_id   bigint primary key references adisyon_kalemleri (id) on delete cascade,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  adisyon_id bigint not null references adisyonlar (id) on delete cascade,
  -- Kalemin toplamı (adet dahil), TL. Birim maliyet gibi altı ondalık
  -- gerekmiyor ama kuruşa yuvarlanmıyor: yüz kalemin yuvarlama artığı toplamda
  -- görünür olurdu.
  maliyet    numeric(14,4) not null,
  eksik      boolean not null default false
);

create index if not exists kalem_maliyetleri_adisyon on kalem_maliyetleri (adisyon_id);

alter table kalem_maliyetleri enable row level security;
drop policy if exists kalem_maliyetleri_isletme on kalem_maliyetleri;
-- Alış maliyeti stok yönetme yetkisine bağlı (Ramazan kararı, 25 Eyl 2026):
-- ciroyu gören herkes malzemenin kaça alındığını görmesin. Yazma yok;
-- tabloyu yalnız kapanış tetikleyicisi dolduruyor.
create policy kalem_maliyetleri_isletme on kalem_maliyetleri for select to authenticated
  using (isletme_id = oturum_isletmesi() and oturum_yetkisi('stok.yonet'));

revoke insert, update, delete on kalem_maliyetleri from authenticated, anon;

-- Maliyet yeniden yazılıyor: adisyon yeniden açılıp kapanırsa kalemler
-- değişmiş olabilir; iptal edilirse satış yok, maliyet de yok.
create or replace function kalem_maliyetlerini_yaz(p_adisyon_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from kalem_maliyetleri where adisyon_id = p_adisyon_id;

  insert into kalem_maliyetleri (kalem_id, isletme_id, adisyon_id, maliyet, eksik)
  select k.id, a.isletme_id, a.id,
         sum(r.miktar * coalesce(m.ortalama_maliyet, 0)) * k.adet,
         bool_or(m.ortalama_maliyet is null)
    from adisyonlar a
    join turlar t            on t.adisyon_id = a.id
    join adisyon_kalemleri k on k.tur_id = t.id
    join recete_satirlari r  on r.porsiyon_id = k.porsiyon_id
    join malzemeler m        on m.id = r.malzeme_id
   where a.id = p_adisyon_id
     and a.durum = 'kapali'
     and k.durum is distinct from 'iptal'
     and r.tip in ('normal', 'cikarilabilir')
   group by k.id, a.isletme_id, a.id, k.adet;
end $fn$;

revoke all on function kalem_maliyetlerini_yaz(bigint) from public, anon, authenticated;

-- Düşüm tetikleyicisi maliyeti de yazıyor: ikisi aynı anın işi.
create or replace function adisyon_stok_dusumu()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform kalem_maliyetlerini_yaz(new.id);
  perform stok_satis_dusumu(new.id);
  return null;
end $fn$;
