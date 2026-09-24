---
name: rayopos-tasarim-claude-izi-olmasin
description: "RayoPOS'da arayüz \"yapay zekâ üretmiş\" gibi durmamalı; her ekranda tasarım kararı verilmeli."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3573031f-cd66-46b2-a2c3-df0d47c64c3e
  modified: 2026-08-12T18:00:27.691Z
---

Ramazan 12 Ağu 2026'da yeni ekranların "Claude yapmış gibi durduğunu" söyledi:
kalıp form, her alanın altında açıklama, üst üste dizilmiş eşit kutular. Ekran
şık ve doğal görünmeli — kendi projesiymiş gibi.

**Why:** RayoPOS satılacak ticari bir ürün. İşi gören ama karakteri olmayan arayüz
ürünü ucuz gösteriyor; rakip Adisyo'nun yanında fark yaratması gereken taraf bu.

**How to apply:** Yeni ekran yazarken önce düzene karar ver, sonra kodla. Tipik
"yapay zekâ izi" ve karşılığı:
- Her alan tam genişlik, alt alta → kısa alanları yan yana koy (`alan-ikili`).
- Her ayarın altında bir açıklama kutusu → ekranda tek Bilgi kutusu yeter,
  gerisi etiketin sağında küçük not olur.
- Uzun ipucu cümleleri → 3-4 kelime.
- Her şey aynı boy dikdörtgen kart → seçim çipleri yuvarlak, anahtarlar tek
  çerçevede gruplu, listeler ızgara (`grid-template-columns`) hizalı.
- Doğrulama uyarısı yalnız gerektiğinde çıksın, baştan yer kaplamasın.

16 Ağu 2026'da Analiz ekranında aynı şikâyet başka yüzüyle geldi: "her şeyi çok
geniş yapıyorsun, birçok şey kaymış duruyor." Ölçü ve hizalama da tasarım
kararı:
- Sayfa genişliğini gerekmedikçe büyütme (1060px yeter, 1180px genişti).
- `repeat(auto-fit, minmax(...))` ızgara kutu sayısı değiştikçe kayıyor —
  metrik/kart ızgaralarında **sabit sütun sayısı** kullan, kutu sayısını
  ızgaraya tam bölünecek şekilde seç (5 kutu 3'lü ızgarada boşluk bırakır).
- Sütunlu liste kart yığını değil gerçek `table` olsun; para sağa dayalı.
- Panel her şeyi alt alta yığmasın; Adisyo'nun deseni varsa sütunlara ayır ve
  ikincil görünümü (zaman çizelgesi gibi) ayrı ekrana al.

İlgili: [[rayopos-arayuzde-yeni-kavram-ekleme]], [[rayopos-tipografi-ve-renk]],
[[rayopos-arayuz-metinleri-genel-dille]], [[rayopos-aciklama-cumleleri-bilgi-kutusu]]
