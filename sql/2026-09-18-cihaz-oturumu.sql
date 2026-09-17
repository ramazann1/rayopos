-- "Şu an kim çalışıyor" bilgisi hesaba değil cihaza bağlanıyor.
--
-- Hata 18 Eylül'de çıktı: bilgisayarda gizli pencerede Mert Bey'e geçilmişti,
-- sonra aynı hesapla girili telefondan kilit ekranından Ramazan'a geçildi;
-- bilgisayar yenilenince o da Ramazan oldu.
--
-- Sebebi `oturum_kisileri` tablosunun anahtarının `auth_id` olması: aynı
-- hesapla giren bütün cihazlar tek satırı paylaşıyordu. Duvarda tek bir yazı
-- tahtası vardı, hangi cihaz kişi değiştirirse herkesin tahtası değişiyordu.
--
-- Görünür zararı isim değil yetki: `oturum_personeli()` fişin imzasını,
-- `oturum_yetkisi()` ise izinleri bu satırdan okuyor. Kasada garson çalışırken
-- telefondan kişi değiştiren biri kasadaki kişinin yetkilerini değiştiriyordu.
-- Üstelik kasa ekranı satırı yalnız açılışta okuduğu için ekranda hâlâ eski
-- isim yazıyor, siparişler yeni kişinin üstüne kaydediliyordu.
--
-- Kasa + garson telefonu aynı hesapla çalışan olağan bir düzen; yani bu hata
-- tek cihazla çalışılmadığı her işletmede çıkardı.

-- 1) İsteği hangi cihaz gönderdi -------------------------------------------
--
-- Tarayıcı kendine bir kimlik üretip her isteğe `x-cihaz` başlığıyla
-- gönderiyor (src/cihaz.ts). Başlığı okuma yöntemi 20 Ağustos'taki
-- `istek_kaynagi()` ile aynı: başlık yoksa ya da okunamıyorsa program
-- durmuyor, "bilinmiyor" deyip devam ediyor.
--
-- Başlık göndermeyen istemci (yazıcı köprüsü, güncellenmemiş sekme) hepsi
-- birlikte "bilinmiyor" cihazı sayılıyor: davranışı bugünküyle aynı kalıyor,
-- daha kötüye gitmiyor.
--
-- Canlı bağlantı (websocket) başlık taşımıyor, yani orada cihaz "bilinmiyor"
-- ve kişi hesabın kendi personeli sayılıyor. Zararsız: üç aboneliğin üçü de
-- gelen satırın içeriğine bakmıyor, yalnız "bir şey değişti" sinyali alıp
-- veriyi REST ile yeniden çekiyor (canli.ts, mutfak.ts, tanimAbonelik.ts) —
-- o istekler başlığı taşıdığı için süzgeç doğru kişiye göre işliyor.

create or replace function oturum_cihazi()
returns text language plpgsql stable set search_path = public as $$
declare
  basliklar json;
  kimlik    text;
begin
  begin
    basliklar := current_setting('request.headers', true)::json;
  exception when others then
    return 'bilinmiyor';
  end;

  if basliklar is null then
    return 'bilinmiyor';
  end if;

  -- Uzunluk sınırı: başlık dışarıdan geliyor, tabloya sınırsız metin girmesin.
  kimlik := nullif(btrim(basliklar ->> 'x-cihaz'), '');
  return coalesce(left(kimlik, 64), 'bilinmiyor');
end;
$$;

revoke all on function oturum_cihazi() from anon, public;
grant execute on function oturum_cihazi() to authenticated;

-- 2) Tablo: satır artık hesabın değil, hesap+cihaz çiftinin ---------------
--
-- Eski satırlar siliniyor, taşınmıyor: hepsi "hangi cihaz" bilgisi olmadan
-- yazılmış, hangisine ait olduğu bilinmiyor. Devredilseler "bilinmiyor"
-- cihazına yazılırlardı ve başlık göndermeyen köprü o kişinin yetkileriyle
-- çalışırdı. Bedeli küçük: her cihazda PIN bir kez yeniden giriliyor, o ana
-- kadar herkes kendi hesabının kişisi sayılıyor.

delete from oturum_kisileri;

alter table oturum_kisileri
  add column if not exists cihaz_id text not null default 'bilinmiyor';

alter table oturum_kisileri drop constraint if exists oturum_kisileri_pkey;
alter table oturum_kisileri add primary key (auth_id, cihaz_id);

