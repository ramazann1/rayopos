-- 15003 dışındaki bütün işletmeleri ve onlara ait her satırı siler.
-- Bazı eski tablolarda isletme_id bağı "on delete cascade" değil, tablolar
-- da birbirine bağlı; bu yüzden isletme_id taşıyan her tablo, silinemeyen
-- kalmayana kadar tekrar tekrar deneniyor. Sonunda bir şey kalırsa işlem
-- hata verip tamamen geri alınır, yarım silme olmaz.
--
-- Bu işletmelerin personel giriş hesapları da (auth.users) silinir;
-- 15003'te de kullanılan bir hesap varsa ona dokunulmaz.

do $$
declare
  kalan_id  bigint := (select id from isletmeler where kod = 15003);
  hesaplar  uuid[];
  t         text;
  tur       int := 0;
  bekleyen  int;
begin
  if kalan_id is null then
    raise exception '15003 kodlu işletme bulunamadı, hiçbir şey silinmedi';
  end if;

  select coalesce(array_agg(distinct auth_id), '{}') into hesaplar
    from personel
   where isletme_id <> kalan_id and auth_id is not null
     and auth_id not in (select auth_id from personel
                          where isletme_id = kalan_id and auth_id is not null);

  loop
    tur := tur + 1;
    bekleyen := 0;

    for t in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables tb
          on tb.table_schema = c.table_schema and tb.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'isletme_id'
         and tb.table_type = 'BASE TABLE'
    loop
      begin
        execute format('delete from %I where isletme_id <> $1', t) using kalan_id;
      exception when foreign_key_violation then
        bekleyen := bekleyen + 1;
      end;
    end loop;

    begin
      delete from isletmeler where id <> kalan_id;
    exception when foreign_key_violation then
      bekleyen := bekleyen + 1;
    end;

    exit when bekleyen = 0;
    if tur >= 20 then
      raise exception '20 turda bitmedi, % tablo hâlâ bağlı; hiçbir şey silinmedi', bekleyen;
    end if;
  end loop;

  delete from auth.users where id = any (hesaplar);

  raise notice 'Bitti: % turda silindi, % giriş hesabı kaldırıldı', tur, cardinality(hesaplar);
end $$;

select id, kod, ad from isletmeler;
