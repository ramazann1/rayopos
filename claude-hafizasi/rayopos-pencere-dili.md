---
name: rayopos-pencere-dili
description: "Ramazan'ın beğendiği pencere (modal) dili — form pencereleri OrtaPencere ile, mercan yalnız Kaydet'te, kaydırmadan sığdır."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5d6fea1f-0097-4230-a8e8-3081836994dd
  modified: 2026-09-27T23:37:42.235Z
---

28 Eyl 2026'da üretim uyarısı (`.urt-uyari`) için yapılan pencereyi Ramazan "çok beğendim" dedi; aynı gün sağdan kayan çekmeceyi (`.panel-fon/.ayar-panel`) "çirkin" bulup hepsinin ortada açılan pencereye çevrilmesini istedi. Form pencereleri artık `components/OrtaPencere.tsx` (`pnc-` sınıfları) ile yapılır: ortada kart, üstte yuvarlak ikon + başlık + tek satır açıklama, altta geniş Vazgeç/Kaydet, Sil yalnız çöp ikonu.

Kurallar (Ramazan, 28 Eyl):
- **Mercan yalnız Kaydet düğmesinde.** Seçili çip/kart/segment ve açık anahtar koyu (`--metin`) çerçeve + tik. Yazıcı penceresinde "çok fazla mercan" dedi.
- **Kaydırmadan sığdır:** uzun form iki sütuna bölünür (`.pnc-sutunlar`). Ama gerçekten uzun liste (kişi yetkileri) tek sütun kalır, aşağı kayar — iki sütunlu hâli "önceki daha iyiydi" diye geri aldırdı. Kaydırma çubuğu gizlenmez.
- Arka plan bulanıklaşmaz, yalnız koyulaşır; açılış animasyonu yalnız saydamlık (telefonda titreme). Telefonda da ortada.
- "Şık ve ikonlu" istiyor: seçenekler (ödeme şekli gibi) ikonlu kart, bölüm başlıklarında ikon.

**Why:** eski pencereler "çirkin", yeni dil beğenildi; mercan fazlası ve iki sütunlu uzun liste reddedildi.
**How to apply:** yeni ya da eski pencereyi bu bileşenle yap; ortak `.perde/.pencere/.secim` sınıflarına dokunma ([[rayopos-ortak-sinifa-dokunmadan-once-say]]).
