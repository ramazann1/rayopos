-- EKSİ STOK ENGELİ — "Eksi stoğa izin ver" ayarı kapalıyken satış durur.
--
-- Ayar 22 Eylül'den beri veritabanında duruyordu (varsayılan açık) ama
-- satışa hiç bağlanmamıştı. Kapalıyken reçetesini karşılayacak stok
-- olmayan ürün siparişe yazılamıyor.
--
-- Kararlar (Ramazan, 25 Eyl 2026):
--
-- 1) STOK KAPANIŞTA DÜŞÜYOR, KONTROL AÇIK MASALARI DA SAYIYOR. Açık
--    masadaki latte henüz düşmemiş olduğu için yalnız depodaki miktara
--    bakılsaydı 5 masaya son 1 litre sütle latte satılabilirdi. Kullanılabilir
--    miktar = depodaki − açık adisyonlarda bekleyen ihtiyaç.
--
-- 2) VERİTABANI DENETLİYOR. Masaüstü, telefon ve Hızlı Öde aynı kurala
--    takılıyor; tarayıcıdaki kod atlanamıyor.
--
-- 3) ÇEVRİMDIŞI KUYRUKTAN GELEN KALEM MUAF. İnternet kopukken alınan
--    sipariş sonradan gönderilirken ürün müşteriye çoktan gitmiş oluyor;
--    reddetmek satışı geri almıyor, yalnız kaydı kaybettiriyor.
--
-- 4) YALNIZ İHTİYACI ARTIRAN DEĞİŞİKLİK DENETLENİYOR. Adet azaltmak ya da
--    kalemi iptal etmek stok yetmese bile her zaman yapılabilmeli.

alter table adisyon_kalemleri
  add column if not exists stok_denetimsiz boolean not null default false;

-- Depodaki en küçük birimi (gram/ml) malzemenin kendi ölçüsüyle yazıyor:
-- hata mesajı "300" değil "0,3 lt" desin.
create or replace function stok_miktar_metni(p_miktar bigint, p_birim text)
returns text
language sql
immutable
as $fn$
  -- to_char küsuratı yuvarlayıp atıyordu (4,5 kg → "5 kg"); trim_scale
  -- yalnız sondaki sıfırları siliyor.
  select case p_birim
    when 'kg'    then replace(trim_scale(round(p_miktar / 1000.0, 3))::text, '.', ',') || ' kg'
    when 'litre' then replace(trim_scale(round(p_miktar / 1000.0, 3))::text, '.', ',') || ' lt'
    when 'gram'  then p_miktar || ' g'
    when 'mililitre' then p_miktar || ' ml'
    else p_miktar || ' adet'
  end;
$fn$;

create or replace function kalem_stok_denetimi()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_izin    boolean;
  v_adisyon record;
  v_eksik   record;
begin
  if new.stok_denetimsiz or new.porsiyon_id is null or new.durum = 'iptal' then
    return null;
  end if;

  -- Güncellemede yalnız ihtiyacı artıran değişiklik denetleniyor.
  if tg_op = 'UPDATE'
     and not (new.adet > old.adet or (old.durum = 'iptal' and new.durum <> 'iptal')) then
    return null;
  end if;

  select eksi_stok_izin into v_izin
    from isletme_ayarlari
   where isletme_id = new.isletme_id;

  if coalesce(v_izin, true) then
    return null;
  end if;

  select a.id, a.durum into v_adisyon
    from turlar t
    join adisyonlar a on a.id = t.adisyon_id
   where t.id = new.tur_id;

  -- Kapanmış hesabın kalemi düzeltiliyorsa stok zaten düşmüş; burada
  -- denetlenecek bir satış yok.
  if v_adisyon.durum is distinct from 'acik' then
    return null;
  end if;

  -- Bu kalemin reçetesindeki her malzeme için: depodaki miktar ile açık
  -- adisyonlarda bekleyen toplam ihtiyaç (bu kalem dahil) karşılaştırılıyor.
  --
  -- Yeniden açılmış adisyonun eski kalemleri ilk kapanışta zaten düştü;
  -- bekleyen ihtiyaçtan o adisyonun satış düşümleri (eksi işaretli)
  -- çıkarılıyor, yoksa aynı latte iki kez sayılırdı.
  select m.ad, m.birim, r.miktar as porsiyon_miktari,
         (m.miktar - coalesce(b.ihtiyac, 0) - coalesce(d.dusulen, 0)
          + r.miktar * new.adet)::bigint as kalan
    into v_eksik
    from recete_satirlari r
    join malzemeler m on m.id = r.malzeme_id
    left join lateral (
      select sum(r2.miktar * k2.adet) as ihtiyac
        from adisyon_kalemleri k2
        join turlar t2          on t2.id = k2.tur_id
        join adisyonlar a2      on a2.id = t2.adisyon_id
        join recete_satirlari r2 on r2.porsiyon_id = k2.porsiyon_id
       where a2.isletme_id = new.isletme_id
         and a2.durum = 'acik'
         and k2.durum is distinct from 'iptal'
         and r2.malzeme_id = r.malzeme_id
         and r2.tip in ('normal', 'cikarilabilir')
    ) b on true
    left join lateral (
      select sum(sh.miktar) as dusulen
        from stok_hareketleri sh
        join stok_belgeleri sb on sb.id = sh.belge_id
        join adisyonlar a3     on a3.id = sb.adisyon_id
       where a3.isletme_id = new.isletme_id
         and a3.durum = 'acik'
         and sb.tip = 'satis'
         and sh.malzeme_id = r.malzeme_id
    ) d on true
   where r.porsiyon_id = new.porsiyon_id
     and r.tip in ('normal', 'cikarilabilir')
     and m.miktar - coalesce(b.ihtiyac, 0) - coalesce(d.dusulen, 0) < 0
   limit 1;

  -- Mesaj üç şeyi söylüyor: ne istendi, ne var, en fazla kaç tane olur.
  -- Yalnız "4,5 kg kaldı" demek "o hâlde neden olmuyor" sorusunu
  -- cevapsız bırakıyordu. Açık masaların hesaba katıldığı söylenmiyor;
  -- garsonun işine yaramıyor, cümleyi uzatıyordu.
  if found then
    raise exception '*%* için % yetmiyor: % adet % istiyor, stokta % var. %',
      new.ad,
      v_eksik.ad,
      trim_scale(new.adet),
      stok_miktar_metni((v_eksik.porsiyon_miktari * new.adet)::bigint, v_eksik.birim),
      stok_miktar_metni(greatest(v_eksik.kalan, 0), v_eksik.birim),
      case
        when greatest(v_eksik.kalan, 0) >= v_eksik.porsiyon_miktari
          then 'En fazla *' || floor(greatest(v_eksik.kalan, 0) / v_eksik.porsiyon_miktari) || ' adet* eklenebilir.'
        else 'Bu ürün şu an satılamaz.'
      end
      using errcode = 'P0001';
  end if;

  return null;
end $fn$;

drop trigger if exists kalem_stok_denetimi_t on adisyon_kalemleri;
create trigger kalem_stok_denetimi_t
  after insert or update of adet, durum on adisyon_kalemleri
  for each row execute function kalem_stok_denetimi();
