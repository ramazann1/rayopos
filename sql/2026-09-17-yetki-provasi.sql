-- Yetki provası: yetkiler kağıt üstünde değil, gerçekten çalışıyor mu?
--
-- Bugüne kadarki bütün testler yönetici hesabıyla yapıldı. Yönetici her şeyi
-- yapabildiği için sunucudaki yetki denetimleri hiç devreye girmedi; yazılmış
-- olmaları çalıştıkları anlamına gelmiyor.
--
-- Bu betik bir personelin kimliğine bürünüp yetki listesindeki her maddeyi tek
-- tek deniyor ve "yapabildi mi, engellendi mi" diye tablo çıkarıyor.
--
-- Kodu okuyarak bu soru cevaplanmıyor: denetimlerin çoğu yetki kodunu doğrudan
-- yazmıyor, tetikleyiciye parametre olarak geçiyor (2026-09-05-tanim-
-- yetkileri.sql'de tek tabloda 30 satır). Hangi kilidin gerçekten kurulu
-- olduğu ancak çalıştırınca görünüyor.
--
--
-- NASIL ÇALIŞTIRILIR
-- ------------------
-- Supabase → SQL Editor. Önce bu dosyanın tamamını bir kez çalıştır; fonksiyonu
-- kurar, hiçbir şey denemez. Sonra provayı şöyle başlat — üç satırı birlikte:
--
--   begin;
--   select * from yetki_provasi('Mert Bey');
--   rollback;
--
-- `rollback` şart. Prova gerçek tablolara yazarak deniyor; geri alma olmazsa
-- sahte kayıtlar canlı veride kalır.
--
--
-- SONUÇ SÜTUNLARI
-- ---------------
--   yetkide_var : bu kişide o yetki var mı (rolden gelen + kişiye özel satır)
--   sunucu      : denemede ne oldu
--   sonuc       : bakılacak satırlar ✘ olanlar
--
--   ✘ AÇIK : yetkisi yok ama yapabildi. Sunucuda kilit eksik — ekrandaki düğme
--            gizli olsa da tarayıcıdan istek atan biri bu işi yapabilir.
--   ✘ TERS : yetkisi var ama engellendi. Personel işini yapamaz, kilit fazla.

-- 1) Sonuç satırının biçimi --------------------------------------------------

drop function if exists yetki_provasi(text);
drop type if exists yetki_prova_satiri;

create type yetki_prova_satiri as (
  grup        text,
  kod         text,
  yetki       text,
  yetkide_var text,
  sunucu      text,
  sonuc       text
);

-- 2) Provanın kendisi --------------------------------------------------------
--
-- Fonksiyon bilerek `security invoker` (varsayılan). Definer olsaydı denetimler
-- fonksiyonun sahibine bakardı ve prova kendi kendini kandırırdı.

create function yetki_provasi(p_kim text)
returns setof yetki_prova_satiri
language plpgsql
as $$
declare
  v_personel bigint;
  v_auth     uuid;
  v_isletme  bigint;
  v_ad       text;

  -- prova zemini: denemelerin üstünde yapılacağı sahte kayıtlar
  v_bolge    bigint;
  v_masa     bigint;
  v_adisyon  bigint;
  v_kapali   bigint;
  v_tur      bigint;
  v_tur2     bigint;
  v_kalem    bigint;
  v_tahsilat bigint;
  v_kategori bigint;

  s        yetki_prova_satiri;
  d        record;
  v_var      boolean;
  v_ezildi   boolean;
  v_ortak    boolean;   -- aynı kilidi açan başka bir yetkisi var mı
  v_beklenen boolean;   -- sunucunun izin vermesi beklenir mi
  v_satir    bigint;
  v_durum    text;
  v_faz      int;
  v_ikinci   boolean := false;  -- önkoşullu ikinci turdayız
