---
name: rayopos-yeni-ekranda-once-taslak
description: "Yeni ekran/pencere kodlanmadan önce taslağı gösterilir, onay alınır."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e28220e4-ba90-44f8-bf94-02e21315aa5d
  modified: 2026-09-23T19:38:21.240Z
---

Yeni bir ekran ya da pencere yazmadan **önce taslağı göster** (görsel araç ya
da net bir kroki), onay al, sonra kodla.

**Why:** 23 Eyl 2026'da Malzemeler ekranı doğrudan kodlandı ve onlarca tur
düzeltme çıktı — beş çipli seçim sırası, yandan açılan çekmece panel, koyu
ipucu balonu, fazla mercan vurgu, öneksiz CSS sınıfı. Ramazan: "bok gibi
tasarım yapma, sonra elli tane değişiklik yapıyoruz." Aynı seansta Hareketler
ekranı önce taslak olarak gösterildi, onaylandı, tek turda geçti.

**How to apply:** Taslakta şunlar görünmeli: sayfa başlığı + eylem düğmeleri,
süzgeç şeridi, liste satırının anatomisi, açılan pencerenin alanları.
Taslakta da seans kuralları geçerli: ortada modal · tek dolu mercan ve o da
birincil eylemde · süzgeç ile eylem ayrı şeritlerde · beşli çip sırası yerine
açılır liste · liste sayfayı uzatmaz ([[rayopos-liste-satiri-duzeni]]).
İlgili: [[rayopos-ortak-sinifa-dokunmadan-once-say]]
