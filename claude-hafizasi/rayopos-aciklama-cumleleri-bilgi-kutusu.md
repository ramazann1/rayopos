---
name: rayopos-aciklama-cumleleri-bilgi-kutusu
description: "Açıklama düz paragraf olmaz; tek cümle başlıktaki Ipucu, çok cümle Bilgi kutusu."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e28220e4-ba90-44f8-bf94-02e21315aa5d
  modified: 2026-09-23T20:27:49.050Z
---

Açıklama cümleleri hiçbir zaman düz paragraf değil. Uzunluğa göre ikiye
ayrılıyor (22 Eyl 2026'da Ramazan'ın kararıyla ikiye bölündü):

- **Tek cümlelik ekran/bölüm açıklaması** → `components/Ipucu.tsx`, başlığın
  yanında küçük "i" işareti.
- **Çok cümlelik, okunması gereken anlatım** → `components/Bilgi.tsx`,
  yuvarlak "i" ikonlu kutu. Çoğunlukla modal ya da kurulum adımı içinde.

**Why:** Malzemeler ekranında tek cümlelik açıklama `Bilgi` kutusuyla yazılınca
sayfanın tüm genişliğini kaplayıp listenin üstündeki en değerli yeri yedi.
Ramazan "hem çok yer kaplıyor hem stili çirkin" dedi ve kuralın güncellenmesini
seçti — yani bu tek ekranın istisnası değil, genel kural.

**Ipucu gerçekten TEK KISA CÜMLEDİR** (23 Eyl 2026). Sayım ekranında üçü de
paragraf uzunluğunda yazılmıştı; Ramazan "aptala anlatır gibi, çok uzun" dedi.
Gerekçeyi anlatma, kuralı söyle: "Sistemdeki miktar gizli; ne saydıysanız onu
yazın." Balonun `baslik` parametresi de tek cümlede kullanılmaz — fazlalık.

**How to apply:** Yeni ekran yazarken açıklama önce `Ipucu` olarak düşünülür;
ancak anlatım iki cümleyi geçiyor ve kullanıcının gerçekten okuması gerekiyorsa
`Bilgi` kutusuna çıkılır. Kural CLAUDE.md "Görünüm kuralları"nda da yazılı.
İlgili: [[rayopos-arayuz-metinleri-genel-dille]] · [[rayopos-liste-satiri-duzeni]]
