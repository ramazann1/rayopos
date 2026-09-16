-- Adisyonu kapatan kişi kapattığını göremediği için kapatamıyordu.
--
-- Belirti üç yerde birden çıkıyordu: garson adisyonu iptal edemiyor, tamamını
-- ikram edemiyor, ödemenin tamamını alıp hesabı kapatamıyordu. İlk ikisi
-- ekrana "new row violates row-level security policy for table adisyonlar"
-- yazıyor, üçüncüsü hiçbir şey söylemiyordu: para kasaya giriyor, masa açık
-- kalıyordu.
--
-- Yetki eksikliği değildi — `siparis.iptal` kişiye özel olarak verilmişti ve
-- yine olmuyordu. Sebebi şu: PostgreSQL bir satırın güncellenmesine izin
-- verirken, güncellenmiş hâlinin de o kişiye görünür kalmasını şart koşuyor.
-- Adisyonun okuma kuralı (2026-09-06) kapanmış adisyonu `siparis.kapali_gor`
-- gibi yetkilere bağlıyor; garson adisyonu kapattığı anda satır kendi
-- gözünden kayboluyor ve veritabanı yazmayı geri çeviriyor.
--
-- Okuma kuralını gevşetmek çözüm değil: garson kendi kapattığı hesapları
-- toplayıp günün cirosunu öğrenirdi. Onun yerine durumu değiştiren üç işlem
-- buraya taşınıyor. Fonksiyonlar tanımlayıcı yetkisiyle çalıştığı için satır
-- güvenliğine takılmıyorlar; karşılığında kimin çağırdığını kendileri
-- denetliyor. Garsonun okuma hakkı olduğu gibi kapalı kalıyor.
--
-- Yetki denetimi kaybolmuyor: tetikleyiciler tabloya bağlı, buradan yapılan
-- güncellemede de çalışıyorlar (2026-08-28). Fonksiyonların kendi kontrolleri
-- onların üstüne biniyor, yerine geçmiyor.

-- 1) İptal ------------------------------------------------------------------
--
-- Tahsilatı olan adisyon iptal edilemez; bugüne kadar bu yalnız tarayıcıda
-- soruluyordu, artık burada da soruluyor — fonksiyon satır güvenliğini aştığı
-- için kendi kapısını kendi tutmak zorunda.

create or replace function adisyon_iptal_et(p_adisyon_id bigint, p_sebep text)
returns void language plpgsql security definer set search_path = public as $$
declare
  bulunan bigint;
begin
  select id into bulunan
    from adisyonlar
   where id = p_adisyon_id and isletme_id = oturum_isletmesi();

  -- "Başka işletmenin adisyonu" denmiyor; olmayan numara ile başkasının
  -- numarası dışarıdan aynı görünsün.
  if bulunan is null then
    raise exception 'Adisyon bulunamadı.' using errcode = '42501';
  end if;

  perform yetki_iste('siparis.iptal', 'Adisyon iptal etme yetkiniz yok.');

  if exists (select 1 from tahsilatlar where adisyon_id = p_adisyon_id) then
    raise exception 'Bu adisyondan tahsilat alınmış. Önce ödemeyi geri verip tahsilatı silin, sonra iptal edin.';
  end if;

  update adisyonlar
     set durum = 'iptal',
         iptal_sebep = p_sebep,
         kapanis = now(),
         guncelleme = now()
   where id = p_adisyon_id;
end;
$$;

-- 2) Adisyonun tamamını ikram -----------------------------------------------
--
-- Kalemler ve adisyon tek işlemde yazılıyor. Eskiden iki ayrı istekti ve
-- ikincisi düşünce ortada yarım bir hesap kalıyordu: ürünler ikram görünüyor,
-- adisyon açık duruyordu. Artık ya ikisi birden oluyor ya hiçbiri.
--
-- `siparis.adisyon_ikram` bugüne kadar yalnızca arayüzde soruluyordu,
-- veritabanında karşılığı yoktu. Denetim buraya giriyor. Kalemlerin kendi
-- ikram yetkisi (`siparis.ikram`) tetikleyicide zaten aranıyor.

