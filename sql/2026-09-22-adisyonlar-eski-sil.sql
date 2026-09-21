-- 4 Ağustos'ta adisyon modeli değişirken eski tablo silinmeyip yeniden
-- adlandırılmıştı; açık adisyonlar o gün yeni tabloya aktarıldı. Geriye 8
-- satırlık ölü kayıt kaldı, kod hiçbir yerden okumuyor. İçinde `isletme_id`
-- olmadığı için her güvenlik denetiminde önümüze çıkıyor.
drop table if exists adisyonlar_eski;
