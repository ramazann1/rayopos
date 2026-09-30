-- Ürün taşıma "Üründen çıkarma" yetkisi istemesin (30 Eyl 2026).
--
-- Taşıma kalemi hedefe yazıp kaynaktan siliyor (ya da adedini düşürüyor).
-- Silme `kalem_yetkisi` tetiğinde "Üründen çıkarma" istiyordu; o yetkisi
-- olmayan garson taşıyınca ürün hedefe yazılıyor, kaynakta kalıyordu — iki
-- masada birden duruyor, iki kez satılmış sayılıyordu.
--
-- Taşıma yetkisini silme yetkisine çevirmek yanlış olurdu: garson taşıma
-- bahanesiyle istediği kalemi silebilirdi. Kaynaktan düşme artık bir sunucu
-- fonksiyonunda: yalnız az önce yazılmış, henüz kaynaktan düşülmemiş bir
-- taşıma kopyası için, kopyanın adedi kadar düşüyor. Her kopya bir kez.

alter table adisyon_kalemleri
  add column if not exists tasima_kapandi boolean not null default false;

create or replace function kalem_yetkisi()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tasima boolean := current_setting('rayopos.tasima', true) = '1';
begin
  if tg_op = 'DELETE' then
    if not tasima then
      perform yetki_iste('siparis.urun_cikar', 'Kaydedilmiş ürünü çıkarma yetkiniz yok.');
    end if;
    return old;
  end if;

  -- Yeni kalem sipariş almanın kendisi. Hangi türü aldığı adisyonun kendi
  -- kaydında denetlendiği için burada üç yetkiden biri yetiyor; ayrıntılı
  -- denetim güncellemede.
  if tg_op = 'INSERT' then
    if not (
      oturum_yetkisi('siparis.al')
      or oturum_yetkisi('siparis.gelal')
      or oturum_yetkisi('siparis.paket')
    ) then
      perform yetki_iste('siparis.al', 'Sipariş alma yetkiniz yok.');
    end if;
    return new;
  end if;

  if new.adet is distinct from old.adet and not tasima then
    perform yetki_iste('siparis.miktar', 'Miktar değiştirme yetkiniz yok.');
    if new.adet < old.adet then
      perform yetki_iste('siparis.urun_cikar', 'Kaydedilmiş ürünün adedini düşürme yetkiniz yok.');
    end if;
  end if;

  if new.fiyat is distinct from old.fiyat then
    perform yetki_iste('siparis.fiyat', 'Ürün fiyatı değiştirme yetkiniz yok.');
  end if;

  if new.durum is distinct from old.durum then
    if new.durum = 'ikram' then
      perform yetki_iste('siparis.ikram', 'İkram yapma yetkiniz yok.');
    elsif new.durum = 'iptal' then
      -- Kalem iptali ekranda "üründen çıkarma" yetkisiyle aynı düğmede;
      -- kalem silinmiyor, iptal olarak duruyor ama karar aynı karar.
      perform yetki_iste('siparis.urun_cikar', 'Kalem iptal etme yetkiniz yok.');
    end if;
  end if;

  -- Satır indirimi hesabın tutarını düşürüyor; adisyon indirimiyle aynı kural.
  if coalesce(new.indirim, 0) is distinct from coalesce(old.indirim, 0) then
    perform indirim_denetle(new.indirim, new.indirim_tanim_id);
  end if;

  return new;
end;
$$;

create or replace function tasinan_kalemi_kaynaktan_dus(p_kopya bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  kopya  adisyon_kalemleri;
  kaynak adisyon_kalemleri;
begin
  perform yetki_iste('siparis.kalem_tasi', 'Ürün taşıma yetkiniz yok.');

  select k.* into kopya
    from adisyon_kalemleri k
    join turlar t on t.id = k.tur_id
    join adisyonlar a on a.id = t.adisyon_id
   where k.id = p_kopya
     and a.isletme_id = oturum_isletmesi()
     and k.tasindigi_kalem_id is not null
     and not k.tasima_kapandi
   for update of k;
  if not found then
    raise exception 'Taşınan ürün bulunamadı.';
  end if;

  select * into kaynak from adisyon_kalemleri where id = kopya.tasindigi_kalem_id for update;

  perform set_config('rayopos.tasima', '1', true);

  if found then
    if kaynak.adet <= kopya.adet then
      delete from adisyon_kalemleri where id = kaynak.id;
    else
      update adisyon_kalemleri set adet = adet - kopya.adet where id = kaynak.id;
    end if;
  end if;

  update adisyon_kalemleri set tasima_kapandi = true where id = kopya.id;

  perform set_config('rayopos.tasima', '', true);
end $$;

revoke all on function tasinan_kalemi_kaynaktan_dus(bigint) from anon, public;
grant execute on function tasinan_kalemi_kaynaktan_dus(bigint) to authenticated;
