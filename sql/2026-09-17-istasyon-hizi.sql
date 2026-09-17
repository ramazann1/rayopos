-- İstasyon ekranının açılışı hızlanıyor.
--
-- Ekran açık adisyonların son turlarını `olusturma` sırasına göre istiyor
-- (mutfak.ts, panoyuGetir). `turlar` tablosunda bu sütunda dizin yoktu: her
-- açılışta bugüne kadarki bütün turlar sıralanıyordu. Sipariş sayısı arttıkça
-- bekleme uzuyor, tezgâh siparişleri beş saniye sonra görüyordu.
--
-- Dizin sıralamayı hazır veriyor; sorgu ilk iki yüz satırı okuyup duruyor.

create index if not exists turlar_olusturma on turlar (olusturma desc);

-- Hazırlananlar listesi son biten kalemleri istiyor; onun da kendi dizini var.
-- Bekleyenlerin dizini 27 Ağustos'ta konmuştu (adisyon_kalemleri_bekleyen).
create index if not exists adisyon_kalemleri_hazirlanan
  on adisyon_kalemleri (hazir_at desc) where hazir_at is not null;

-- Ürün süzmesi artık sunucuda: ekranın tezgâhına düşen ürünler sorguya
-- veriliyor, kalem o listeye göre süzülüyor.
create index if not exists adisyon_kalemleri_urun on adisyon_kalemleri (urun_id);
