-- Müşteri listesindeki açık hesap ve cüzdan bakiyeleri veritabanında
-- toplanıyor. Eskiden bütün hareketler cihaza çekilip orada toplanıyordu;
-- Supabase tek okumada en fazla 1000 satır verdiği için hareket sayısı bunu
-- geçince bakiyeler sessizce eksik çıkıyordu.
--
-- security invoker: okuma kişinin kendi yetkisiyle yapılıyor, her işletme
-- yalnız kendi hareketlerini görüyor.

create or replace function musteri_bakiyeleri()
returns table (musteri_id bigint, bakiye numeric, cuzdan numeric)
language sql stable security invoker set search_path = public as $$
  with cari as (
    select musteri_id, sum(alacak) - sum(borc) as bakiye
      from cari_hareketler
     group by musteri_id
  ),
  sadakat as (
    select musteri_id, sum(tutar) as cuzdan
      from sadakat_hareketleri
     group by musteri_id
  )
  select coalesce(c.musteri_id, s.musteri_id),
         coalesce(c.bakiye, 0),
         coalesce(s.cuzdan, 0)
    from cari c
    full join sadakat s on s.musteri_id = c.musteri_id;
$$;

grant execute on function musteri_bakiyeleri() to authenticated;
