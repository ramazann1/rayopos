---
name: rayopos-adisyo-canli-tarayici-turu
description: "Adisyo masaüstü turu Chrome araçlarıyla canlı yapılıyor; işletmenin gerçek verisi, hiçbir şey değiştirilmez."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6e7ceb90-6f91-4990-b349-10b2f0936264
  modified: 2026-09-02T21:17:48.279Z
---

Adisyo'nun **masaüstü** paneli turu artık ekran kaydından değil, doğrudan
tarayıcıdan yapılıyor: Ramazan `pos.adisyo.com`'a giriş yapıyor, ben
`claude-in-chrome` araçlarıyla giriyorum. (Mobil uygulama hâlâ native, orada
video yolu geçerli — [[rayopos-adisyo-video-kayitlari]].)

**Bu eGZOZ'un canlı işletmesi.** Açılan hiçbir pencere kaydedilmez: eylem
görülür, **Vazgeç/İptal ile çıkılır**, tur sonunda ekranın ilk hâline
dönüldüğü doğrulanır (masa tutarı, kalem sayısı). Sonuç raporunda "hiçbir şey
değiştirilmedi" diye açıkça yazılır. Arama kutusuna yazıldıysa temizlenir,
sekme kapatılır.

**Göz kararı değil ölç.** `javascript_tool` ile `getBoundingClientRect` +
`getComputedStyle` okunup gerçek değerler alınıyor (üst bar 80px, sepet 450px,
kalem satırı 87px, kart çerçevesi `0.8px #e7e7e7`). Bizim ekranla yan yana
tablo hâline getirilince "ilkel duruyor" somut bir listeye dönüşüyor.

**Why:** Ramazan görsel işlerde "şu sayfa da ilkel" diyor; tur olmadan neyi
düzelteceğimiz tahmin oluyor. Ölçülmüş kıyas hem planı hem gerekçeyi veriyor.

**How to apply:** Turdan sonra üç başlık sun — *alacağımız fikirler*,
*almayacaklarımız (ve neden)*, *bizim kararımız*. Ramazan birebir kopya
istemiyor, "modern ve şık, bize özgü" istiyor; Adisyo'nun çözdüğü problemi al,
çözümünü değil. İlgili: [[rayopos-yeni-modulden-once-adisyo-turu]]
