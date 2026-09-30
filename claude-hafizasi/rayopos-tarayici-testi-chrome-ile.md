---
name: rayopos-tarayici-testi-chrome-ile
description: "RayoPOS'u tarayıcıda test ederken dahili panel değil Ramazan'ın Chrome'u kullanılır."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0b998b2b-f763-4da4-8e15-002384649b21
  modified: 2026-09-30T02:22:02.819Z
---

RayoPOS'un dev sunucusu kendi ürettiği sertifikayla HTTPS çalışıyor
(`@vitejs/plugin-basic-ssl`). Claude'un dahili tarayıcı paneli bu sertifikayı
geçemiyor — `https://localhost:5173` boş sayfa olarak açılıyor, uyarı ekranı
bile çıkmıyor.

**Nasıl yapılır:** Ramazan'ın kendi Chrome'u (`claude-in-chrome` araçları) ile
gir; orada hem sertifika kabul edilmiş hem de giriş açık duruyor. Şifre girmek
yasak olduğu için zaten açık oturum şart.

**Kaçınılacak yol:** `dist`i düz HTTP ile ayrı portta sunmak sertifika
sorununu çözüyor ama giriş ekranına takılıyor — oturum o tarayıcıda yok.

17 Eyl 2026'da Ramazan "sen test et, cafede kullanılmıyor şu an" dedi; canlı
veride tam tur atıldı. Bu izin o güne özeldi, her seansta varsayılmaz —
[[rayopos-adisyo-canli-tarayici-turu]] kuralındaki gibi önce sor.

**Gizli pencere iki kez takıldı (18 Eyl 2026).** Kısıtlı kullanıcıyla tur
atarken Ramazan gizli sekmede giriş yapıyor; oradaki iki tuzak:
- Chrome uzantıları gizli pencerede varsayılan kapalı — o pencere hiç
  görünmüyor, sekme listesi boş geliyor. `chrome://extensions` → uzantı →
  "Gizli modda izin ver" açılmalı. Ayrı bir Chrome profili daha temiz çözüm.
- Pencere simge durumundayken (`document.visibilityState === "hidden"`)
  ekran görüntüsü alınabiliyor ama tıklama iletilemiyor; hata
  "Input.dispatchMouseEvent timed out" diye çıkıyor. Pencerenin görünür
  olması şart. Aynı şekilde büyütülmüş (maximized) pencere yeniden
  boyutlandırmayı sessizce yok sayıyor — mobil görünüm denenecekse önce
  pencere tam ekrandan çıkarılmalı.

**`/mobil/...` adresi salona düşüyorsa yetki sanma (30 Eyl 2026).** Genişlik
820px üstündeyse (`mobilTercih.ts`) mobil adresler `/`'e yönlendiriliyor;
yetkisiz sayfayla aynı görünüyor. Önce `window.innerWidth` ölç, pencereyi
Ramazan'a "Aşağı geri al" yaptır, sonra 420 genişliğe indir. Test sekmesi
eklentinin ayrı sekme grubunda — Ramazan izlemek isterse hangi pencere
olduğunu söyle. Kişi değiştirmek: Ben → Ekranı kilitle → PIN (Deneme test
PIN'lerini Ramazan sohbette veriyor).
