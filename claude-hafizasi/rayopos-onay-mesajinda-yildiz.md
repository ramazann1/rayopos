---
name: rayopos-onay-mesajinda-yildiz
description: OnayModal mesajında kararı belirleyen bilgi *yıldız* arasına alınır; yoksa düz cümlede kaybolur.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e28220e4-ba90-44f8-bf94-02e21315aa5d
  modified: 2026-09-21T23:47:23.494Z
---

`OnayModal`'a verilen `mesaj` metninde kararı belirleyen bilgi — malzeme adı,
masa adı, tutar, grup adı — `*yıldız arasına*` alınır. Bileşen o parçayı koyu
yazıyor.

**Why:** Ramazan 22 Eyl 2026'da malzeme silme onayında yakaladı: "a silinsin
mi?" cümlesinde ürün adı düz metinde kayboluyordu. Kural bileşenin kendi
içinde yazılı ama kolayca atlanıyor — her yeni onay penceresinde tekrar
düşünmek yerine varsayılan davranış olmalı.

**How to apply:** Yeni bir `OnayModal` yazarken mesajı önce yıldızlı kur:
`` `*${ad}* silinsin mi?` ``. Silme onaylarında `tehlikeli` ve gerekirse
`onayMetni` da verilir. İlgili: [[rayopos-arayuz-metinleri-genel-dille]]
