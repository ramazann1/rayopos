-- Eksi stok uyarısı gerçek stoğu gösteriyor (0'a yuvarlamıyor).
drop function if exists stok_satis_dusumu(bigint);

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
        -- Düşmesi gereken: iptal olmayan kalemlerin adedi × reçete miktarı.
        -- Yuvarlama malzeme toplamında bir kez yapılıyor.
        select r.malzeme_id, round(sum(r.miktar * k.adet))::bigint as hedef
          from adisyon_kalemleri k
          join turlar t           on t.id = k.tur_id
          join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
         where t.adisyon_id = p_adisyon_id
           and v_adisyon.durum <> 'iptal'
           and k.durum is distinct from 'iptal'
           and r.tip in ('normal', 'cikarilabilir')
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

    -- Eksi stok kapalıysa yetmeyen düşüm reddediliyor. Hepsi toplanıp tek
    -- mesajda alt alta söyleniyor: ilk yetmeyende durulsaydı garson süt
    -- sorununu çözüp tekrar denediğinde bu kez çekirdeği öğrenirdi.
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
         order by k.id desc
         limit 1;
      end if;

      v_eksikler := coalesce(v_eksikler, '') || E'\n' ||
        '*' || v_satir.ad || '*: ' ||
        stok_miktar_metni(v_satir.stok, v_satir.birim) || ' var, ' ||
        stok_miktar_metni(-v_satir.fark, v_satir.birim) || ' gerekiyor';
      continue;
    end if;

    -- Belge ilk farkta açılıyor: değişmeyen kayıtta boş fiş yok.
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

  -- Hata bütün işlemi geri alıyor: bu döngüde yazılan hareketler de silinir.
  if v_eksikler is not null then
    raise exception '*%* için stok yetersiz%', v_urun, v_eksikler
      using errcode = 'P0001';
  end if;

  perform kalem_maliyetlerini_yaz(p_adisyon_id);
end $fn$;

revoke all on function stok_satis_dusumu(bigint, boolean) from public, anon, authenticated;
