---
name: rayopos-korumali-alan-ciktisi
description: "Claude'un proje dışına yazdığı dosyalar (ör. %LOCALAPPDATA%) Ramazan'ın Windows'unda görünmüyor; çıktıyı proje klasörüne kopyala."
metadata: 
  node_type: memory
  type: reference
  originSessionId: fdbe0a3c-6adb-41b6-bf46-ed7ad890db6f
  modified: 2026-09-14T23:25:36.355Z
---

`npm.cmd run paketle` köprü kurulumunu `%LOCALAPPDATA%\RayoPOS\dagitim`'e yazıyor, ama Claude'un komutları korumalı alanda çalıştığı için Ramazan o klasörü açınca "Konum kullanılamıyor" hatası aldı (15 Eyl 2026). Proje klasörüne yazılanlar ise görünüyor.

**How to apply:** Ramazan'ın açacağı her dosyayı proje içine kopyala (`kurulum-dosyasi/`, gitignore'da). Explorer'la proje dışı klasör açtırma. İlgili: [[rayopos-dosya-yolu-tarifi]]
