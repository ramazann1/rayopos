---
name: rayopos-gorsel-hatada-once-onbellek
description: "RayoPOS'da Ramazan görsel bir hata bildirirse önce tarayıcı önbelleğinden şüphelen."
metadata: 
  node_type: memory
  type: project
  originSessionId: 46fb1d83-1af7-4a31-8041-09e279b17a75
  modified: 2026-07-31T23:08:03.688Z
---

Ramazan yeni eklenen bir arayüz öğesinin yanlış göründüğünü söylerse (anahtar
kapalı görünüyor, renk gelmiyor, stil uygulanmamış), önce **tarayıcının eski CSS'i
gösterdiğinden** şüphelen — `Ctrl+Shift+R` ile sert yenileme istet. 1 Ağu 2026
seansında görünürlük anahtarları "varsayılan kapalı geliyor" diye raporlandı;
veritabanı ve kod doğruydu, sorun önbellekti.

**Why:** Kodda olmayan bir hatayı aramak hem tur hem usage harcıyor.

**How to apply:** Veri doğruysa (curl ile Supabase'den doğrulanabiliyor) ve kod
doğruysa, üçüncü ihtimali kurcalamadan önce sert yenileme iste. Vite'ın HMR'ı
CSS'te her zaman güvenilir değil. İlgili: [[rayopos-seans-sonu-commit-claude-yapar]]

**Sadece CSS değil — modül seviyesi durum da.** 7 Eyl 2026'da kuyruk düzeltmesi
"çalışmıyor" diye üç tur döndü; kod doğruydu, HMR `kuyruk.ts`'i yeniden yüklerken
`App.tsx`'teki `kuyruguIzle()` başlangıcı yeniden çalışmıyordu, yani dinleyici hiç
kurulmuyordu. Modül seviyesinde durum tutan dosyaya (kuyruk, bağlantı, oturum,
önbellek) dokunduysan **testten önce sert yenileme istet**, sonucu ondan sonra
değerlendir.
