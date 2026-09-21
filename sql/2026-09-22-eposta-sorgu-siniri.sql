-- Giriş ekranında telefon yerine e-posta da yazılabiliyor. Asıl hesap telefona
-- bağlı olduğu için "bu e-posta hangi hesabın" sorusunu `eposta_hesabi`
-- cevaplıyor ve giriş yapmamış herkes çağırabiliyor — çağırabilmesi gerekiyor,
-- soruyu soran henüz giriş yapmamış biri.
--
-- Açık şu: birinin e-postasını bilen kişi, dönen adresten telefon numarasını
-- okuyabiliyor (adres "numara@garso.app" biçiminde) ve arama bütün
-- işletmelerde yapılıyor. Tek tek denemek gerektiği için toplu liste
-- çekilemiyor; asıl risk sabırla deneme yapılması.
--
-- Çözüm kayıt korumasının aynısı: sınır IP'ye göre. Orada her deneme ayrı satır
-- yazılıyordu; giriş çok daha sık yapıldığı için burada IP başına TEK satır
-- tutuluyor, sayaç üstüne yazılıyor. Defter şişmiyor.

create table if not exists eposta_sorgulari (
  ip      text primary key,
  sayi    integer     not null default 0,
  pencere timestamptz not null default now()
);

-- Defteri kimse okumasın: satır güvenliği açık ve hiçbir politika yok. Yalnız
-- güvenliği aşarak çalışan sorgu fonksiyonu yazabiliyor.
alter table eposta_sorgulari enable row level security;
revoke all on eposta_sorgulari from anon, authenticated;

-- Saatte 20 deneme. Kendi e-postasını yazan biri şifresini üst üste yanlış
-- girse bile bu sınıra takılmıyor; numarayı toplamaya çalışan takılıyor.
-- Sınır dolunca boş dönüyor, hata metni değişmiyor: giriş ekranı zaten
-- "Bilgiler doğru değil" diyor. Farklı bir metin, sınıra takılanın doğru
-- e-postayı bulduğunu ele verirdi.
create or replace function eposta_hesabi(giris text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  gelen_ip text := istek_ip();
  kalan    integer;
begin
  -- Bir saatten eski satırlar bir işe yaramıyor; defteri kendi kendine süpürsün.
  delete from eposta_sorgulari where pencere < now() - interval '1 hour';

  insert into eposta_sorgulari (ip, sayi, pencere)
  values (gelen_ip, 1, now())
  on conflict (ip) do update
    set sayi = case
          when eposta_sorgulari.pencere < now() - interval '1 hour' then 1
          else eposta_sorgulari.sayi + 1
        end,
        pencere = case
          when eposta_sorgulari.pencere < now() - interval '1 hour' then now()
          else eposta_sorgulari.pencere
        end
  returning sayi into kalan;

  if kalan > 20 then
    return null;
  end if;

  return (
    select hesap_epostasi(telefon)
      from personel
     where lower(eposta) = lower(trim(giris))
       and aktif
       and not giris_engelli
     limit 1
  );
end $$;

grant execute on function eposta_hesabi(text) to anon, authenticated;
