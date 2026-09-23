-- STOK MODÜLÜ — 1. adım: veri modeli.
-- Bu dosya yalnız tabloları kuruyor; Malzemeler ekranı tanım girmek için
-- kullanılacak, hareket ekranları (giriş/sayım/fire) sonraki adımda gelecek.
--
-- İki temel karar bu şemanın her yerinde görünüyor:
--
-- 1) MİKTARLAR EN KÜÇÜK BİRİMDE TAM SAYI. Parada kuruş neyse burada gram,
--    mililitre ve adet o: 1,5 kg = 1500. Ondalık tutulsaydı reçete düşümünde
--    yuvarlama artığı birikir, stok zamanla gerçekten kayardı. Ekranda kg/lt
--    gösterilir, veritabanında hep en küçük birim durur.
--
-- 2) STOK YALNIZ HAREKETLE DEĞİŞİR. Adisyo'da malzemenin miktarı ürün
--    kartından elle düzeltilebiliyor ve defterde izi kalmıyor — "stok neden
--    tutmuyor" sorusunun cevabı orada kayboluyor. Bizde malzemenin miktarını
--    kimse doğrudan yazamaz (sütun yetkisi verilmiyor); yalnız stok hareketi
--    yazılır, miktarı tetikleyici günceller.

-- 1) Malzeme grupları ------------------------------------------------------
-- Menüdeki kategorinin stok tarafındaki karşılığı: Süt Ürünleri, Kuru Gıda...
-- Hazır liste tohumlanmıyor, her işletme kendi setini kurar.
create table if not exists malzeme_gruplari (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  ad         text   not null,
  renk       text,
  sira       int    not null default 0,
  aktif      boolean not null default true
);

create unique index if not exists malzeme_gruplari_ad
  on malzeme_gruplari (isletme_id, lower(ad));

-- 2) Malzemeler ------------------------------------------------------------
-- Malzeme ürün değildir: satılmaz, kendi ölçü birimi ve alış fiyatı vardır.
-- (eGZOZ'daki "HAMMADDE" kategorisi ürün tablosunu zorlayarak uydurulmuş bir
-- çareydi; burada kendi tablosunda duruyor.)
create table if not exists malzemeler (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  grup_id    bigint references malzeme_gruplari (id) on delete set null,
  ad         text   not null,
  -- İşletmenin kendi stok kodu; barkod değil, boş bırakılabilir.
  kod        text,
  -- İşletmenin bu malzemeyi hangi ölçüyle saydığı — yalnız GÖSTERİM içindir.
  -- Un kiloyla, maya gramla, süt litreyle sayılıyor; herkese kilo dayatmak
  -- "0,004 kg maya" gibi okunmaz rakamlar çıkarıyor. Depodaki miktar bu
  -- seçimden bağımsız, hep en küçük birimde (gram/mililitre/adet) duruyor.
  birim      text   not null default 'kg'
             check (birim in ('kg', 'gram', 'litre', 'mililitre', 'adet')),
  -- Altına düşünce satır kırmızı şeritle kendini belli eder. 0 = takip yok.
  kritik_seviye bigint not null default 0 check (kritik_seviye >= 0),
  -- Eksi olabilir: eksi stoğa izin veren işletmede satış durmuyor, stok
  -- eksiye düşüp görünür kalıyor.
  miktar     bigint not null default 0,
  -- Birim maliyet en küçük birim başınadır (gram başına kuruşun altına inen
  -- rakamlar çıkıyor), o yüzden dört haneli ondalık. numeric — float değil.
  son_alis_fiyati   numeric(14,4),
  ortalama_maliyet  numeric(14,4),
  aktif      boolean not null default true,
  olusturma  timestamptz not null default now()
);

create unique index if not exists malzemeler_ad
  on malzemeler (isletme_id, lower(ad));
create index if not exists malzemeler_grup
  on malzemeler (isletme_id, grup_id);

-- 3) Stok belgeleri --------------------------------------------------------
-- Fiş başlığı: bir defada girilen hareketleri bir arada tutar. Alışta on
-- kalem tek belgede durur; belge silinmez, hatalı belge ters kayıtla düzeltilir.
create table if not exists stok_belgeleri (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  -- giris = alış/mal kabul · sayim = fiili sayım düzeltmesi · fire = zayi
  -- (bizde ücretsiz, Adisyo ayrı satıyor) · cikis = elle düşüm ·
  -- satis = adisyon kapanınca reçeteden otomatik düşüm (4. adım)
  tip        text   not null
             check (tip in ('giris', 'sayim', 'fire', 'cikis', 'satis')),
  zaman      timestamptz not null default now(),
  aciklama   text,
  kisi_id    bigint references personel (id),
  -- Personel sonradan silinse de belgeyi kimin girdiği okunabilsin.
  kisi_ad    text,
  olusturma  timestamptz not null default now()
);

create index if not exists stok_belgeleri_zaman
  on stok_belgeleri (isletme_id, zaman desc);

