---
name: rayopos-ortak-sinifa-dokunmadan-once-say
description: Bir CSS sınıfını yenilemeden önce kaç ekranın kullandığını say; ortaksa önekli kendi sınıfını ver.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6e7ceb90-6f91-4990-b349-10b2f0936264
  modified: 2026-09-02T21:18:14.740Z
---

`index.css` tek dosya ve sınıflar ekranlar arasında sessizce paylaşılıyor. Bir
pencereyi yenilemeden önce **her zaman** kullanım sayısı çıkarılır:

```bash
grep -rl 'className="alan"' --include=*.tsx src | wc -l
```

Çıkanlar (3 Eyl 2026): `.ayar-panel` 12 ekran, `.modal-aksiyonlar` 16 ekran,
`.alan` 13 ekran, `.alt-ac` iki ayrı sayfa. Bunlar yenilenen pencereyle
birlikte değiştirilirse alakasız on ekran bozulur.

**Çözüm sırası:**
1. Yenilenen pencereye **önekli kendi sınıfları** ver (`kp-`, `ab-`, `th-`,
   `up-`), ortak sınıfa dokunma.
2. Aynı kabuğu paylaşan birkaç pencere varsa sınıf eklemek yerine **kabuğun
   içinden hedefle** (`.onay-modal .modal-aksiyonlar`) — kabuğu kullanan üçü
   birden düzelir, diğer on üçü etkilenmez.
3. Kabuğun dolgusunu kaldırıyorsan, o kabuğu paylaşan **öteki bileşenlerin iç
   bloklarını da** gez: dolgu onlardan geliyordu (`.duzelt-tipler`,
   `.eksik-tutar` kenara yapışmıştı).

Ayrıca eski kurallar yeniyi ezebiliyor: dosyada **sonra gelen** kazanıyor, o
yüzden yenilemeden sonra `grep -n "^\.sinif"` ile kopya/çakışan kural ara.
Ölü kalan kuralları da sil — sınıf artık hiçbir `.tsx`'te yoksa gitmeli.

**Why:** Bu seansta `.kategori`, `.urun-kart` ve `.alt-ac`'ın eski kuralları
dosyanın ilerisinde durup yeni tasarımı eziyordu; `.alt-ac` silinince Menü
Stüdyosu'ndaki ok bozuluyordu.

**How to apply:** Yenileme bitince `npx.cmd tsc --noEmit -p tsconfig.app.json`
ve kök dizinden `npx.cmd vite build` çalıştır, ayrıca CSS süslü parantez
dengesini say. İlgili: [[rayopos-masaustu-mobil-esitligi]]
