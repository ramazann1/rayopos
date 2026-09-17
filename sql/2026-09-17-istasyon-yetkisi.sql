-- İstasyon tabloları yetki sormuyordu.
--
-- 21 Ağustos'ta `mutfak_gruplari` → `istasyonlar`, `yazici_mutfak_gruplari` →
-- `yazici_istasyonlari` olarak adlandırıldı. 5 Eylül'de tanım tablolarına yetki
-- tetikleyicisi bağlanırken liste hâlâ eski adları kullanıyordu.
--
-- Bağlama yardımcısı olmayan tabloyu görünce sessizce atlıyor:
--
--   if to_regclass(tablo) is null then
--     raise notice 'Tablo bulunamadı, atlandı: %', tablo;
--
-- Göç "başarılı" göründü, iki not yazdı, kimse okumadı. O günden beri işletmeye
-- giriş yapan herkes — garson dahil — istasyon ekleyip silebiliyor, yazıcı
-- istasyon eşleşmesini değiştirebiliyordu. Satır güvenliği yalnız işletmeyi
-- ayırıyordu, işletme içinde kimin yapabileceğini kimse sormuyordu.
--
-- 17 Eylül'deki yetki provası bunu yakaladı: garson yetkisiyle yeni istasyon
-- açılabildi. Kodu okuyarak görünmüyordu, çünkü eksik olan kod değil, kurulmamış
-- bir tetikleyiciydi.

-- 1) Sessiz atlama bitiyor ---------------------------------------------------
--
-- Asıl mesele tek bir tablo adı değil, hatanın duyulmaması. Bundan sonra olmayan
-- tabloya bağlanmaya çalışmak göçü durduruyor: bir tablo yeniden adlandırılırsa
-- sorun kurulumda patlar, aylar sonra yetki provasında değil.

create or replace function tanim_yetkisi_bagla(tablo text, kod text, mesaj text)
returns void language plpgsql as $$
begin
  if to_regclass(tablo) is null then
    raise exception 'Yetki bağlanacak tablo yok: %. Adı değiştiyse listeyi güncelle.', tablo;
  end if;
  execute format('drop trigger if exists %I on %I', tablo || '_yetki', tablo);
  execute format(
    'create trigger %I before insert or update or delete on %I
       for each row execute function tanim_yetkisi(%L, %L)',
    tablo || '_yetki', tablo, kod, mesaj
  );
end;
$$;

revoke all on function tanim_yetkisi_bagla(text, text, text) from anon, authenticated, public;

-- 2) Eksik iki bağlama -------------------------------------------------------

select tanim_yetkisi_bagla(
  'istasyonlar', 'yazici.yonet', 'İstasyon ayarlarını değiştirme yetkiniz yok.');

select tanim_yetkisi_bagla(
  'yazici_istasyonlari', 'yazici.yonet', 'Yazıcı ayarlarını değiştirme yetkiniz yok.');

-- 3) Kontrol -----------------------------------------------------------------
-- Tetikleyici bağlanmış tanım tablolarının tamamı. İstasyon satırlarının
-- listede görünmesi gerekiyor; görünmüyorsa yukarısı çalışmamıştır.

select c.relname as tablo, t.tgname as tetikleyici
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal
   and t.tgname like '%\_yetki'
 order by c.relname;
