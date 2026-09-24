---
name: rayopos-liste-satiri-duzeni
description: "RayoPOS'da liste satırları — etiket/düğme sabit sütunda, açıklama satıra yazı değil \"i\" ikonuna."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 23c7c9a2-3d9d-4b3f-a53e-1bd4f7091887
  modified: 2026-08-14T01:51:06.120Z
---

Liste satırlarında (durum listeleri, cihaz listeleri) etiketler ve düğmeler
**sabit genişlikte sütunlarda** durmalı; yanlarındaki yazı uzayıp kısaldıkça
kaymamalı. Aynı gruptaki çip/etiketler (Çevrimiçi/Çevrimdışı gibi) eşit
genişlikte olmalı ki alt alta hizalansınlar. Düğmenin yazısı iş sırasında
değişiyorsa (Dene → Deneniyor) düğme yine de sabit genişlikte kalmalı.

Satırdaki açıklama ve sebep metinleri düz yazı olarak yazılmaz, `Ipucu`
bileşeninin "i" ikonuna girer — [[rayopos-aciklama-cumleleri-bilgi-kutusu]]
kuralının satır içi karşılığı.

Bir anahtarın kendi ayarı (logo yükleme, karekod seçimi gibi) listenin sonuna
değil **o anahtarın hemen altına** açılır; hangi anahtara ait olduğu bakar
bakmaz anlaşılsın. Bkz. [[rayopos-arayuzde-yeni-kavram-ekleme]].

**Why:** Ramazan bu üçünü de ayrı ayrı düzelttirdi; kayan sütun ve satıra
serpiştirilmiş açıklama ekranı dağınık gösteriyor.

**How to apply:** Yeni bir liste satırı yazarken grid sütunlarını baştan sabitle,
açıklamayı Ipucu'ya koy, ayarı anahtarının altına yerleştir.
