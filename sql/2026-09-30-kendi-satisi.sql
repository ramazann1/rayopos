-- Kendi satışını görme (30 Eyl 2026).
--
-- Bazı işletmeler garsona o gün sattığını göstermek istiyor. "Kendi satışı"
-- masayı açanın değil, ürünü adisyona yazanın satışı: kalabalık masada birden
-- çok garson tur giriyor, ciro turu yazana ait (`turlar.garson_id`, personel
-- raporuyla aynı kural).
--
-- Garsona kapanmış adisyonları okuma izni verilmiyor; sunucu yalnız kişinin
-- kendi turlarındaki kalemleri döndürüyor. Başkasının satışı hiçbir yoldan
-- görünmüyor.

insert into yetkiler (kod, ad, grup, sira)
select 'rapor.kendi_satis', 'Kendi satışını görme', 'Rapor', 503
where not exists (select 1 from yetkiler where kod = 'rapor.kendi_satis');

-- Yönetici ve Müdür her şeyi yapar; mevcut işletmelerde de işaretleniyor.
-- Garsona kendiliğinden verilmiyor, işletme karar versin.
insert into rol_yetkileri (isletme_id, rol_id, yetki_id)
select r.isletme_id, r.id, y.id
from roller r join yetkiler y on y.kod = 'rapor.kendi_satis'
where r.ad in ('Yönetici', 'Müdür')
  and not exists (
    select 1 from rol_yetkileri v where v.rol_id = r.id and v.yetki_id = y.id
  );

-- Aralık kasa gününe göre ekrandan geliyor (kasa günü başlangıcı işletme
-- ayarında, hesabı istemcide tek yerde duruyor). İptal edilmiş adisyonun
-- kalemleri sayılmıyor.
create or replace function kendi_satisim(p_bas timestamptz, p_bit timestamptz)
returns table (ad text, adet numeric, fiyat numeric, indirim numeric, durum text, adisyon_id bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not oturum_yetkilerinden_biri(array['rapor.kendi_satis', 'rapor.gun_sonu', 'rapor.tumu']) then
    raise exception 'Bu ekran için yetkiniz yok.';
  end if;

  return query
    select k.ad, k.adet, k.fiyat, coalesce(k.indirim, 0), k.durum, a.id
      from turlar t
      join adisyonlar a on a.id = t.adisyon_id
      join adisyon_kalemleri k on k.tur_id = t.id
     where t.garson_id = oturum_personeli()
       and a.isletme_id = oturum_isletmesi()
       and a.durum <> 'iptal'
       and t.olusturma >= p_bas
       and t.olusturma < p_bit;
end $$;

revoke all on function kendi_satisim(timestamptz, timestamptz) from anon, public;
grant execute on function kendi_satisim(timestamptz, timestamptz) to authenticated;
