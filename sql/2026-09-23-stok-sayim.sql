-- STOK MODÜLÜ — sayım.
--
-- Sayım bir hareket değil, başlayıp biten bir SÜREÇ: kişi elinde telefonla
-- raf raf geziyor, yarım saat sürüyor, yarıda kesilebiliyor. Bu yüzden
-- kendi tablosu var; girilen rakamlar deftere değil taslağa yazılıyor ve
-- rapor onaylanana kadar stokta hiçbir şey değişmiyor.
--
-- İki karar şemanın her yerinde görünüyor:
--
-- 1) KÖRLEME SAYIM. Sayarken sistemdeki miktar görünmüyor. Rakamı gören kişi
--    24 saysa bile "yanlış saymışımdır" deyip 25 yazıyor, sayım kendini
--    doğrulayan bir tiyatroya dönüyor. Sistem miktarı raporda görünür.
--
-- 2) SİSTEM MİKTARI SAYIM ANINDA DONUYOR. Kalem yazılırken o malzemenin
--    o andaki miktarı kaleme kopyalanıyor. Sayım sürerken satış düşümü ya da
--    mal kabulü olursa raporun gösterdiği fark kaymasın diye.

-- 1) Sayım başlığı ---------------------------------------------------------
create table if not exists stok_sayimlari (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  -- tumu = bütün aktif malzemeler · grup = seçilen gruplar · kritik = yalnız
  -- kritik seviyenin altındakiler
  kapsam     text   not null check (kapsam in ('tumu', 'grup', 'kritik')),
  -- Kapsam 'grup' ise seçilen grup kimlikleri; diğerlerinde boş.
  grup_idler bigint[] not null default '{}',
  -- acik = sayım sürüyor · onayli = rapor onaylandı, hareketler yazıldı ·
  -- iptal = vazgeçildi. Onaylı sayım silinmiyor: ay sonu maliyet hesabı
  -- (açılış + alış − kapanış) kapanış rakamını buradan okuyacak.
  durum      text   not null default 'acik'
             check (durum in ('acik', 'onayli', 'iptal')),
  -- Onaylanınca yazılan belge; rapordan deftere geçiş buradan izleniyor.
  belge_id   bigint references stok_belgeleri (id) on delete set null,
  aciklama   text,
  kisi_id    bigint references personel (id),
  kisi_ad    text,
  baslangic  timestamptz not null default now(),
  bitis      timestamptz
);

create index if not exists stok_sayimlari_durum
  on stok_sayimlari (isletme_id, durum, baslangic desc);

-- 2) Sayım kalemleri -------------------------------------------------------
-- Kapsamdaki her malzeme için bir satır; `sayilan` boş kaldıysa o malzeme
-- sayılmamış demektir. Sıfır ile boş aynı şey değil: "hiç kalmamış" ayrı
-- bilgidir, "bakmadım" ayrı.
create table if not exists stok_sayim_kalemleri (
  id         bigint generated always as identity primary key,
  isletme_id bigint not null references isletmeler (id) on delete cascade,
  sayim_id   bigint not null references stok_sayimlari (id) on delete cascade,
  malzeme_id bigint not null references malzemeler (id) on delete cascade,
  -- Ad burada da donuyor: malzeme sonradan yeniden adlandırılsa bile eski
  -- sayım o günkü adıyla okunur.
  malzeme_ad text   not null,
  -- En küçük birimde tam sayı. Boş = sayılmadı.
  sayilan    bigint,
  -- Kalem yazılırken donan sistem miktarı (yukarıdaki 2. karar).
  sistem     bigint not null default 0,
  zaman      timestamptz
);

create unique index if not exists stok_sayim_kalemleri_malzeme
  on stok_sayim_kalemleri (sayim_id, malzeme_id);

-- 3) Satır güvenliği -------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['stok_sayimlari', 'stok_sayim_kalemleri'] loop
    execute format('alter table %I alter column isletme_id set default oturum_isletmesi()', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_isletme', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (isletme_id = oturum_isletmesi())
         with check (isletme_id = oturum_isletmesi())',
      t || '_isletme', t
    );
  end loop;
end $$;

-- Onaylanmış sayım artık bir muhasebe kaydı: rakamı sonradan değiştirilemez.
create or replace function stok_sayim_kilidi()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_durum text;
begin
  select durum into v_durum from stok_sayimlari
   where id = coalesce(new.sayim_id, old.sayim_id);

  if v_durum is distinct from 'acik' then
    raise exception 'Kapanmis sayim degistirilemez';
  end if;

  return coalesce(new, old);
end $fn$;

drop trigger if exists stok_sayim_kilidi_t on stok_sayim_kalemleri;
create trigger stok_sayim_kilidi_t
  before insert or update or delete on stok_sayim_kalemleri
  for each row execute function stok_sayim_kilidi();