create or replace function adisyon_ikram_et(p_adisyon_id bigint, p_odenmez_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  bulunan bigint;
begin
  select id into bulunan
    from adisyonlar
   where id = p_adisyon_id and isletme_id = oturum_isletmesi();

  if bulunan is null then
    raise exception 'Adisyon bulunamadı.' using errcode = '42501';
  end if;

  perform yetki_iste('siparis.adisyon_ikram', 'Adisyonun tamamını ikram etme yetkiniz yok.');

  -- İptal edilmiş kalemler olduğu gibi kalıyor: iptal ikramdan başka bir şey.
  update adisyon_kalemleri k
     set durum = 'ikram',
         indirim = 0,
         indirim_tanim_id = null,
         indirim_ad = null,
         odenmez_id = p_odenmez_id
    from turlar t
   where t.id = k.tur_id
     and t.adisyon_id = p_adisyon_id
     and k.durum = 'normal';

  -- Tamamı ikram edilen hesaptan servis bedeli de alınmıyor; kaldırıldığı
  -- yazılıyor ki adisyon yeniden açılırsa kuver kendiliğinden geri gelmesin.
  update adisyonlar
     set durum = 'kapali',
         indirim = 0,
         indirim_tanim_id = null,
         indirim_ad = null,
         kuver_tutar = 0,
         garsoniye_tutar = 0,
         kuver_uygula = false,
         garsoniye_uygula = false,
         odenmez_id = p_odenmez_id,
         kapanis = now(),
         guncelleme = now()
   where id = p_adisyon_id;
end;
$$;

-- 3) Ödeme alındı, hesap kapanıyor ------------------------------------------
--
-- Kapanışın kendi yetkisi yok, ödemenin yetkisi var: hesabı kapatmak ödeme
-- almanın doğal sonucu. Eksik tahsilatla kapatmak ayrı bir karar, onu
-- adisyon tetikleyicisi `odeme.eksik_kapat` ile ayrıca denetliyor.

create or replace function adisyon_kapat(
  p_adisyon_id bigint,
  p_eksik_kisi text,
  p_eksik_sebep text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  bulunan bigint;
begin
  select id into bulunan
    from adisyonlar
   where id = p_adisyon_id and isletme_id = oturum_isletmesi();

  if bulunan is null then
    raise exception 'Adisyon bulunamadı.' using errcode = '42501';
  end if;

  perform yetki_iste('odeme.al', 'Ödeme alma yetkiniz yok.');

  -- Eksik kapatma bilgisi yalnız o kapanışta yazılıyor; hesap tam ödenerek
  -- kapandıysa eski borç notu da temizleniyor.
  update adisyonlar
     set durum = 'kapali',
         kapanis = now(),
         eksik_kisi = p_eksik_kisi,
         eksik_sebep = p_eksik_sebep,
         guncelleme = now()
   where id = p_adisyon_id;
end;
$$;

-- 4) Kimler çağırabilir -----------------------------------------------------
--
-- Postgres'te yeni bir fonksiyon yetki yazılmazsa herkese açık doğuyor
-- (2026-09-01'deki toplu kapatma yalnız o günkü fonksiyonları kapsıyordu).
-- Üçü de önce kapatılıyor, sonra yalnız giriş yapmış kullanıcıya açılıyor.

revoke all on function adisyon_iptal_et(bigint, text) from anon, public;
revoke all on function adisyon_ikram_et(bigint, bigint) from anon, public;
revoke all on function adisyon_kapat(bigint, text, text) from anon, public;

grant execute on function adisyon_iptal_et(bigint, text) to authenticated;
grant execute on function adisyon_ikram_et(bigint, bigint) to authenticated;
grant execute on function adisyon_kapat(bigint, text, text) to authenticated;
