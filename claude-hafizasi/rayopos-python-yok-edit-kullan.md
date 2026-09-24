---
name: rayopos-python-yok-edit-kullan
description: Bu makinede Python kurulu değil; dosya düzenlemede betik denemeden doğrudan Edit kullanılır.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d718e7f3-f95c-45e5-aa49-41397bcfe0d0
  modified: 2026-09-17T20:13:53.238Z
---

Ramazan'ın bilgisayarında Python kurulu değil (`python` komutu Microsoft Store
kısayoluna düşüyor). Toplu metin değişikliği için Python/sed betiği yazma
denemesi yapılmaz; dosya değişiklikleri doğrudan Edit aracıyla yapılır.

**Why:** Başarısız betik denemesi Ramazan'a anlamsız hata çıktısı olarak
görünüyor ve "neden böyle bir şey söylüyorsun" diye sordu — iş için gereksiz
bir adım.

**How to apply:** Bir dosyada birkaç yerde değişiklik olsa bile Edit ile
sırayla yap. Kabuk gerekiyorsa `npm.cmd`/git gibi gerçek komutlarla sınırlı
kal ([[rayopos-buyuk-dosya-bastan-yazilmaz]]).
