-- Arama yolu yazılmamış on üç fonksiyon tamamlanıyor.
--
-- 18 Eylül denetiminde çıktı. Bir fonksiyonda `search_path` yazılı değilse
-- gövdesindeki `personel`, `urunler` gibi nitelenmemiş adlar, çağıranın o
-- anki arama yoluna göre çözülüyor. Çağıran yolu değiştirirse fonksiyon
-- başka bir şemadaki aynı adlı tabloya yazabilir.
--
-- On üçü de `security invoker`, yani çağıranın kendi yetkisiyle çalışıyorlar:
-- buradan yetki yükseltilemez, kimse kendi hakkından fazlasını yapamaz.
-- `security definer` olanların hepsinde yol zaten yazılı — asıl tehlikeli
-- olan taraf kapalıydı. Bu, kalan eksiğin kapatılması.
--
-- Gövdeler yeniden yazılmıyor: `alter function ... set` yalnız fonksiyonun
-- ayarını değiştiriyor, kodu olduğu gibi kalıyor. Hiçbiri şifreleme
-- kullanmadığı için `extensions` şemasına ihtiyaç yok, `public` yetiyor.

alter function adisyon_no_ver()                                 set search_path = public;
alter function siparis_no_ver()                                 set search_path = public;
alter function tahsilat_no_ver()                                set search_path = public;
alter function urun_medya_siniri()                              set search_path = public;

alter function hesap_epostasi(text)                             set search_path = public;
alter function istek_ip()                                       set search_path = public;
alter function qr_menu_kodu_uret()                              set search_path = public;

alter function kopru_bildir(text, text, text)                   set search_path = public;
alter function kopru_kapandi(text)                              set search_path = public;
alter function yazici_durum_bildir(bigint, text, boolean, text) set search_path = public;

alter function okuma_yetkisi_bagla(text, text[])                set search_path = public;
alter function tanim_yetkisi_bagla(text, text, text)            set search_path = public;
alter function yetki_provasi(text)                              set search_path = public;
