-- Fiş kuyruğu temizliği: yer açan şey satır değil, fişin metni.
--
-- Ölçüldü (21 Eyl 2026): 250 adisyon/gün senaryosunda veritabanı ayda ~134 MB
-- büyüyor ve ücretsiz paketin 500 MB'ı 3,5 ayda doluyor. Büyümenin kabaca
-- yarısı fiş kuyruğu: her tur bir mutfak fişi bırakıyor (~900 bayt) ve hesap
-- fişi logoyu base64 olarak içinde taşıdığı için ~4 KB tutuyor. Basıldıktan
-- sonra hiçbiri silinmiyordu.
--
-- İlk düşünülen satırı silmekti. Tablo tanımındaki not onu eledi: `icerik`
-- bilerek donduruluyor ki şablon değişse bile eski fiş o günkü hâliyle
-- yeniden basılabilsin. Satır gidince o kapı kapanırdı — üstelik masa
-- kartındaki "hesap fişi basıldı" işareti de bu satıra bakıyor.
--
-- Onun için satır kalıyor, METİN boşaltılıyor. Yerin tamamına yakınını metin
-- tutuyor; kalan satır yüz bayt civarı. Böylece:
--   * masa kartındaki fiş işareti etkilenmiyor (o `basilma`ya bakıyor),
--   * Bağlantı Durumu ekranının yazıcı geçmişi duruyor,
--   * geçmiş adisyonlar zaten başka tablolarda, onlara hiç dokunulmuyor.
-- Kaybedilen tek şey: yedi günden eski bir fişin harfi harfine kopyası.
-- Fiş o adisyondan bugünkü şablonla yeniden üretilebiliyor.
--
-- BEKLEYEN FİŞE ASLA DOKUNULMUYOR. Metni boşaltılan fiş basılamaz; kural
-- yalnız işi bitmiş satırlar için geçerli (basildi / basarisiz / iptal).

create or replace function kuyrugu_temizle()
returns text language plpgsql security definer set search_path = public as $$
declare
  bosaltilan int;
  silinen    int;
begin
  -- 1) Yedi günden eski, işi bitmiş fişlerin metni boşaltılıyor.
  update yazdirma_kuyrugu
     set icerik = ''
   where durum in ('basildi', 'basarisiz', 'iptal')
     and olusturma < now() - interval '7 days'
     and icerik <> '';
  get diagnostics bosaltilan = row_count;

  -- 2) Doksan günden eski satırlar büsbütün gidiyor — ama yalnız adisyonu
  -- kapanmışsa. Aylardır açık duran bir hesabın fiş işareti kaybolmasın.
  delete from yazdirma_kuyrugu k
   using (
     select k2.id
       from yazdirma_kuyrugu k2
       left join adisyonlar a on a.id = k2.adisyon_id
      where k2.durum in ('basildi', 'basarisiz', 'iptal')
        and k2.olusturma < now() - interval '90 days'
        and (k2.adisyon_id is null or a.durum is distinct from 'acik')
      limit 20000
   ) s
   where k.id = s.id;
  get diagnostics silinen = row_count;

  return bosaltilan || ' fişin metni boşaltıldı, ' || silinen || ' satır silindi.';
exception when others then
  -- Bakım işi yüzünden fiş basımı durmaz.
  return 'Temizlik yapılamadı: ' || sqlerrm;
end;
$$;

revoke all on function kuyrugu_temizle() from anon, public;

-- Gecelik çalışıyor. pg_cron yoksa betik hata vermeden geçiyor; o durumda
-- temizlik `select kuyrugu_temizle();` ile elle çağrılabiliyor.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('kuyruk-temizligi')
    where exists (select 1 from cron.job where jobname = 'kuyruk-temizligi');
  perform cron.schedule('kuyruk-temizligi', '30 4 * * *', 'select kuyrugu_temizle()');
  raise notice 'Kuyruk temizligi her gece 04:30''ta calisacak.';
exception when others then
  raise notice 'pg_cron kurulamadi (%). Temizlik elle cagrilabilir: select kuyrugu_temizle();', sqlerrm;
end $$;

-- Birikmiş olanı şimdi temizle.
select kuyrugu_temizle();
