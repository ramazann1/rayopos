-- İstasyon ekranının aşama işaretleri yetki soruyor.
--
-- `mutfak.ekran` yetkisi bugüne kadar yalnız ekranı açıp kapatıyordu: yetkisi
-- olmayan kişi menüde İstasyon satırını görmüyordu, ama tarayıcıdan istek atan
-- biri kalemi "hazır" işaretleyebiliyordu. 17 Eylül'deki yetki provası bunu
-- gösterdi — garson yetkisiyle kalemin hazır saati yazılabildi.
--
-- Zararı gizli ama gerçek: hazırlık süreleri Analiz'de mutfak performansı
-- olarak okunuyor (analiz.ts, hazir_at ile sipariş anı arasındaki fark). Yanlış
-- yazılan bir saat o raporu sessizce bozuyor, kimse fark etmiyor.
--
-- Altı sütun var, üç aşamanın zamanı ve kişisi (mutfak.ts'teki SUTUN eşlemesi).
-- Denetim hepsini birlikte koruyor: geri alma da (`asamadanCik`) aynı sütunları
-- boşaltıyor, o da aynı karardır.

create or replace function kalem_asama_yetkisi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.hazirlik_at  is distinct from old.hazirlik_at
     or new.paketleme_at is distinct from old.paketleme_at
     or new.hazir_at     is distinct from old.hazir_at
     or new.hazirlik_kisi  is distinct from old.hazirlik_kisi
     or new.paketleme_kisi is distinct from old.paketleme_kisi
     or new.hazir_kisi     is distinct from old.hazir_kisi then
    perform yetki_iste('mutfak.ekran', 'İstasyon ekranını kullanma yetkiniz yok.');
  end if;

  return new;
end;
$$;

drop trigger if exists kalem_asama_yetkisi on adisyon_kalemleri;
create trigger kalem_asama_yetkisi
  before update on adisyon_kalemleri
  for each row execute function kalem_asama_yetkisi();
