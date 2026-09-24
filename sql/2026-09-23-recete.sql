-- STOK MODÜLÜ — 3. adım: REÇETE.
--
-- Reçete, bir porsiyonun hangi malzemeden ne kadar harcadığının listesi.
-- İki iş birden çözüyor: adisyon kapanınca stoğun kendiliğinden düşmesi
-- (4. adım) ve porsiyon maliyetinin elle değil malzeme fiyatından çıkması.
--
-- Üç karar bu dosyanın her yerinde görünüyor:
--
-- 1) REÇETE PORSİYONA AİT, ÜRÜNE DEĞİL. Aynı kahvenin "Tam" ve "Yarım"
--    porsiyonu aynı malzemeden farklı miktar harcıyor.
--
-- 2) MİKTAR EN KÜÇÜK BİRİMDE TAM SAYI. Stok tarafının tamamında olduğu gibi:
--    200 ml süt = 200, 1,5 kg un = 1500. Reçete düşümü günde yüzlerce kez
--    çalışacak; ondalık tutulsaydı yuvarlama artığı birikir, stok kayardı.
--
-- 3) SAHİP İKİ TÜRLÜ OLABİLİR. Bugün yalnız porsiyonun reçetesi giriliyor,
--    ama yarı mamul (kendi reçetesi olan malzeme — "kremalı mantar sosu")
--    sonraki adımda gelecek. Tabloyu o gün sökmemek için sahip alanı şimdiden
--    iki sütun: `porsiyon_id` ya da `sahip_malzeme_id`, tam olarak biri dolu.

-- 1) Reçete satırları ------------------------------------------------------
create table if not exists recete_satirlari (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,

  -- Sahip: porsiyonun reçetesi (bugün) ya da malzemenin reçetesi (yarı
  -- mamul, sonraki adım). İkisi birden dolu olamaz, ikisi birden boş olamaz.
  porsiyon_id       bigint references porsiyonlar (id) on delete cascade,
  sahip_malzeme_id  bigint references malzemeler (id) on delete cascade,

  -- Harcanan malzeme. Reçetede geçen malzeme silinemez (restrict): silinseydi
  -- ürünün maliyeti sessizce düşerdi.
  malzeme_id bigint not null references malzemeler (id) on delete restrict,

  -- En küçük birimde, artı. Sıfır miktarlı satırın anlamı yok — silinsin.
  miktar     bigint not null check (miktar > 0),

  -- normal        = her zaman girer
  -- cikarilabilir = varsayılan girer, müşteri istemezse çıkarılır
  -- opsiyonel     = varsayılan girmez, isteyen ekletir
  -- Maliyet hesabı ilk ikisini sayar; opsiyonel satış anında eklenirse düşer.
  tip        text   not null default 'normal'
             check (tip in ('normal', 'cikarilabilir', 'opsiyonel')),
  sira       int    not null default 0,

  constraint recete_tek_sahip check (
    (porsiyon_id is not null) <> (sahip_malzeme_id is not null)
  )
);

-- Aynı malzeme bir reçetede iki kez yazılmasın; iki ayrı satır yerine
-- miktarı artırılır. Sahip iki sütuna bölündüğü için iki ayrı dizin.
create unique index if not exists recete_porsiyon_malzeme
  on recete_satirlari (porsiyon_id, malzeme_id) where porsiyon_id is not null;
create unique index if not exists recete_malzeme_malzeme
  on recete_satirlari (sahip_malzeme_id, malzeme_id) where sahip_malzeme_id is not null;

-- Maliyet görünümü bu yönden okuyor, malzeme silinirken de bakılıyor.
create index if not exists recete_malzeme
  on recete_satirlari (isletme_id, malzeme_id);

-- 2) Satır güvenliği + yazma yetkisi --------------------------------------
alter table recete_satirlari alter column isletme_id set default oturum_isletmesi();
alter table recete_satirlari enable row level security;
drop policy if exists recete_satirlari_isletme on recete_satirlari;
create policy recete_satirlari_isletme on recete_satirlari for all to authenticated
  using (isletme_id = oturum_isletmesi())
  with check (isletme_id = oturum_isletmesi());

-- Reçeteyi menü ekranı düzenliyor; yetkisi menünün yetkisiyle aynı.
select tanim_yetkisi_bagla('recete_satirlari', 'tanim.menu', 'Menüyü düzenleme yetkiniz yok.');

-- 3) Reçeteden çıkan maliyet ----------------------------------------------
-- Maliyet kopyalanıp saklanmıyor, her okunuşta hesaplanıyor. Gerekçe: süt
-- zamlandığında yüzlerce porsiyonun kopyalanmış maliyetini kimse tazelemez,
-- rakam sessizce eskir. Ağırlıklı ortalama maliyet zaten malzemede duruyor
-- ve en küçük birim başına olduğu için miktarla doğrudan çarpılıyor.
--
-- `eksik` alanı şu yüzden var: fiyatı hiç girilmemiş malzeme varsa toplam
-- gerçeği söylemiyor. O satır sıfır sayılıp "₺4,20" yazmak, "—" yazmaktan
-- daha kötü — yanlış rakam kararı yanlış yere götürüyor.
drop view if exists porsiyon_recete_maliyetleri;
create view porsiyon_recete_maliyetleri with (security_invoker = false) as
  select r.porsiyon_id                                   as id,
         sum(r.miktar * coalesce(m.ortalama_maliyet, 0))  as maliyet,
         bool_or(m.ortalama_maliyet is null)              as eksik
    from recete_satirlari r
    join malzemeler m on m.id = r.malzeme_id
   where r.isletme_id = oturum_isletmesi()
     and r.porsiyon_id is not null
     and r.tip in ('normal', 'cikarilabilir')
     and oturum_yetkisi('tanim.menu')
   group by r.porsiyon_id;

grant select on porsiyon_recete_maliyetleri to authenticated;
