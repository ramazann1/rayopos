-- Yetki provasında çıkan iki denetim eksiği.
--
-- 17 Eylül'deki prova (2026-09-17-yetki-provasi.sql) iki açık gösterdi. İkisi de
-- adisyon ve kalem tetikleyicilerini ilgilendirdiği için tek dosyada duruyorlar;
-- ayrı dosyalara bölünse ikincisi birincinin yazdığı gövdeyi silerdi.
--
-- 1. Kuver/garsoniye kaldırmak yetki sormuyordu (`siparis.servis`).
-- 2. "Sadece ön tanımlı indirim" yetkisi sunucuda serbest indirimden
--    ayrılmıyordu (`odeme.indirim_tanimli`).

-- 1) İndirim denetimi tek yerde ----------------------------------------------
--
-- İki yetki var ve aralarındaki fark bugüne kadar yalnız ekranda duruyordu
-- (IndirimModal.tsx: `serbest = yetkiVar("odeme.indirim")`). Sunucudaki
-- tetikleyici ikisinden birini yeterli sayıyordu, yani yalnız "ön tanımlı"
-- yetkisi olan biri istediği tutarı yazabiliyordu.
--
-- Kural: serbest yetkisi varsa her şey serbest. Yoksa yalnız tanımlı indirim
-- seçilebiliyor — indirimi kaldırmak (sıfırlamak) tanım istemiyor, o zaten
-- hesabı büyüten yönde.

create or replace function indirim_denetle(p_tutar numeric, p_tanim_id bigint)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  -- Kurulum betikleri ve bakım işleri denetim dışı; yetki_iste ile aynı ölçü.
  if auth.uid() is null then
    return;
  end if;

  -- Tam ikram indirimleri de sıfırlıyor; yetkisi kapıda soruldu, burada
  -- tekrar sorulursa indirim yetkisi olmayan kişi hesabı ikram edemez.
  if coalesce(current_setting('rayopos.ikram_suruyor', true), '') = '1' then
    return;
  end if;

  if oturum_yetkisi('odeme.indirim') then
    return;
  end if;

  if not oturum_yetkisi('odeme.indirim_tanimli') then
    raise exception 'İndirim yapma yetkiniz yok.' using errcode = '42501';
  end if;

  if coalesce(p_tutar, 0) = 0 then
    return;
  end if;

  if p_tanim_id is null or not exists (
    select 1 from indirim_tanimlari
     where id = p_tanim_id
       and isletme_id = oturum_isletmesi()
       and aktif
  ) then
    raise exception 'Yalnız tanımlı indirimlerden seçebilirsiniz.' using errcode = '42501';
  end if;
end;
$$;

-- 2) Tam ikram, servis bedelini de kaldırıyor --------------------------------
--
-- `adisyon_ikram_et` hesabın tamamını ikram ederken kuveri de sıfırlıyor; bu
-- ikramın parçası, ayrı bir servis kararı değil. Yetkisi zaten kapıda sorulduğu
-- için işlem kendini işaretliyor ve aşağıdaki servis denetimi ona karışmıyor.
-- İşaret işlemle birlikte kayboluyor (set_config'in üçüncü parametresi).

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

  -- Servis bedelinin kalkması ikramın parçası; servis yetkisi ayrıca sorulmuyor.
  perform set_config('rayopos.ikram_suruyor', '1', true);

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

  perform set_config('rayopos.ikram_suruyor', '', true);
end;
$$;

-- 3) Adisyon tetikleyicisi ---------------------------------------------------
--
-- Gövdenin geri kalanı 28 Ağustos'taki hâliyle; değişen iki yer: indirim
-- denetimi ortak fonksiyona taşındı, servis bayraklarının denetimi eklendi.

