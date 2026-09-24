---
name: rayopos-grafik-degil-cumle
description: Analiz ekranlarında soyut grafik yerine cümle/rozet; Adisyo turundan sonra kırılımları kopyalama.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 63e3ac2a-2c1c-4ecf-b3ee-d20c66cd4beb
  modified: 2026-09-11T00:31:32.000Z
---

Analiz ekranında veriyi *göstermek* değil *cevaplamak* gerekiyor. İki somut kural:

**Soyut grafik reddediliyor.** 11 Eyl 2026'da adet–ciro dağılım grafiği (dört
bölgeli kadran) çizildi; Ramazan "fikri beğendim ama karışık, ben bile
anlamadım, diğer kullanıcılar nasıl anlayacak" dedi. Aynı bilgi dört kutuya ve
satır rozetine dönünce kabul edildi (Yıldız · Hacim · Pahalı · Geride).

**Adisyo turundan sonra kırılımları kopyalama.** Tur bulgularını olduğu gibi
plana dökünce Ramazan "hepsini yaparsak Adisyo'nun aynısı olmaz mı, bunu bir
şekilde geliştirmemiz lazım" diye uyardı. Haklıydı: Adisyo'nun altı kırılımı tek
soruyu altı kez farklı gruplayıp yığıyor. Turdan sonra **bizde olmayanı değil,
onda olamayacak olanı** aramak gerekiyor (satılmayan ürünler, önceki dönemle
karşılaştırma).

**Why:** Ürün kasada duran işletmeciye satılacak; veri analizi diliyle çizilmiş
bir grafik orada okunmuyor. Rakip taklidi de ürünü satılabilir kılmıyor.

**How to apply:** Grafik önermeden önce "bunu açıklamadan anlaşılır mı" diye sor;
açıklama kutusu gerekiyorsa grafik yanlış. Tur sonrası planda her maddenin
karşısına "bu hangi soruyu cevaplıyor" yaz; cevabı olmayanı listeye koyma.
İlgili: [[rayopos-yeni-modulden-once-adisyo-turu]], [[rayopos-arayuzde-yeni-kavram-ekleme]]
