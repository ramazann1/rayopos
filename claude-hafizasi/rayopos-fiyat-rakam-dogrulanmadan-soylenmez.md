---
name: rayopos-fiyat-rakam-dogrulanmadan-soylenmez
description: Dış servis fiyatı/kotası hafızadan söylenmez; karar önerisine girmeden önce siteden okunur.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 652fc61e-f59d-41ae-a1b3-5175d6918d90
  modified: 2026-09-21T00:10:52.354Z
---

Bir dış servisin fiyatını, paket sınırını veya donanım özelliğini **hafızadan
söyleme**. Öneriye dönüşecekse önce canlı kaynaktan oku (tarayıcıyla fiyat
sayfası, `nslookup`, servisin kendi yanıtı), sonra konuş. Okunamıyorsa
"doğrulayamadım" diye açıkça işaretle.

**Why:** 21 Eyl 2026'da Hetzner için "4 çekirdek / 8 GB ayda ~15 €" dendi,
gerçeği €35,99 çıktı — iki buçuk kat. O yanlış rakamla "kendi sunucumuz 9 kat
ucuz" denip Ramazan hesap açmaya, $25 kredi yatırmaya yönlendirildi. Doğru
rakamla bakınca tek cafe için kendi sunucusu Supabase'den **pahalı** olduğu
görüldü ve plan tamamen iptal edildi. Ramazan "fiyatlandırmayı bilmeden neden
yapayım" diye durdurmasa para harcanmış olacaktı. Aynı seansta Supabase ve
Adisyo rakamları ölçülerek alındığı için doğru çıktı; yalnız hafızadan
söylenen kalem yanlış çıktı.

**How to apply:** Fiyat/kota/donanım içeren her cümleden önce dur ve sor:
"bunu bu seansta bir yerden okudum mu?" Okumadıysan ya oku ya da yazma.
Yanlış rakam dosyaya da geçiyor — [[rayopos-karar-alininca-hemen-dosyaya]]
gereği kararlar anında yazıldığı için hatalı rakam kalıcı hale geliyor,
sonradan düzeltmek iki dosyada birden iş çıkarıyor.
İlgili: [[rayopos-yavaslikta-once-olc]], [[dokumanda-yok-demeden-once-ara]].
