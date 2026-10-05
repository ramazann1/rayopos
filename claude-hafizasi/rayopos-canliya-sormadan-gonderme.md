---
name: rayopos-canliya-sormadan-gonderme
description: "Veri/rapor gibi birlikte bakılması gereken işlerde push etmeden önce Ramazan'a sor"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2cb8de48-d68a-4817-8409-faa0e4205099
  modified: 2026-10-05T22:50:37.429Z
---

Ramazan bir kez "canlıya gönder" dedi diye sonraki her iş otomatik push edilmez. 6 Eki 2026'da eski adisyon kategorileri (analiz hesabı + veri eşleştirmesi) sorulmadan canlıya gönderildi; Ramazan "önce beraber baksaydık" dedi.

**Why:** Rapor rakamlarını ya da veriyi değiştiren işlerde sonucu önce birlikte görmek istiyor; canlı site gerçek işletme tarafından da kullanılıyor.

**How to apply:** Kod bitince derle, sonucu anlat, "canlıya göndereyim mi?" diye sor. Ramazan o iş için açıkça "gönder" demeden push etme. Küçük görünüm düzeltmelerinde de aynı soru sorulur — onay görev başına. Bkz. [[rayopos-canlida-test-yok]], [[rayopos-gondermeden-once-build]].
