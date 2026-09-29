-- Köprü kendi bağlantısını kestiğinde hesabı da silinsin.
--
-- Köprüde "Bağlantıyı kes" yalnız bilgisayardaki bilgileri siliyordu; hesap
-- RayoPOS'taki Kasa köprüleri listesinde kalıyor, orada ayrıca silinmesi
-- gerekiyordu. Artık köprü giderken kendi hesabını da götürüyor.
--
-- Yalnız çağıranın kendi kaydı ve yalnız sistem hesabıysa siliniyor: bir
-- personel bu işlevle kendini silemez. Hesabı `personel_hesabi_sil`
-- tetikleyicisi siliyor.

create or replace function kopru_kendini_kaldir()
returns void language sql volatile security definer
set search_path = public as $$
  delete from personel where auth_id = auth.uid() and sistem;
$$;

revoke all on function kopru_kendini_kaldir() from anon, public;
grant execute on function kopru_kendini_kaldir() to authenticated;
