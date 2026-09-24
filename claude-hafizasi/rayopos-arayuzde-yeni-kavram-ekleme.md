---
name: rayopos-arayuzde-yeni-kavram-ekleme
description: "RayoPOS'da arayüz çözümü önerirken yeni öğe/kavram eklemek yerine mevcut deseni genişlet."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4333226f-c757-42cf-8c62-a5ac21f498c3
  modified: 2026-08-02T00:30:01.333Z
---

RayoPOS'da bir arayüz sorununa çözüm üretirken önce **mevcut öğeleri** kullanan
seçeneği öner: yeni çip şeridi, ikinci mod, ek düğme grubu gibi yeni kavramlar
Ramazan tarafından "karmaşık, anlaşılmıyor" diye reddediliyor. Alt kategori
işinde iki tur harcandı — girintili tam liste ve "Tümü + çip şeridi" denendi,
kabul edilen çözüm ekrana hiçbir yeni öğe eklemeyen "seçili kategorinin altları
açılır" oldu.

**Why:** Ramazan yazılımda acemi; ekranda öğrenmesi gereken her yeni kavram
(çip, "Tümü" seçimi, çip içi düzenleme) maliyet. Çalışan ama anlaşılmayan
arayüz onun için başarısız sayılıyor.

**How to apply:** Seçenek sunarken en sade olanı ilk sıraya koy ve "yeni kavram
yok" olduğunu açıkça söyle. Bir çözümde üç-dört yeni etkileşim biriktiyse
(düğme + rozet + mod + ipucu) durup sadeleştir. Tasarım kararı netleşince
rayopos-tasarim.md bölüm 6'ya gerekçesiyle yaz — [[rayopos-seans-sonu-commit-claude-yapar]]
akışının parçası.