-- 4) Sayımı aç -------------------------------------------------------------
-- Kapsamdaki malzemeleri kalem olarak tek seferde yazıyor. Aynı anda ikinci
-- bir açık sayım olmasın: iki kişi ayrı ayrı sayıp ikisi de onaylarsa
-- ikincisi birincinin düzeltmesini yeniden düzeltir.
create or replace function stok_sayimi_ac(
  p_kapsam   text,
  p_gruplar  bigint[],
  p_kisi_id  bigint,
  p_kisi_ad  text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_isletme bigint := oturum_isletmesi();
  v_id      bigint;
begin
  if exists (select 1 from stok_sayimlari
              where isletme_id = v_isletme and durum = 'acik') then
    raise exception 'Zaten acik bir sayim var';
  end if;

  insert into stok_sayimlari (isletme_id, kapsam, grup_idler, kisi_id, kisi_ad)
  values (v_isletme, p_kapsam, coalesce(p_gruplar, '{}'), p_kisi_id, p_kisi_ad)
  returning id into v_id;

  insert into stok_sayim_kalemleri
    (isletme_id, sayim_id, malzeme_id, malzeme_ad, sistem)
  select v_isletme, v_id, m.id, m.ad, m.miktar
    from malzemeler m
   where m.isletme_id = v_isletme
     and m.aktif
     and (
       p_kapsam = 'tumu'
       or (p_kapsam = 'grup'   and m.grup_id = any (coalesce(p_gruplar, '{}')))
       or (p_kapsam = 'kritik' and m.kritik_seviye > 0
                               and m.miktar <= m.kritik_seviye)
     );

  if not exists (select 1 from stok_sayim_kalemleri where sayim_id = v_id) then
    raise exception 'Kapsamda malzeme yok';
  end if;

  return v_id;
end $fn$;

-- 5) Sayımı onayla ---------------------------------------------------------
-- Rapor onaylanınca tek bir 'sayim' belgesi açılıyor ve YALNIZ farkı olan
-- malzemeye hareket yazılıyor. Sıfır fark deftere girmez: otuz malzemelik
-- bir sayımdan yirmi yedi anlamsız satır çıkardı.
--
-- Fark hesabı kalemdeki DONMUŞ sistem miktarına göre değil, malzemenin
-- O ANKİ miktarına göre yapılıyor. Sebebi: hareket zinciri şu anki miktarın
-- üstüne yazıyor; sayım sürerken satış olduysa donmuş rakamla yazılan fark
-- stoğu yanlış yere çekerdi. Rapor donmuş rakamı gösterir (kişi neyi
-- saydıysa onun karşılığı), defter gerçeği düzeltir.
create or replace function stok_sayimi_onayla(p_sayim_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_isletme bigint := oturum_isletmesi();
  v_sayim   stok_sayimlari%rowtype;
  v_belge   bigint;
  k         record;
  v_fark    bigint;
begin
  select * into v_sayim from stok_sayimlari
   where id = p_sayim_id and isletme_id = v_isletme
   for update;

  if not found then
    raise exception 'Sayim bulunamadi';
  end if;
  if v_sayim.durum <> 'acik' then
    raise exception 'Sayim zaten kapanmis';
  end if;

  insert into stok_belgeleri (isletme_id, tip, aciklama, kisi_id, kisi_ad)
  values (v_isletme, 'sayim', v_sayim.aciklama, v_sayim.kisi_id, v_sayim.kisi_ad)
  returning id into v_belge;

  for k in
    select sk.malzeme_id, sk.malzeme_ad, sk.sayilan, m.miktar, m.ortalama_maliyet
      from stok_sayim_kalemleri sk
      join malzemeler m on m.id = sk.malzeme_id
     where sk.sayim_id = p_sayim_id
       and sk.sayilan is not null
     order by sk.malzeme_ad
  loop
    v_fark := k.sayilan - k.miktar;
    continue when v_fark = 0;

    insert into stok_hareketleri
      (isletme_id, belge_id, malzeme_id, malzeme_ad, tip, miktar,
       birim_maliyet, kisi_id)
    values
      (v_isletme, v_belge, k.malzeme_id, k.malzeme_ad, 'sayim', v_fark,
       k.ortalama_maliyet, v_sayim.kisi_id);
  end loop;

  -- Bütün farklar sıfırsa belge boş kalıyor; kalemsiz fiş defterde boş bir
  -- başlık olarak dururdu.
  if not exists (select 1 from stok_hareketleri where belge_id = v_belge) then
    delete from stok_belgeleri where id = v_belge;
    v_belge := null;
  end if;

  update stok_sayimlari
     set durum = 'onayli', belge_id = v_belge, bitis = now()
   where id = p_sayim_id;

  return v_belge;
end $fn$;

grant execute on function stok_sayimi_ac(text, bigint[], bigint, text) to authenticated;
grant execute on function stok_sayimi_onayla(bigint) to authenticated;
revoke all on function stok_sayim_kilidi() from public, anon, authenticated;

-- 6) Ayrı yetki ------------------------------------------------------------
-- Sayım stoğu görmek ya da mal girmek değil: raf raf gezip stoğu düzelten,
-- kayıp ve fireyi ortaya çıkaran bir denetim işi. Mutfak sorumlusu mal
-- girebilsin ama sayımı kim yapacağına işletme ayrı karar versin diye
-- kendi yetkisi var (Ramazan kararı, 23 Eyl 2026).
insert into yetkiler (kod, ad, grup, sira)
select 'stok.sayim', 'Stok sayımı', 'Tanım', 9
where not exists (select 1 from yetkiler y where y.kod = 'stok.sayim');

insert into rol_yetkileri (isletme_id, rol_id, yetki_id)
select r.isletme_id, r.id, y.id
from roller r cross join yetkiler y
where r.ad in ('Yönetici', 'Müdür')
  and y.kod = 'stok.sayim'
  and not exists (
    select 1 from rol_yetkileri ry where ry.rol_id = r.id and ry.yetki_id = y.id
  );
