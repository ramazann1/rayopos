---
name: rayopos-yeni-modulden-once-adisyo-turu
description: "Adisyo'da derin turu yapılmamış bir modüle başlamadan önce önce beraber canlı tur atılır, plan ondan sonra."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4cd10387-9edd-46f9-91c8-50ec0fc6dffd
  modified: 2026-08-12T23:24:32.004Z
---

Sıradaki iş Adisyo'da **derinlemesine incelenmemiş** bir modülse (pos-yol-haritasi.md'de
o modülün kendi "derin tur" bölümü yoksa, sadece rota/başlık listesinde geçiyorsa),
plan sunmadan önce Ramazan'a "önce Adisyo'da beraber tur atalım" denir. Tur bittikten
sonra bulgular yol haritasına yazılır, plan ondan sonra çıkarılır.

**Why:** RayoPOS, Adisyo'nun işlevini alıp arayüzü kendi kuran bir ürün. Turu atlanan
modülde Adisyo'da hiç olmayan ekran öneriliyor (9 Ağu 2026: "kapanmış adisyonlar"
ayrı sol menü maddesi olarak önerildi, oysa Adisyo'da o bilgi Raporlar → Gün Sonu
içinde). Ramazan bunu yakaladı ve kural olarak istedi.

**How to apply:** Plan yerine önce "bu modülü Adisyo'da detaylı gezdik mi?" diye
kontrol et. Gezilmediyse tur öner. Turu **Claude kendi başına yapar**: Ramazan
Chrome'da pos.adisyo.com'a giriş yapar (şifreyi Claude giremez), gerisini Claude
`mcp__claude-in-chrome__*` ile gezer. 11 Ağu 2026'da Ramazan bunu açıkça istedi —
ekran ekran anlattırmak yerine "sen bağlan, herşeye detaylıca bak".

Canlı işletme olduğu için: ayar değiştirmek veya kayıt oluşturmak gerekiyorsa önce
sorulur. Kasa turunda gerekti (parametre kapalıyken ekran hiç görünmüyordu) ve
Ramazan izin verdi; tur sonunda her şey eski haline döndürüldü.

Menü modülü, satış ekranı, Tanımlamalar, Ayarlar/Kullanıcılar, **Kasa/Gider**,
**Raporlar** ve **ödeme/tahsilat ekranı** (2 Eyl 2026) gezildi; **Yazıcı, KDS,
Stok, Cari** henüz derin turlu değil.

2 Eyl 2026 turunda Ramazan canlı masada küçük tutarlı deneme tahsilatına izin
verdi (₺0,10 nakit alınıp silindi) ve ÖKC anahtarı geçici kapatıldı; ikisi de
tur sonunda geri alındı. Bakmakla görülmeyen akışlar ancak böyle çıkıyor.
İlgili: [[rayopos-arayuzde-yeni-kavram-ekleme]], [[dokumanda-yok-demeden-once-ara]].
