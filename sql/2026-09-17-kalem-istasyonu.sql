-- Kalem kendi tezgâhını taşıyor.
--
-- Bugüne kadar "bu kalem hangi tezgâha ait" sorusu çalışma anında ürünlerden
-- türetiliyordu: İstasyon ekranı her açılışta menünün tamamını (ürünler +
-- kategori bağları) indirip haritayı kuruyor, sonra o tezgâhın bütün ürün
-- kimliklerini sorgunun içine yazıyordu. Bar en uzun ürün listesine sahip
-- olduğu için en çok o yavaşlıyordu.
--
-- Cevap kayıtta duruyor artık. Kural değişmiyor: ürünün kendi istasyonu varsa
-- o, yoksa istasyonu tanımlı ilk kategorisinden devralıyor — Menü
-- Stüdyosu'ndaki "Kategorisine göre" ve mutfak fişiyle aynı kural
-- (yazicilar.ts, urununIstasyonu).

alter table adisyon_kalemleri
  add column if not exists istasyon_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'adisyon_kalemleri_istasyon_fkey'
  ) then
    alter table adisyon_kalemleri add constraint adisyon_kalemleri_istasyon_fkey
      foreign key (istasyon_id) references istasyonlar (id) on delete set null;
  end if;
end $$;

-- Ürünün tezgâhı: kendi istasyonu, yoksa kategorisinden devralınan.
create or replace function urunun_istasyonu(p_urun_id bigint)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.istasyon_id from urunler u where u.id = p_urun_id),
    (select k.istasyon_id
       from urun_kategorileri uk
       join kategoriler k on k.id = uk.kategori_id
      where uk.urun_id = p_urun_id and k.istasyon_id is not null
      order by uk.sira, uk.kategori_id
      limit 1)
  );
$$;

-- Kalem eklenirken bir kez hesaplanıyor. Ürün sonradan başka tezgâha
-- taşınsa da o gün mutfağa düşmüş sipariş yerini değiştirmiyor; bekleyen
-- kalemler aşağıdaki tetikleyiciyle güncelleniyor.
create or replace function kalem_istasyonu()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.urun_id is distinct from old.urun_id
     or new.istasyon_id is null then
    new.istasyon_id := case when new.urun_id is not null
                            then urunun_istasyonu(new.urun_id) end;
  end if;
  return new;
end;
$$;

drop trigger if exists kalem_istasyon_tetik on adisyon_kalemleri;
create trigger kalem_istasyon_tetik
  before insert or update of urun_id on adisyon_kalemleri
  for each row execute function kalem_istasyonu();

-- Ürünün ya da kategorinin tezgâhı değişirse henüz hazırlanmamış kalemler
-- yeni tezgâha geçiyor: tanım değişince ekranlar şaşmasın.
create or replace function bekleyen_kalem_istasyonlari()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update adisyon_kalemleri k
     set istasyon_id = urunun_istasyonu(k.urun_id)
   where k.hazir_at is null
     and k.urun_id is not null
     and k.istasyon_id is distinct from urunun_istasyonu(k.urun_id);
  return null;
end;
$$;

drop trigger if exists urun_istasyonu_degisti on urunler;
create trigger urun_istasyonu_degisti
  after update of istasyon_id on urunler
  for each statement execute function bekleyen_kalem_istasyonlari();

drop trigger if exists kategori_istasyonu_degisti on kategoriler;
create trigger kategori_istasyonu_degisti
  after update of istasyon_id on kategoriler
  for each statement execute function bekleyen_kalem_istasyonlari();

-- Eski kayıtlar: tek seferlik doldurma.
update adisyon_kalemleri
   set istasyon_id = urunun_istasyonu(urun_id)
 where istasyon_id is null and urun_id is not null;

-- Ekranın sorduğu soru bu: şu tezgâhta bekleyen kalemler.
create index if not exists adisyon_kalemleri_istasyon_bekleyen
  on adisyon_kalemleri (istasyon_id) where hazir_at is null;

create index if not exists adisyon_kalemleri_istasyon_hazir
  on adisyon_kalemleri (istasyon_id, hazir_at desc) where hazir_at is not null;
