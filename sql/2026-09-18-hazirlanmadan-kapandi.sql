-- Hesap kapanırken hazır işaretlenmemiş kalemler.
--
-- Mutfak ekranı yalnız açık adisyonları gösterdiği için, kalem hazır
-- işaretlenmeden hesap kapanırsa kalem ekrandan sessizce düşüyor. Geriye
-- `hazir_at`'i boş bir kayıt kalıyor: Analiz'deki mutfak süresi onu ölçüme
-- almıyor (hazır saati yok, süre de yok) ama hiçbir yerde de sayılmıyor.
-- 17 Eylül'de barda 131 böyle kalem çıktı, hepsi kapanmış hesaplardan.
--
-- Kapanış saatini hazır saati diye yazmak çözüm değil: müşteri iki saat
-- oturduysa o kahve iki saatte hazır olmuş görünür, ortalama bozulur. Onun
-- yerine kaleme ayrı bir işaret konuyor — süre hesabına girmez, ama
-- "kaç kalem işaretlenmeden kapandı" diye sayılabilir.
--
-- Eski 131 kalem olduğu gibi bırakılıyor; kural bugünden sonrası için.

alter table adisyon_kalemleri
  add column if not exists kapanista_kapandi timestamptz;

comment on column adisyon_kalemleri.kapanista_kapandi is
  'Hesap kapanırken kalem hâlâ hazır işaretlenmemişse kapanış saati. Hazır saati değildir, süre hesabına girmez.';

-- İşaret adisyonun kendi tablosundan konuyor, kapatan fonksiyondan değil:
-- kapanış üç ayrı yoldan olabiliyor (ödeme, tamamı ikram, iptal) ve ileride
-- dördüncüsü çıkarsa da tetikleyici yerinde kalır.

create or replace function kapanista_bekleyen_kalemler()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update adisyon_kalemleri k
     set kapanista_kapandi = now()
    from turlar t
   where t.id = k.tur_id
     and t.adisyon_id = new.id
     and k.hazir_at is null
     and k.durum <> 'iptal'
     and k.kapanista_kapandi is null;

  return null;
end;
$$;

drop trigger if exists adisyon_kapanis_bekleyen_tetik on adisyonlar;
create trigger adisyon_kapanis_bekleyen_tetik
  after update on adisyonlar
  for each row
  when (old.durum = 'acik' and new.durum in ('kapali', 'iptal'))
  execute function kapanista_bekleyen_kalemler();
