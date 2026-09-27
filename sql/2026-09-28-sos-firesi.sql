-- HAZIRLANAN MALZEMENİN FİRESİ — "1 kg salsa döküldü".
--
-- Sosun hammaddeleri satışta düşüyor (2026-09-27-ara-recete-uretim.sql).
-- Dökülen sos hiç satılmayacağı için içindeki domates de hiç düşmeyecekti;
-- stok sayımda fark verirdi. Kararı Ramazan verdi (28 Eyl 2026): sosun
-- firesi ve çıkışı tarifindeki hammaddeleri de aynı fişte düşürür.
--
-- Hammadde satırları sosun satırına bağlı duruyor: sos satırı düzenlenince
-- oranla değişiyor, silinince onlar da gidiyor. Tek başlarına düzeltilmiyorlar.
--
-- Tutar hammaddelerde: sosun satırı ₺0 yazılıyor, yoksa aynı kayıp raporda
-- iki kez (sos + domates) görünürdü.
--
-- Bu dosya 2026-09-27-ara-recete-uretim.sql'den SONRA çalışır.

alter table stok_hareketleri add column if not exists bagli_hareket_id bigint
  references stok_hareketleri (id) on delete cascade;

create index if not exists stok_hareketleri_bagli
  on stok_hareketleri (bagli_hareket_id) where bagli_hareket_id is not null;

-- 1) Fire ve çıkışta hammaddeler -----------------------------------------
create or replace function sos_firesi_dagit()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.tip not in ('fire', 'cikis') or new.bagli_hareket_id is not null then
    return null;
  end if;

  insert into stok_hareketleri
    (isletme_id, belge_id, malzeme_id, malzeme_ad, tip, miktar, onceki, sonraki,
     kisi_id, zaman, bagli_hareket_id)
  select new.isletme_id, new.belge_id, h.id, h.ad, new.tip,
         round(new.miktar::numeric * s.miktar / m.tarif_miktari)::bigint,
         0, 0, new.kisi_id, new.zaman, new.id
    from malzemeler m
    join recete_satirlari s on s.sahip_malzeme_id = m.id
    join malzemeler h       on h.id = s.malzeme_id
   where m.id = new.malzeme_id
     and m.tarif_miktari is not null
     and round(new.miktar::numeric * s.miktar / m.tarif_miktari) <> 0
   order by s.sira, s.id;

  return null;
end $fn$;

drop trigger if exists sos_firesi_dagit_t on stok_hareketleri;
create trigger sos_firesi_dagit_t
  after insert on stok_hareketleri
  for each row execute function sos_firesi_dagit();

