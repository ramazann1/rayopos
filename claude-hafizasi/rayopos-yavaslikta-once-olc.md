---
name: rayopos-yavaslikta-once-olc
description: "Ekran yavaş" şikayetinde kod okuyup tahmin etme; Chrome'da istek sürelerini ölçüp sorgu adaylarını yarıştır.
metadata:
  type: feedback
---

Bir ekran yavaş diye şikayet gelirse iyileştirme tahmin edilerek yazılmaz.
Ramazan'ın Chrome'una bağlanıp (`mcp__claude-in-chrome__*`) ekranı aç,
`performance.getEntriesByType('resource')` ile hangi isteğin kaç ms sürdüğünü
oku. Sonra sayfanın kendi `fetch` başlıklarını yakalayıp aynı veriyle sorgu
varyantlarını yarıştır; kazananı koda geçir.

**Why:** 17 Eyl 2026'da İstasyon ekranı için üç tur tahminle değişiklik
yapıldı, biri işi daha da yavaşlattı ve Ramazan "sen başka bir yeri
düzeltmiyorsun dimi" diye sordu. Ölçüm tek turda bitirdi: 5 sn → 0,3 sn.

**How to apply:** Varyantları ölç, sonucu tabloyla göster. O ekranda kazanan
desen: "önce açık adisyon kimlikleri, sonra `turlar?adisyon_id=in.(...)`" —
gömülü tabloya süzgeç koymak (`adisyon.durum=eq.acik`) tek başına ~1 sn
tutuyor. Aynı tuzak başka ekranlarda da olabilir.
Ayrıca [[rayopos-tarayici-testi-chrome-ile]].

Ölçüm tuzağı (25 Eyl 2026): Chrome arka plan sekmesinde setTimeout 1 sn'ye kısılıyor; bekleme döngüsüyle ölçülen süre sahte 1000 ms çıkar. Ekrandaki değişikliği MutationObserver ile yakala.