create or replace function adisyon_yetkisi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Masasız siparişin kendi yetkisi var: kurye paket alır ama masaya
    -- sipariş girmez, ondan "sipariş alma" beklenmiyor.
    if new.tip = 'gelal' then
      perform yetki_iste('siparis.gelal', 'Gel al siparişi alma yetkiniz yok.');
    elsif new.tip = 'paket' then
      perform yetki_iste('siparis.paket', 'Paket siparişi alma yetkiniz yok.');
    else
      perform yetki_iste('siparis.al', 'Sipariş alma yetkiniz yok.');
    end if;
    return new;
  end if;

  if coalesce(new.indirim, 0) is distinct from coalesce(old.indirim, 0) then
    perform indirim_denetle(new.indirim, new.indirim_tanim_id);
  end if;

  -- Kuver ve garsoniye. Yalnız bayraklara bakılıyor: tutar sütunları her sipariş
  -- değişiminde yeniden hesaplanıyor (servisTutarlariniGuncelle), onlara kilit
  -- koymak sipariş almayı bozardı. İnsan kararı bayrakta.
  if new.kuver_uygula is distinct from old.kuver_uygula
     or new.garsoniye_uygula is distinct from old.garsoniye_uygula then
    if coalesce(current_setting('rayopos.ikram_suruyor', true), '') <> '1' then
      perform yetki_iste('siparis.servis', 'Kuver/garsoniye değiştirme yetkiniz yok.');
    end if;
  end if;

  if new.durum is distinct from old.durum then
    if new.durum = 'iptal' then
      perform yetki_iste('siparis.iptal', 'Adisyon iptal etme yetkiniz yok.');
    elsif new.durum = 'acik' and old.durum <> 'acik' then
      perform yetki_iste('siparis.aktif_et', 'Kapanmış adisyonu yeniden açma yetkiniz yok.');
    end if;
  end if;

  -- Borcu birine yazarak kapatmak ayrı bir karar; kapanışta bu iki alan dolar.
  if coalesce(new.eksik_kisi, '') is distinct from coalesce(old.eksik_kisi, '') then
    perform yetki_iste('odeme.eksik_kapat', 'Eksik tahsilatla hesap kapatma yetkiniz yok.');
  end if;

  return new;
end;
$$;

drop trigger if exists adisyon_yetkisi on adisyonlar;
create trigger adisyon_yetkisi
  before insert or update on adisyonlar
  for each row execute function adisyon_yetkisi();

-- 4) Kalem tetikleyicisi -----------------------------------------------------
-- Tek değişiklik: satır indirimi de ortak denetimden geçiyor.

create or replace function kalem_yetkisi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform yetki_iste('siparis.urun_cikar', 'Kaydedilmiş ürünü çıkarma yetkiniz yok.');
    return old;
  end if;

  -- Yeni kalem sipariş almanın kendisi. Hangi türü aldığı adisyonun kendi
  -- kaydında denetlendiği için burada üç yetkiden biri yetiyor; ayrıntılı
  -- denetim güncellemede.
  if tg_op = 'INSERT' then
    if not (
      oturum_yetkisi('siparis.al')
      or oturum_yetkisi('siparis.gelal')
      or oturum_yetkisi('siparis.paket')
    ) then
      perform yetki_iste('siparis.al', 'Sipariş alma yetkiniz yok.');
    end if;
    return new;
  end if;

  if new.adet is distinct from old.adet then
    perform yetki_iste('siparis.miktar', 'Miktar değiştirme yetkiniz yok.');
  end if;

  if new.fiyat is distinct from old.fiyat then
    perform yetki_iste('siparis.fiyat', 'Ürün fiyatı değiştirme yetkiniz yok.');
  end if;

  if new.durum is distinct from old.durum then
    if new.durum = 'ikram' then
      perform yetki_iste('siparis.ikram', 'İkram yapma yetkiniz yok.');
    elsif new.durum = 'iptal' then
      -- Kalem iptali ekranda "üründen çıkarma" yetkisiyle aynı düğmede;
      -- kalem silinmiyor, iptal olarak duruyor ama karar aynı karar.
      perform yetki_iste('siparis.urun_cikar', 'Kalem iptal etme yetkiniz yok.');
    end if;
  end if;

  -- Satır indirimi hesabın tutarını düşürüyor; adisyon indirimiyle aynı kural.
  if coalesce(new.indirim, 0) is distinct from coalesce(old.indirim, 0) then
    perform indirim_denetle(new.indirim, new.indirim_tanim_id);
  end if;

  return new;
end;
$$;

drop trigger if exists kalem_yetkisi on adisyon_kalemleri;
create trigger kalem_yetkisi
  before insert or update or delete on adisyon_kalemleri
  for each row execute function kalem_yetkisi();
