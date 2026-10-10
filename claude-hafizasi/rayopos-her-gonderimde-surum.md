---
name: rayopos-her-gonderimde-surum
description: "Canlıya her gönderimde sürüm numarası artırılır, yalnız seans sonunda değil"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a59d6d70-b5c8-4479-b780-1460312b596a
  modified: 2026-10-10T00:11:18.676Z
---

Canlıya giden her push'tan önce `npm.cmd run surum` çalıştırılır (CLAUDE.md "seans sonunda bir kez" diyor; Ramazan 10 Eki 2026'da bunu genişletti).

**Why:** Numara değişmeyince telefonun yeni kodu alıp almadığını Ben ekranından anlayamıyor; aynı numarada test edip "olmadı" sanıyor.

**How to apply:** Göndermeden önce surum → build → commit → push. Sadece hafıza/dokümantasyon commit'lerinde gerekmez. Bkz. [[rayopos-canliya-sormadan-gonderme]].
