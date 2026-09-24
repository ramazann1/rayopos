---
name: rayopos-her-yerde-ikon
description: "RayoPOS'da her düğme, başlık ve durum işareti lucide-react ikonuyla gelir; düz karakter simgesi (× ← ✓ ⌫) kullanılmaz."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0ae7810d-5c2c-47c0-9252-7875e358f38f
  modified: 2026-08-06T21:47:44.404Z
---

RayoPOS'da arayüzdeki her düğme, pencere başlığı ve durum işareti **lucide-react
ikonu** taşır. Düz karakter simgeleri (`×`, `←`, `✓`, `⌫`, `−`) kullanılmaz;
hepsi ikona çevrilir.

**Why:** Ramazan 7 Ağu 2026'da kalem paneli ve tahsilat ekranı ikonlanınca
"bak ikonlar kullanılınca nasıl estetik duruyor, bundan sonra her yerde ikon
kullanacağız" dedi. İkonlu düğme ürünü satılabilir gösteriyor; düz karakterler
yarım kalmış izlenimi veriyor.

**How to apply:** Yeni düğme/başlık yazarken ikonu ilk seferde koy, sonradan
eklenecek diye bırakma. İkon yazının **soluna** gelir, `gap` ile hizalanır —
hizalama kuralları `index.css`'te "İkonlu düğmeler" bölümünde toplu duruyor,
her düğmeye ayrı yazma. Boyut: gövde düğmesi 16-18px, başlık 18-19px, numpad
gibi büyük tuşlar 19-20px. Elin değdiği eski ekranlarda kalan düz karakterleri
de o sırada ikona çevir.

Kullanıcının kendi tanımladığı kayıtlarda (ödeme tipleri gibi) sabit ikon
listesi olmaz — ada bakıp eşleştir, tanınmayan için nötr bir varsayılan ver
(`src/odemeIkon.tsx` bu deseni kuruyor). Bkz. [[rayopos-tipografi-ve-renk]],
[[rayopos-arayuzde-yeni-kavram-ekleme]].
