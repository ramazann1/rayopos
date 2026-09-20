-- Tek sinyal: ekranlar dört tabloyu değil, tek bir haber tablosunu dinliyor.
--
-- Ölçüldü (20 Eyl 2026, iki izleyici sekmeyle): bir masanın tam ömründe
-- (6 tur, ödeme, kapanış) her cihaza 49 mesaj düşüyor. Supabase'in kuralı
-- "bir satır değişti, on beş cihaz dinliyor = on beş mesaj" olduğu için
-- ücretsiz paketin aylık iki milyonluk sınırı 15 cihaz / 250 masa senaryosunda
-- %276 doluyor. Mesajların üçte ikisi adisyon, kalem, tahsilat ve fiş
-- satırlarından geliyor: iki ürünlük bir sipariş beş ayrı haber üretiyor,
-- oysa ekranın öğrendiği tek şey var — "bu masada bir şey değişti".
--
-- Burada o tek şey söyleniyor. `masa_degisim` veri taşımıyor; adisyonun
-- kimliği ve değişim anı duruyor. Ekran haberi alınca kendi okumasını
-- yapıyor, yani ne gördüğü değişmiyor, yalnız kaç kere uyandığı değişiyor.
--
--
-- NEDEN TETİKLEYİCİ, NEDEN PROGRAMDAN DEĞİL
-- ------------------------------------------
-- Haberi programın kendisi de yazabilirdi ama bir yazma yolunu atlamak
-- serbest kalırdı: o iş her yapıldığında ekran sessizce bayatlardı ve hata
-- kendiliğinden düzelmezdi. Tetikleyici unutamaz, çünkü haberi üreten
-- tablonun kendisi.
--
-- Bedeli, tetikleyicinin yazma yolunun üstünde durması. İki önlemle kapatıldı:
--   1. `security definer` — satır güvenliği kuralı haberi engelleyemiyor.
--   2. Gövde hata yutucu içinde — haber yazılamazsa sessizce geçiyor ve
--      SİPARİŞ NORMAL KAYDEDİLİYOR. Ekran geç güncellenir, kayıt düşmez.
--
--
-- İFADE BAŞINA, ÜSTELİK KISA ARA İLE
-- -----------------------------------
-- Tetikleyiciler satır başına değil ifade başına çalışıyor: üç ürünlük tek
-- ekleme üç değil bir haber üretiyor.
--
-- Bir kaydetme yine de birkaç ayrı istek atıyor (adisyon güncelle, tur aç,
-- kalemleri yaz, fişi kuyruğa koy) ve her biri kendi işlemi olduğu için
-- ayrı ayrı haber üretirdi. Onun için damga 500 ms'den sık yenilenmiyor:
-- aynı kaydetmenin art arda gelen yazmaları tek habere düşüyor.
--
-- BU SAYI EKRANIN DİZGİNİNE BAĞLI. Sinyali dinleyen ekran haberi alınca
-- 800 ms bekleyip okuyor (`canli.ts`, SINYAL). 500 < 800 olduğu sürece
-- bastırılan yazmalar okumadan önce tamamlanmış oluyor. İKİSİ BİRLİKTE
-- DEĞİŞİR: SINYAL küçültülürse burası da küçülmeli, yoksa ekran kendi
-- okumasından sonra yazılan bir satırı kaçırır ve sessizce bayatlar.
--
-- İlk ölçümde ikisi 200/400 ms'ydi ve bir kaydetme 2 sinyal üretiyordu:
-- istekler ~600 ms'ye yayıldığı için pencereye sığmıyorlardı (21 Eyl 2026).

create table if not exists masa_degisim (
  adisyon_id  bigint primary key references adisyonlar (id) on delete cascade,
  isletme_id  bigint not null references isletmeler (id) on delete cascade,
  degisim     timestamptz not null default now()
);

-- Okuma işletmeye bağlı. Yazma kuralı yok: satırları yalnız aşağıdaki
-- `security definer` tetikleyiciler yazıyor, kimse elle dokunamıyor.
alter table masa_degisim enable row level security;
drop policy if exists masa_degisim_oku on masa_degisim;
create policy masa_degisim_oku on masa_degisim
  for select to authenticated
  using (isletme_id = oturum_isletmesi());

revoke all on masa_degisim from anon, public;
grant select on masa_degisim to authenticated;

-- İşletme oturumdan değil adisyonun kendisinden alınıyor. Köprü fişi
-- "basıldı" yaparken ortada oturum yok; oturumdan alsaydık orada kırılırdı.
--
-- Dört ayrı fonksiyon var çünkü tablolar adisyona farklı yoldan bağlanıyor.
-- Geçiş tablosunun adı hepsinde aynı (`degisenler`), böylece bir tablonun
-- ekleme/güncelleme/silme tetikleyicileri tek fonksiyonu çağırabiliyor.

