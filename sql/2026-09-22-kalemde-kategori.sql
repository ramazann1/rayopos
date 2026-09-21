-- Satış kaleminde kategori de saklanıyor.
--
-- `adisyon_kalemleri` zaten ürünün adını ve fiyatını satış anında kopyalıyor
-- (bkz. 2026-08-04 adisyon modeli): ürün sonradan değişse ya da silinse adisyon
-- oynamasın diye. Kategori bu listede yoktu; rapor onu `urun_id` üstünden
-- menüye sorarak buluyordu.
--
-- Ölçüldü (22 Eyl 2026): 16 üründe 249 kalem kategorisiz kalmış. Silinen
-- ürünler değil — menü bir noktada baştan kurulmuş, aynı adlı ürünler yeni
-- kimliklerle oluşmuş, geçmiş kalemler eski kimliklere bakar kalmış. Cafede
-- menü her elden geçtiğinde aynısı olur.
--
-- Kimlik değil AD saklanıyor: kategori de silinebiliyor, kimlik saklamak aynı
-- sorunu bir üst kata taşırdı.

alter table adisyon_kalemleri
  add column if not exists kategori_ad text;

-- Doldurmayı tarayıcı değil veritabanı yapıyor. Kalem eklenen birden fazla yol
-- var (normal sipariş, çevrimdışı kuyruk, kalem taşıma); birinde unutulursa
-- sessizce eksik kalırdı.
--
-- Bir ürün birden çok kategoride olabiliyor; rapor ürünü tek yerde saysın diye
-- sıradaki ilki alınıyor — `urun_kategorisi` ile aynı kural.
create or replace function kalem_kategorisini_yaz()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kategori_ad is null and new.urun_id is not null then
    select k.ad into new.kategori_ad
      from urun_kategorileri uk
      join kategoriler k on k.id = uk.kategori_id
     where uk.urun_id = new.urun_id
     order by uk.sira
     limit 1;
  end if;
  return new;
end $$;

drop trigger if exists kalem_kategorisi on adisyon_kalemleri;
create trigger kalem_kategorisi
  before insert on adisyon_kalemleri
  for each row execute function kalem_kategorisini_yaz();

-- Geçmiş kalemler: tek seferlik doldurma ------------------------------------
--
-- Önce kimlik üstünden — ürün hâlâ duruyorsa doğrusu bu.
update adisyon_kalemleri k
   set kategori_ad = e.ad
  from (
    select uk.urun_id,
           (array_agg(kat.ad order by uk.sira))[1] as ad
      from urun_kategorileri uk
      join kategoriler kat on kat.id = uk.kategori_id
     group by uk.urun_id
  ) e
 where k.kategori_ad is null
   and k.urun_id = e.urun_id;

-- Kalanlar için ad eşleşmesi. Menü baştan kurulduğunda "Salep" yine "Salep"
-- olarak duruyor, yalnız kimliği değişmiş. Aynı adla birden fazla ürün varsa
-- ve kategorileri ayrıysa eşleşme yapılmıyor: yanlış kategori yazmaktansa boş
-- bırakmak doğru. Deneme kayıtları (menüde karşılığı olmayan adlar) da burada
-- eşleşmiyor, kategorisiz kalıyor — kalması gerektiği gibi.
--
-- **İŞLETME AYRIMI ŞART.** Bu dosya ilk yazıldığında yoktu ve panelden
-- çalıştırıldı; panelde satır güvenliği devrede olmadığı için bütün
-- işletmelerin ürünleri birlikte tarandı ve 11 kaleme başka bir işletmenin
-- kategorisi yazıldı. Temizliği `2026-09-22-kalemde-kategori-duzeltme.sql`
-- yaptı. Aşağıdaki hâli doğrusu; bu dosyanın daha önce çalıştığı bir
-- veritabanında düzeltme dosyası da çalıştırılmalı.
--
-- Kimlik üstünden yapılan yukarıdaki doldurma etkilenmiyor: `urun_id` sistem
-- genelinde tekil, yanlış işletmeye denk gelemez.
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
