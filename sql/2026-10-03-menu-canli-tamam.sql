-- Menü kopyasının okuduğu ama canlı yayında olmayan tablolar.
--
-- Cihazdaki tanım kopyası artık yeni tazelendiyse (2 dakika) yeniden
-- sorulmuyor; bayatlamaması tamamen canlı habere bağlı. Ürün görseli, reçete,
-- menü içeriği ve malzeme adı değişince haber gelmiyordu — önceden her ekran
-- açılışında arkadan okunduğu için fark edilmiyordu.

do $$
declare
  t text;
begin
  foreach t in array array[
    'urun_medya',
    'recete_satirlari',
    'malzemeler',
    'menu_gruplari',
    'menu_satirlari'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
