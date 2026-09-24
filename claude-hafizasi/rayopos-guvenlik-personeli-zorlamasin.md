---
name: rayopos-guvenlik-personeli-zorlamasin
description: "RayoPOS'da personeli veya işletmeciyi zorlaştıran güvenlik önlemleri reddediliyor; görünmez olanları öner."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: da0b7d07-f1cd-4917-80c0-2a4a57255934
  modified: 2026-08-22T02:02:48.066Z
---

RayoPOS'da güvenlik önlemi önerirken **kullanıcının günlük işine dokunanı**
Ramazan reddediyor, **arkada çalışan görünmez olanı** kabul ediyor.

22 Ağu 2026 güvenlik seansında iki kez aynı yönde karar çıktı:
- **PIN deneme yavaşlatması reddedildi** ("çok aptal garsonlar var, sistemi
  kilitleyebilir"). Tasarımda kilit yoktu, 5 yanlıştan sonra 2 saniye gecikme
  vardı — yine de istemedi.
- **Şifre alt sınırı 6→8 geri alındı** ("6 iyiydi, sadece kuralları yerleştirmen
  yeterliydi").

Aynı seansta kabul edilenler kullanıcıya hiç görünmeyenlerdi: PIN'in bcrypt'e
geçmesi, `pin_hash` sütununun gizlenmesi, fonksiyon yetkilerinin kapatılması,
köprü için ayrı hesap.

**Why:** RayoPOS satılacak bir ürün ve kasada acele eden insanlar kullanıyor.
Ramazan için bir önlemin bedeli "garson bekliyor mu" ile ölçülüyor; teorik
saldırı senaryosu bunun önüne geçmiyor. İşletme içi güveni de yüksek sayıyor
("hepsi bizim personelimiz").

**How to apply:** Önlemleri iki kovaya ayırıp sun — "kullanıcı fark etmez" ve
"kullanıcıya dokunur". İlk gruba onay isteme gereği yok, ikinci grubu ayrıca
sor ve bedelini net söyle. Bir öneri reddedilirse bir kez gerekçeni söyle,
ısrar etme; kararı [[rayopos-karar-alininca-hemen-dosyaya]] gereği o an
rayopos-tasarim.md'ye "bilinçli karar" olarak yaz ki sonraki seansta yeniden
önerilmesin.
