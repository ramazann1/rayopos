-- Aktarılmış adisyonda ödeme tipi düzeltme ve iptal (5 Eki 2026).
--
-- Önceki programdan gelen adisyon yeniden açılamıyor (masası ve ürünleri
-- RayoPOS kayıtlarına bağlı değil); iptal doğrudan yapılıyor. İptal edilen
-- hesap silinmiyor, durumu değişiyor ve ciroya girmiyor.
--
-- Tabloya ekrandan yazma yolu açılmıyor: iki fonksiyon yetkiyi kendisi
-- soruyor, değişikliği ve defter kaydını tek işlemde yazıyor.

alter table gecmis_adisyonlar add column if not exists durum text not null default 'kapali';
alter table gecmis_adisyonlar add column if not exists iptal_sebep text;

-- Defter satırı aktarılmış adisyona da bağlanabiliyor; sipariş geçmişi
-- bu sütunla okuyor.
alter table denetim_kayitlari add column if not exists gecmis_kaynak_id bigint;
create index if not exists denetim_kayitlari_gecmis on denetim_kayitlari (gecmis_kaynak_id)
  where gecmis_kaynak_id is not null;

create or replace function gecmis_odeme_tipi_duzelt(
  p_kaynak_id bigint,
  p_sira      int,
  p_tip       text,
  p_sebep     text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  a gecmis_adisyonlar;
  eski jsonb;
begin
  if not oturum_yetkisi('odeme.tip_duzelt') then
    raise exception 'Ödeme tipini düzeltme yetkiniz yok.';
  end if;

  select * into a from gecmis_adisyonlar
   where isletme_id = oturum_isletmesi() and kaynak_id = p_kaynak_id
   for update;
  if not found then
    raise exception 'Adisyon bulunamadı.';
  end if;

  eski := a.odemeler -> p_sira;
  if eski is null then
    raise exception 'Ödeme bulunamadı.';
  end if;

  update gecmis_adisyonlar
     set odemeler = jsonb_set(odemeler, array[p_sira::text, 'tip'], to_jsonb(p_tip))
   where isletme_id = a.isletme_id and kaynak_id = a.kaynak_id;

  insert into denetim_kayitlari (isletme_id, islem, gecmis_kaynak_id, yer, konu, tutar, sebep)
  values (a.isletme_id, 'tahsilat_tip_duzelt', a.kaynak_id, a.masa_ad,
          (eski ->> 'tip') || ' → ' || p_tip, (eski ->> 'tutar')::numeric,
          nullif(trim(p_sebep), ''));
end;
$$;

create or replace function gecmis_adisyon_iptal(p_kaynak_id bigint, p_sebep text)
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
  if a.durum = 'iptal' then
    raise exception 'Adisyon zaten iptal edilmiş.';
  end if;

  update gecmis_adisyonlar
     set durum = 'iptal', iptal_sebep = nullif(trim(p_sebep), '')
   where isletme_id = a.isletme_id and kaynak_id = a.kaynak_id;

  insert into denetim_kayitlari (isletme_id, islem, gecmis_kaynak_id, yer, tutar, sebep)
  values (a.isletme_id, 'adisyon_iptal', a.kaynak_id, a.masa_ad, a.toplam,
          nullif(trim(p_sebep), ''));
end;
$$;

revoke all on function gecmis_odeme_tipi_duzelt(bigint, int, text, text) from anon, public;
revoke all on function gecmis_adisyon_iptal(bigint, text) from anon, public;
grant execute on function gecmis_odeme_tipi_duzelt(bigint, int, text, text) to authenticated;
grant execute on function gecmis_adisyon_iptal(bigint, text) to authenticated;

-- Basılamayan hesap fişinden vazgeçmek. Kuyruğu güncellemek yazıcı yönetimi
-- yetkisinde; fişi gönderen garson yalnız kendi bekleyen fişini, kimliğini
-- bildiği için, sıradan düşürebiliyor. Basılmış ya da basılamamış fişe
-- dokunulmuyor.
create or replace function bekleyen_fisi_birak(p_kimlikler text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not oturum_yetkisi('siparis.fis_yazdir') then
    raise exception 'Fiş yazdırma yetkiniz yok.';
  end if;

  update yazdirma_kuyrugu
     set durum = 'iptal', hata = 'Gönderen vazgeçti.'
   where isletme_id = oturum_isletmesi()
     and istemci_kimlik::text = any (p_kimlikler)
     and durum = 'bekliyor';
end;
$$;

revoke all on function bekleyen_fisi_birak(text[]) from anon, public;
grant execute on function bekleyen_fisi_birak(text[]) to authenticated;
