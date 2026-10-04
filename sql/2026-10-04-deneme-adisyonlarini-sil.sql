-- Deneme işletmesinin (15003) test adisyonlarını siler; aktarılan Adisyo
-- cirosu o günlerde tek başına görünsün diye.
--
-- Yalnız satış kayıtları gidiyor: adisyonlar ve onlara bağlı turlar, kalemler,
-- tahsilatlar, maliyetler (zincirleme siliniyor). Masa, menü, personel, stok
-- tanımları yerinde kalıyor. Denetim, fiş kuyruğu ve stok hareketlerindeki
-- adisyon bağı boşalıyor, satırların kendisi duruyor.

delete from adisyonlar
 where isletme_id = (select id from isletmeler where kod = 15003);
