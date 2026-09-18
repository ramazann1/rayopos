-- Veritabanı toplu denetimi — YALNIZ OKUMA, hiçbir şeyi değiştirmez.
--
-- 18 Eylül'deki cihaz hatası (bir cihazda kişi değiştirince öbür cihazın
-- kişisi ve yetkileri de değişiyordu) gibi sessiz duran başka sorun var mı
-- diye bakıyor. O hatanın sınıfı şu: bir durum yanlış anahtara bağlanmış —
-- cihaz yerine hesaba, kişi yerine işletmeye. Aşağıdaki bölümler önce bu
-- sınıfı, sonra klasik açıkları tarıyor.
--
-- Tek sorgu, tek sonuç tablosu: (bolum, konu, detay). Supabase SQL Editor
-- birden çok sorguda yalnız sonuncunun sonucunu gösterdiği için hepsi
-- `union all` ile birleştirildi.

with
tablolar as (
  select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
),
fonksiyonlar as (
  select p.oid, p.proname, p.prosecdef, p.proconfig, p.prosrc, p.proacl, p.proowner,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as imza
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
),

-- A) Satır güvenliği hiç açılmamış ya da açık ama kuralsız tablolar.
--    Kuralsız RLS = kimse okuyamaz; kapalı RLS = herkes okur. İkisi de hata.
a_rls as (
  select 'A. Satır guvenligi' as bolum,
         t.relname as konu,
         case when not t.relrowsecurity
              then 'RLS KAPALI — bu tabloyu her hesap okuyabilir'
              else 'RLS açık ama hiç kural yok — kimse okuyamaz' end as detay
    from tablolar t
   where not t.relrowsecurity
      or not exists (select 1 from pg_policy p where p.polrelid = t.oid)
),

-- B) Kiracı sütunu olmayan tablolar. Ürün başka işletmelere satılacak;
--    süzgeci olmayan tablo bir işletmenin verisini ötekine gösterir.
b_isletme as (
  select 'B. Isletme ayrimi', t.relname,
         'isletme_id / auth_id sütunu yok — kiracı süzgeci neye dayanıyor?'
    from tablolar t
   where not exists (
          select 1 from pg_attribute a
           where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
             and a.attname in ('isletme_id', 'auth_id'))
),

-- C) Kural ifadesinde ne işletme ne kullanıcı geçen politikalar.
--    Böyle bir kural pratikte "herkese açık" demek.
c_politika as (
  select 'C. Suzgecsiz kural',
         p.polrelid::regclass::text || ' / ' || p.polname,
         'ifade: ' || left(coalesce(pg_get_expr(p.polqual, p.polrelid),
                                    pg_get_expr(p.polwithcheck, p.polrelid),
                                    '(yok)'), 140)
    from pg_policy p
    join tablolar t on t.oid = p.polrelid
   where coalesce(pg_get_expr(p.polqual, p.polrelid), '')
      || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
         !~* '(isletme|auth\.uid|oturum_|yetki|personel)'
),

-- D) Aynı adla birden fazla fonksiyon. Eski imza silinmediyse çağrı eskisine
--    düşebilir; `yazici.yonet` hatasının akrabası.
d_cift as (
  select 'D. Cift tanim', f.proname,
         count(*) || ' ayrı imza duruyor: ' ||
         string_agg(pg_get_function_identity_arguments(f.oid), '  |  ')
    from fonksiyonlar f
   group by f.proname
  having count(*) > 1
),

-- E) `security definer` olup `search_path` yazılmamış fonksiyonlar.
--    Sahibinin yetkisiyle çalışır; arama yolu sabit değilse başka şemadaki
--    sahte tablo çağrılabilir.
e_yol as (
  select 'E. Arama yolu', f.imza,
         'security definer ama search_path yazılmamış'
    from fonksiyonlar f
   where f.prosecdef
     and (f.proconfig is null
          or not exists (select 1 from unnest(f.proconfig) x where x like 'search\_path=%'))
),

-- F) Herkese / anon'a açık fonksiyonlar. 1 Eylül kuralı: yeni fonksiyon
--    yetki yazılmazsa herkese açık doğuyor.
f_acik as (
  select 'F. Acik fonksiyon', f.imza,
         'execute yetkisi: ' || string_agg(distinct
           case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, ', ')
    from fonksiyonlar f
    cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
   where a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or pg_get_userbyid(a.grantee) = 'anon')
   group by f.imza
),

