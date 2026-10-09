---
name: rayopos-once-devde-dene
description: "Canlıda bulunan hata düzeltilince göndermeden önce Chrome'da dev'de (localhost:5173) Deneme ile denenir; gizli sekmede animasyon donar."
metadata:
  node_type: memory
  type: feedback
  originSessionId: fbba09ed-d7a6-4014-87c8-744e580dbb1c
  modified: 2026-10-09T01:21:05.359Z
---

Canlıda görülen hata düzeltildiğinde Ramazan "önce dev'de deneyelim" diyor (9 Eki 2026): düzeltme Chrome'da `https://localhost:5173` üzerinde, Deneme işletmesinde aynı adımlarla canlandırılır, sonra canlıya gönderme sorulur. Dev ayrı adres olduğu için oturum ayrı — girişi Ramazan yapar (şifre girilmez).

Chrome penceresi görünür değilken (`document.visibilityState: hidden`) CSS animasyonları donuyor: geçiş/yanıp sönme ölçülemez, `getAnimations()` currentTime 0 kalır. Başlangıç durumunu ölç, gerisini Ramazan'a gözle denet.

**Why:** canlıdaki işletme verisine deneme kaydı düşmesin; düzeltme gerçekten çalışıyor mu görülsün.
**How to apply:** düzeltme → dev'de canlandır → sonuç → "göndereyim mi?" ([[rayopos-canliya-sormadan-gonderme]], [[rayopos-tarayici-testi-chrome-ile]], [[rayopos-mobil-test-iframe]]).
