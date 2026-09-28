-- Deneme işletmesinden (15003) eGZOZ lounge'a yazıcı ve seçenek tanımları.
--
-- Taşınanlar: istasyonlar, yazıcılar, yazıcı–istasyon bağları, fiş şablonları,
-- seçenek grupları ve seçenekler. Seçeneklerin ürünlere bağlantısı
-- (porsiyon_secenek_gruplari) bilerek taşınmıyor, elle kurulacak.
--
-- Sütunlar tablodan okunuyor: tablolara sonradan eklenen alanlar (kağıt
-- genişliği, zil, logo...) elle sayılmadan hepsi geliyor. Satırlar tek tek
-- kopyalanıyor ki eski kimlik → yeni kimlik eşlemesi tutulabilsin; bağlar
-- (seçenek → grubu, yazıcı → istasyon) bu eşlemeyle yeni satırlara çevriliyor.
--
-- Yeni işletme açılırken kurulan hazır istasyonlar, fiş şablonları ve örnek
-- seçenek grupları önce siliniyor, yerlerine deneme işletmesindekiler geliyor.
-- Bir hata olursa hiçbir şey yazılmaz.

do $$
declare
  kaynak   bigint := (select id from isletmeler where kod = 15003);
  hedef    bigint;
  hedef_sayi int;
  t        text;
  sutunlar text;
  eski     bigint;
  yeni     bigint;
begin
  select count(*), max(id) into hedef_sayi, hedef from isletmeler where ad = 'eGZOZ lounge';
  if kaynak is null then
    raise exception 'Deneme işletmesi (15003) bulunamadı';
  end if;
  if hedef_sayi <> 1 then
    raise exception '"eGZOZ lounge" adında % işletme var, tek olmalı', hedef_sayi;
  end if;
  if exists (select 1 from yazicilar where isletme_id = hedef) then
    raise exception 'eGZOZ lounge''da zaten yazıcı var; üstüne yazmamak için durdum';
  end if;

  -- Hazır gelenler. Seçeneklerde yalnız kurulumun örnek grupları siliniyor.
  delete from porsiyon_secenek_gruplari
   where isletme_id = hedef
     and grup_id in (select id from secenek_gruplari
                      where isletme_id = hedef and ad in ('Şeker', 'Ekstralar'));
  delete from secenekler
   where isletme_id = hedef
     and grup_id in (select id from secenek_gruplari
                      where isletme_id = hedef and ad in ('Şeker', 'Ekstralar'));
  delete from secenek_gruplari where isletme_id = hedef and ad in ('Şeker', 'Ekstralar');
  delete from fis_sablonlari where isletme_id = hedef;
  delete from istasyonlar where isletme_id = hedef;

  create temp table esleme (tablo text, eski bigint, yeni bigint) on commit drop;

  foreach t in array array['istasyonlar', 'yazicilar', 'fis_sablonlari',
                           'secenek_gruplari', 'secenekler'] loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into sutunlar
      from information_schema.columns
     where table_schema = 'public' and table_name = t
       and column_name not in ('id', 'isletme_id')
       and is_generated = 'NEVER';

    for eski in execute format('select id from %I where isletme_id = $1 order by id', t)
                using kaynak loop
      execute format(
        'insert into %I (isletme_id, %s) select $1, %s from %I where id = $2 returning id',
        t, sutunlar, sutunlar, t)
        into yeni using hedef, eski;
      insert into esleme values (t, eski, yeni);
    end loop;
  end loop;

  -- Seçenekler hâlâ deneme işletmesinin gruplarını gösteriyor; yenilerine çevir.
  update secenekler s
     set grup_id = e.yeni
    from esleme e, esleme es
   where e.tablo = 'secenek_gruplari' and e.eski = s.grup_id
     and es.tablo = 'secenekler' and es.yeni = s.id;

  insert into yazici_istasyonlari (isletme_id, yazici_id, istasyon_id)
  select hedef, y.yeni, i.yeni
    from yazici_istasyonlari yi
    join esleme y on y.tablo = 'yazicilar'   and y.eski = yi.yazici_id
    join esleme i on i.tablo = 'istasyonlar' and i.eski = yi.istasyon_id
   where yi.isletme_id = kaynak;

  raise notice 'Taşındı: % istasyon, % yazıcı, % fiş şablonu, % seçenek grubu, % seçenek',
    (select count(*) from esleme where tablo = 'istasyonlar'),
    (select count(*) from esleme where tablo = 'yazicilar'),
    (select count(*) from esleme where tablo = 'fis_sablonlari'),
    (select count(*) from esleme where tablo = 'secenek_gruplari'),
    (select count(*) from esleme where tablo = 'secenekler');
end $$;

-- Kontrol: iki işletmede sayılar aynı çıkmalı.
select i.ad,
       (select count(*) from istasyonlar x         where x.isletme_id = i.id) as istasyon,
       (select count(*) from yazicilar x           where x.isletme_id = i.id) as yazici,
       (select count(*) from yazici_istasyonlari x where x.isletme_id = i.id) as yazici_istasyon,
       (select count(*) from fis_sablonlari x      where x.isletme_id = i.id) as fis,
       (select count(*) from secenek_gruplari x    where x.isletme_id = i.id) as secenek_grubu,
       (select count(*) from secenekler x          where x.isletme_id = i.id) as secenek
  from isletmeler i
 order by i.kod;