begin
  -- 2.1) Kişiyi bul ----------------------------------------------------------
  --
  -- Ada veya e-postaya göre. Çoğu personelin e-postası boş (ortak kasada PIN'le
  -- geçiliyor, kendi hesabıyla giriş yapmıyor), o yüzden ad da kabul ediliyor.

  select count(*) into v_satir
    from personel p
   where lower(p.ad) = lower(btrim(p_kim))
      or lower(coalesce(p.eposta, '')) = lower(btrim(p_kim));

  if v_satir = 0 then
    raise exception
      'Personel bulunamadı: %. Personel ekranındaki adı ya da e-postayı birebir yaz.', p_kim;
  end if;

  if v_satir > 1 then
    raise exception
      '% adında birden çok kayıt var. E-posta ile ya da tam adıyla dene.', p_kim;
  end if;

  select p.id, p.auth_id, p.isletme_id, p.ad
    into v_personel, v_auth, v_isletme, v_ad
    from personel p
   where lower(p.ad) = lower(btrim(p_kim))
      or lower(coalesce(p.eposta, '')) = lower(btrim(p_kim));

  if v_auth is null then
    raise exception
      '% kaydının giriş hesabı yok (auth_id boş). Provası yapılamaz — kimliğine bürünülemez.', v_ad;
  end if;

  -- 2.2) Deneme listesi ------------------------------------------------------
  --
  -- Her yetki için o yetkiyi tetikleyen en küçük işlem. İki tür var:
  --   yaz : tabloya yazar, ölçüsü "kaç satıra dokundu"
  --   oku : tablodan okur,  ölçüsü "kaç satır görebildi"
  -- Ayrımı yapmak zorundayız: okuma denemesi engellense de `count(*)` yine tek
  -- satır döndürür, satır sayısına bakmak okumada yanıltır.

  create temp table prova_liste (
    kod     text primary key,
    tur     text not null,
    komut   text not null,
    ortak   text[],     -- bu kilidi açan diğer yetkiler (aynı kapıyı paylaşanlar)
    beklenti text,      -- başarı beklentisi bu yetkiye bakar, kodun kendisine değil
    onkosul text[],     -- bu deneme yapılabilsin diye önce gereken yetkiler
    gecti   text,       -- bu mesaj çıkarsa yetki kapısı geçilmiş demektir
    toplam  bigint      -- okuma denemelerinde: işletmenin toplam satır sayısı
  ) on commit drop;

  insert into prova_liste (kod, tur, komut) values
    -- Sipariş ----------------------------------------------------------------
    ('siparis.al',            'yaz', 'insert into adisyonlar (masa_ad, tip, durum) values (''~prova'', ''masa'', ''acik'')'),
    ('siparis.gelal',         'yaz', 'insert into adisyonlar (masa_ad, tip, durum) values (''~prova'', ''gelal'', ''acik'')'),
    ('siparis.paket',         'yaz', 'insert into adisyonlar (masa_ad, tip, durum) values (''~prova'', ''paket'', ''acik'')'),
    ('siparis.urun_cikar',    'yaz', 'delete from adisyon_kalemleri where id = @KALEM@'),
    ('siparis.miktar',        'yaz', 'update adisyon_kalemleri set adet = adet + 1 where id = @KALEM@'),
    ('siparis.fiyat',         'yaz', 'update adisyon_kalemleri set fiyat = fiyat + 1 where id = @KALEM@'),
    ('siparis.ikram',         'yaz', 'update adisyon_kalemleri set durum = ''ikram'' where id = @KALEM@'),
    ('siparis.iptal',         'yaz', 'update adisyonlar set durum = ''iptal'' where id = @ADISYON@'),
    ('siparis.aktif_et',      'yaz', 'update adisyonlar set durum = ''acik'' where id = @KAPALI@'),
    ('siparis.tasi',          'yaz', 'update adisyonlar set masa_ad = ''~prova 2'' where id = @ADISYON@'),
    ('siparis.kalem_tasi',    'yaz', 'update adisyon_kalemleri set tur_id = @TUR2@ where id = @KALEM@'),
    ('siparis.servis',        'yaz', 'update adisyonlar set kuver_uygula = false, kuver_tutar = 0 where id = @ADISYON@'),
    ('siparis.adisyon_ikram', 'yaz', 'select adisyon_ikram_et(@ADISYON@, null)'),
    ('siparis.kapali_gor',    'oku', 'select count(*) from adisyonlar where durum = ''kapali'' and isletme_id = @ISLETME@'),
    ('siparis.gecmis',        'oku', 'select count(*) from turlar where isletme_id = @ISLETME@'),
    ('siparis.fis_yazdir',    'yaz', 'insert into yazdirma_kuyrugu (tip, adisyon_id, icerik) values (''adisyon'', @ADISYON@, '''')'),
    -- Gerçek devralma yolu silmek değil üstüne yazmak: isaretiKoy upsert
    -- yapıyor, satır varken güncellemeye düşüyor. Deneme de öyle yapmalı.
    ('masa.devral',           'yaz', 'update masa_mesguliyet set kisi_ad = ''~prova devralan'', guncelleme = now() where masa_id = @MASA@'),

    -- Ödeme --------------------------------------------------------------------
    ('odeme.al',              'yaz', 'insert into tahsilatlar (adisyon_id, tip, tutar) values (@ADISYON@, ''Nakit'', 5)'),
    ('odeme.iade',            'yaz', 'delete from tahsilatlar where id = @TAHSILAT@'),
    ('odeme.tip_duzelt',      'yaz', 'update tahsilatlar set tip = ''Kredi Kartı'' where id = @TAHSILAT@'),
    ('odeme.indirim',         'yaz', 'update adisyonlar set indirim = 5 where id = @ADISYON@'),
    ('odeme.eksik_kapat',     'yaz', 'update adisyonlar set eksik_kisi = ''~prova'' where id = @ADISYON@'),
    ('odeme.acik_hesap',      'yaz', 'insert into tahsilatlar (adisyon_id, tip, tutar) values (@ADISYON@, @ACIKTIP@, 5)'),
    -- Serbest indirimin eşi: ikisinden biri kalemde indirim yazmayı açıyor.
    -- Denemesi bilerek tanımsız indirim — "yalnız ön tanımlı" yetkisi varsa
    -- sunucu bunu reddetmeli, kabul ediyorsa ayrım uygulanmıyor demektir.
    ('odeme.indirim_tanimli', 'yaz', 'update adisyon_kalemleri set indirim = 3, indirim_tanim_id = null where id = @KALEM@'),

    -- Kasa ----------------------------------------------------------------------
    ('kasa.ac_kapat',         'yaz', 'insert into kasa_vardiyalari (acilis, acilis_tutar) values (now(), 0)'),
    ('kasa.para',             'oku', 'select count(*) from kasa_hareketleri where isletme_id = @ISLETME@'),
    ('kasa.gider',            'yaz', 'insert into masraf_tipleri (ad) values (''~prova gider'')'),
    ('kasa.cekmece',          'yaz', 'insert into yazdirma_kuyrugu (tip, icerik) values (''cekmece'', '''')'),

    -- Cari ----------------------------------------------------------------------
    ('cari.duzenle',          'yaz', 'insert into musteriler (no, ad) values (999999, ''~prova müşteri'')'),
    ('cari.gor',              'oku', 'select count(*) from musteriler where isletme_id = @ISLETME@'),
    ('cari.tahsilat',         'oku', 'select count(*) from cari_hareketler where isletme_id = @ISLETME@'),

    -- Tanım ---------------------------------------------------------------------
    ('tanim.menu',            'yaz', 'update kategoriler set ad = ''~prova 2'' where id = @KATEGORI@'),
    ('tanim.masa',            'yaz', 'update masalar set sira = sira + 1 where id = @MASA@'),
    ('tanim.ayar',            'yaz', 'update isletme_ayarlari set okc_acik = okc_acik'),
    ('tanim.odenmez',         'yaz', 'insert into odenmezler (ad) values (''~prova ikram'')'),
    ('tanim.personel',        'yaz', 'insert into roller (ad, sira) values (''~prova rol'', 9999)'),

    -- Yazıcı ve istasyon ----------------------------------------------------------
    -- Tablo 21 Ağustos'ta `mutfak_gruplari`dan `istasyonlar`a çevrilmişti.
    ('yazici.yonet',          'yaz', 'insert into istasyonlar (ad) values (''~prova istasyon'')'),
    ('yazici.hesap',          'yaz', 'select yazici_hesabi_kur('''')'),
    -- İstasyon ekranı siparişi görüp "hazır" diyor; ölçü istasyon listesini
    -- okumak değil, mutfağa düşmüş kalemin durumunu değiştirebilmek.
    ('mutfak.ekran',          'yaz', 'update adisyon_kalemleri set hazir_at = now() where id = @KALEM@'),

    -- Rapor -----------------------------------------------------------------------
    ('rapor.gun_sonu',        'oku', 'select count(*) from kasa_vardiyalari where isletme_id = @ISLETME@'),
    ('rapor.tumu',            'oku', 'select count(*) from masraflar where isletme_id = @ISLETME@');

  -- Aynı kapıyı paylaşan yetkiler. Bunu bilmezsek "yetkisi yok ama yapabildi"
  -- diye yanlış alarm veririz. Kuyruk politikası artık iş türüne göre ayrıldı
  -- (2026-09-17-kuyruk-is-turleri.sql), paylaşımlar da daraldı: çekmeceyi
  -- ödeme alan da açabiliyor, nakit ödemede kendiliğinden açıldığı için.
  update prova_liste set ortak = array['yazici.yonet']
   where kod = 'siparis.fis_yazdir';
  update prova_liste set ortak = array['odeme.al']
   where kod = 'kasa.cekmece';

  -- Kendi kilidine varmadan başka bir kilide takılan denemeler. Bunlar ikinci
  -- turda, önkoşul yetkisi geçici olarak verilerek tekrar deneniyor — yoksa o
  -- kilitlerin çalışıp çalışmadığı hiç ölçülmemiş oluyor.
  update prova_liste set onkosul = array['odeme.al']
   where kod in ('odeme.acik_hesap', 'odeme.tip_duzelt');

  -- Kısıtlayıcı yetki: "sadece ön tanımlı indirim" bir izin değil, bir sınır.
  -- Denemesi tanımsız indirim yazmak, yani bu yetkinin yasaklaması gereken şey.
  -- Başarı yalnız serbest indirim yetkisi olanda beklenir.
  update prova_liste set beklenti = 'odeme.indirim'
   where kod = 'odeme.indirim_tanimli';

  -- Yetki kapısını geçtiğini gösteren mesaj. `yazici_hesabi_kur` önce yetkiye
  -- bakıyor, sonra telefona; boş telefonla çağırınca telefon hatası görüyorsak
  -- yetki kapısı açılmış demektir. Gerçekten hesap kurup auth kaydı açmamak
  -- için deneme bilerek burada durduruluyor.
  update prova_liste set gecti = 'Telefon numarası' where kod = 'yazici.hesap';

  -- 2.3) Deneme zemini -------------------------------------------------------
  --
  -- Sahte kayıtlar yönetici gözüyle açılıyor: auth.uid() henüz boş, o yüzden
  -- yetki tetikleyicileri geçiyor (yetki_iste böyle yazılmış — kurulum
  -- betikleri engellenmesin diye). isletme_id elle veriliyor; varsayılanı
  -- oturum_isletmesi() ve o da şu an boş döner.

  insert into bolgeler (isletme_id, ad, sira)
    values (v_isletme, '~prova bölge', 9999) returning id into v_bolge;
  insert into masalar (isletme_id, bolge_id, ad, sira)
    values (v_isletme, v_bolge, '~prova masa', 9999) returning id into v_masa;

  -- Masa başkasının üstünde görünsün ki "devralma" gerçekten devralma olsun.
  insert into masa_mesguliyet (isletme_id, masa_id, kisi_id, kisi_ad)
    values (v_isletme, v_masa, null, '~prova başka garson');

  insert into adisyonlar (isletme_id, masa_ad, masa_id, tip, durum)
    values (v_isletme, '~prova masa', v_masa, 'masa', 'acik') returning id into v_adisyon;
  insert into turlar (isletme_id, adisyon_id, sira)
    values (v_isletme, v_adisyon, 1) returning id into v_tur;
  -- Kalem taşıma denemesi için ikinci tur: kalemi kendi turuna taşımak
  -- hiçbir şeyi değiştirmez, tetikleyici de uyanmaz — deneme boşa giderdi.
  insert into turlar (isletme_id, adisyon_id, sira)
    values (v_isletme, v_adisyon, 2) returning id into v_tur2;
  insert into adisyon_kalemleri (isletme_id, tur_id, ad, adet, fiyat, durum)
    values (v_isletme, v_tur, '~prova ürün', 1, 100, 'normal') returning id into v_kalem;
  insert into tahsilatlar (isletme_id, adisyon_id, tip, tutar)
    values (v_isletme, v_adisyon, 'Nakit', 10) returning id into v_tahsilat;
  insert into kategoriler (isletme_id, ad, renk)
    values (v_isletme, '~prova kategori', '#888888') returning id into v_kategori;

  -- İndirim tanımı tablosu boştu, okuma denemesinin karşılaştıracağı satır
  -- yoktu. Bir tane açıyoruz ki "göremedi" sonucu kilitten gelsin, boşluktan değil.
  insert into indirim_tanimlari (isletme_id, ad, tip, deger, sira)
    values (v_isletme, '~prova indirim', 'yuzde', 10, 9999);

  -- Açık hesap denemesi, açık hesap işaretli bir ödeme tipi olmadan tetiklenmiyor:
  -- tahsilat sıradan bir ödeme sayılır ve o kilit hiç sorulmaz.
  insert into odeme_tipleri (isletme_id, ad, renk, sira, sinif, acik_hesap, aktif)
    values (v_isletme, '~prova açık hesap', '#888888', 9999, 'klasik', true, true);

  -- "Kapanmış adisyonu yeniden açma" için kapalı bir adisyon da gerek.
  insert into adisyonlar (isletme_id, masa_ad, tip, durum, kapanis)
    values (v_isletme, '~prova kapalı', 'masa', 'kapali', now()) returning id into v_kapali;

  -- Kimlikleri komutlara yerleştir. Açık hesap denemesi işletmenin kendi açık
  -- hesap ödeme tipini kullanmalı; tanımlı değilse deneme anlamsız olur, onu
  -- sonuç tablosunda "sonuç yok" olarak göreceğiz.
  update prova_liste set komut =
    replace(replace(replace(replace(replace(replace(replace(replace(komut,
      '@MASA@',     v_masa::text),
      '@ADISYON@',  v_adisyon::text),
      '@KAPALI@',   v_kapali::text),
      '@TUR@',      v_tur::text),
      '@TUR2@',     v_tur2::text),
      '@KALEM@',    v_kalem::text),
      '@TAHSILAT@', v_tahsilat::text),
      '@KATEGORI@', v_kategori::text);

  update prova_liste set komut = replace(komut, '@ISLETME@', v_isletme::text);

  update prova_liste set komut = replace(komut, '@ACIKTIP@', quote_literal(coalesce(
      (select ad from odeme_tipleri where isletme_id = v_isletme and acik_hesap limit 1),
      '~acik-hesap-tipi-yok')))
   where komut like '%@ACIKTIP@%';

  -- Okuma denemelerinde karşılaştırma noktası: yöneticinin gördüğü satır sayısı.
  -- Tablo zaten boşsa "göremedi" sonucu kilitten değil verisizlikten gelir.
  for d in select kod, komut from prova_liste where tur = 'oku' loop
    begin
      execute d.komut into v_satir;
    exception when others then
      v_satir := null;
    end;
    update prova_liste set toplam = v_satir where kod = d.kod;
  end loop;

  -- 2.4) Kimliğe bürün -------------------------------------------------------
  --
  -- Buradan sonrası o personelin gördüğü veritabanı: auth.uid() onun, rol
  -- `authenticated`. Satır güvenliği ve yetki tetikleyicileri tam olarak
  -- canlıdaki gibi çalışıyor.

  -- Deneme listesi geçici bir tablo ve sahibi yönetici; rol değişince
  -- `authenticated` onu okuyamaz ve prova daha ilk satırda düşerdi. Tablonun
  -- kendisi yetmiyor, durduğu geçici şemaya da izin gerekiyor.
  execute format('grant usage on schema %I to authenticated',
    (select nspname from pg_namespace where oid = pg_my_temp_schema()));
  execute 'grant select on prova_liste to authenticated';

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_auth::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- 2.5) Denemeler -----------------------------------------------------------
  --
  -- İki tur. Birincide kişi olduğu gibi denenir. İkincide, kendi kilidine
  -- varmadan başka bir kilide takılan denemeler için önkoşul yetkisi geçici
  -- olarak verilir ve tekrar denenir — o kilitler yoksa hiç ölçülmemiş olurdu.
  -- Verilen yetki de en sonda geri alınıyor (her şey rollback'e gidiyor).

  for v_faz in 1..2 loop
  if v_faz = 2 then
    -- Yetki yazmak için önce yöneticiye dönülüyor: kimlik takılıyken
    -- personel_yetkileri tetikleyicisi tanim.personel istiyor ve kişide yok.
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);

    -- distinct şart: birden çok denemenin önkoşulu aynı yetki olabiliyor ve
    -- aynı satırı tek komutta iki kez eklemek hata veriyor.
    insert into personel_yetkileri (isletme_id, personel_id, yetki_id, izin)
    select distinct v_isletme, v_personel, y.id, true
      from prova_liste l
      cross join lateral unnest(l.onkosul) as o(kod)
      join yetkiler y on y.kod = o.kod
     where l.onkosul is not null
    on conflict (personel_id, yetki_id) do update set izin = true;

    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_auth::text, 'role', 'authenticated')::text,
      true
    );
    execute 'set local role authenticated';
    v_ikinci := true;
  end if;

  for d in
    select l.kod, l.tur, l.komut, l.toplam, l.ortak, l.gecti, l.beklenti,
           y.grup, y.ad as yetki, y.sira
      from prova_liste l
      left join yetkiler y on y.kod = l.kod
     where (v_faz = 1 and l.onkosul is null)
        or (v_faz = 2 and l.onkosul is not null)
     order by coalesce(y.sira, 9999), l.kod
  loop
    -- Kişide bu yetki var mı? Kural: rolden gelen temel, kişiye özel satır onu
    -- eziyor — yetkiler.ts'teki etkinYetkiler ile aynı.
    select
      coalesce(kisiye_ozel, rolden, false),
      kisiye_ozel is not null
      into v_var, v_ezildi
    from (
      select
        (select py.izin
           from personel_yetkileri py
           join yetkiler y on y.id = py.yetki_id
          where py.personel_id = v_personel and y.kod = d.kod) as kisiye_ozel,
        (select true
           from personel p
           join rol_yetkileri ry on ry.rol_id = p.rol_id
           join yetkiler y on y.id = ry.yetki_id
          where p.id = v_personel and y.kod = d.kod) as rolden
    ) k;

    -- Aynı kilidi açan başka bir yetkisi var mı? Varsa sunucunun izin vermesi
    -- beklenir; "yetkisi yok ama yapabildi" demek yanlış olur.
    select exists (
      select 1 from unnest(coalesce(d.ortak, '{}'::text[])) as o(kod)
       where coalesce(
         (select py.izin
            from personel_yetkileri py
            join yetkiler y on y.id = py.yetki_id
           where py.personel_id = v_personel and y.kod = o.kod),
         (select true
            from personel p
            join rol_yetkileri ry on ry.rol_id = p.rol_id
            join yetkiler y on y.id = ry.yetki_id
           where p.id = v_personel and y.kod = o.kod),
         false)
    ) into v_ortak;

    if d.beklenti is not null then
      -- Kısıtlayıcı yetki: başarı beklentisi başka bir yetkiden geliyor.
      select coalesce(
        (select py.izin
           from personel_yetkileri py
           join yetkiler y on y.id = py.yetki_id
          where py.personel_id = v_personel and y.kod = d.beklenti),
        (select true
           from personel p
           join rol_yetkileri ry on ry.rol_id = p.rol_id
           join yetkiler y on y.id = ry.yetki_id
          where p.id = v_personel and y.kod = d.beklenti),
        false
      ) into v_beklenen;
    else
      v_beklenen := v_var or v_ortak;
    end if;

    -- Denemeyi çalıştır. Yazma başarılı olsa bile sonunda bilerek hata
    -- fırlatılıyor: alt işlem geri sarılıyor, hiçbir deneme veriye yapışmıyor.
    begin
      if d.tur = 'oku' then
        execute d.komut into v_satir;
        raise exception 'PROVA_GERI_AL:%', v_satir;
      else
        execute d.komut;
        get diagnostics v_satir = row_count;
        raise exception 'PROVA_GERI_AL:%', v_satir;
      end if;
    exception
      when sqlstate '42501' then
        -- Hangi kilidin engellediğini mesajdan görüyoruz. Bir işlem birden çok
        -- yetkiye takılabiliyor (paket sipariş hem siparis.paket hem
        -- siparis.al istiyor); o zaman mesaj beklenenden başkasını söyler.
        v_durum := 'reddedildi: ' || left(sqlerrm, 48);
      when others then
        if d.gecti is not null and sqlerrm like '%' || d.gecti || '%' then
          -- Yetki kapısı açıldı, deneme sonraki adımda bilerek durdu.
          v_durum := 'yapabildi (yetki kapısı geçildi)';
        elsif sqlerrm like 'PROVA_GERI_AL:%' then
          v_satir := split_part(sqlerrm, ':', 2)::bigint;
          if d.tur = 'oku' then
            if d.toplam is null then
              v_durum := 'ölçülemedi';
            elsif d.toplam = 0 then
              v_durum := 'tablo boş — sonuç çıkmaz';
            elsif v_satir = 0 then
              v_durum := 'hiçbir satırı göremedi';
            elsif v_satir < d.toplam then
              v_durum := format('%s/%s satır gördü', v_satir, d.toplam);
            else
              v_durum := format('hepsini gördü (%s satır)', v_satir);
            end if;
          elsif v_satir = 0 then
            -- Satır güvenliği bir yazmayı engellediğinde hata döndürmüyor,
            -- sadece hiçbir satıra dokunmuyor. Yalnız hataya bakmak bunu
            -- kaçırır (16 Eyl'de bölge silme bu yüzden sessizce çalışmıyordu).
            v_durum := 'satır güvenliği durdurdu (0 satır)';
          else
            v_durum := format('yapabildi (%s satır)', v_satir);
          end if;
        elsif sqlerrm ilike '%yetki%' then
          -- Her kilit 42501 kullanmıyor; `yazici_hesabi_kur` düz hata
          -- fırlatıyor. Mesajda yetki geçiyorsa bu da bir rettir.
          v_durum := 'reddedildi: ' || left(sqlerrm, 48);
        else
          v_durum := format('başka hata: %s', left(sqlerrm, 70));
        end if;
    end;

    -- Değerlendirme ----------------------------------------------------------
    s.grup        := coalesce(d.grup, '(listede yok)');
    s.kod         := d.kod;
    s.yetki       := coalesce(d.yetki, d.kod);
    -- Kişiye özel satır rolü ezmiş mi? Kuralın kendisi de sınanıyor: ezilmiş
    -- satırda sunucunun davranışı kişiye özel değere uymalı, rolden gelene değil.
    s.yetkide_var := (case when v_var then 'VAR' else 'yok' end)
                  || (case when v_ezildi then ' (kişiye özel)' else '' end)
                  || (case when v_ortak and not v_var then ' — kilidi ortak' else '' end)
                  || (case when d.beklenti is not null then ' — kısıtlayıcı yetki' else '' end);
    s.sunucu      := v_durum
                  || (case when v_ikinci then ' [önkoşul verildi]' else '' end);

    if v_durum like 'başka hata%' or v_durum like 'tablo boş%' or v_durum = 'ölçülemedi' then
      s.sonuc := '— sonuç yok';
    elsif v_durum like 'yapabildi%' or v_durum like 'hepsini gördü%' then
      s.sonuc := case when v_beklenen then '✔ doğru' else '✘ AÇIK' end;
    elsif v_durum like '%satır gördü' then
      s.sonuc := case when v_beklenen then '✘ TERS' else '✔ doğru (kısıtlı)' end;
    else
      s.sonuc := case when v_beklenen then '✘ TERS' else '✔ doğru' end;
    end if;

    return next s;
  end loop;
  end loop;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  -- 2.6) Denemesi olmayan yetkiler -------------------------------------------
  -- Yetki listesine yeni madde eklenip provaya eklenmemişse burada görünür.
  -- Betik listeyi koddan değil `yetkiler` tablosundan okuduğu için bu kontrol
  -- kendini güncel tutuyor.

  for d in
    select y.grup, y.kod, y.ad
      from yetkiler y
     where not exists (select 1 from prova_liste l where l.kod = y.kod)
     order by y.sira
  loop
    s.grup        := d.grup;
    s.kod         := d.kod;
    s.yetki       := d.ad;
    s.yetkide_var := '';
    s.sunucu      := 'denemesi yok';
    s.sonuc       := '— betiğe eklenmeli';
    return next s;
  end loop;

  drop table prova_liste;
end;
$$;

-- Prova yönetim işi ve kimliğe bürünüyor: giriş yapmış sıradan kullanıcının
-- elinde olmasının anlamı yok.
revoke all on function yetki_provasi(text) from anon, authenticated, public;
