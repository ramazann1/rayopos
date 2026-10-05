-- Aktarılan adisyonların ürün kalemleri.
--
-- Kalemler ayrı tabloya değil adisyonun yanına liste olarak yazılıyor:
-- yalnız okunuyorlar (detay penceresi, ürün sayımları), değişmiyorlar.
-- Her kalem: { ad, adet, fiyat, indirim, durum, saat, not }.
-- Adisyonun tutarı yine `toplam`'dan okunuyor; ciro kalemden hesaplanmıyor.

alter table gecmis_adisyonlar add column if not exists kalemler jsonb not null default '[]';
