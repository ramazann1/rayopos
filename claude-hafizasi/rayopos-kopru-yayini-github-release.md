---
name: rayopos-kopru-yayini-github-release
description: "Köprü kurulum dosyası GitHub Release'e Claude tarafından gh ile yüklenir; paket korumalı alana düşer, Ramazan'a proje klasörüne kopyalanır."
metadata:
  node_type: memory
  type: reference
  originSessionId: 17f2c267-16f3-4aca-bd95-caedc716bb63
  modified: 2026-09-29T01:55:24.801Z
---

Köprü (yazıcı programı) indirme adresi sabit: `github.com/ramazann1/rayopos/releases/latest/download/rayopos-kopru-kurulum.exe`. Yeni paketi Claude yükler: `gh release upload kopru-<sürüm> <dosya> -R ramazann1/rayopos --clobber` (dosya adı sürümsüz `rayopos-kopru-kurulum.exe`). `gh` kurulu, ramazann1 ile giriş yapılı; PowerShell'de önce PATH'i Machine+User'dan yenile.

`npm.cmd run paketle` çıktısı `AppData\Local\RayoPOS\dagitim`'e düşüyor ve Ramazan orayı göremiyor — denemesi için `kurulum-dosyasi/` klasörüne kopyala ([[rayopos-korumali-alan-ciktisi]]).

**Why:** Cloudflare Pages 25 MB üstünü almıyor, exe ~110 MB.
**How to apply:** Köprü değişince paketle → Ramazan denesin → onaylarsa --clobber ile yükle.
