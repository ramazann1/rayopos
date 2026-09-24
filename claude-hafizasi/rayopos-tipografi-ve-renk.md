---
name: rayopos-tipografi-ve-renk
description: "RayoPOS'da silik yazı kesinlikle yasak, yazı tipi Poppins, vurgu rengi mercan; pastel palet reddedildi."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9a70c593-2b6e-48ba-ac00-e3a2e375b9b0
  modified: 2026-09-15T00:12:34.016Z
---

**Silik yazı RayoPOS'da yasaktır.** Ramazan'ın 6 Ağu 2026'daki sözü: "bundan
sonra asla silik yazı görmek istemiyorum, okunabilir ve düzgün fontlu olsun".
Bu tek seansta üç kez tekrarlanan şikâyet — yeni ekran yazarken en baştan uy.

- İkincil metin bile okunur tonda: `--soluk: #6b7578`. Düşük kontrastlı gri
  (`#8a9296`, `#999`, `#aaa`) hiçbir yerde kullanılmaz.
- Masaüstünde gövde metni 14px'in, başlık 17px'in altına inmez; 12px altı
  punto yok. **Mobilde punto alt sınırı yok** (15 Eyl 2026): "telefon ekranı
  zaten küçük, masaüstü gibi olması şart değil" — yazı karta göre küçülür,
  Adisyo gibi ekrana çok masa sığar. Küçük olabilir, silik (açık gri) olamaz.
- Yazı tipi **Poppins** — `@fontsource/poppins`, pakete gömülü. Google
  Fonts'tan çekilmez, kasa çevrimdışıyken de doğru görünmeli.
- Vurgu rengi **mercan** (`--mercan: #ff7a59`). Ana ekranlarda pastel veya
  çok renkli palet kullanılmaz; bölgelere pastel renk verme denemesi "çok
  çirkin" diye reddedildi. Renk seçici yalnızca kategori/ürün gibi kullanıcının
  kendi etiketlediği yerlerde kalır.

**İki tuzak — soluk yazı bildirildiğinde önce bunlara bak:**
1. `input`, `button`, `select`, `textarea` sayfa fontunu **miras almaz**.
   Global `font-family: inherit` kuralı var; yeni bir stil dosyası veya
   bileşen eklenirse tekrar kontrol et.
2. Ekrana özel bir kural (`.ayar-baslik p` gibi) ortak bileşenin içindeki
   etiketi yakalayıp rengini ezebiliyor. Soluk görünen yazıda önce hangi
   kuralın kazandığına bak, bileşeni değiştirme.

**How to apply:** Kural CLAUDE.md "Görünüm kuralları" bölümünde ve
rayopos-tasarim.md 48-50 numaralı tasarım kararlarında da yazılı.
[[rayopos-arayuz-metinleri-genel-dille]] [[rayopos-aciklama-cumleleri-bilgi-kutusu]]
