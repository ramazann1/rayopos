---
name: dokumanda-yok-demeden-once-ara
description: Bir bulgunun projede eksik olduğunu söylemeden önce kendi dokümanlarda arama yapılmalı
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f588f1fa-f2ab-40cc-92ab-d3b913f6defc
  modified: 2026-09-25T21:35:10.593Z
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

**Tek dar desen yetmiyor (26 Eyl 2026):** "tarih seçici|tarih filtre" diye
aradım, bulamayınca "Adisyo'nun süzgeci hakkında not yok" dedim; oysa yol
haritası 11.1 "Filtreler penceresi" başlığıyla aynı şeyi anlatıyordu. Kavramın
Adisyo'daki adını ("Filtreler", "Filtrele"), örnek değerleri ("08:45") ve
ilgili kavramı ("kasa günü") da ara; `pos-yol-haritasi.md`'de rakip ekranları
bölüm başlıklarıyla duruyor, başlıklara bak.
