-- Hazır rollerin yetki şablonu yenilendi (30 Eyl 2026).
--
-- Şablon `isletme_kur_uygula` içinde 19 Ağu'dan kalmaydı; sonra eklenen
-- yetkiler (stok, sipariş geçmişi, köprü...) yeni işletmede hiçbir role
-- işaretli gelmiyordu. Şablon artık ayrı bir fonksiyonda: kurulumun iki yüz
-- satırlık gövdesine dokunmadan dış kapı (`isletme_kur`) onu çağırıyor ve
-- gövdenin eski dağıtımının üstüne yazıyor.
--
-- Mevcut işletmelerin rollerine dokunulmuyor; işletmeci onları kendisi
-- düzenlemiş olabilir.

-- 1) "Kapanmış adisyonu görme" kaldırılıyor --------------------------------
--
-- Tek başına hiçbir ekran açmıyordu: kapanmış adisyonlar yalnız Analiz →
-- Adisyonlar'da listeleniyor, o da "Özet ve adisyon listesi" yetkisiyle
-- açılıyor. Listeyi gören içini de görüyor. Rol ve kişi işaretleri silme ile
-- birlikte gidiyor.

create or replace function adisyon_okunur(durum text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when durum = 'acik' then oturum_yetkilerinden_biri(array[
      'siparis.al', 'odeme.al', 'mutfak.ekran', 'kasa.ac_kapat',
      'rapor.gun_sonu', 'rapor.tumu'
    ])
    else oturum_yetkilerinden_biri(array[
      'siparis.aktif_et', 'odeme.tip_duzelt', 'odeme.iade',
      'kasa.ac_kapat', 'rapor.gun_sonu', 'rapor.tumu'
    ])
  end;
$$;

delete from yetkiler where kod = 'siparis.kapali_gor';

-- 2) Ad düzeltmesi ---------------------------------------------------------
--
-- Bu yetki yalnız artırmaya izin veriyor; kaydedilmiş kalemin adedini
-- düşürmek "Üründen çıkarma" yetkisinde.
update yetkiler set ad = 'Miktar artırma' where kod = 'siparis.miktar';

-- 3) Şablon ----------------------------------------------------------------
--
-- Yönetici ve Müdür her şeyi yapar. Kasa tanım ekranları dışında her şeyi:
-- masa, menü, ayar, ödenmez ve personel yönetimi yok; yazıcı ve köprü var.
-- Garson sipariş alır, ödeme almaz: nakit tek elde, kasada kalsın.
-- İstasyon yalnız kendi ekranını kullanır. Kurye paket alır, kapıda tahsil
-- eder.
--
-- Liste dışlama ile yazılanlar (Yönetici, Müdür, Kasa) sonradan eklenen
-- yetkiyi kendiliğinden alıyor; diğerleri adıyla sayılıyor.

create or replace function hazir_rol_yetkilerini_kur(p_isletme bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from rol_yetkileri v
   using roller r
   where v.rol_id = r.id
     and r.isletme_id = p_isletme
     and r.hazir
     and r.ad in ('Yönetici', 'Müdür', 'Kasa', 'Garson', 'İstasyon', 'Kurye');

  insert into rol_yetkileri (isletme_id, rol_id, yetki_id)
  select p_isletme, r.id, y.id
    from roller r
    join yetkiler y on
         r.ad in ('Yönetici', 'Müdür')
      or (r.ad = 'Kasa' and y.kod not in (
           'tanim.masa', 'tanim.menu', 'tanim.ayar', 'tanim.odenmez', 'tanim.personel'
         ))
      or (r.ad = 'Garson' and y.kod in (
           'siparis.al', 'siparis.miktar', 'siparis.tasi', 'siparis.kalem_tasi',
           'siparis.gelal', 'siparis.paket', 'siparis.fis_yazdir'
         ))
      or (r.ad = 'İstasyon' and y.kod = 'mutfak.ekran')
      or (r.ad = 'Kurye' and y.kod in ('siparis.paket', 'odeme.al'))
   where r.isletme_id = p_isletme
     and r.hazir;
end $$;

revoke all on function hazir_rol_yetkilerini_kur(bigint) from anon, authenticated, public;

-- Dış kapı: 2026-09-03-sifre-kurallari.sql'deki hâli, sona şablon eklendi.
-- Yetkiler `create or replace` ile korunuyor (kayıt 16 Eyl'den beri kapalı).
create or replace function isletme_kur(
  p_isletme_ad  text,
  p_yonetici_ad text,
  p_telefon     text,
  p_sifre       text
)
returns bigint language plpgsql security definer
set search_path = public, extensions as $$
declare
  yeni_id bigint;
begin
  if not sifre_gecerli(p_sifre) then
    raise exception 'Şifre kurallara uymuyor: en az 6 karakter, bir harf ve bir rakam.';
  end if;

  perform kayit_sinirini_kontrol_et();

  yeni_id := isletme_kur_uygula(p_isletme_ad, p_yonetici_ad, p_telefon, p_sifre);

  perform hazir_rol_yetkilerini_kur(yeni_id);

  perform kayit_denemesi_yaz(p_telefon, p_isletme_ad);

  return yeni_id;
end $$;
