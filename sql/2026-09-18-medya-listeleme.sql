-- Ürün görselleri artık dışarıdan listelenemiyor.
--
-- Supabase denetçisi yakaladı ("Public Bucket Allows Listing"), 18 Eylül.
-- Benim denetim betiğim kaçırmıştı: o yalnız `public` şemasına bakıyor,
-- dosya deposu ayrı bir şemada (`storage`).
--
-- 11 Eylül'de kova şöyle kurulmuştu:
--   create policy menu_medya_oku on storage.objects for select
--     using (bucket_id = 'menu');
--
-- Klasör ayrımı yok — yani anonim anahtarla gelen biri kovadaki **bütün
-- işletmelerin** dosyalarının listesini çekip hepsini indirebiliyordu.
-- Yazma ve silme kuralları baştan doğruydu, kendi klasörüyle sınırlı;
-- gözden kaçan yalnız okuma tarafı.
--
-- Karekod menüsü bundan etkilenmiyor. Kova `public = true` olduğu için
-- görseller doğrudan adresinden servis ediliyor (`/object/public/menu/...`),
-- o yol satır güvenliğine hiç bakmıyor. Program da zaten dosya listelemiyor:
-- `src/medya.ts` yalnız `getPublicUrl` (adresi kendisi kuruyor, istek bile
-- atmıyor), `upload` ve `remove` kullanıyor.
--
-- Okuma yine de tamamen kapatılmıyor, üyeye kendi klasörü için bırakılıyor:
-- depodan silme, silmeden önce dosyayı okuyor. Kural kaldırılsaydı menüden
-- çıkarılan görsel depoda kalırdı.

drop policy if exists menu_medya_oku on storage.objects;

create policy menu_medya_oku on storage.objects for select to authenticated
  using (bucket_id = 'menu' and (storage.foldername(name))[1] = oturum_isletmesi()::text);
