-- Kaydedilmiş kalemin adedini düşürmek "Üründen çıkarma" yetkisi istiyor.
-- "Miktar değiştirme" yetkisiyle 16 latteyi 1'e indirmek, on beşini iptal
-- etmekle aynı sonucu veriyordu. Adedi artırmak eskisi gibi miktar yetkisiyle.

create or replace function kalem_yetkisi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform yetki_iste('siparis.urun_cikar', 'Kaydedilmiş ürünü çıkarma yetkiniz yok.');
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

  if new.adet is distinct from old.adet then
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

drop trigger if exists kalem_yetkisi on adisyon_kalemleri;
create trigger kalem_yetkisi
  before insert or update or delete on adisyon_kalemleri
  for each row execute function kalem_yetkisi();
