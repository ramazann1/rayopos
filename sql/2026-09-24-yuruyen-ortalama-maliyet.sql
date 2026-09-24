-- ORTALAMA MALİYET DÜZELTMESİ — yürüyen (hareketli) ağırlıklı ortalama.
--
-- HATA NEYDİ: `stok_ortalama_maliyet` bugüne kadar yapılmış BÜTÜN girişleri
-- tek seferde ortalıyordu. Ortalama maliyet ise "elimdeki malın bana kaça mal
-- olduğu" demektir; çoktan tükenmiş bir alışın bugünkü maliyete etkisi olamaz.
--
-- Bir yıl önce 100 lt süt 10 TL'den alınıp bitmiş, bugün 2 lt 100 TL'den
-- alınmış olsun. Eski hesap 1.200 / 102 = 11,76 TL/lt diyordu; oysa elde
-- yalnız bugünkü 2 litre var, doğru rakam 100 TL/lt. Reçete maliyeti dokuz
-- kat düşük çıkıyor, zarar ettiren ürün kârlı görünüyordu.
--
-- DOĞRUSU: ortalama her GİRİŞTE, o an eldeki stok üzerinden yeniden kurulur:
--
--   yeni ortalama = (eldeki miktar × eski ortalama + giren miktar × giriş fiyatı)
--                   ───────────────────────────────────────────────────────────
--                               eldeki miktar + giren miktar
--
-- Çıkış (satış, fire, çıkış, sayım eksiği) ortalamayı DEĞİŞTİRMEZ, yalnız
-- miktarı azaltır: mal harcamak elde kalanın alış fiyatını değiştirmiyor.
--
-- Hesap defteri zaman sırasıyla baştan yürüyor. Tek seferlik toplama yerine
-- yürüyüş seçilmesinin sebebi: hareket silinip düzeltilebiliyor, geçmişe
-- dönük değişiklikten sonra ortalamanın da baştan kurulması gerekiyor.

-- 1) Hassasiyet ------------------------------------------------------------
-- Reçete maliyeti görünümü bu sütunu okuduğu için sütunun tipi ona bağlı;
-- PostgreSQL görünüm dururken tip değiştirmiyor. Görünüm kaldırılıp dosyanın
-- sonunda aynısıyla yeniden kuruluyor.
drop view if exists porsiyon_recete_maliyetleri;

-- Birim maliyet en küçük birim başına tutuluyor ve dört ondalık yetmiyordu:
-- kilosu 0,12 TL olan dökme bir malzemede gram maliyeti 0,00012 iken 0,0001'e
-- yuvarlanıp %17 sapma veriyordu. Altı ondalığa çıkarılıyor.
alter table malzemeler
  alter column ortalama_maliyet type numeric(18,6),
  alter column son_alis_fiyati  type numeric(18,6);

alter table stok_hareketleri
  alter column birim_maliyet type numeric(18,6);

-- 2) Yürüyen ortalama ------------------------------------------------------
create or replace function stok_ortalama_maliyet(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  satir   record;
  eldeki  numeric := 0;   -- o ana kadar elde kalan miktar
  ortalama numeric;       -- o ana kadarki birim maliyet; bilinmiyorsa null
  taban   numeric;
begin
  for satir in
    select tip, miktar, birim_maliyet
      from stok_hareketleri
     where malzeme_id = p_malzeme_id
     order by zaman, id
  loop
    if satir.tip = 'giris' and satir.miktar > 0 and satir.birim_maliyet is not null then
      -- Eldeki mal ancak maliyeti BİLİNİYORSA harmana katılıyor. Fiyatsız
      -- girilmiş stoğu yeni fiyattan saymak, bilmediğimiz bir rakamı uydurmak
      -- olurdu; o durumda maliyeti bu giriş belirliyor.
      -- Eksi stok da sıfır sayılıyor: eksi miktarla çarpım ortalamayı bozar.
      taban := case when ortalama is null then 0 else greatest(eldeki, 0) end;

      ortalama := (taban * coalesce(ortalama, satir.birim_maliyet)
                   + satir.miktar * satir.birim_maliyet)
                  / (taban + satir.miktar);
    end if;

    -- Çıkışlar yalnız miktarı değiştiriyor, ortalamaya dokunmuyor.
    eldeki := eldeki + satir.miktar;
  end loop;

  update malzemeler
     set ortalama_maliyet = round(ortalama, 6)
   where id = p_malzeme_id;
end $fn$;

revoke all on function stok_ortalama_maliyet(bigint) from public, anon, authenticated;

-- 3) Tetikleyici her girişte çalışsın -------------------------------------
-- Eski hâli yalnız fiyatlı girişte tazeliyordu. Artık fiyatsız giriş de
-- sırayı değiştiriyor (kendisinden sonraki girişin "eldeki miktar"ını
-- büyütüyor), o yüzden her giriş hesabı yeniden yürütüyor.
create or replace function stok_maliyeti_tazele()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.tip = 'giris' then
    perform stok_ortalama_maliyet(new.malzeme_id);
  end if;
  return null;
end $fn$;

-- 4) Reçete maliyeti görünümü geri ----------------------------------------
-- 1. adımda kaldırılmıştı; tanımı 2026-09-23-recete.sql'deki ile aynı.
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

-- 5) Mevcut veri yeniden hesaplansın --------------------------------------
do $$
declare
  m record;
begin
  for m in select id from malzemeler loop
    perform stok_ortalama_maliyet(m.id);
  end loop;
end $$;
