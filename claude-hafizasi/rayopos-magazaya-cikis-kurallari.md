---
name: rayopos-magazaya-cikis-kurallari
description: RayoPOS mağazaya çıkmadan önce uyulacak kurallar — paket adı, geliştirici hesabı, veritabanı ayrımı, Capacitor kararı.
metadata:
  type: project
---

RayoPOS mağazaya (App Store / Play Store) çıkarken şunlar baştan doğru
kurulmalı; sonradan düzeltilemiyorlar:

- **Paket adı** ilk yayında konur ve bir daha asla değişmez (`com.garso.app`
  gibi). Değişirse mağaza onu yeni uygulama sayar, müşteriye "eskiyi silin,
  yenisini indirin" dedirtir.
- **Geliştirici hesabı Ramazan'ın kendi şirketi adına** açılır. Kişisel hesap
  veya bir yazılımcının hesabı üstünden yayınlanmaz.
- **Veritabanı uygulamadan ayrı kalır** (Supabase). Ön taraf ne olursa olsun
  veri yerinde durur; ileride native'e geçilse bile arka taraf hiç değişmez.

Paketleme kararı: **Capacitor**. React Native/Flutter/native yeniden yazım
demek, tek kişilik ekiple sürdürülemez. Capacitor'la çıkan uygulama mağazada
normal uygulama olarak durur. Kabuğa yazıcı/bildirim gibi gerçek telefon
özellikleri konur — yoksa Apple "boş kabuk" diye reddedebiliyor.

Sıra: önce PWA canlıya → gerçek kullanımda pişir → sonra Capacitor ile iki
mağazaya. Mağazada her düzeltme onay bekliyor, ilk aylardaki yoğun düzeltme
trafiği web'de yaşanmalı.

Adisyo native yazılmış (uygulama boyutu 78 MB). Bu bizim kararımızı
değiştirmez — arkalarında üç ayrı kod tabanını taşıyan bir ekip var.
