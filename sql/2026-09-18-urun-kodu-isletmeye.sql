-- Ürün kodu ve barkod benzersizliği işletmeye bağlanıyor.
--
-- 18 Eylül'deki veritabanı denetiminde çıktı. İki ayrı yanlış, aynı yerde:
--
-- 1) `urunler.kod` bütün işletmelerde ortak benzersizdi:
--       create unique index urunler_kod_essiz on urunler (kod) where kod is not null
--    `isletme_id` yok. A kafesi bir ürüne "101" kodunu verdiyse B kafesi o kodu
--    kullanamıyordu; ekranda "Bu ürün kodu başka bir üründe kullanılıyor."
--    yazıyor ama o ürün B'nin menüsünde değil, hiç göremiyor. Kendi verisinde
--    olmayan bir şeyin engellediği hata, sebebi bulunamayan hatadır. Ürün başka
--    işletmelere satılacağı için ilk çakışmada iki müşteri birbirini kilitlerdi.
--
-- 2) `porsiyonlar.barkod` hiç benzersiz değildi — ama kod öyle sanıyor:
--    `porsiyonSatiri` ürün kopyalarken barkodu bilerek boşaltıyor
--    ("Barkod benzersiz olmak zorunda", src/menu.ts). Karşılığı veritabanında
--    yoktu. Barkod okuyucu geldiğinde aynı barkodu taşıyan iki porsiyon yanlış
--    ürünü satardı.
--
-- Şu an kodlu ürün de barkodlu porsiyon da sıfır, taşınacak veri yok.

-- 1) Ürün kodu ------------------------------------------------------------
--
-- Eski indeks düşüp yerine işletmeli olanı geliyor. Ad da değişiyor: "essiz"
-- tek başına neye göre eşsiz olduğunu söylemiyordu, asıl hata oradaydı.

drop index if exists urunler_kod_essiz;

create unique index if not exists urunler_isletme_kod
  on urunler (isletme_id, kod)
  where kod is not null;

-- 2) Barkod ---------------------------------------------------------------
--
-- Aynı ölçü: barkod işletmenin kendi içinde tek. Boş barkod sınırlanmıyor,
-- porsiyonların çoğunun barkodu yok.

create unique index if not exists porsiyonlar_isletme_barkod
  on porsiyonlar (isletme_id, barkod)
  where barkod is not null;
