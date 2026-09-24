---
name: dokumanda-yok-demeden-once-ara
description: Bir bulgunun projede eksik olduğunu söylemeden önce kendi dokümanlarda arama yapılmalı
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f588f1fa-f2ab-40cc-92ab-d3b913f6defc
  modified: 2026-07-31T02:30:49.202Z
---

Adisyo incelemesi gibi işlerde "bu bizde yok" demeden önce `rayopos-tasarim.md`,
`pos-yol-haritasi.md` ve gerekirse `src/` içinde arama yapılmalı. Ramazan
31 Tem 2026'da bunu uyardı: dokümanları baştan okumuş olmak yetmiyor.

**Why:** Baştan okunmuş olsa bile detaylar gözden kaçıyor. Arama yapınca üç
farklı durum çıktı — zaten kayıtlı olanlar, eksik yazılmış olanlar ve
dokümanda yanlış yazılmış bir madde (barkodun ürün seviyesinde gösterilmesi).
Doğrulamadan sunulan liste yanlış iş önceliği doğurur.

**How to apply:** Eksik listesi çıkarırken önce anahtar kelimelerle grep at,
sonra bulguları üçe ayırarak sun: zaten var / eksik yazılmış / gerçekten yeni.
Dokümandaki yanlış bilgiyi ayrıca belirt ve düzelt.
