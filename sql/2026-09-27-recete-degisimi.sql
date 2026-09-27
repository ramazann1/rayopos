-- REÇETE DEĞİŞİMİ — "soğansız", "+ jambon".
--
-- Reçete satırının tipi ekrana geri geliyor (Sabit / Çıkarılabilir / Ekstra).
-- Garson ürün penceresinde çıkarılabilir malzemeyi "Olmasın", ekstrayı
-- "Ekstra" bölümünden seçiyor. Kalem hangi malzemenin çıktığını ve hangisinin
-- eklendiğini kimlikle saklıyor; stok ve maliyet buna göre hesaplanıyor.
-- Ekranda görünen "Soğansız · + Jambon" metni `secimler` sütununda, eskisi gibi.
--
-- Bu dosya 2026-09-25-eksi-stok-metni.sql, -sipariste-dusum.sql ve
-- -stok-on-denetim.sql'den SONRA çalışır; onların fonksiyonlarını değiştirir.

-- 1) Ekstra fiyatı -----------------------------------------------------------
-- Boşsa ekstra ücretsiz ("biraz daha sos").
alter table recete_satirlari add column if not exists ek_fiyat numeric(10,2);

-- 2) Kalemin reçete değişimi ------------------------------------------------
alter table adisyon_kalemleri add column if not exists cikan_malzemeler bigint[];
alter table adisyon_kalemleri add column if not exists eklenen_malzemeler bigint[];

-- 3) Reçete satırı bu kalemde harcanıyor mu --------------------------------
-- Sabit hep, çıkarılabilir çıkarılmadıysa, ekstra eklendiyse.
create or replace function recete_girer(
  p_tip text, p_malzeme bigint, p_cikan bigint[], p_eklenen bigint[]
)
returns boolean
language sql
immutable
as $fn$
  select case p_tip
    when 'normal'        then true
    when 'cikarilabilir' then not (p_malzeme = any(coalesce(p_cikan, '{}')))
    when 'opsiyonel'     then p_malzeme = any(coalesce(p_eklenen, '{}'))
    else false
  end
$fn$;

