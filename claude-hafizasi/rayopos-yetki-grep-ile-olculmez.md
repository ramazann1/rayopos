---
name: rayopos-yetki-grep-ile-olculmez
description: "Hangi yetkinin sunucuda kilitli olduğu grep'le bulunamaz; yetki provası betiği çalıştırılır."
metadata: 
  node_type: memory
  type: project
  originSessionId: e9dc575c-485e-4ea6-9976-f6b188211d88
  modified: 2026-09-17T00:21:29.139Z
---

RayoPOS'ta "şu yetki sunucuda korunuyor mu" sorusu **kodu okuyarak
cevaplanamaz**. Denetimlerin çoğu yetki kodunu doğrudan yazmıyor, tetikleyiciye
parametre olarak geçiyor (`tanim_yetkisi(tg_argv[0])`,
`sql/2026-09-05-tanim-yetkileri.sql`'de tek tabloda 30 satır). Grep bunları
görmüyor.

**Why:** 17 Eyl 2026'da bu yüzden arka arkaya iki yanlış sayı verildi —
"9 yetki korunuyor", sonra "23". Gerçekte neredeyse hepsi korunuyordu. Yanlış
sayı Ramazan'ın planı yanlış kurmasına yol açardı.

**How to apply:** Yetki kapsamı sorulduğunda tahmin yürütme, tabloyu
`sql/2026-09-17-yetki-provasi.sql` ile çıkar:
`begin; select * from yetki_provasi('Mert Bey'); rollback;`
Kısıtlı yetkili biri seçilir (yöneticide her satır ✔ çıkar, hiçbir şey
öğrenilmez). Betiğe yeni deneme eklenmezse yeni yetki "betiğe eklenmeli" diye
raporun sonunda görünür. [[rayopos-dokumanda-yok-demeden-once-ara]]
