---
name: rayopos-canli-adres
description: "RayoPOS canlı sitesi rayopos.pages.dev; kendi adres rayopos.net (8 Eki 2026 Turhost'tan alındı, bağlanmadı)"
metadata:
  node_type: memory
  type: reference
  originSessionId: 7f914584-6031-4113-b402-ce9192d4fc58
  modified: 2026-10-08T00:13:53.967Z
---

Canlı RayoPOS: **https://rayopos.pages.dev** (Cloudflare Pages). Chrome eklentisinde bu alan adı için izin gerekiyor; engellenirse Ramazan'dan eklentiden izin vermesi istenir. Bkz. [[rayopos-tarayici-testi-chrome-ile]].

`rayopos.com.tr` TRABIS'ten dönmedi; **8 Eki 2026'da Turhost'tan `rayopos.net` alındı**, henüz Cloudflare'e bağlanmadı. Bağlamadan önce güvenlik konuşulacak, gerekirse ayrı Cloudflare hesabı (adımlar tasarım dosyasının en üstünde). Bağlanınca bu not güncellenmeli.

Canlı site iframe içinde açılmıyor (`_headers`: `X-Frame-Options: DENY`) — telefon testi için Ramazan'a DevTools telefon modu (F12 → Ctrl+Shift+M) açtırılır. [[rayopos-mobil-test-iframe]]
