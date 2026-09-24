---
name: rayopos-tarihi-dosyadan-okuma
description: "rayopos-tasarim.md'ye tarih yazarken dosyadaki eski tarihi kaynak alma, gerçek günün tarihini kullan."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8edaaf5-789a-4434-b39e-e2751ac1383d
  modified: 2026-08-28T22:06:21.819Z
---

`rayopos-tasarim.md`'ye ("0. SIRADAKİ İŞ" ve seans notları) tarih yazarken
dosyanın kendi üstündeki tarihe bakıp "bir gün sonrası" diye devam etme.
Bağlamda verilen gerçek günün tarihini kullan; emin değilsen
`git log -1 --date=short` ile doğrula.

**Why:** Bir seansta yanlış yazılan tarih sonraki seansın kaynağı oluyor ve
hata birikiyor. 29 Ağustos 2026'da fark edildi: dosya "11 Eyl 2026" diyordu,
gerçek tarih 29 Ağustos'tu — yaklaşık 12 günlük ileri kayma vardı.

**How to apply:** Seans sonu güncellemesinde tarihi bağlamdaki günden yaz.
Dosyada gördüğün tarihle bağlamdaki tarih tutmuyorsa Ramazan'a söyle,
sessizce dosyadakini sürdürme.

İlgili: [[rayopos-karar-alininca-hemen-dosyaya]]
