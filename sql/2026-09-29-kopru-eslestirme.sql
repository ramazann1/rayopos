-- Kasa köprüsünü kodla eşleştirme.
--
-- Köprü bugüne kadar telefon ve şifreyle giriyordu: ya bir personelin gerçek
-- şifresi kasada duruyordu ya da işletmeci Yazıcılar'da ayrı bir hesap açıp
-- şifreyi elle köprüye yazıyordu. İkisi de kurulumu uzatıyordu.
--
-- Yeni akış:
--   1. Köprü ilk açılışta 6 haneli bir kod gösteriyor (`kopru_kod_al`).
--   2. Yetkili kişi RayoPOS'ta Yazıcılar → Köprü ekle'ye bu kodu yazıyor
--      (`kopru_eslestir`). O an işletmeye yetkisiz bir sistem hesabı açılıyor.
--   3. Köprü hesabın bilgilerini bir kez alıyor (`kopru_eslesme_sonuc`),
--      saklıyor ve bundan sonra kendiliğinden giriyor.
--
-- Her köprünün kendi hesabı var: iki kasalı işletmede birini yeniden
-- eşleştirmek ötekini düşürmesin, çalınan bilgisayarın bağlantısı tek başına
-- kaldırılabilsin.

-- 1) Bekleyen kodlar ------------------------------------------------------
--
-- Kodu herkes görebilir (kasanın ekranında yazıyor), o yüzden kod tek başına
-- hesabı almaya yetmiyor: köprü kodu isterken yalnız kendisinin bildiği bir
-- gizli sözcük gönderiyor, sonucu alırken onu tekrar gösteriyor.
--
-- Hesabın şifresi burada en fazla birkaç saniye duruyor: köprü alınca satır
-- siliniyor. On dakikada alınmayan kod da siliniyor.

create table if not exists kopru_eslesmeleri (
  kod         text primary key,
  gizli_hash  text not null,
  cihaz       text not null default '',
  olusturma   timestamptz not null default now(),
  isletme_id  bigint references isletmeler (id) on delete cascade,
  eposta      text,
  sifre       text
);

alter table kopru_eslesmeleri enable row level security;
revoke all on kopru_eslesmeleri from anon, authenticated, public;

-- 2) Köprü: kod iste -------------------------------------------------------
--
-- Köprü henüz kimse değil, giriş yapmadan çağırıyor.

create or replace function kopru_kod_al(p_gizli text, p_cihaz text)
returns text language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  yeni text;
begin
  if length(coalesce(p_gizli, '')) < 32 then
    raise exception 'Geçersiz istek.';
  end if;

  delete from kopru_eslesmeleri where olusturma < now() - interval '10 minutes';

  loop
    yeni := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from kopru_eslesmeleri where kod = yeni);
  end loop;

  insert into kopru_eslesmeleri (kod, gizli_hash, cihaz)
  values (yeni, encode(digest(p_gizli, 'sha256'), 'hex'), left(coalesce(p_cihaz, ''), 60));

  return yeni;
end $$;

-- 3) Program: kodu onayla ---------------------------------------------------
--
-- Hesap burada açılıyor. Adresi ve şifreyi kimse görmüyor, ezberlemiyor:
-- adres rastgele, şifre uzun. Personel listesinde görünmüyor (`sistem`),
-- rolü yok — `oturum_yetkisi` rolü olmayana hep false diyor.

create or replace function kopru_eslestir(p_kod text)
returns text language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  isletme  bigint;
  satir    kopru_eslesmeleri;
  kisi_id  bigint;
  hesap    uuid;
  adres    text;
  yeni     text;
