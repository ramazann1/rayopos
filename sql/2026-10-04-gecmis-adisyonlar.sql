-- Önceki programdan (Adisyo) aktarılan adisyonlar.
--
-- Adisyo'nun rapor adresi her adisyonun başlığını ve ödemelerini veriyor:
-- masa, garson, açılış/kapanış, kişi sayısı, indirim, bahşiş, servis, ödeme
-- tipleri. Ürün kalemi yok. Bu yüzden canlı `adisyonlar` tablosuna
-- yazılmıyor — orada tutar kalemlerden hesaplanıyor, kalemsiz hesap sıfır
-- görünürdü. Analiz iki tabloyu birlikte okuyor.
--
-- Satırları yalnız SQL Editor'den yüklenen aktarım dosyaları yazıyor
-- (`adisyo-aktar.js` üretir); ekrandan yazma yolu yok. Aktarım işletmenin
-- eski satırlarını silip hepsini yeniden yazıyor — numaralar baştan sona
-- tek sıra kalsın diye.
--
-- İlk denemede günlük ciro toplamları tutuluyordu (`gecmis_ciro`); adisyon
-- ayrıntısı gelince gereksiz kaldı.

drop table if exists gecmis_ciro;

create table if not exists gecmis_adisyonlar (
  isletme_id   bigint not null references isletmeler (id) on delete cascade,
  kaynak_id    bigint not null,
  -- RayoPOS numarası: aktarımda açılış sırasına göre 3000'den veriliyor,
  -- işletmenin sayacı sondan devam ediyor. Fişteki eski numara kaynak_no'da.
  no           integer,
  kaynak_no    integer,
  tip          text not null default 'masa',
  masa_ad      text,
  garson_ad    text,
  musteri_ad   text,
  acilis       timestamptz not null,
  kapanis      timestamptz not null,
  kisi_sayisi  integer not null default 0,
  indirim      numeric(12, 2) not null default 0,
  bahsis       numeric(12, 2) not null default 0,
  servis       numeric(12, 2) not null default 0,
  toplam       numeric(12, 2) not null,
  odemeler     jsonb not null default '[]',
  primary key (isletme_id, kaynak_id)
);

create index if not exists gecmis_adisyonlar_kapanis on gecmis_adisyonlar (isletme_id, kapanis);

alter table gecmis_adisyonlar enable row level security;
drop policy if exists gecmis_adisyonlar_oku on gecmis_adisyonlar;
create policy gecmis_adisyonlar_oku on gecmis_adisyonlar
  for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and (select oturum_yetkilerinden_biri(array['rapor.gun_sonu', 'rapor.tumu']))
  );

revoke all on gecmis_adisyonlar from anon, public;
grant select on gecmis_adisyonlar to authenticated;
