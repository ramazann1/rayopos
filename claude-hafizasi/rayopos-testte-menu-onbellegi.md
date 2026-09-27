---
name: rayopos-testte-menu-onbellegi
description: Chrome testinde reçeteyi doğrudan veritabanına yazınca sipariş ekranı eski menüyü gösterir.
metadata:
  node_type: memory
  type: reference
  originSessionId: 7ba9282a-6b59-4cc0-a7cf-94b4208ee12a
  modified: 2026-09-27T23:02:13.072Z
---

Test verisini (reçete satırı vb.) Supabase istemcisiyle doğrudan yazınca tanım değişikliği sinyali gitmiyor; sipariş ekranı menüyü yerel önbellekten okuyup eski hâli gösteriyor (pencere açılmıyor, ürün doğrudan sepete düşüyor). Çözüm: sayfada `(await import('/src/onbellek.ts')).onbellegiTemizle()` sonra yenile. Menü ekranından yapılan değişiklikte sorun yok.

İlgili: [[rayopos-tarayici-testi-chrome-ile]], [[rayopos-supabase-tarayicidan-teshis]].