-- 4) Stok hareketleri — değişmez defter -----------------------------------
-- Her satır tek bir malzemenin tek bir değişimi. `onceki` ve `sonraki`
-- tetikleyici tarafından yazılır; böylece defter kendi kendini doğrular ve
-- "stok ne zaman nereden kaydı" sorusu geriye doğru okunabilir.
create table if not exists stok_hareketleri (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  belge_id   bigint not null references stok_belgeleri (id) on delete cascade,
  malzeme_id bigint not null references malzemeler (id) on delete restrict,
  -- Malzeme adı belgeyle birlikte donuyor (satış kaleminde ürün adını
  -- dondurduğumuz gibi): malzeme sonradan yeniden adlandırılsa bile eski
  -- fiş o günkü adıyla okunur.
  malzeme_ad text   not null,
  tip        text   not null
             check (tip in ('giris', 'sayim', 'fire', 'cikis', 'satis')),
  -- İşaretli değişim: giriş artı, fire/çıkış/satış eksi, sayım iki yöne de
  -- gidebilir. En küçük birimde tam sayı.
  miktar     bigint not null check (miktar <> 0),
  onceki     bigint not null,
  sonraki    bigint not null,
  birim_maliyet numeric(14,4),
  kisi_id    bigint references personel (id),
  zaman      timestamptz not null default now()
);

create index if not exists stok_hareketleri_malzeme
  on stok_hareketleri (isletme_id, malzeme_id, zaman desc);
create index if not exists stok_hareketleri_belge
  on stok_hareketleri (belge_id);

-- 5) Hareket yazılınca miktar güncellenir ---------------------------------
-- Miktarı kod değil veritabanı yazıyor. Gerekçesi kalemdeki kategori
-- tetikleyicisiyle aynı: stok hareketi üreten birden çok yol olacak (elle
-- giriş, sayım, adisyon kapanışı, çevrimdışı kuyruk) ve birinde unutulursa
-- stok sessizce kayardı.
create or replace function stok_hareketi_uygula()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  simdiki bigint;
begin
  -- Aynı malzemeye iki kişi aynı anda hareket yazarsa satır kilitleniyor;
  -- ikisi de aynı `onceki` değerini okuyup defteri bozmasın.
  select miktar into simdiki from malzemeler
   where id = new.malzeme_id and isletme_id = new.isletme_id
   for update;

  if not found then
    raise exception 'Malzeme bulunamadi: %', new.malzeme_id;
  end if;

  new.onceki  := simdiki;
  new.sonraki := simdiki + new.miktar;

  update malzemeler
     set miktar = new.sonraki,
         son_alis_fiyati = case
           when new.tip = 'giris' and new.birim_maliyet is not null
             then new.birim_maliyet
           else son_alis_fiyati
         end
   where id = new.malzeme_id;

  return new;
end $fn$;

drop trigger if exists stok_hareketi_uygula_t on stok_hareketleri;
create trigger stok_hareketi_uygula_t
  before insert on stok_hareketleri
  for each row execute function stok_hareketi_uygula();

-- 6) Defter değişmez -------------------------------------------------------
-- Yazılan hareket düzeltilemez ve silinemez; yanlış kayıt ters hareketle
-- düzeltilir. Yetki seviyesinde kapatılıyor, yani uygulamada bir hata olsa
-- bile veritabanı kabul etmiyor.
revoke update, delete on stok_hareketleri from authenticated;

-- Malzemenin miktarı da elle yazılamaz: güncelleme yetkisi yalnız tanım
-- alanlarına veriliyor. Tetikleyici security definer olduğu için miktarı
-- yine de güncelleyebiliyor.
revoke update on malzemeler from authenticated;
grant update (grup_id, ad, kod, birim, kritik_seviye, aktif) on malzemeler
  to authenticated;

-- 7) Satır güvenliği -------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'malzeme_gruplari', 'malzemeler', 'stok_belgeleri', 'stok_hareketleri'
  ] loop
    execute format('alter table %I alter column isletme_id set default oturum_isletmesi()', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_isletme', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (isletme_id = oturum_isletmesi())
         with check (isletme_id = oturum_isletmesi())',
      t || '_isletme', t
    );
  end loop;
end $$;

-- 8) Eksi stok ayarı -------------------------------------------------------
-- Adisyo'da "Eksi stoğa izin verilsin" anahtarı var ve eGZOZ'da bilerek açık:
-- malzeme girişi geç kalabiliyor, satış durursa işletme duruyor. Bizde de
-- varsayılan izinli; isteyen işletme kapatır. Kapalıyken bile eksi stok
-- engel değil uyarıdır — satır kırmızı görünür.
alter table isletme_ayarlari
  add column if not exists eksi_stok_izin boolean not null default true;

-- 9) Yetkiler --------------------------------------------------------------
-- İki ayrı yetki: stoğu görmek ile stoğu değiştirmek aynı şey değil. Mutfak
-- sorumlusu neyin bittiğine bakabilsin ama alış fiyatını kimse değiştiremesin.
insert into yetkiler (kod, ad, grup, sira)
select 'stok.gor', 'Stok görüntüleme', 'Tanım', 7
where not exists (select 1 from yetkiler y where y.kod = 'stok.gor');

insert into yetkiler (kod, ad, grup, sira)
select 'stok.yonet', 'Stok yönetimi', 'Tanım', 8
where not exists (select 1 from yetkiler y where y.kod = 'stok.yonet');

-- Göç SQL editöründen çalıştığı için oturum yok: isletme_id elle yazılıyor,
-- kaynağı yetkinin verildiği rolün kendi işletmesi.
insert into rol_yetkileri (isletme_id, rol_id, yetki_id)
select r.isletme_id, r.id, y.id
from roller r cross join yetkiler y
where r.ad in ('Yönetici', 'Müdür')
  and y.kod in ('stok.gor', 'stok.yonet')
  and not exists (
    select 1 from rol_yetkileri ry where ry.rol_id = r.id and ry.yetki_id = y.id
  );
