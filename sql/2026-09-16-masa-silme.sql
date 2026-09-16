-- Masa silinince geçmiş adisyonların bağı kopsun, adı kalsın.
--
-- Bölge silme hiç çalışmıyordu: bölge → masalar zaten cascade ile gidiyor ama
-- geçmişte o masada kapanmış adisyon varsa adisyonun masa_id bağı masayı
-- bırakmıyor, silme veritabanında geri çevriliyordu. Program sonucu okumadığı
-- için ekran "silindi" diyor, bölge yerinde duruyordu.
--
-- Adisyonları silmek yok: kapanmış hesap ciro geçmişi. Onun yerine masa
-- silinmeden hemen önce adı adisyonun eski `masa_ad` sütununa yazılıp bağ
-- boşaltılıyor; mutfak ve fiş ekranları masa adını zaten oradan da okuyor.
--
-- Üstünde AÇIK adisyon olan masa yine silinemez — onu ekran soruyor, silme
-- denense bile açık adisyonun masa adı benzersizlik kuralına takılır.

create or replace function masa_silinmeden_once()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update adisyonlar
     set masa_ad = coalesce(masa_ad, old.ad),
         masa_id = null
   where masa_id = old.id;
  return old;
end $$;

drop trigger if exists masa_silinmeden_once on masalar;

create trigger masa_silinmeden_once
before delete on masalar
for each row execute function masa_silinmeden_once();
