---
name: rayopos-adisyo-yok-demeden-parametrelere-bak
description: "Adisyo turunda bir davranış yokmuş gibi görünürse önce Restaurant Ayarları -> Parametreler'e bakılır."
metadata:
  type: feedback
---

Adisyo turunda "bunu yapmıyor / engellemiyor / böyle bir seçenek yok" demeden
önce **Restaurant Ayarları → Parametreler** açılır. Kırka yakın anahtar var ve
çoğu davranışı kökten değiştiriyor (eksi stoğa izin, gün başı-gün sonu manuel,
kasa açılış/kapanış kullanıcıda, mutfak yazıcısı manuel...). Ekranda görünen
davranış çoğu zaman Adisyo'nun tasarımı değil, o anahtarın durumu.

**Why:** 22 Eyl 2026 stok turunda "Adisyo stoğun eksiye düşmesini ne engelliyor
ne uyarıyor" diye rapor edildi. Ramazan düzeltti: *"Eksi stoğa izin verilsin"*
parametresi var ve o açmış. Yani kusur sanılan şey kullanıcının tercihiydi;
yanlış teşhis yanlış tasarım kararına götürüyordu (zorlayıcı engel yazacaktık,
oysa doğrusu ayar).

**How to apply:** Turda bir eksiklik tespit edilince Parametreler'de ilgili
kelimeyi ara, anahtarın açık/kapalı olduğunu **oku**, değiştirme. Rapordaki
cümle "Adisyo yapmıyor" değil "şu parametre kapalıyken yapmıyor" olur. Bizim
karşılığımız da çoğu zaman zorlama değil **ayar** olmalı —
[[rayopos-guvenlik-personeli-zorlamasin]] ile aynı ruh.
İlgili: [[dokumanda-yok-demeden-once-ara]], [[rayopos-adisyo-canli-tarayici-turu]]