-- 2) Sosun satırı ₺0 --------------------------------------------------------
-- 2026-09-27-ara-recete-uretim.sql'deki ile aynı; yalnız sos dalında fire ve
-- çıkış satırına tarif maliyeti değil sıfır yazılıyor.
create or replace function stok_ortalama_maliyet(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  satir    record;
  eldeki   numeric := 0;
  ortalama numeric;
  taban    numeric;
  sos      record;
begin
  if exists (select 1 from malzemeler where id = p_malzeme_id and tarif_miktari is not null) then
    perform ara_maliyet_tazele(p_malzeme_id);
    update stok_hareketleri
       set birim_maliyet = 0
     where malzeme_id = p_malzeme_id
       and tip in ('fire', 'cikis')
       and birim_maliyet is distinct from 0;
    return;
  end if;

  for satir in
    select id, tip, miktar, birim_maliyet
      from stok_hareketleri
     where malzeme_id = p_malzeme_id
     order by zaman, id
  loop
    if satir.tip = 'giris' and satir.miktar > 0 and satir.birim_maliyet is not null then
      taban := case when ortalama is null then 0 else greatest(eldeki, 0) end;

      ortalama := (taban * coalesce(ortalama, satir.birim_maliyet)
                   + satir.miktar * satir.birim_maliyet)
                  / (taban + satir.miktar);
    elsif satir.tip in ('fire', 'cikis')
          and satir.birim_maliyet is distinct from round(ortalama, 6) then
      update stok_hareketleri
         set birim_maliyet = round(ortalama, 6)
       where id = satir.id;
    end if;

    eldeki := eldeki + satir.miktar;
  end loop;

  update malzemeler
     set ortalama_maliyet = round(ortalama, 6)
   where id = p_malzeme_id;

  for sos in
    select distinct sahip_malzeme_id as id
      from recete_satirlari
     where malzeme_id = p_malzeme_id
       and sahip_malzeme_id is not null
  loop
    perform ara_maliyet_tazele(sos.id);
  end loop;
end $fn$;

revoke all on function stok_ortalama_maliyet(bigint) from public, anon, authenticated;

-- 3) Silme ------------------------------------------------------------------
-- 2026-09-22-stok-hareket-duzenle.sql'deki ile aynı; bağlı hammadde satırları
-- da gidiyor (cascade) ve onların defteri de yeniden kuruluyor.
create or replace function stok_hareketi_sil(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_malzeme bigint;
  v_belge   bigint;
  v_kalan   int;
  v_bagli   bigint[];
  v_ust     bigint;
  m         bigint;
begin
  select malzeme_id, belge_id, bagli_hareket_id into v_malzeme, v_belge, v_ust
    from stok_hareketleri
   where id = p_id and isletme_id = oturum_isletmesi();

  if v_malzeme is null then
    raise exception 'Hareket bulunamadi';
  end if;

  if v_ust is not null then
    raise exception 'Bu satır hazırlanan malzemenin firesine bağlı; o satır silinince kalkar.'
      using errcode = 'P0001';
  end if;

  select array_agg(distinct malzeme_id) into v_bagli
    from stok_hareketleri where bagli_hareket_id = p_id;

  delete from stok_hareketleri where id = p_id;

  select count(*) into v_kalan from stok_hareketleri where belge_id = v_belge;
  if v_kalan = 0 then
    delete from stok_belgeleri where id = v_belge;
  end if;

  perform stok_zincirini_kur(v_malzeme);
  foreach m in array coalesce(v_bagli, '{}') loop
    perform stok_zincirini_kur(m);
  end loop;
end $fn$;

-- 4) Düzenleme --------------------------------------------------------------
-- Bağlı satırlar sosun miktarıyla aynı oranda değişiyor; tarif sonradan
-- değişmiş olsa bile o günkü oran korunuyor.
create or replace function stok_hareketi_duzenle(
  p_id            bigint,
  p_miktar        bigint,
  p_birim_maliyet numeric,
  p_zaman         timestamptz,
  p_aciklama      text,
  p_sebep         text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_malzeme bigint;
  v_belge   bigint;
  v_eski    bigint;
  v_ust     bigint;
  v_bagli   bigint[];
  m         bigint;
begin
  if p_miktar = 0 then
    raise exception 'Miktar sifir olamaz';
  end if;

  select malzeme_id, belge_id, miktar, bagli_hareket_id
    into v_malzeme, v_belge, v_eski, v_ust
    from stok_hareketleri
   where id = p_id and isletme_id = oturum_isletmesi();

  if v_malzeme is null then
    raise exception 'Hareket bulunamadi';
  end if;

  if v_ust is not null then
    raise exception 'Bu satır hazırlanan malzemenin firesine bağlı; o satır düzenlenince değişir.'
      using errcode = 'P0001';
  end if;

  update stok_hareketleri
     set miktar = p_miktar,
         birim_maliyet = p_birim_maliyet,
         zaman = p_zaman
   where id = p_id;

  select array_agg(distinct malzeme_id) into v_bagli
    from stok_hareketleri where bagli_hareket_id = p_id;

  -- Oran küçülünce sıfıra inen satır kalmıyor; kısıt da izin vermezdi.
  delete from stok_hareketleri
   where bagli_hareket_id = p_id
     and round(miktar::numeric * p_miktar / v_eski) = 0;

  update stok_hareketleri
     set miktar = round(miktar::numeric * p_miktar / v_eski)::bigint,
         zaman = p_zaman
   where bagli_hareket_id = p_id;

  update stok_belgeleri
     set aciklama = nullif(btrim(coalesce(p_aciklama, '')), ''),
         sebep = p_sebep,
         zaman = p_zaman
   where id = v_belge;

  perform stok_zincirini_kur(v_malzeme);
  foreach m in array coalesce(v_bagli, '{}') loop
    perform stok_zincirini_kur(m);
  end loop;
end $fn$;

grant execute on function stok_hareketi_sil(bigint) to authenticated;
grant execute on function stok_hareketi_duzenle(bigint, bigint, numeric, timestamptz, text, text)
  to authenticated;
