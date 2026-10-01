-- Adisyon okuma kuralları sorgu başına bir kez hesaplanıyor.
--
-- Eski kurallar her satırda baştan çalışıyordu: bir adisyon için altı yetki
-- tek tek soruluyor, her soru oturumdaki kişiyi ve cihazı yeniden buluyordu.
-- Tur, kalem ve tahsilat satırları da her biri için adisyona dönüp aynı
-- hesabı tekrarlıyordu. 584 kalem 2,8 saniye sürüyordu; aylık raporda
-- binlerce kalem dakikalar demek.
--
-- Kimin neyi göreceği değişmiyor. Değişen, kişiye bağlı soruların
-- `(select ...)` içinde yazılması: PostgreSQL bunu sorgunun başında bir kez
-- hesaplayıp sonucu bütün satırlara kullanıyor. Alt tablolar da kendi
-- hesaplarını yapmak yerine "üstteki satır okunabiliyor mu" diye bakıyor;
-- o bakış adisyonun kendi kuralından geçiyor, kural tek yerde kalıyor.

create or replace function adisyon_acik_okunur()
returns boolean language sql stable security definer set search_path = public as $$
  select oturum_yetkilerinden_biri(array[
    'siparis.al', 'odeme.al', 'mutfak.ekran', 'kasa.ac_kapat',
    'rapor.gun_sonu', 'rapor.tumu'
  ]);
$$;

create or replace function adisyon_kapali_okunur()
returns boolean language sql stable security definer set search_path = public as $$
  select oturum_yetkilerinden_biri(array[
    'siparis.aktif_et', 'odeme.tip_duzelt', 'odeme.iade',
    'kasa.ac_kapat', 'rapor.gun_sonu', 'rapor.tumu'
  ]);
$$;

-- Eski fonksiyon başka yerlerden de çağrılıyor; liste tek yerde kalsın.
create or replace function adisyon_okunur(durum text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when durum = 'acik' then adisyon_acik_okunur() else adisyon_kapali_okunur() end;
$$;

revoke all on function adisyon_acik_okunur() from anon, public;
revoke all on function adisyon_kapali_okunur() from anon, public;
grant execute on function adisyon_acik_okunur() to authenticated;
grant execute on function adisyon_kapali_okunur() to authenticated;

drop policy if exists adisyonlar_oku on adisyonlar;
create policy adisyonlar_oku on adisyonlar for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and (
      case when durum = 'acik'
        then (select adisyon_acik_okunur())
        else (select adisyon_kapali_okunur())
      end
      or ((select oturum_yetkilerinden_biri(array['cari.gor']))
          and cari_adisyonu(id, musteri_id))
    )
  );

drop policy if exists turlar_oku on turlar;
create policy turlar_oku on turlar for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and exists (select 1 from adisyonlar a where a.id = turlar.adisyon_id)
  );

drop policy if exists tahsilatlar_oku on tahsilatlar;
create policy tahsilatlar_oku on tahsilatlar for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and exists (select 1 from adisyonlar a where a.id = tahsilatlar.adisyon_id)
  );

drop policy if exists adisyon_kalemleri_oku on adisyon_kalemleri;
create policy adisyon_kalemleri_oku on adisyon_kalemleri for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and exists (select 1 from turlar t where t.id = adisyon_kalemleri.tur_id)
  );

drop policy if exists kalem_maliyetleri_isletme on kalem_maliyetleri;
create policy kalem_maliyetleri_isletme on kalem_maliyetleri for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and (select oturum_yetkisi('stok.yonet'))
  );
