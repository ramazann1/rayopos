-- Ürün kodu artık büyük-küçük harf ayırmıyor.
--
-- Bugünkü `2026-09-18-urun-kodu-isletmeye.sql` göçünün eki. Kod işletmeye
-- bağlandı ama harf duyarlılığı gözden kaçmıştı; iki taraf aynı soruya farklı
-- cevap veriyordu:
--
--   İçe aktarım (src/aktarim.ts): Excel'deki kodu küçük harfe çevirip
--     karşılaştırıyor — `KAHVE1` ile `kahve1` onun için aynı üründür,
--     var olanın üstüne yazar.
--   Veritabanı: harfe duyarlıydı — ikisi ayrı koddur, yan yana var olabilirdi.
--
--   Sonuç: menüde hem `kahve1` hem `KAHVE1` varken içe aktarım `Kahve1`
--   satırını görünce hangisini güncelleyeceğini bilemiyordu; listede önce
--   hangisi denk gelirse onu güncelliyordu. Yanlış ürünün fiyatı değişirdi.
--
-- Kural içe aktarımın tarafına çekiliyor, çünkü doğru olan o: insan kodu
-- elle yazıyor, `KAHVE1` yazdı diye yeni ürün açılmasını beklemiyor.
-- Aynı desen projede zaten var: `masraf_tipleri_ad → (isletme_id, lower(ad))`.
--
-- Barkod'a dokunulmuyor: onu insan değil okuyucu yazıyor, harfi harfine
-- eşleşmesi gereken bir makine dizgisi.

drop index if exists urunler_isletme_kod;

create unique index if not exists urunler_isletme_kod
  on urunler (isletme_id, lower(kod))
  where kod is not null;