-- 4) Maliyet ---------------------------------------------------------------
create or replace function kalem_maliyetlerini_yaz(p_adisyon_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from kalem_maliyetleri km
   using adisyon_kalemleri k, adisyonlar a
   where km.kalem_id = k.id
     and km.adisyon_id = p_adisyon_id
     and a.id = p_adisyon_id
     and (k.durum = 'iptal' or a.durum = 'iptal');

  update kalem_maliyetleri km
     set maliyet = km.maliyet / km.adet * k.adet,
         adet = k.adet
    from adisyon_kalemleri k
   where km.kalem_id = k.id
     and km.adisyon_id = p_adisyon_id
     and km.adet is not null and km.adet > 0
     and km.adet <> k.adet;

  insert into kalem_maliyetleri (kalem_id, isletme_id, adisyon_id, maliyet, eksik, adet)
  select k.id, a.isletme_id, a.id,
         sum(r.miktar * coalesce(m.ortalama_maliyet, 0)) * k.adet,
         bool_or(m.ortalama_maliyet is null),
         k.adet
    from adisyonlar a
    join turlar t            on t.adisyon_id = a.id
    join adisyon_kalemleri k on k.tur_id = t.id
    join recete_satirlari r  on r.porsiyon_id = k.porsiyon_id
    join malzemeler m        on m.id = r.malzeme_id
   where a.id = p_adisyon_id
     and a.durum <> 'iptal'
     and k.durum is distinct from 'iptal'
     and recete_girer(r.tip, r.malzeme_id, k.cikan_malzemeler, k.eklenen_malzemeler)
     and not exists (select 1 from kalem_maliyetleri x where x.kalem_id = k.id)
   group by k.id, a.isletme_id, a.id, k.adet;
end $fn$;

-- 5) Düşüm -----------------------------------------------------------------
create or replace function stok_satis_dusumu(p_adisyon_id bigint, p_denetle boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_adisyon record;
  v_satir   record;
  v_belge   bigint;
  v_kisi    bigint := oturum_personeli();
  v_izin    boolean;
  v_urun    text;
  v_eksikler text;
begin
  select a.id, a.isletme_id, a.durum, a.adisyon_no,
         coalesce(ms.ad, a.masa_ad) as masa_ad
    into v_adisyon
    from adisyonlar a
    left join masalar ms on ms.id = a.masa_id
   where a.id = p_adisyon_id;

  if not found then
    return;
  end if;

  select eksi_stok_izin into v_izin
    from isletme_ayarlari
   where isletme_id = v_adisyon.isletme_id;

  for v_satir in
    select m.id, m.ad, m.birim, m.miktar as stok,
           -coalesce(h.hedef, 0) - coalesce(d.dusulen, 0) as fark
      from malzemeler m
      left join (
        select r.malzeme_id, round(sum(r.miktar * k.adet))::bigint as hedef
          from adisyon_kalemleri k
          join turlar t           on t.id = k.tur_id
          join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and v_adisyon.durum <> 'iptal'
           and k.durum is distinct from 'iptal'
           and recete_girer(r.tip, r.malzeme_id, k.cikan_malzemeler, k.eklenen_malzemeler)
         group by r.malzeme_id
      ) h on h.malzeme_id = m.id
      left join (
        select sh.malzeme_id, sum(sh.miktar)::bigint as dusulen
          from stok_hareketleri sh
          join stok_belgeleri b on b.id = sh.belge_id
         where b.adisyon_id = p_adisyon_id
           and b.tip = 'satis'
         group by sh.malzeme_id
      ) d on d.malzeme_id = m.id
     where m.isletme_id = v_adisyon.isletme_id
       and (h.hedef is not null or d.dusulen is not null)
     order by m.ad
  loop
    continue when v_satir.fark = 0;

    if p_denetle and not coalesce(v_izin, true)
       and v_satir.fark < 0 and v_satir.stok + v_satir.fark < 0 then
      if v_urun is null then
        select k.ad into v_urun
          from adisyon_kalemleri k
          join turlar t           on t.id = k.tur_id
          join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and r.malzeme_id = v_satir.id
           and k.durum is distinct from 'iptal'
           and recete_girer(r.tip, r.malzeme_id, k.cikan_malzemeler, k.eklenen_malzemeler)
         order by k.id desc
         limit 1;
      end if;

      v_eksikler := coalesce(v_eksikler, '') || E'\n' ||
        '*' || v_satir.ad || '*: ' ||
        stok_miktar_metni(v_satir.stok, v_satir.birim) || ' var, ' ||
        stok_miktar_metni(-v_satir.fark, v_satir.birim) || ' gerekiyor';
      continue;
    end if;

    if v_belge is null then
      insert into stok_belgeleri (isletme_id, tip, aciklama, kisi_id, kisi_ad, adisyon_id)
      values (
        v_adisyon.isletme_id,
        'satis',
        'Adisyon #' || v_adisyon.adisyon_no || coalesce(' · ' || v_adisyon.masa_ad, ''),
        v_kisi,
        (select ad from personel where id = v_kisi),
        p_adisyon_id
      )
      returning id into v_belge;
    end if;

    insert into stok_hareketleri
      (isletme_id, belge_id, malzeme_id, malzeme_ad, tip, miktar, onceki, sonraki, kisi_id)
    values
      (v_adisyon.isletme_id, v_belge, v_satir.id, v_satir.ad, 'satis', v_satir.fark, 0, 0, v_kisi);
  end loop;

  if v_eksikler is not null then
    raise exception '*%* için stok yetersiz%', v_urun, v_eksikler
      using errcode = 'P0001';
  end if;

  perform kalem_maliyetlerini_yaz(p_adisyon_id);
end $fn$;

revoke all on function stok_satis_dusumu(bigint, boolean) from public, anon, authenticated;

-- 6) Ön denetim ------------------------------------------------------------
-- Girdi: [{"porsiyon_id": 12, "adet": 9, "ad": "BURGER",
--          "cikan": [4], "eklenen": [7]}, ...]
create or replace function stok_on_denetim(p_kalemler jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_isletme  bigint := oturum_isletmesi();
  v_urun     text;
  v_eksikler text;
  v_satir    record;
begin
  if v_isletme is null then
    return null;
  end if;

  if coalesce((select eksi_stok_izin from isletme_ayarlari where isletme_id = v_isletme), true) then
    return null;
  end if;

  for v_satir in
    with kalemler as (
      select (e->>'porsiyon_id')::bigint as porsiyon_id,
             (e->>'adet')::numeric       as adet,
             e->>'ad'                    as ad,
             array(select jsonb_array_elements_text(coalesce(e->'cikan', '[]')))::bigint[]   as cikan,
             array(select jsonb_array_elements_text(coalesce(e->'eklenen', '[]')))::bigint[] as eklenen,
             ord
        from jsonb_array_elements(p_kalemler) with ordinality as x(e, ord)
    ),
    ihtiyac as (
      select r.malzeme_id,
             round(sum(r.miktar * k.adet))::bigint as gereken,
             (array_agg(k.ad order by k.ord desc))[1] as urun
        from kalemler k
        join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
       where recete_girer(r.tip, r.malzeme_id, k.cikan, k.eklenen)
       group by r.malzeme_id
    )
    select m.ad, m.birim, m.miktar as stok, i.gereken, i.urun
      from ihtiyac i
      join malzemeler m on m.id = i.malzeme_id
     where m.isletme_id = v_isletme
       and m.miktar - i.gereken < 0
     order by m.ad
  loop
    v_urun := coalesce(v_urun, v_satir.urun);
    v_eksikler := coalesce(v_eksikler, '') || E'\n' ||
      '*' || v_satir.ad || '*: ' ||
      stok_miktar_metni(v_satir.stok, v_satir.birim) || ' var, ' ||
      stok_miktar_metni(v_satir.gereken, v_satir.birim) || ' gerekiyor';
  end loop;

  if v_eksikler is null then
    return null;
  end if;

  return '*' || v_urun || '* için stok yetersiz' || v_eksikler;
end $fn$;

revoke all on function stok_on_denetim(jsonb) from public, anon;
grant execute on function stok_on_denetim(jsonb) to authenticated;
