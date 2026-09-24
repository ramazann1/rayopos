---
name: rayopos-altyapi-sinirini-musteriye-gosterme
description: "Bizim barındırma/kota sınırlarımız ürünün ekranına konmaz; çözüm uyarı değil, sistemin kendiliğinden temiz kalmasıdır."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 63faae9d-fa96-48b2-afd1-fe08d9e57265
  modified: 2026-09-20T22:09:27.063Z
---

Supabase kotası, veritabanı doluluğu, paket sınırı gibi şeyler **bizim
barındırma sorunumuz**. Bunları ürün ekranına (örn. Bağlantı Durumu'na
"veritabanı 312/500 MB") koymak reddedildi: "başka işletmeler bunu neden
bilsin, onların sorunu değil."

**Why:** RayoPOS başka işletmelere satılacak. Cafe sahibi bizim hangi
paketi kullandığımızı bilmek zorunda değil; o bilgi ekranda yer kaplayan,
müşteride karşılığı olmayan bir sızıntı.

**How to apply:** Altyapı sınırı için çözüm önerirken "kullanıcıya uyarı
gösterelim" deme. Doğru çözüm, sınırın kendiliğinden aşılmaması — gecelik
temizlik, otomatik arşivleme gibi arka planda duran işler. "8 ay sonra
karar verirsin" de kötü kurgu; Ramazan o tarihi hatırlamak zorunda
kalmamalı. Geri dönüşü olmayan işlerde (veri silme) önce yöntem beraber
konuşulur — bkz. [[rayopos-karar-alininca-hemen-dosyaya]] ve
[[rayopos-arayuz-metinleri-genel-dille]].
