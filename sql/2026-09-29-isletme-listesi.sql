-- Silmeden önce bak: hangi işletmeler var, kaçar personeli ve adisyonu var.
select i.id, i.kod, i.ad, i.olusturma,
       (select count(*) from personel p where p.isletme_id = i.id)  as personel,
       (select count(*) from adisyonlar a where a.isletme_id = i.id) as adisyon
  from isletmeler i
 order by i.kod;
