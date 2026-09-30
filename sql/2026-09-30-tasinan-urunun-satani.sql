-- Taşınan ürünün satışı satanda kalır (30 Eyl 2026).
--
-- Kalem taşıma hedef masada yeni bir tur açıyor; tur imzası (`tur_imzasi`)
-- taşıyanı yazıyor. Ciro tura bakıldığı için satış taşıyana geçiyordu.
--
-- Artık kalem kendi satanını taşıyor. Yeni girilen kalemde satan, oturumdaki
-- kişi; taşınan kalemde kaynak kalemin satanı. Kaynak kimliği istemciden
-- geliyor ama satan sunucuda okunuyor — taşıma sırasında satışı başkasının
-- üstüne yazmak mümkün değil. Eski kalemlerde sütun boş; rapor boşta turun
-- imzasına düşüyor.

alter table adisyon_kalemleri
  add column if not exists satan_id bigint references personel (id) on delete set null,
  add column if not exists tasindigi_kalem_id bigint;

create or replace function kalem_satani()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kaynak_satan bigint;
begin
  if tg_op = 'UPDATE' then
    new.satan_id := old.satan_id;
    new.tasindigi_kalem_id := old.tasindigi_kalem_id;
    return new;
  end if;

  new.satan_id := oturum_personeli();

  if new.tasindigi_kalem_id is not null then
    select coalesce(k.satan_id, t.garson_id) into kaynak_satan
      from adisyon_kalemleri k
      join turlar t on t.id = k.tur_id
      join adisyonlar a on a.id = t.adisyon_id
     where k.id = new.tasindigi_kalem_id
       and a.isletme_id = oturum_isletmesi();
    if found then
      new.satan_id := kaynak_satan;
    else
      new.tasindigi_kalem_id := null;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists kalem_satan_tetik on adisyon_kalemleri;
create trigger kalem_satan_tetik before insert or update on adisyon_kalemleri
  for each row execute function kalem_satani();

-- "Satışım" satanı kalemden okuyor; boşsa turun imzası.
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
     where coalesce(k.satan_id, t.garson_id) = oturum_personeli()
       and a.isletme_id = oturum_isletmesi()
       and a.durum <> 'iptal'
       and t.olusturma >= p_bas
       and t.olusturma < p_bit;
end $$;
