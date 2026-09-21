-- Mobil mi masaüstü mü sorusunun cevabını bugüne kadar yalnız ekran genişliği
-- veriyordu (820 px). Cihaz ölçüsü işi temsil etmiyor: 10 inçlik tablette
-- duran kasiyer mobil arayüze düşüyor, elindeki büyük telefonla masa gezen
-- garson masaüstüne. Karar işletmecinin olsun.
--
-- 'ekran'    = eski davranış, genişliğe bakılır (varsayılan)
-- 'mobil'    = kişi hangi cihazda girerse girsin mobil arayüz
-- 'masaustu' = her zaman masaüstü
alter table personel
  add column if not exists arayuz text not null default 'ekran';

alter table personel drop constraint if exists personel_arayuz_gecerli;
alter table personel add constraint personel_arayuz_gecerli
  check (arayuz in ('ekran', 'mobil', 'masaustu'));

-- `personel` tablosunda yetkiler sütun sütun veriliyor (bkz. 2026-09-02
-- pin-sertlestirme). Yeni sütun o listeye kendiliğinden girmiyor; yetki
-- verilmezse arayüz alanı ne okunabilir ne yazılabilir. Aynı blok tekrar
-- çalıştırılıyor, listeyi tablonun güncel hâlinden üretiyor.
do $$
declare
  okunabilir text;
  yazilabilir text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into okunabilir
    from information_schema.columns
   where table_schema = 'public' and table_name = 'personel'
     and column_name <> 'pin_hash';

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into yazilabilir
    from information_schema.columns
   where table_schema = 'public' and table_name = 'personel'
     and column_name <> 'pin_hash'
     and is_generated = 'NEVER';

  revoke select, insert, update on personel from authenticated;

  execute format('grant select (%s) on personel to authenticated', okunabilir);
  execute format('grant insert (%s) on personel to authenticated', yazilabilir);
  execute format('grant update (%s) on personel to authenticated', yazilabilir);
end $$;
