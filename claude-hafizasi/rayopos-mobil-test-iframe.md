---
name: rayopos-mobil-test-iframe
description: "Chrome tam ekranken mobil arayüz, sekme içinde 400 px iframe açılarak denenir"
metadata:
  node_type: memory
  type: reference
  originSessionId: 8010c720-ecdd-442e-954e-63e47bdccf18
  modified: 2026-10-07T20:51:11.506Z
---

Mobil arayüz cihaz genişliğinden seçiliyor (`GorunumKapisi`, App.tsx); Ramazan'ın Chrome penceresi tam ekran olduğu için `resize_window` işe yaramıyor, `/mobil/...` adresi masaüstüne geri atıyor. Çözüm: ayrı sekmede `document.body.innerHTML = '<iframe src="/mobil/masalar" style="width:400px;height:720px">'` — çerçeve kendi genişliğiyle telefon ekranını açıyor, tıklamalar ekran görüntüsü koordinatıyla yapılıyor (find çerçeve içini görmeyebilir).

Chrome DevTools'un telefon modu açıksa (innerWidth 375 gibi, ekran görüntüsü 234×417) sayfa doğrudan telefon arayüzünü açar — iframe gerekmez, ama `computer` tıklamaları CDP zaman aşımına düşüyor. O zaman dokunuş `javascript_tool` ile `element.click()` yapılır; sığma ölçümü `getBoundingClientRect` ile (son kutunun altı < `.m-sekmeler` üstü, `scrollHeight` = `innerHeight`). Telefon modunda masaüstü ekranı görülemiyor, Ramazan'a söyle (7 Eki 2026).

İlgili: [[rayopos-tarayici-testi-chrome-ile]], [[rayopos-masaustu-mobil-esitligi]]
