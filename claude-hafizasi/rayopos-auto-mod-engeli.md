---
name: rayopos-auto-mod-engeli
description: "Auto modda Adisyo oturumuyla toplu çekim ve canlı Supabase'de silme/yazma SQL'i engelleniyor; Manual'a aldır."
metadata:
  node_type: memory
  type: feedback
  originSessionId: cb542956-3fe1-421b-bd75-ae627c1168d2
  modified: 2026-10-05T00:28:02.180Z
---

Claude Code "Auto" modundayken otomatik denetim, Ramazan açıkça izin verse bile şunları durduruyor: Adisyo oturum anahtarıyla toplu istek (kalem çekimi) ve canlı veritabanında delete+insert yapan SQL'in Claude tarafından çalıştırılması. Masaüstü uygulamada mod seçicide adı **Manual** ("Ask permissions" değil).

**Why:** 5 Eki 2026 seansında iki kez yarıda kaldı; Ramazan modu nasıl değiştireceğini sordu, zaman kaybı oldu.

**How to apply:** Adisyo çekimi ya da canlı SQL gerekecekse işe başlamadan Ramazan'dan modu Manual'a almasını iste; iş bitince Auto'ya dönebileceğini söyle. Engel gelirse etrafından dolanma, dur ve anlat. İlgili: [[rayopos-sql-ramazan-calistirir]].
