-- Sadakat programının iskeleti: para puan cüzdanı.
--
-- Müşteri kapanan hesabının yüzde X'ini cüzdanına TL olarak kazanıyor,
-- sonraki hesaplarda "Cüzdan" ödeme tipiyle harcıyor. Açık hesaptan ayrı
-- tutuluyor: açık hesap müşterinin işletmeye borcu, cüzdan işletmenin
-- müşteriye verdiği hediye — ikisi tek bakiyede karışırsa kasa tutmaz.
--
-- Kazanma ve harcama tarayıcıdan yazılmıyor, tetikleyiciler yazıyor:
--   kazanc  — adisyon kapanınca; yeniden açılırsa ya da iptal edilirse siliniyor.
--   harcama — "Cüzdan" tipli tahsilat yazılınca; tahsilat silinirse onunla gidiyor.
--   duzeltme — elle bakiye düzeltme, cari tahsilat yetkisi istiyor.

alter table isletme_ayarlari add column if not exists sadakat_acik boolean not null default false;
-- Kapanan hesabın yüzde kaçı cüzdana dönüyor.
alter table isletme_ayarlari add column if not exists sadakat_oran numeric(5,2) not null default 5;
-- Cüzdan bu tutara ulaşmadan harcanamıyor; 0 = sınır yok.
alter table isletme_ayarlari add column if not exists sadakat_alt_limit numeric(12,2) not null default 0;
-- Bir hesabın en fazla yüzde kaçı cüzdanla ödenebiliyor.
alter table isletme_ayarlari add column if not exists sadakat_ust_oran numeric(5,2) not null default 100;

alter table isletme_ayarlari drop constraint if exists sadakat_oran_aralik;
alter table isletme_ayarlari add constraint sadakat_oran_aralik
  check (sadakat_oran between 0 and 100 and sadakat_ust_oran between 0 and 100 and sadakat_alt_limit >= 0);

-- Bakiye müşteri satırında tutulmuyor, cari hesaptaki kuralın aynısı:
-- hareketlerin toplamı. Artı tutar cüzdana giren, eksi tutar çıkan.
create table if not exists sadakat_hareketleri (
  id          bigint generated always as identity primary key,
  isletme_id  bigint not null references isletmeler (id) on delete cascade,
  musteri_id  bigint not null references musteriler (id) on delete cascade,
  tip         text   not null check (tip in ('kazanc', 'harcama', 'duzeltme')),
  tutar       numeric(12,2) not null check (tutar <> 0),
  adisyon_id  bigint references adisyonlar (id) on delete set null,
  tahsilat_id bigint references tahsilatlar (id) on delete cascade,
  aciklama    text,
  personel_id bigint references personel (id) on delete set null,
  olusturma   timestamptz not null default now()
);

create index if not exists sadakat_hareketleri_musteri
  on sadakat_hareketleri (isletme_id, musteri_id, olusturma);
create index if not exists sadakat_hareketleri_adisyon
  on sadakat_hareketleri (adisyon_id);
create index if not exists sadakat_hareketleri_tahsilat
  on sadakat_hareketleri (tahsilat_id);

alter table sadakat_hareketleri alter column isletme_id set default oturum_isletmesi();
alter table sadakat_hareketleri enable row level security;

drop policy if exists sadakat_hareketleri_oku on sadakat_hareketleri;
create policy sadakat_hareketleri_oku on sadakat_hareketleri for select to authenticated
  using (isletme_id = (select oturum_isletmesi()));

-- Tarayıcı yalnız düzeltme yazabiliyor; kazanma ve harcama tetikleyicinin işi.
drop policy if exists sadakat_hareketleri_duzelt on sadakat_hareketleri;
create policy sadakat_hareketleri_duzelt on sadakat_hareketleri for insert to authenticated
  with check (
    isletme_id = (select oturum_isletmesi())
    and tip = 'duzeltme'
    and (select oturum_yetkilerinden_biri(array['cari.tahsilat']))
  );

-- Kim yaptı: tarayıcıdan değil oturumdan.
create or replace function sadakat_imzasi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.personel_id := oturum_personeli();
  return new;
end;
$$;

drop trigger if exists sadakat_imza_tetik on sadakat_hareketleri;
create trigger sadakat_imza_tetik before insert on sadakat_hareketleri
  for each row execute function sadakat_imzasi();

