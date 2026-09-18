-- Giriş yapmamış ziyaretçinin çağırabildikleri yeniden kapatılıyor.
--
-- 1 Eylül'de (guvenlik-sikilastirma, bölüm 3) tam bu iş yapılmıştı: bütün
-- fonksiyonlar `anon` ve `public` rolünden kapatılmış, sonra giriş ekranının
-- gerçekten ihtiyaç duyduğu üç tanesi tek tek açılmıştı.
--
-- 18 Eylül denetiminde çıktı ki o günden sonra eklenen 32 fonksiyon yine
-- herkese açık doğmuş. Sebep Postgres'in kuralı: bir fonksiyona hiç yetki
-- yazılmazsa `public` rolüne, yani anonim anahtarla gelen isteğe de açılıyor.
-- Yani bu bir kerelik iş değil, her yeni fonksiyonda tekrarlanan bir sızıntı.
--
-- Bugün istismar edilebilir bir tanesi yok: yarısı tetikleyici fonksiyonu
-- (dışarıdan çağrılınca "trigger functions can only be called as triggers"
-- diyor), diğer yarısı ilk satırında `oturum_isletmesi()` boş mu diye bakıp
-- hata veriyor. Ama ölçü bu değil — tek bir unutulmuş kontrol yeterdi.
--
-- Bu yüzden yine tek tek değil süpürerek kapatılıyor: bugün gözden kaçan ya
-- da yarın eklenecek fonksiyon da kapalı kalsın.

-- 1) Hepsi kapanıyor -------------------------------------------------------

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as imza
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from anon, public', f.imza);
  end loop;
end $$;

-- 2) Giriş yapmadan çağrılan üç fonksiyon geri açılıyor --------------------
--
-- Giriş ekranı: "hiç hesap açılmış mı" ve "bu telefona hangi hesap adresi
-- karşılık geliyor". QR menü: masadaki karekodu okutan müşterinin hesabı yok,
-- menüyü bu fonksiyon veriyor.
--
-- `isletme_kur` bilerek listede yok: 16 Eylül'de dışarıdan işletme açma
-- kapatıldı (kayit-kapat.sql), satışa geçilince oradan açılacak.

grant execute on function giris_kuruldu() to anon, authenticated;
grant execute on function eposta_hesabi(text) to anon, authenticated;
grant execute on function qr_menu(text) to anon;

-- 3) Üyeye açık kalması gerekenler ------------------------------------------
--
-- Süpürme `public` rolünü de kapsadığı için, yetkisi yalnız oradan gelen
-- fonksiyonlar üyeye de kapanırdı. 1 Eylül'den sonra eklenenler burada tek
-- tek geri veriliyor; hepsi programın ya da satır güvenliğinin gerçekten
-- çağırdıkları.

-- Satır güvenliği politikalarının içinden çağrılanlar. Politika, sorguyu
-- yapan kişinin yetkisiyle değerlendiriliyor; bu yetki alınırsa kimse kendi
-- adisyonunu bile okuyamaz.
grant execute on function adisyon_okunur(text) to authenticated;
grant execute on function adisyon_okunur_id(bigint) to authenticated;
grant execute on function turun_adisyonu(bigint) to authenticated;
grant execute on function oturum_yetkilerinden_biri(text[]) to authenticated;

-- Tetikleyici gövdelerinden çağrılanlar.
grant execute on function indirim_denetle(numeric, bigint) to authenticated;
grant execute on function urunun_istasyonu(bigint) to authenticated;
grant execute on function odenmez_kullanimda(bigint) to authenticated;

-- Ekrandan doğrudan çağrılan: işletme ayarlarında QR menü kodunu yeniler.
grant execute on function qr_menu_kodu_uret() to authenticated;

-- Köprünün (yazıcı programı) kuyruktan iş çekmesi. Köprü de kendi hesabıyla
-- giriş yapıyor, yani onun için de `authenticated`. Unutulursa fiş basmaz.
grant execute on function kuyruktan_al(text, int) to authenticated;

-- Tetikleyici fonksiyonlarına yetki verilmiyor: tetikleyici ateşlerken
-- çağıranın EXECUTE yetkisine bakılmıyor, yetki yalnız `create trigger`
-- anında sınanıyor. 1 Eylül'deki süpürmeden beri böyle çalışıyorlar.
