---
name: rayopos-tarih-saat-kutulari
description: "Tarih/saat girişi tarayıcı seçicisiyle değil maskeli kendi kutumuzla; önemli ayar yazarken kaydedilmez, tik + onay."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 76e8fe73-7980-482e-ba1b-d302d91f3ffe
  modified: 2026-09-26T19:04:09.814Z
---

Tarayıcının kendi tarih/saat seçicisi (`type="date"`, `type="time"`) kullanılmaz — Ramazan "kullanışsız ve rüküş" dedi (26 Eyl 2026). Yerine `components/SaatKutusu.tsx` ve `TarihSuzgeci.tsx` içindeki tarih kutusu: elle yazılır, nokta/iki nokta kendiliğinden gelir, olmayan gün/ay/saat tuşta reddedilir.

Raporları etkileyen ayar (kasa günü gibi) yazarken kaydedilmez: değişiklik başlayınca yanında tik çıkar, tike basınca OnayModal sorar. Kutudan çıkınca otomatik onay sorma da reddedildi.

**Why:** Yarım yazılmış saat anında kaydedilip raporların aralığını değiştiriyordu; odak kaybında açılan onay da beklenmedik geldi.
**How to apply:** Yeni tarih/saat alanında önce bu bileşenleri kullan. Mercan vurgu az olsun: [[rayopos-tipografi-ve-renk]].
