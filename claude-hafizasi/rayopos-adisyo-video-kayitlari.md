---
name: rayopos-adisyo-video-kayitlari
description: Adisyo mobil uygulamasını Ramazan ekran kaydıyla paylaşıyor; videodan kare çıkarma yolu.
metadata: 
  node_type: memory
  type: project
  originSessionId: a0b874df-8e74-4d36-a444-957a2d566c90
  modified: 2026-08-19T23:27:31.633Z
---

Adisyo'nun mobil uygulaması (Adisyo Garson) native, tarayıcıdan açılmıyor —
`garson.adisyo.com` yok, `pos.adisyo.com` masaüstü panelin kendisi. Ramazan
telefondan **ekran kaydı** alıp `C:\Users\Ramazan\Desktop\yeni klasör\` içine
atıyor (IMG_5828.MP4, IMG_5829.MP4 — 19-20 Ağu 2026).

Video izlenemiyor, kare çıkarmak gerekiyor. ffmpeg kurulu:
`C:\Users\Ramazan\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe`

**Önce kontakt sayfası çıkar, sonra ilgili yeri sık kareyle al** — tek tek
kare okumak hem yavaş hem atlıyor (bir turda üç nokta menüsünü kaçırdım):
`-vf "fps=1,scale=-1:300,tile=7x7"` → tüm kayıt üç görselde görünüyor.

İlgili: [[rayopos-yeni-modulden-once-adisyo-turu]]
