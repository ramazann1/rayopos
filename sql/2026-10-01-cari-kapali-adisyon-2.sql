-- Müşteri ekranından geçmiş adisyon: açık hesaba aktarılanlar da.
--
-- İlk dosya yalnız müşteri seçilerek açılmış adisyonlara bakıyordu. Müşteri
-- kartının listesi ise açık hesap hareketlerinden geliyor ve açık hesaba
-- aktarılan adisyonda müşteri adisyonun kendisine yazılmıyor. O adisyonlar
-- listede görünüp açılmıyordu.

drop policy if exists adisyonlar_oku on adisyonlar;

create or replace function cari_adisyonu(a_id bigint, musteri bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select musteri is not null or exists (
    select 1 from cari_hareketler h
     where h.adisyon_id = a_id and h.isletme_id = oturum_isletmesi()
  );
$$;

create or replace function adisyon_okunur_id(a_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from adisyonlar a
     where a.id = a_id
       and a.isletme_id = oturum_isletmesi()
       and (adisyon_okunur(a.durum)
            or (oturum_yetkilerinden_biri(array['cari.gor'])
                and cari_adisyonu(a.id, a.musteri_id)))
  );
$$;

drop function if exists adisyon_okunur(text, bigint);

create policy adisyonlar_oku on adisyonlar for select to authenticated
  using (
    isletme_id = oturum_isletmesi()
    and (adisyon_okunur(durum)
         or (oturum_yetkilerinden_biri(array['cari.gor'])
             and cari_adisyonu(id, musteri_id)))
  );
