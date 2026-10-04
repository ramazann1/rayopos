---
name: rayopos-sql-ramazan-calistirir
description: "Canlı Supabase'e SQL'i varsayılan olarak Ramazan çalıştırır; Claude yalnız o iş için açık izin verilirse çalıştırır (Monaco setValue ile)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6457c278-1cae-4d9d-b7a8-e28e79725724
  modified: 2026-10-04T00:56:35.180Z
---

Yeni `sql/*.sql` dosyası canlı veritabanına varsayılan olarak Ramazan tarafından Supabase SQL Editor'de çalıştırılır. 27 Eyl 2026'da Claude'un SQL Editor'ü açması otomatik izin sisteminde "production deploy" diye reddedildi.

4 Eki 2026'da Ramazan "sen yap, izin veriyorum" dedi; Claude Chrome'da SQL Editor'de sorgu çalıştırdı ve CSV içe aktardı (Adisyo aktarımı). İzin o işe özeldi, sonraki işlere taşınmaz.

**Why:** Tek bir Supabase projesi var (iwcmsvexfuyopebkaxrg), o da canlı.
**How to apply:** SQL hazır olunca dosya yolunu verip "yapıştır, Run'a bas, Success yazınca haber ver" de. Ramazan açıkça "sen yap" derse: uzun metni editöre harf harf yazma (sekme donuyor), `window.monaco.editor.getModels()[0].setValue(sql)` ile koy, Run'a bas. Editör 3–4 MB sorguyu "too large" diye reddediyor; büyük veri Table Editor → Import data from CSV ile girer (Claude'un yükleme aracı dosya başına 10 MB). Bkz. [[rayopos-tarayici-testi-chrome-ile]].