begin
  if not oturum_yetkisi('yazici.hesap') then
    raise exception 'Kasa köprüsü ekleme yetkin yok.';
  end if;

  isletme := oturum_isletmesi();

  select * into satir
    from kopru_eslesmeleri
   where kod = regexp_replace(coalesce(p_kod, ''), '\D', '', 'g')
     and olusturma > now() - interval '10 minutes'
     and eposta is null
   for update;

  if not found then
    raise exception 'Kod bulunamadı. Köprünün ekranındaki güncel kodu yazın.';
  end if;

  adres := 'kopru-' || encode(gen_random_bytes(8), 'hex') || '@rayopos.com.tr';
  yeni  := encode(gen_random_bytes(24), 'hex');
  hesap := gen_random_uuid();

  insert into personel (isletme_id, ad, telefon, rol_id, aktif, giris_engelli, sistem)
  values (isletme,
          'Kasa Köprüsü' || case when satir.cihaz <> '' then ' · ' || satir.cihaz else '' end,
          null, null, true, false, true)
  returning id into kisi_id;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', hesap, 'authenticated', 'authenticated',
    adres, crypt(yeni, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
  values (gen_random_uuid(), hesap,
          jsonb_build_object('sub', hesap::text, 'email', adres),
          'email', hesap::text, now(), now());

  update personel set auth_id = hesap where id = kisi_id;

  update kopru_eslesmeleri
     set isletme_id = isletme, eposta = adres, sifre = yeni
   where kod = satir.kod;

  return nullif(satir.cihaz, '');
end $$;

-- 4) Köprü: sonucu al -------------------------------------------------------
--
-- Köprü kodu gösterirken birkaç saniyede bir soruyor. Onaylanmadıysa boş
-- dönüyor; onaylandıysa bilgileri bir kez veriyor ve satırı siliyor.

create or replace function kopru_eslesme_sonuc(p_kod text, p_gizli text)
returns table (eposta text, sifre text)
language plpgsql volatile security definer
set search_path = public, extensions as $$
begin
  return query
  delete from kopru_eslesmeleri k
   where k.kod = p_kod
     and k.gizli_hash = encode(digest(coalesce(p_gizli, ''), 'sha256'), 'hex')
     and k.eposta is not null
  returning k.eposta, k.sifre;
end $$;

-- 5) Program: bağlı köprüler ----------------------------------------------

create or replace function kopru_hesaplari()
returns table (id bigint, ad text)
language sql stable security definer set search_path = public as $$
  select p.id, p.ad
    from personel p
   where p.isletme_id = oturum_isletmesi()
     and p.sistem
     and p.auth_id is not null
   order by p.id;
$$;

-- Bağlantıyı kaldırmak hesabı siliyor; köprü bir sonraki isteğinde düşüyor
-- ve yeniden kod göstermeye başlıyor. Personel silinince hesabını
-- `personel_hesabi_sil` tetikleyicisi siliyor.

create or replace function kopru_kaldir(p_id bigint)
returns void language plpgsql volatile security definer
set search_path = public as $$
begin
  if not oturum_yetkisi('yazici.hesap') then
    raise exception 'Kasa köprüsü kaldırma yetkin yok.';
  end if;

  delete from personel
   where id = p_id and isletme_id = oturum_isletmesi() and sistem;
end $$;

-- 6) Telefonla kurulan eski yol kalkıyor -----------------------------------

drop function if exists yazici_hesabi_kur(text);
drop function if exists yazici_hesabi_durumu();
drop function if exists yazici_sifresi_uret();

update yetkiler set ad = 'Kasa köprüsü ekleme ve kaldırma' where kod = 'yazici.hesap';

-- 7) Yetkiler -------------------------------------------------------------

revoke all on function kopru_kod_al(text, text) from public;
revoke all on function kopru_eslesme_sonuc(text, text) from public;
revoke all on function kopru_eslestir(text) from anon, public;
revoke all on function kopru_hesaplari() from anon, public;
revoke all on function kopru_kaldir(bigint) from anon, public;

grant execute on function kopru_kod_al(text, text) to anon, authenticated;
grant execute on function kopru_eslesme_sonuc(text, text) to anon, authenticated;
grant execute on function kopru_eslestir(text) to authenticated;
grant execute on function kopru_hesaplari() to authenticated;
grant execute on function kopru_kaldir(bigint) to authenticated;