-- G) Fonksiyon gövdesinde geçen ama artık var olmayan tablo adları.
--    21 Ağustos'taki yeniden adlandırmadan kalan artıklar burada çıkar.
--    Eleme kaba: yerel değişken ve CTE adları da düşebilir, elle doğrulanır.
g_adaylar as (
  select f.proname as fn, lower(m[1]) as ad
    from fonksiyonlar f,
         lateral regexp_matches(f.prosrc,
           '(?:\mfrom|\mjoin|\mupdate|\minsert\s+into|\mdelete\s+from)\s+([a-z_][a-z0-9_]*)',
           'gi') m
),
g_varliklar as (
  select lower(c.relname) as ad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'auth', 'storage', 'extensions', 'pg_catalog', 'realtime')
),
g_yok as (
  select distinct 'G. Yok olan tablo' as bolum, g.fn,
         'gövdede geçiyor ama tablo/görünüm yok: ' || g.ad
    from g_adaylar g
   where g.ad not in (select ad from g_varliklar)
     and g.ad not in ('select','values','only','lateral','unnest','set','conflict',
                      'table','temp','strict','each','rows','row','generate_series',
                      'jsonb_array_elements','json_array_elements','string_to_table',
                      'regexp_matches','dual','new','old','x','t','v','q','s','r')
),

-- H) Devre dışı bırakılmış tetikleyiciler. Kilit duruyor görünür, çalışmaz.
h_tetik as (
  select 'H. Tetikleyici',
         t.tgrelid::regclass::text || ' / ' || t.tgname,
         case t.tgenabled when 'D' then 'DEVRE DIŞI'
                          when 'R' then 'yalnız replica'
                          when 'A' then 'her zaman (replica dahil)'
                          else 'durum kodu: ' || t.tgenabled::text end
    from pg_trigger t
   where not t.tgisinternal and t.tgenabled <> 'O'
     and t.tgrelid in (select oid from tablolar)
),

-- I) Cihaz sınıfı: hesap başına tutulan durum tabloları. Her biri için soru
--    şu — iki cihaz aynı hesapla girerse birbirini ezer mi?
i_cihaz as (
  select 'I. Cihaz ayrimi', t.relname,
         'auth_id var, cihaz_id yok — iki cihaz aynı satırı paylaşıyor mu?'
    from tablolar t
   where exists (select 1 from pg_attribute a
                  where a.attrelid = t.oid and a.attname = 'auth_id'
                    and a.attnum > 0 and not a.attisdropped)
     and not exists (select 1 from pg_attribute a
                      where a.attrelid = t.oid and a.attname = 'cihaz_id'
                        and a.attnum > 0 and not a.attisdropped)
),

-- J) `_id` ile biten ama yabancı anahtarı olmayan sütunlar: yetim satır
--    üretebilecek yerler.
j_bagsiz as (
  select 'J. Bagsiz sutun',
         t.relname || '.' || a.attname,
         'yabancı anahtar yok — silinen kayda bağlı satır kalabilir'
    from tablolar t
    join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
   where a.attname like '%\_id'
     and a.attname <> 'auth_id'
     and not exists (select 1 from pg_constraint k
                      where k.conrelid = t.oid and k.contype = 'f'
                        and a.attnum = any (k.conkey))
),

-- K) Görünümler. Sahibinin yetkisiyle okunan görünüm RLS'i atlar.
k_gorunum as (
  select 'K. Gorunum', c.relname,
         'security_invoker kapalı — sahibinin yetkisiyle okunuyor, RLS atlanabilir'
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v', 'm')
     and not coalesce((select option_value = 'true'
                         from pg_options_to_table(c.reloptions)
                        where option_name = 'security_invoker'), false)
),

-- L) anon (giriş yapmamış ziyaretçi) hangi tabloya erişiyor. QR menü için
--    birkaçı beklenir; gerisi sızıntıdır.
l_anon as (
  select 'L. anon erisimi', t.relname,
         'anon yetkisi: ' || string_agg(y.ad, ', ')
    from tablolar t
    cross join lateral (
      select unnest(array['select','insert','update','delete']) as ad) y
   where has_table_privilege('anon', t.oid, y.ad)
   group by t.relname
),

-- M) Yabancı anahtarı olup dizini (index) olmayan sütunlar. Hata değil ama
--    ana tablodan silme yaparken tabloyu baştan sona tarar.
m_dizin as (
  select 'M. Dizinsiz bag',
         t.relname || '.' || a.attname,
         'yabancı anahtar var, dizin yok — silme/arama yavaş'
    from pg_constraint k
    join tablolar t on t.oid = k.conrelid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = k.conkey[1]
   where k.contype = 'f' and array_length(k.conkey, 1) = 1
     and not exists (select 1 from pg_index i
                      where i.indrelid = t.oid and i.indkey[0] = a.attnum)
)

select * from a_rls
union all select * from b_isletme
union all select * from c_politika
union all select * from d_cift
union all select * from e_yol
union all select * from f_acik
union all select * from g_yok
union all select * from h_tetik
union all select * from i_cihaz
union all select * from j_bagsiz
union all select * from k_gorunum
union all select * from l_anon
union all select * from m_dizin
order by 1, 2;