-- 1) adisyonlar — kimlik satırın kendisinde.
create or replace function sinyal_adisyon()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into masa_degisim (adisyon_id, isletme_id)
    select d.id, d.isletme_id from degisenler d
    on conflict (adisyon_id) do update set degisim = now()
     where masa_degisim.degisim < now() - interval '500 milliseconds';
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- 2) turlar / tahsilatlar — adisyon kimliği sütunda duruyor.
create or replace function sinyal_adisyon_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into masa_degisim (adisyon_id, isletme_id)
    select a.id, a.isletme_id
      from adisyonlar a
     where a.id in (select d.adisyon_id from degisenler d where d.adisyon_id is not null)
    on conflict (adisyon_id) do update set degisim = now()
     where masa_degisim.degisim < now() - interval '500 milliseconds';
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- 3) adisyon_kalemleri — adisyona turu üzerinden bağlı.
create or replace function sinyal_kalem()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into masa_degisim (adisyon_id, isletme_id)
    select a.id, a.isletme_id
      from adisyonlar a
     where a.id in (select t.adisyon_id from turlar t
                     where t.id in (select d.tur_id from degisenler d where d.tur_id is not null))
    on conflict (adisyon_id) do update set degisim = now()
     where masa_degisim.degisim < now() - interval '500 milliseconds';
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- 4) yazdirma_kuyrugu — yalnız hesap fişi. Ekranlardaki fiş işareti buna
-- bakıyor; mutfak fişi ekranda hiçbir şeyi değiştirmiyor, haber de üretmemeli
-- (19 Eyl'de abonelik süzgeciyle kapatılmıştı, aynı kural burada sürüyor).
create or replace function sinyal_kuyruk()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into masa_degisim (adisyon_id, isletme_id)
    select a.id, a.isletme_id
      from adisyonlar a
     where a.id in (select d.adisyon_id from degisenler d
                     where d.adisyon_id is not null and d.tip = 'adisyon')
    on conflict (adisyon_id) do update set degisim = now()
     where masa_degisim.degisim < now() - interval '500 milliseconds';
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function sinyal_adisyon() from anon, public;
revoke all on function sinyal_adisyon_id() from anon, public;
revoke all on function sinyal_kalem() from anon, public;
revoke all on function sinyal_kuyruk() from anon, public;

-- Geçiş tablosu ekleme ve güncellemede NEW, silmede OLD tarafından geliyor;
-- PostgreSQL üçünü tek bildirimde birleştirmiyor, onun için tablo başına üç
-- tetikleyici var. Silinen adisyonun haber satırı zaten zincirle düşüyor ve
-- o düşüş ekranlara ayrıca haber oluyor.

drop trigger if exists sinyal_adisyon_ekle on adisyonlar;
create trigger sinyal_adisyon_ekle after insert on adisyonlar
  referencing new table as degisenler
  for each statement execute function sinyal_adisyon();

drop trigger if exists sinyal_adisyon_guncelle on adisyonlar;
create trigger sinyal_adisyon_guncelle after update on adisyonlar
  referencing new table as degisenler
  for each statement execute function sinyal_adisyon();

drop trigger if exists sinyal_tur_ekle on turlar;
create trigger sinyal_tur_ekle after insert on turlar
  referencing new table as degisenler
  for each statement execute function sinyal_adisyon_id();

drop trigger if exists sinyal_tur_guncelle on turlar;
create trigger sinyal_tur_guncelle after update on turlar
  referencing new table as degisenler
  for each statement execute function sinyal_adisyon_id();

drop trigger if exists sinyal_tur_sil on turlar;
create trigger sinyal_tur_sil after delete on turlar
  referencing old table as degisenler
  for each statement execute function sinyal_adisyon_id();

drop trigger if exists sinyal_tahsilat_ekle on tahsilatlar;
create trigger sinyal_tahsilat_ekle after insert on tahsilatlar
  referencing new table as degisenler
  for each statement execute function sinyal_adisyon_id();

drop trigger if exists sinyal_tahsilat_guncelle on tahsilatlar;
create trigger sinyal_tahsilat_guncelle after update on tahsilatlar
  referencing new table as degisenler
  for each statement execute function sinyal_adisyon_id();

drop trigger if exists sinyal_tahsilat_sil on tahsilatlar;
create trigger sinyal_tahsilat_sil after delete on tahsilatlar
  referencing old table as degisenler
  for each statement execute function sinyal_adisyon_id();

drop trigger if exists sinyal_kalem_ekle on adisyon_kalemleri;
create trigger sinyal_kalem_ekle after insert on adisyon_kalemleri
  referencing new table as degisenler
  for each statement execute function sinyal_kalem();

drop trigger if exists sinyal_kalem_guncelle on adisyon_kalemleri;
create trigger sinyal_kalem_guncelle after update on adisyon_kalemleri
  referencing new table as degisenler
  for each statement execute function sinyal_kalem();

drop trigger if exists sinyal_kalem_sil on adisyon_kalemleri;
create trigger sinyal_kalem_sil after delete on adisyon_kalemleri
  referencing old table as degisenler
  for each statement execute function sinyal_kalem();

drop trigger if exists sinyal_kuyruk_ekle on yazdirma_kuyrugu;
create trigger sinyal_kuyruk_ekle after insert on yazdirma_kuyrugu
  referencing new table as degisenler
  for each statement execute function sinyal_kuyruk();

drop trigger if exists sinyal_kuyruk_guncelle on yazdirma_kuyrugu;
create trigger sinyal_kuyruk_guncelle after update on yazdirma_kuyrugu
  referencing new table as degisenler
  for each statement execute function sinyal_kuyruk();

-- Haber tablosu canlı yayına giriyor. Eski tablolar yayında kalıyor: mutfak
-- ekranı kalemleri, köprü de kuyruğu kendi aboneliğiyle dinlemeye devam
-- ediyor. Yayında durmak tek başına mesaj üretmiyor — mesaj, dinleyen cihaz
-- başına sayılıyor. Ekranlar artık onları dinlemediği için sayaç düşüyor.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'masa_degisim'
  ) then
    alter publication supabase_realtime add table masa_degisim;
  end if;
end $$;
