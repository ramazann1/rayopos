---
name: rayopos-gondermeden-once-build
description: "Push etmeden önce npm.cmd run build çalıştır; tsc --noEmit yetmiyor, Cloudflare derlemesi kırılıyor."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8a6a0ccb-22d4-4abc-a56b-0e649ef1ba45
  modified: 2026-09-16T00:39:15.383Z
---

RayoPOS'ta commit/push öncesi doğrulama `npm.cmd run build` ile yapılır.

**Why:** Proje `tsc -b` + `vite build` kullanıyor ve `noUnusedLocals` açık.
`tsc --noEmit` boşta kalan içe aktarımı yakalamadı, Cloudflare Pages derlemesi
iki kez kırmızıya düştü; Ramazan canlıda eski sürümü görüp "göndermemişsin"
dedi (16 Eyl 2026).

**How to apply:** Kod değişikliğinden sonra push'tan önce `npm.cmd run build`
çalıştır, çıktının "built in" satırını gör, sonra gönder. Özellikle bir
bileşenden state/prop kaldırdıysan boşta kalan import'ları da temizle.

İlgili: [[rayopos-seans-sonu-commit-claude-yapar]]
