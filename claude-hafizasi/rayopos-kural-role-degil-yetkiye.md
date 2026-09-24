---
name: rayopos-kural-role-degil-yetkiye
description: "Güvenlik/erişim kuralı yazarken \"garson bunu yapmaz\" varsayımı yasak; ölçüt yetki kodu."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a661dc0e-73f2-4d1d-8f50-cae5d061413e
  modified: 2026-08-22T22:04:05.100Z
---

Erişim kuralı tasarlarken "bizim işletmede garson bunu okumuyor/yapmıyor"
diye gruplama yapma. Ölçüt her zaman **hangi yetki kodunun işi** olduğudur.

**Why:** RayoPOS başka işletmelere satılacak ticari bir ürün. Ramazan'ın kendi
işletmesindeki rol dağılımı ürünün kuralı değil — başka bir işletme aynı
yetkiyi bambaşka bir role verebilir. Rol varsayımına dayanan kural o
işletmede ya işi kırar ya da açık bırakır.

**How to apply:** Tabloyu/işlemi role değil `oturum_yetkisi('kod')`a bağla.
Kural yazarken "X rolü bunu kullanmıyor" cümlesi kuruyorsan dur, yerine
"bu iş hangi yetkinin kapsamında" diye sor. Yetki canlı okunuyor, işletmeci
ayarı değiştirince kural kendiliğinden uyar. Aynı mantık [[rayopos-arayuz-metinleri-genel-dille]]
ile kardeş: ürün Ramazan'a göre değil, satın alacak işletmeciye göre kurulur.
Güvenlik kapsamı için ayrıca [[rayopos-guvenlik-personeli-zorlamasin]].
