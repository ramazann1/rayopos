-- Gel al ve paket için günlük numara.
--
-- Adisyon numarası (3200, 3201...) kalıcı ve hiç tekrarlanmıyor; rapor, iade ve
-- arama onunla. Ama tezgâhta müşteriye "12 numara hazır" deniyor, kuryeye
-- "15'i al" — dört beş haneli sayı bağırılmıyor. Günlük numara yalnız gel al
-- ve pakete veriliyor, masanın zaten adı var.
--
-- Sayaç kasa günüyle başa dönüyor, takvim günüyle değil: 08:00'de açılan
-- işletmede gece 01:00'deki sipariş önceki günün sırasından devam ediyor.

alter table adisyonlar add column if not exists gunluk_no int;

alter table isletmeler add column if not exists son_gunluk_no int not null default 0;
alter table isletmeler add column if not exists gunluk_no_gunu date;

create or replace function gunluk_no_ver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  baslangic time;
  gun date;
begin
  if new.tip = 'masa' or new.gunluk_no is not null then return new; end if;

  select coalesce(a.kasa_gunu_baslangic, '08:00') into baslangic
    from isletme_ayarlari a where a.isletme_id = new.isletme_id;
  gun := ((now() at time zone 'Europe/Istanbul') - coalesce(baslangic, '08:00')::interval)::date;

  -- Satır güncellenirken kilitleniyor: iki kasa aynı anda açsa da numara çakışmıyor.
  update isletmeler
     set son_gunluk_no = case when gunluk_no_gunu = gun then son_gunluk_no + 1 else 1 end,
         gunluk_no_gunu = gun
   where id = new.isletme_id
   returning son_gunluk_no into new.gunluk_no;

  return new;
end;
$$;

drop trigger if exists gunluk_no_tetik on adisyonlar;
create trigger gunluk_no_tetik before insert on adisyonlar
  for each row execute function gunluk_no_ver();
