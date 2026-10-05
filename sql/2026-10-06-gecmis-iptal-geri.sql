-- Aktarılmış (önceki programdan gelen) adisyonda iptali geri almak. Adisyon
-- yeniden kapanmış sayılıyor, ciroya dönüyor; defterde ayrı satır kalıyor.
create or replace function gecmis_adisyon_iptal_geri(p_kaynak_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  a gecmis_adisyonlar;
begin
  if not oturum_yetkisi('siparis.iptal') then
    raise exception 'Adisyon iptal etme yetkiniz yok.';
  end if;

  select * into a from gecmis_adisyonlar
   where isletme_id = oturum_isletmesi() and kaynak_id = p_kaynak_id
   for update;
  if not found then
    raise exception 'Adisyon bulunamadı.';
  end if;
  if a.durum <> 'iptal' then
    raise exception 'Adisyon iptal edilmemiş.';
  end if;

  update gecmis_adisyonlar
     set durum = 'kapali', iptal_sebep = null
   where isletme_id = a.isletme_id and kaynak_id = a.kaynak_id;

  insert into denetim_kayitlari (isletme_id, islem, gecmis_kaynak_id, yer, tutar)
  values (a.isletme_id, 'adisyon_iptal_geri', a.kaynak_id, a.masa_ad, a.toplam);
end;
$$;

revoke all on function gecmis_adisyon_iptal_geri(bigint) from anon, public;
grant execute on function gecmis_adisyon_iptal_geri(bigint) to authenticated;
