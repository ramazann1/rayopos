-- Müşteri ekranından geçmiş adisyon açılabiliyor.
--
-- Müşteri kartı geçmiş adisyonları listeliyor, ama kapanmış adisyonu okuma
-- kuralı "Müşterileri görme" yetkisine bakmıyordu. Yalnız o yetkisi olan
-- kişi listeye basınca boş ekran görürdü.
--
-- Yetki bütün kapanmış adisyonları açmıyor, yalnız bir müşteriye bağlı
-- olanları: müşteri kartında görünenler bunlar. Ciro yine rapor yetkisinde.

create or replace function adisyon_okunur(durum text, musteri bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select adisyon_okunur(durum)
      or (musteri is not null and oturum_yetkilerinden_biri(array['cari.gor']));
$$;

create or replace function adisyon_okunur_id(a_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from adisyonlar a
     where a.id = a_id
       and a.isletme_id = oturum_isletmesi()
       and adisyon_okunur(a.durum, a.musteri_id)
  );
$$;

drop policy if exists adisyonlar_oku on adisyonlar;
create policy adisyonlar_oku on adisyonlar for select to authenticated
  using (isletme_id = oturum_isletmesi() and adisyon_okunur(durum, musteri_id));
