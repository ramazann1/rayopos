-- Yazdırma kuyruğu: her iş kendi yetkisini soruyor.
--
-- Kuyruğa dört ayrı iş giriyor — hesap fişi (`adisyon`), mutfak fişi
-- (`mutfak`), çekmece darbesi (`cekmece`) ve yazıcı deneme fişi (`deneme`).
-- 1 Eylül'deki politika hepsini tek kapıdan geçiriyordu: üç yetkiden herhangi
-- biri varsa kuyruğa her şey yazılabiliyordu. İki sorun çıktı.
--
-- 1) `kasa.cekmece` işlevsizdi. Her garsonda bulunan `siparis.fis_yazdir`
--    çekmece darbesini de kabul ediyordu; çekmece yetkisini birinden almak
--    sunucuda hiçbir şeyi değiştirmiyordu. 17 Eylül'deki yetki provası bunu
--    gösterdi.
--
-- 2) Mutfak fişi yanlış yetkiye bağlıydı. Sipariş kaydedilince kendiliğinden
--    gidiyor, elle bastırılan bir çıktı değil — ama politika onun için de
--    `siparis.fis_yazdir` istiyordu. O yetkisi olmayan bir garsonun siparişi
--    mutfağa hiç düşmezdi. Provada görünmedi çünkü denenen kişide o yetki
--    vardı; sessiz kalan tam da bu tür eşleşmeler.
--
-- Çekmece nakit ödemede kendiliğinden açılıyor (`cekmeceNakitteAcilsin`), o
-- yüzden ödeme alma yetkisi de kapıyı açıyor: parayı alan kasiyer, parayı
-- koyacağı çekmeceyi açabilmeli. Ramazan kararı, 17 Eyl 2026.

drop policy if exists yazdirma_kuyrugu_ekle on yazdirma_kuyrugu;

create policy yazdirma_kuyrugu_ekle on yazdirma_kuyrugu
  for insert to authenticated
  with check (
    isletme_id = oturum_isletmesi()
    and case tip
      -- Hesap fişi: kişinin kendi kararıyla bastırdığı çıktı.
      when 'adisyon' then
        oturum_yetkilerinden_biri(array['siparis.fis_yazdir', 'yazici.yonet'])

      -- Mutfak fişi: siparişin kendisiyle birlikte gidiyor. Sipariş alabilen
      -- herkes gönderebilmeli, yoksa siparişi kaydeder ama mutfak görmez.
      when 'mutfak' then
        oturum_yetkilerinden_biri(
          array['siparis.al', 'siparis.gelal', 'siparis.paket', 'yazici.yonet'])

      -- Çekmece: para çekmecesini açan darbe.
      when 'cekmece' then
        oturum_yetkilerinden_biri(array['kasa.cekmece', 'odeme.al'])

      -- Deneme fişi yazıcı ayarlarının işi.
      when 'deneme' then
        oturum_yetkisi('yazici.yonet')

      -- Tanımadığımız bir iş türü: en dar kapı. Yeni tür eklenirse buraya da
      -- eklenmeli, unutulursa yazıcı ayarları olmayan kimse gönderemez.
      else oturum_yetkisi('yazici.yonet')
    end
  );