-- Cüzdan eksiye düşemez. Müşteri satırı kilitleniyor: iki kasa aynı anda
-- aynı parayı harcamaya kalkarsa ikincisi birincinin sonucunu görsün.
create or replace function sadakat_bakiye_denetimi()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bakiye numeric;
begin
  if new.tutar >= 0 then return new; end if;

  perform 1 from musteriler where id = new.musteri_id for update;
  select coalesce(sum(tutar), 0) into v_bakiye
    from sadakat_hareketleri where musteri_id = new.musteri_id;

  if v_bakiye + new.tutar < 0 then
    raise exception 'Cüzdan bakiyesi yetmiyor. Kullanılabilir: ₺%', to_char(v_bakiye, 'FM999G999G990D00');
  end if;
  return new;
end;
$$;

drop trigger if exists sadakat_bakiye_tetik on sadakat_hareketleri;
create trigger sadakat_bakiye_tetik before insert on sadakat_hareketleri
  for each row execute function sadakat_bakiye_denetimi();

-- Cüzdanla ödeme: tahsilat yazılırken cüzdandan düşülüyor. Bakiye yetmezse
-- tahsilat da yazılmıyor, ikisi tek işlem. Müşteri adisyondan okunuyor.
create or replace function sadakat_harcamasi()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_musteri bigint; v_isletme bigint;
begin
  if tg_op = 'UPDATE' then
    if old.tip = new.tip and old.tutar = new.tutar then return new; end if;
    delete from sadakat_hareketleri where tahsilat_id = new.id;
  end if;

  if new.tip <> 'Cüzdan' then return new; end if;

  select musteri_id, isletme_id into v_musteri, v_isletme
    from adisyonlar where id = new.adisyon_id;
  if v_musteri is null then
    raise exception 'Cüzdanla ödeme için önce hesaba müşteri bağlayın.';
  end if;

  insert into sadakat_hareketleri (isletme_id, musteri_id, tip, tutar, adisyon_id, tahsilat_id)
  values (v_isletme, v_musteri, 'harcama', -new.tutar, new.adisyon_id, new.id);
  return new;
end;
$$;

drop trigger if exists sadakat_harcama_tetik on tahsilatlar;
create trigger sadakat_harcama_tetik after insert or update of tip, tutar on tahsilatlar
  for each row execute function sadakat_harcamasi();

-- Kazanç: adisyon kapanınca, cüzdan dışındaki ödemelerin yüzdesi. Cüzdanla
-- ödenen kısım yeniden kazandırmıyor; bahşiş tahsilat tutarında değil.
-- Kapanmış adisyon yeniden açılır ya da iptal edilirse kazanç geri alınıyor,
-- tekrar kapanınca o anki tutarla yeniden yazılıyor.
create or replace function sadakat_kazanci()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_acik boolean;
  v_oran numeric;
  v_taban numeric;
  v_tutar numeric;
begin
  if old.durum = 'kapali' and new.durum <> 'kapali' then
    delete from sadakat_hareketleri where adisyon_id = new.id and tip = 'kazanc';
  end if;

  if new.durum = 'kapali' and old.durum <> 'kapali' and new.musteri_id is not null then
    select sadakat_acik, sadakat_oran into v_acik, v_oran
      from isletme_ayarlari where isletme_id = new.isletme_id;
    if not coalesce(v_acik, false) or coalesce(v_oran, 0) <= 0 then return new; end if;

    select coalesce(sum(tutar), 0) into v_taban
      from tahsilatlar where adisyon_id = new.id and tip <> 'Cüzdan';
    v_tutar := round(v_taban * v_oran / 100, 2);

    if v_tutar > 0 then
      insert into sadakat_hareketleri (isletme_id, musteri_id, tip, tutar, adisyon_id)
      values (new.isletme_id, new.musteri_id, 'kazanc', v_tutar, new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sadakat_kazanc_tetik on adisyonlar;
create trigger sadakat_kazanc_tetik after update of durum on adisyonlar
  for each row execute function sadakat_kazanci();

revoke all on function sadakat_imzasi() from anon, public;
revoke all on function sadakat_bakiye_denetimi() from anon, public;
revoke all on function sadakat_harcamasi() from anon, public;
revoke all on function sadakat_kazanci() from anon, public;
