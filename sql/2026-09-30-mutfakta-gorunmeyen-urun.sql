-- "Mutfak ekranında" anahtarı kapalı ürün hiçbir tezgâha gitmiyor: ne mutfak
-- fişine yazılıyor ne istasyon ekranında görünüyor. Kategorisine istasyon
-- tanımlanmış olsa bile tek tek ürünü dışarıda bırakmanın yolu bu.
--
-- Kategorinin anahtarı kapalıysa o kategori istasyonunu ürünlerine
-- devretmiyor; ürünün kendi istasyonu varsa o yine geçerli.

create or replace function urunun_istasyonu(p_urun_id bigint)
returns bigint language sql stable security definer set search_path = public as $$
  select case
    when (select u.mutfakta_gorunur from urunler u where u.id = p_urun_id) is false then null
    else coalesce(
      (select u.istasyon_id from urunler u where u.id = p_urun_id),
      (select k.istasyon_id
         from urun_kategorileri uk
         join kategoriler k on k.id = uk.kategori_id
        where uk.urun_id = p_urun_id
          and k.istasyon_id is not null
          and k.mutfakta_gorunur is not false
        order by uk.sira, uk.kategori_id
        limit 1)
    )
  end;
$$;

-- Anahtar değişince henüz hazırlanmamış kalemler de yerini buluyor.
drop trigger if exists urun_istasyonu_degisti on urunler;
create trigger urun_istasyonu_degisti
  after update of istasyon_id, mutfakta_gorunur on urunler
  for each statement execute function bekleyen_kalem_istasyonlari();

drop trigger if exists kategori_istasyonu_degisti on kategoriler;
create trigger kategori_istasyonu_degisti
  after update of istasyon_id, mutfakta_gorunur on kategoriler
  for each statement execute function bekleyen_kalem_istasyonlari();
