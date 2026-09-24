---
name: rayopos-dosya-yolu-tarifi
description: "Dosya/klasör tarif ederken Explorer ayarı değil, adres çubuğuna yapıştırılacak yol veya komut ver."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f876bd5e-61e2-43bf-93e6-944bca6068bd
  modified: 2026-08-15T00:45:14.842Z
---

Ramazan'a bir dosyanın yerini tarif ederken "Explorer'da şu klasöre git" deme;
doğrudan yapıştırılacak tam yolu ya da klasörü açan komutu ver
(`explorer "$env:LOCALAPPDATA\RayoPOS\dagitim"` gibi).

**Why:** 25 Ağu 2026'da gizli bir klasördeki (AppData) kurulum dosyasını tarif
ettim; Ramazan klasörü bulmak için Kullanıcılar klasörünün özelliklerinden
"Gizli" kutusunu değiştirdi ve bütün dosyaları alt klasörlerle birlikte
görünmez oldu. Dosya kaybı olmadı ama panik ve kayıp zaman oldu.

**How to apply:** Yol gizli bir klasördeyse bunu önceden söyle ve klasörü açan
komutu ver. Windows görünüm/klasör ayarı değiştirmesini isteme. İlgili kural:
[[rayopos-arayuz-metinleri-genel-dille]].
