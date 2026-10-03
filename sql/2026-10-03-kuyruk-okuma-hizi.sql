-- Yazdırma kuyruğunun okuma kuralları sorgu başına bir kez hesaplanıyor.
--
-- Kuyrukta basılmış her fiş satır olarak kalıyor; eski kural "işletme kim,
-- yetkisi var mı" sorusunu her satırda baştan soruyordu. Bağlantı Durumu
-- ekranı yazıcıların son durumunu okurken 2 saniye bekliyordu (ölçüm,
-- 3 Eki 2026). Kimin neyi göreceği değişmiyor; kişiye bağlı sorular
-- `(select ...)` içinde, PostgreSQL bunları bir kez hesaplıyor
-- (2026-10-02-adisyon-okuma-hizi.sql ile aynı kural).

drop policy if exists yazdirma_kuyrugu_oku on yazdirma_kuyrugu;
create policy yazdirma_kuyrugu_oku on yazdirma_kuyrugu
  for select to authenticated
  using (
    isletme_id = (select oturum_isletmesi())
    and (select oturum_yetkilerinden_biri(
      array['yazici.yonet', 'siparis.fis_yazdir', 'siparis.al']
    ))
  );

drop policy if exists yazdirma_kuyrugu_guncelle on yazdirma_kuyrugu;
create policy yazdirma_kuyrugu_guncelle on yazdirma_kuyrugu
  for update to authenticated
  using      (isletme_id = (select oturum_isletmesi()) and (select oturum_yetkisi('yazici.yonet')))
  with check (isletme_id = (select oturum_isletmesi()) and (select oturum_yetkisi('yazici.yonet')));

drop policy if exists yazdirma_kuyrugu_sil on yazdirma_kuyrugu;
create policy yazdirma_kuyrugu_sil on yazdirma_kuyrugu
  for delete to authenticated
  using (isletme_id = (select oturum_isletmesi()) and (select oturum_yetkisi('yazici.yonet')));

-- Son fişler tarihe göre okunuyor; durum sütunu önde olan dizin bu sıralamayı
-- veremiyordu, işletmenin bütün kuyruğu sıralanıyordu.
create index if not exists yazdirma_kuyrugu_son
  on yazdirma_kuyrugu (isletme_id, olusturma desc);