-- 3) Şu an kim -------------------------------------------------------------
--
-- Tek değişiklik: satır aranırken cihaz da eşleşiyor. Bulunamazsa kural aynı
-- kalıyor — kimlik biletinin sahibi. Yani PIN'le geçilmemiş cihazda kişi,
-- hesabın kendi personeli.

create or replace function oturum_personeli()
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(
    (select ok.personel_id
       from oturum_kisileri ok
       join personel p on p.id = ok.personel_id
      where ok.auth_id = auth.uid()
        and ok.cihaz_id = oturum_cihazi()
        and p.aktif
        and not p.giris_engelli),
    (select id from personel where auth_id = auth.uid())
  );
$$;

-- 4) PIN'le geçiş ----------------------------------------------------------
--
-- 2 Eylül'deki sürümün aynısı; değişen yalnız yazılan satırın cihazı ve
-- çakışma kuralı. Gövdeyi kısaltmadan yeniden yazmak gerekiyor: fonksiyon
-- bütün olarak değiştiriliyor.

create or replace function pin_ile_gec(pin text)
returns bigint language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  isletme bigint;
  bulunan bigint;
  eski    boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Oturum yok.' using errcode = '42501';
  end if;

  select isletme_id into isletme from personel where auth_id = auth.uid();
  if isletme is null then
    raise exception 'Oturum yok.' using errcode = '42501';
  end if;

  -- Önce bcrypt.
  select id into bulunan
    from personel
   where isletme_id = isletme
     and pin_hash is not null
     and pin_hash like '$2%'
     and pin_hash = crypt(pin, pin_hash)
     and aktif
     and not giris_engelli
   limit 1;

  -- Bulunamadıysa eski yöntem.
  if bulunan is null then
    select id into bulunan
      from personel
     where isletme_id = isletme
       and pin_hash = encode(digest(pin, 'sha256'), 'hex')
       and aktif
       and not giris_engelli
     limit 1;

    if bulunan is not null then
      eski := true;
    end if;
  end if;

  -- Yanlış PIN'de kim olmadığı söylenmiyor, yalnız olmadığı söyleniyor.
  if bulunan is null then
    raise exception 'PIN doğru değil.' using errcode = '42501';
  end if;

  -- Doğru girildi: kayıt yeni yönteme çevriliyor.
  if eski then
    update personel set pin_hash = crypt(pin, gen_salt('bf')) where id = bulunan;
  end if;

  insert into oturum_kisileri (auth_id, cihaz_id, personel_id)
  values (auth.uid(), oturum_cihazi(), bulunan)
  on conflict (auth_id, cihaz_id) do update
    set personel_id = excluded.personel_id, guncelleme = now();

  -- Cihaz satırları kendiliğinden silinmiyor; değiştirilen telefon ya da
  -- temizlenen tarayıcı geride ölü satır bırakıyor. Uzun süre dokunulmayanlar
  -- burada temizleniyor — yalnız bu hesabın satırları, ucuz bir silme.
  delete from oturum_kisileri
   where auth_id = auth.uid()
     and guncelleme < now() - interval '60 days';

  return bulunan;
end $$;

-- 5) Kişiyi bırakma --------------------------------------------------------
--
-- Yalnız isteği gönderen cihazın satırı siliniyor. Eskiden hesabın bütün
-- satırı gidiyordu; artık kasada çıkış yapmak telefondaki vardiyayı
-- düşürmüyor.

create or replace function oturum_kisisini_birak()
returns void language sql volatile security definer set search_path = public as $$
  delete from oturum_kisileri
   where auth_id = auth.uid()
     and cihaz_id = oturum_cihazi();
$$;

-- 6) Yetkiler --------------------------------------------------------------
--
-- Fonksiyonlar yeniden yazıldığında yetkileri sıfırlanmıyor ama 1 Eylül'deki
-- kural gereği açıkça yazılıyorlar: yeni bir fonksiyon yetki yazılmazsa
-- herkese açık doğuyor.

revoke all on function pin_ile_gec(text) from anon, public;
revoke all on function oturum_kisisini_birak() from anon, public;
revoke all on function oturum_personeli() from anon, public;

grant execute on function pin_ile_gec(text) to authenticated;
grant execute on function oturum_kisisini_birak() to authenticated;
grant execute on function oturum_personeli() to authenticated;
