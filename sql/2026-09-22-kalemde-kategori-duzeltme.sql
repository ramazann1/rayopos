-- Aynı gün çıkan hata: `2026-09-22-kalemde-kategori.sql` içindeki geçmişi
-- doldurma sorguları **işletme ayırmıyordu**. Panelden çalıştırıldığında satır
-- güvenliği devrede olmadığı için bütün işletmelerin ürünleri birlikte tarandı;
-- ad eşleşmesi başka bir işletmenin kategorisini bizim kalemimize yazabildi.
--
-- Ölçüldü: 11 kalem böyle doldu (10 "Sıcak İçecekler", 1 "Soğuk İçecekler" —
-- bizim kategorilerimiz büyük harfli, o adlar deneme işletmelerinden).
--
-- Önce yabancı kategoriler siliniyor, sonra doldurma işletme içinde tekrar
-- yapılıyor. Kimlik üstünden yapılan ilk doldurma etkilenmedi: `urun_id`
-- sistem genelinde tekil, yanlış işletmeye denk gelemez.

-- 1) Kalemin bağlı olduğu işletmede karşılığı olmayan kategori adları siliniyor.
update adisyon_kalemleri k
   set kategori_ad = null
  from turlar t
  join adisyonlar a on a.id = t.adisyon_id
 where t.id = k.tur_id
   and k.kategori_ad is not null
   and not exists (
     select 1 from kategoriler kat
      where kat.isletme_id = a.isletme_id
        and kat.ad = k.kategori_ad
   );

-- 2) Ad eşleşmesi tekrar, bu kez kalemin kendi işletmesi içinde. Aynı adla
-- birden fazla ürün varsa ve kategorileri ayrıysa yine boş bırakılıyor.
update adisyon_kalemleri k
   set kategori_ad = e.ad
  from turlar t
  join adisyonlar a on a.id = t.adisyon_id
  join (
    select u.isletme_id,
           lower(btrim(u.ad)) as ad_anahtar,
           min(e2.ad)         as ad
      from urunler u
      join lateral (
        select kat.ad
          from urun_kategorileri uk
          join kategoriler kat on kat.id = uk.kategori_id
         where uk.urun_id = u.id
         order by uk.sira
         limit 1
      ) e2 on true
     group by u.isletme_id, lower(btrim(u.ad))
    having count(distinct e2.ad) = 1
  ) e on e.isletme_id = a.isletme_id
 where t.id = k.tur_id
   and k.kategori_ad is null
   and lower(btrim(k.ad)) = e.ad_anahtar;
