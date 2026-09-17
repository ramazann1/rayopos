-- Mutfak aşama imzaları artık sunucuda atılıyor.
--
-- "Kim hazırladı" bugüne kadar tarayıcının gönderdiği değerle yazılıyordu
-- (mutfak.ts, acikOturum()?.id). 5 Eylül'de adisyon, tur ve kasa imzaları tam
-- bu yüzden sunucuya taşınmıştı; bu üç sütun o taramada atlanmış.
--
-- Zararı gizli: Analiz'deki mutfak süresi bu imzayla kişiye bağlanıyor, istek
-- kurcalayan biri kendi hazırladığı kalemi başkasının üstüne yazabilirdi.
--
-- Kural aynı desende: saat yeni yazıldıysa imza oturum_personeli() olur,
-- saat boşaltıldıysa (geri alma) imza da boşalır, saat değişmediyse eski imza
-- geri yazılır — duran kayıtta imza kurcalanamaz. Üç aşama ayrı ayrı bakılıyor
-- ki birini geri alırken diğerinin imzası bozulmasın.

create or replace function kalem_asama_imzasi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.hazirlik_kisi  := case when new.hazirlik_at  is not null then oturum_personeli() end;
    new.paketleme_kisi := case when new.paketleme_at is not null then oturum_personeli() end;
    new.hazir_kisi     := case when new.hazir_at     is not null then oturum_personeli() end;
    return new;
  end if;

  if new.hazirlik_at is distinct from old.hazirlik_at then
    new.hazirlik_kisi := case when new.hazirlik_at is not null then oturum_personeli() end;
  else
    new.hazirlik_kisi := old.hazirlik_kisi;
  end if;

  if new.paketleme_at is distinct from old.paketleme_at then
    new.paketleme_kisi := case when new.paketleme_at is not null then oturum_personeli() end;
  else
    new.paketleme_kisi := old.paketleme_kisi;
  end if;

  if new.hazir_at is distinct from old.hazir_at then
    new.hazir_kisi := case when new.hazir_at is not null then oturum_personeli() end;
  else
    new.hazir_kisi := old.hazir_kisi;
  end if;

  return new;
end;
$$;

drop trigger if exists kalem_asama_imza_tetik on adisyon_kalemleri;
create trigger kalem_asama_imza_tetik
  before insert or update on adisyon_kalemleri
  for each row execute function kalem_asama_imzasi();
