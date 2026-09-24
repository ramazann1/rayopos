---
name: rayopos-css-ozgullugu-say
description: "RayoPOS'da ortak kabuk sınıfını ezen CSS yazarken özgüllüğü say; \"yazdım ama değişmedi\" bunun belirtisi."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3bf51063-7d7c-4aa8-8398-3e481dce2766
  modified: 2026-09-10T20:54:14.164Z
---

RayoPOS'da ortak pencere kabuğunu (`.up-modal.tam`, `.up-fon:has(> .tam)`) ya da
`.detay-cizelge` gibi paylaşılan bir düzeni ezen kural yazarken, **yazmadan önce
asıl kuralın özgüllüğünü ve dosyadaki yerini kontrol et.** Yeni kural eşit
özgüllükteyse ve asıl kural `index.css`'te daha sonra yazılmışsa sessizce
kaybediyor. Belirti: "CSS'i yazdım ama hiçbir şey değişmedi."

**Why:** 10 Eyl 2026 seansında aynı tuzağa üç kez düşüldü (Hızlı Öde'nin
yüksekliği, fonun kenar boşluğu, zaman çizelgesinin bağlantı çizgisi). Üçü de
Ramazan'a "düzeltildi" diye sunuldu, üçü de düzelmemişti; hatayı o yakaladı.
`index.css` çok uzun ve dar ekran blokları dosyanın sonuna toplanmış durumda,
bu yüzden yeni yazılan kural neredeyse her zaman "önce" kalıyor.

**How to apply:** Ezmeden önce asıl kuralı `grep` ile bul, satır numarasına ve
seçicisine bak. Yeni seçiciyi bir sınıf daha ekleyerek güçlendir
(`.up-modal.tam.hizli-ode`, `.up-fon:has(> .hizli-ode.tam)`,
`.gecmis-govde .detay-cizelge li:not(:last-child)::before`). `!important`
kullanma. Neden üç sınıflı yazıldığını yorumda söyle, yoksa sonraki seansta
gereksiz görünüp sadeleştirilir. İlgili: [[rayopos-ortak-sinifa-dokunmadan-once-say]],
[[rayopos-buyuk-dosya-bastan-yazilmaz]], [[rayopos-gorsel-hatada-once-onbellek]]
