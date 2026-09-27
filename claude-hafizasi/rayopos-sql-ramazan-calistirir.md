---
name: rayopos-sql-ramazan-calistirir
description: "Canlı Supabase'e SQL dosyasını Ramazan çalıştırır; Claude'un SQL Editor'ü açması izin sisteminde engelleniyor."
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8af45a2-8548-4a9c-b570-6175d4a24ead
  modified: 2026-09-27T19:56:22.726Z
---

Yeni `sql/*.sql` dosyası canlı veritabanına Ramazan tarafından Supabase SQL Editor'de çalıştırılır. Claude'un Chrome'da SQL Editor sayfasını açması 27 Eyl 2026'da otomatik izin sistemi tarafından "production deploy" diye reddedildi.

**Why:** Tek bir Supabase projesi var (iwcmsvexfuyopebkaxrg), o da canlı; engel kalıcı.
**How to apply:** SQL hazır olunca dosya yolunu verip "yapıştır, Run'a bas, Success yazınca haber ver" de; test adımlarını (localhost:5173 üzerinden Chrome'da) sonra kendin yap. Uygulama yeni sütunu sorguluyorsa SQL'den önce test etme — menü yüklenmez. Bkz. [[rayopos-tarayici-testi-chrome-ile]].
