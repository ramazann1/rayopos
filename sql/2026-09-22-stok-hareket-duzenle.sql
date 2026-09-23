-- Stok hareketinde düzenleme ve silme (Ramazan kararı, 22 Eyl 2026).
--
-- Defter başta değişmez kurgulanmıştı: yanlış kayıt ters hareketle
-- düzeltilecekti. Ramazan doğrudan düzenleme ve silme istedi.
--
-- Sorun şu: bir satır silinir ya da miktarı değişirse, o malzemenin ondan
-- SONRAKİ bütün satırlarındaki "önceki → sonraki" zinciri yalan olur. Defterin
-- tek işe yarar özelliği o zincir; bozulursa "stok nerede kaydı" sorusu
-- cevapsız kalır.
--
-- Çözüm: değişiklik tarayıcıdan tek tek yazılmıyor. Aşağıdaki iki işlev
-- değişikliği yapıyor, sonra o malzemenin bütün hareketlerini zaman sırasına
-- dizip zinciri baştan kuruyor ve malzemenin miktarını yeniden hesaplıyor.
-- Hepsi tek işlemde olduğu için yarıda kalmış bir defter oluşmuyor.
--
-- Doğrudan update/delete yetkisi KAPALI kalıyor (2026-09-22-stok-veri-modeli).
-- Böylece uygulamada bir hata olsa bile zincir yalnız bu yoldan değişebiliyor.

-- Zinciri baştan kuran yardımcı. Sıra: zaman, eşitlikte kimlik — aynı saniyeye
-- düşen iki hareket her çağrıda aynı sırayla dizilsin.
create or replace function stok_zincirini_kur(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  yurur bigint := 0;
  satir record;
begin
  for satir in
    select id, miktar from stok_hareketleri
     where malzeme_id = p_malzeme_id
     order by zaman, id
     for update
  loop
    update stok_hareketleri
       set onceki = yurur,
           sonraki = yurur + satir.miktar
     where id = satir.id;
    yurur := yurur + satir.miktar;
  end loop;

  update malzemeler set miktar = yurur where id = p_malzeme_id;
end $fn$;

-- Silme. Belgenin son kalemi de siliniyorsa belge kendisi de gidiyor: kalemsiz
-- bir fiş defterde boş bir satır başlığı olarak kalırdı.
create or replace function stok_hareketi_sil(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_malzeme bigint;
  v_belge   bigint;
  v_kalan   int;
begin
  select malzeme_id, belge_id into v_malzeme, v_belge
    from stok_hareketleri
   where id = p_id and isletme_id = oturum_isletmesi();

  if v_malzeme is null then
    raise exception 'Hareket bulunamadi';
  end if;

  delete from stok_hareketleri where id = p_id;

  select count(*) into v_kalan from stok_hareketleri where belge_id = v_belge;
  if v_kalan = 0 then
    delete from stok_belgeleri where id = v_belge;
  end if;

  perform stok_zincirini_kur(v_malzeme);
end $fn$;

-- Düzenleme. Miktar İŞARETLİ geliyor (giriş artı, fire/çıkış eksi) — yönü
-- belirleyen belge tipi değişmiyor, yalnız büyüklük ve fiyat düzeltiliyor.
-- Belgenin açıklaması ve zamanı da buradan güncelleniyor: ikisi de defterin
-- okunuşunu değiştiriyor, ayrı ayrı istek atmaya değmez.
create or replace function stok_hareketi_duzenle(
  p_id            bigint,
  p_miktar        bigint,
  p_birim_maliyet numeric,
  p_zaman         timestamptz,
  p_aciklama      text,
  p_sebep         text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_malzeme bigint;
  v_belge   bigint;
begin
  if p_miktar = 0 then
    raise exception 'Miktar sifir olamaz';
  end if;

  select malzeme_id, belge_id into v_malzeme, v_belge
    from stok_hareketleri
   where id = p_id and isletme_id = oturum_isletmesi();

  if v_malzeme is null then
    raise exception 'Hareket bulunamadi';
  end if;

  update stok_hareketleri
     set miktar = p_miktar,
         birim_maliyet = p_birim_maliyet,
         zaman = p_zaman
   where id = p_id;

  update stok_belgeleri
     set aciklama = nullif(btrim(coalesce(p_aciklama, '')), ''),
         sebep = p_sebep,
         zaman = p_zaman
   where id = v_belge;

  perform stok_zincirini_kur(v_malzeme);
end $fn$;

revoke all on function stok_zincirini_kur(bigint) from public, anon, authenticated;
grant execute on function stok_hareketi_sil(bigint) to authenticated;
grant execute on function stok_hareketi_duzenle(bigint, bigint, numeric, timestamptz, text, text)
  to authenticated;

-- Ağırlıklı ortalama maliyet.
--
-- Malzemenin fiyatı her alışta değişiyor: 20 lt süt 32 TL'den, sonraki 30 lt
-- 36 TL'den geliyor. Tek bir "fiyat" tutmak yanlış cevap verir; elindeki
-- 50 lt'nin gerçek maliyeti 34,40 TL'dir. Fire tutarı, sayım farkının parası
-- ve reçete maliyeti bu rakamdan okunuyor.
--
-- Hesap yalnız GİRİŞLERDEN yapılıyor: çıkan malın maliyeti elde kalanın
-- maliyetini değiştirmez. Fiyatı girilmemiş giriş hesaba katılmıyor — sıfır
-- sayılsaydı ortalamayı aşağı çekip yanlış tutar üretirdi.
create or replace function stok_ortalama_maliyet(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ortalama numeric(14,4);
begin
  select sum(miktar * birim_maliyet) / nullif(sum(miktar), 0)
    into v_ortalama
    from stok_hareketleri
   where malzeme_id = p_malzeme_id
     and tip = 'giris'
     and miktar > 0
     and birim_maliyet is not null;

  update malzemeler set ortalama_maliyet = v_ortalama where id = p_malzeme_id;
end $fn$;

revoke all on function stok_ortalama_maliyet(bigint) from public, anon, authenticated;

-- Zincir her kurulduğunda ortalama da tazeleniyor: silme ve düzenleme
-- fiyatı da değiştirebiliyor.
create or replace function stok_zincirini_kur(p_malzeme_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  yurur bigint := 0;
  satir record;
begin
  for satir in
    select id, miktar from stok_hareketleri
     where malzeme_id = p_malzeme_id
     order by zaman, id
     for update
  loop
    update stok_hareketleri
       set onceki = yurur,
           sonraki = yurur + satir.miktar
     where id = satir.id;
    yurur := yurur + satir.miktar;
  end loop;

  update malzemeler set miktar = yurur where id = p_malzeme_id;
  perform stok_ortalama_maliyet(p_malzeme_id);
end $fn$;

-- Yeni hareket yazılırken de ortalama güncelleniyor; tetikleyici insert
-- sonrası çalışıyor, çünkü satırın kendisi de hesaba giriyor.
create or replace function stok_maliyeti_tazele()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.tip = 'giris' and new.birim_maliyet is not null then
    perform stok_ortalama_maliyet(new.malzeme_id);
  end if;
  return null;
end $fn$;

drop trigger if exists stok_maliyeti_tazele_t on stok_hareketleri;
create trigger stok_maliyeti_tazele_t
  after insert on stok_hareketleri
  for each row execute function stok_maliyeti_tazele();
