-- STOK ÖN DENETİMİ — "stok yetersiz" uyarısı Kaydet'e basınca hemen çıksın.
--
-- Denetim kalem yazılırken tetikleyicide yapılıyordu; uyarı ancak hesap
-- güncellenip tur açıldıktan sonra, beşinci istekte geliyordu (ölçüldü:
-- 0,7-2 sn). Ekran artık yeni kalemleri önce buraya soruyor; yetmiyorsa
-- hiçbir şey yazılmadan uyarı çıkıyor.
--
-- Asıl kilit yerinde duruyor: bu fonksiyon yalnız erken haber veriyor,
-- atlanırsa tetikleyici yine reddediyor. Mesaj biçimi tetikleyicininkiyle aynı.
--
-- Girdi: [{"porsiyon_id": 12, "adet": 9, "ad": "CAFE LATTE"}, ...]
-- Çıktı: stok yetiyorsa null, yetmiyorsa uyarı metni.

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
             ord
        from jsonb_array_elements(p_kalemler) with ordinality as x(e, ord)
    ),
    ihtiyac as (
      select r.malzeme_id,
             round(sum(r.miktar * k.adet))::bigint as gereken,
             (array_agg(k.ad order by k.ord desc))[1] as urun
        from kalemler k
        join recete_satirlari r on r.porsiyon_id = k.porsiyon_id
       where r.tip in ('normal', 'cikarilabilir')
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
