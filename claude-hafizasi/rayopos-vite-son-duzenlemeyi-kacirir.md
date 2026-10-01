---
name: rayopos-vite-son-duzenlemeyi-kacirir
description: "Art arda Edit'lerde Vite son değişikliği kaçırabiliyor; tarayıcı yarım dosya alıp sayfa boş açılıyor"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b0c6895d-6ba2-466e-a3ac-e3cbedede63d
  modified: 2026-10-01T20:15:11.728Z
---

Aynı dosyaya hızlı art arda birkaç Edit yapınca Vite bazen son düzenlemeyi görmüyor ve dönüştürülmüş modülü yarım sunuyor (1 Eki 2026: Kasa.tsx'te import satırı eksik geldi, sayfa bembeyaz açıldı, konsolda yalnız "error in <Kasa>").

**Why:** Kod doğruyken "çalışmıyor" sanılıp yanlış yerde hata aranıyor; Ramazan da beyaz sayfa görür.

**How to apply:** Düzenleme sonrası tarayıcıda tuhaflık varsa önce `fetch('/src/...tsx')` ile sunulan metinde son değişiklik var mı bak; yoksa `(Get-Item dosya).LastWriteTime = Get-Date` ile dosyaya dokun, sayfayı yenile. İlgili: [[rayopos-buyuk-dosya-bastan-yazilmaz]], [[rayopos-gorsel-hatada-once-onbellek]].
