-- Ürün taşıma tek istekte (1 Eki 2026).
--
-- Taşıma tarayıcıdan sırayla on bir istekle yapılıyordu (adisyonu bul/aç,
-- tur aç, kalemi yaz, kaynaktan düş, boşalan adisyonu kapat...). Kasada 1,4
-- saniye sürüyordu, telefonda daha uzun. Hepsi bu fonksiyonda tek seferde.
--
-- Fonksiyon çağıranın yetkisiyle çalışıyor (security definer değil): RLS ve
-- kalem tetikleri tarayıcıdan yazılırken nasılsa öyle işliyor. Kaynaktan düşme
-- yine tasinan_kalemi_kaynaktan_dus'ta; taşıma yetkisi orada soruluyor. Artık
-- hepsi tek işlem: bir adım hata verirse yarım taşıma kalmıyor.

create or replace function kalem_tasi(
  p_kaynak_masa bigint,
  p_hedef_masa  bigint,
  p_kalem       bigint,
  p_adet        numeric
)
returns jsonb language plpgsql set search_path = public as $$
declare
  kaynak_id bigint;
  hedef_id  bigint;
  yeni_tur  bigint;
  kopya_id  bigint;
  k         adisyon_kalemleri;
begin
  if p_kaynak_masa = p_hedef_masa then
    raise exception 'Kalem zaten bu masada.';
  end if;

  select id into kaynak_id from adisyonlar where masa_id = p_kaynak_masa and durum = 'acik';
  if kaynak_id is null then
    raise exception 'Bu masada açık adisyon yok.';
  end if;

  select ak.* into k
    from adisyon_kalemleri ak
    join turlar t on t.id = ak.tur_id
   where ak.id = p_kalem and t.adisyon_id = kaynak_id;
  if not found then
    raise exception 'Kalem bulunamadı. Adisyonu kaydedip tekrar deneyin.';
  end if;

  select id into hedef_id from adisyonlar where masa_id = p_hedef_masa and durum = 'acik';
  if hedef_id is null then
    insert into adisyonlar (masa_id, indirim) values (p_hedef_masa, 0) returning id into hedef_id;
  end if;

  insert into turlar (adisyon_id, sira)
  values (hedef_id, coalesce((select max(sira) from turlar where adisyon_id = hedef_id), 0) + 1)
  returning id into yeni_tur;

  -- Kategori taşınan kalemden geliyor, yeniden hesaplanmıyor: ürün arada başka
  -- kategoriye alınmışsa iki masada iki ayrı kategori görünmesin.
  insert into adisyon_kalemleri (
    tur_id, tasindigi_kalem_id, urun_id, porsiyon_id, ad, kategori_ad, porsiyon,
    secimler, cikan_malzemeler, eklenen_malzemeler, adet, fiyat, kdv_oran, durum, not_metni
  )
  values (
    yeni_tur, k.id, k.urun_id, k.porsiyon_id, k.ad, k.kategori_ad, k.porsiyon,
    k.secimler, k.cikan_malzemeler, k.eklenen_malzemeler, least(p_adet, k.adet),
    k.fiyat, k.kdv_oran, k.durum, k.not_metni
  )
  returning id into kopya_id;

  perform tasinan_kalemi_kaynaktan_dus(kopya_id);

  -- Son kalem de gittiyse adisyon masayı işgal etmesin.
  if not exists (
    select 1 from adisyon_kalemleri ak join turlar t on t.id = ak.tur_id
     where t.adisyon_id = kaynak_id
  ) then
    delete from adisyonlar where id = kaynak_id;
    kaynak_id := null;
  end if;

  return jsonb_build_object('kaynak', kaynak_id, 'hedef', hedef_id);
end $$;

revoke all on function kalem_tasi(bigint, bigint, bigint, numeric) from anon, public;
grant execute on function kalem_tasi(bigint, bigint, bigint, numeric) to authenticated;
