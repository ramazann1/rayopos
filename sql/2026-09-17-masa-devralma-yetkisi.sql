-- Masa devralma yetki soruyor — ama yalnız masa canlıyken.
--
-- Masaya giren kişinin adı `masa_mesguliyet` satırında duruyor, ekran 20
-- saniyede bir tazeliyor. 60 saniye tazelenmeyen satır ölü sayılıyor ve masa
-- listesinde elenip görünmez oluyor (mesguliyet.ts, OLU_SURE).
--
-- Eksik olan, satırın korunmasıydı. Devralma `upsert` ile yapılıyor: satır
-- kimin olursa olsun, kaç saniyelik olursa olsun üstüne yazılıyordu. Sunucu ne
-- yetki ne yaş soruyordu. `masa.devral` 30 Ağustos'ta eklenmiş ama yalnız
-- ekrandaki düğmeyi gizliyordu; 17 Eylül'deki yetki provası bunu gösterdi.
--
-- Kural, ekrandakinin aynısı olsun diye aynı süreyi kullanıyor:
--
--   kendi satırın            → serbest (kalp atışı, masaya geri girme)
--   60 saniyeden eski satır  → serbest (sahibi gitmiş, zaten ölü sayılıyor)
--   başkasının taze satırı   → `masa.devral` ister
--
-- Sert kilit bilerek konmadı. Dosyanın 29 Ağustos'taki notu haklı: garson
-- ekranı açık unutur, kasiyer müşteriyi kapıda bekletir. Bayat satır serbest
-- kaldığı sürece o aksama olmuyor, korunan yalnız şu anda çalışılan masa.

create or replace function masa_devralma_yetkisi()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  serbest boolean;
begin
  serbest :=
    -- Kendi işaretimiz: tazelemek de bırakmak da kendi işimiz.
    (old.kisi_id is not null and old.kisi_id = oturum_personeli())
    -- Ölü işaret. Ekran bunu zaten göstermiyor; sunucunun da tutması anlamsız,
    -- tutsaydı sahibi gitmiş masa kilitli kalırdı.
    or old.guncelleme < now() - interval '60 seconds';

  if not serbest then
    perform yetki_iste('masa.devral', 'Başkasının açtığı masayı devralma yetkiniz yok.');
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Ekleme denetlenmiyor: satırı olmayan masa boş masadır, kimseden alınmıyor.
-- Devralma ekleme değil güncelleme — `isaretiKoy` upsert yapıyor ve satır
-- varken güncellemeye düşüyor.
drop trigger if exists masa_devralma_yetkisi on masa_mesguliyet;
create trigger masa_devralma_yetkisi
  before update or delete on masa_mesguliyet
  for each row execute function masa_devralma_yetkisi();
