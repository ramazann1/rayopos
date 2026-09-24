---
name: rayopos-masaustu-mobil-esitligi
description: Masaüstünde yapılan her değişiklik mobilde de yapılır; Ramazan ayrıca söylemez.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ef11d8f6-9cc8-4b85-ad8d-a5946b5b5b3b
  modified: 2026-09-02T20:13:48.261Z
---

Bir ekranda yapılan değişiklik, karşılığı olan mobil ekranda da yapılır. Ramazan
bunu her seferinde söylemek zorunda kalmamalı (2 Eyl 2026'da kural oldu).

**Why:** RayoPOS satılacak bir ürün; aynı masaya iki cihazdan bakan iki kişinin
farklı şey görmesi hata olarak okunuyor. İki ayrı ekran tutmak da her
düzeltmenin bir yüzeyde unutulması demek.

**How to apply:** Mümkünse mobil, masaüstündeki bileşeni açsın (tahsilat
penceresi ve Hızlı Öde böyle yapıldı); telefon farkı yalnız CSS'te kalsın.
Renk/durum/para biçimi kuralları iki yüzeyde birebir aynı sonucu vermeli —
`||` yerine `??`, sınıf sırası aynı. Kural CLAUDE.md'de de yazılı.
Bkz. [[rayopos-arayuz-metinleri-genel-dille]], [[rayopos-tipografi-ve-renk]].
