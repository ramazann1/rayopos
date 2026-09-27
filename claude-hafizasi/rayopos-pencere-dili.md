---
name: rayopos-pencere-dili
description: "Ramazan'ın beğendiği pencere (modal) dili — yeni ya da eski çirkin pencereler buna çevrilir."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7ba9282a-6b59-4cc0-a7cf-94b4208ee12a
  modified: 2026-09-27T23:02:09.578Z
---

28 Eyl 2026'da üretim uyarısı (`.urt-uyari`) için yapılan pencereyi Ramazan "çok beğendim" dedi ve aynısını satıştaki "stok yetersiz" ile seçenekli ürün penceresine (`UrunSecim`, `.us-` sınıfları) istedi. Dil: ortada yuvarlak köşeli kart, üstte yuvarlak renkli ikon + başlık + kısa cümle, bilgi varsa çerçeveli küçük tablo (başlık satırı kart-üst renginde), altta geniş düğmeler; seçim kartları koyu çerçeve + tik, mercan yalnız ana düğmede.

**Why:** eski pencereler (düz liste, çıplak düğmeler) "çok çirkin" bulunuyor; bu dil beğenildi.

**How to apply:** yeni pencere yaparken ya da Ramazan bir pencereyi beğenmediğinde bu dili kullan. Telefonda da **ortada** açılır (alttan açılan panel istenmedi). Açılış animasyonu yalnız saydamlık — ölçek/kaydırma ve backdrop-filter telefonda titretiyor. Ortak `.perde/.pencere/.secim` sınıflarına dokunma, önekli sınıf ver ([[rayopos-ortak-sinifa-dokunmadan-once-say]]).
