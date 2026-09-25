-- FİRE VE ÇIKIŞIN MALİYETİ — fire/çıkış raporu için.
--
-- Girişler fiyatını taşıyordu, fire ve çıkış taşımıyordu: "bu ay kaç liralık
-- süt döküldü" sorusu cevapsızdı. Satırın malzemesinin O ANKİ ortalama
-- maliyeti artık satıra yazılıyor.
--
-- Rakam ortalamanın yürüyüşü sırasında yazılıyor, ayrı bir hesap yok: yürüyüş
-- zaten her hareketin anındaki ortalamayı biliyor. Geçmişe dönük bir giriş
-- düzeltilirse fire tutarları da kendiliğinden doğru rakama kayıyor; sonraki
-- alışlar ise öncesindeki fireyi etkilemiyor, çünkü yürüyüş zaman sırasıyla.
--
-- Maliyeti henüz bilinmeyen malzemede (hiç fiyatlı giriş yoksa) sütun boş
-- kalıyor; rapor bunları tutara katmıyor, ayrıca sayıyor.

create or replace function stok_ortalama_maliyet(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  satir    record;
  eldeki   numeric := 0;
  ortalama numeric;
  taban    numeric;
begin
  for satir in
    select id, tip, miktar, birim_maliyet
      from stok_hareketleri
     where malzeme_id = p_malzeme_id
     order by zaman, id
  loop
    if satir.tip = 'giris' and satir.miktar > 0 and satir.birim_maliyet is not null then
      taban := case when ortalama is null then 0 else greatest(eldeki, 0) end;

      ortalama := (taban * coalesce(ortalama, satir.birim_maliyet)
                   + satir.miktar * satir.birim_maliyet)
                  / (taban + satir.miktar);
    elsif satir.tip in ('fire', 'cikis')
          and satir.birim_maliyet is distinct from round(ortalama, 6) then
      update stok_hareketleri
         set birim_maliyet = round(ortalama, 6)
       where id = satir.id;
    end if;

    eldeki := eldeki + satir.miktar;
  end loop;

  update malzemeler
     set ortalama_maliyet = round(ortalama, 6)
   where id = p_malzeme_id;
end $fn$;

revoke all on function stok_ortalama_maliyet(bigint) from public, anon, authenticated;

-- Yeni fire ve çıkış da yürüyüşü tetikliyor; yoksa satır fiyatsız kalırdı.
-- Satış burada yok: sipariş kalemi maliyetini kendisi donduruyor ve günde
-- yüzlerce satır her seferinde bütün defteri yürütmemeli.
create or replace function stok_maliyeti_tazele()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.tip in ('giris', 'fire', 'cikis') then
    perform stok_ortalama_maliyet(new.malzeme_id);
  end if;
  return null;
end $fn$;

-- Eski kayıtlar doldurulsun.
do $$
declare
  m record;
begin
  for m in select distinct malzeme_id from stok_hareketleri where tip in ('fire', 'cikis') loop
    perform stok_ortalama_maliyet(m.malzeme_id);
  end loop;
end $$;
