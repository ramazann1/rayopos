-- Fire ve çıkış belgelerinde sebep.
--
-- Sebepsiz bir fire raporu "ne kadar" der, "neden" demez — oysa karar için
-- gereken ikincisi: bu ayki firenin yarısı bozulmaysa alım sıklığına,
-- yarısı kırılmaysa tezgâh düzenine bakılır.
--
-- Fire ile çıkış bilerek ayrı tipler: fire KAYIP (döküldü, bozuldu, kırıldı),
-- çıkış satılmadan yapılan BİLİNÇLİ tüketim (personel yemeği, satıcıya iade,
-- numune, etkinlik). İkisi aynı torbaya girseydi personele giden mal fire
-- raporunu şişirir, yanlış yerde önlem alınırdı.
--
-- Sebep belgede duruyor, kalemde değil: bir fire fişi genelde tek bir olaydır
-- (buzdolabı bozuldu → beş kalem, tek sebep).
alter table stok_belgeleri
  add column if not exists sebep text;

alter table stok_belgeleri drop constraint if exists stok_belgeleri_sebep_gecerli;
alter table stok_belgeleri add constraint stok_belgeleri_sebep_gecerli
  check (
    sebep is null
    or (tip = 'fire'  and sebep in ('dokuldu', 'bozuldu', 'kirildi'))
    or (tip = 'cikis' and sebep in ('personel', 'iade', 'numune', 'etkinlik'))
  );
