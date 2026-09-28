---
name: rayopos-canlida-test-yok
description: "28 Eyl 2026'dan sonra gerçek cafe ayrı işletmede; tarayıcı testleri yalnız deneme işletmesinde (kod 15003)"
metadata:
  node_type: memory
  type: project
  originSessionId: 2b9aa953-a9b0-4956-a5d5-ee34ef4109fe
  modified: 2026-09-28T00:30:26.191Z
---

28 Eyl 2026'da Ramazan cafede gerçek kullanıma geçmeye karar verdi. Eski işletme
(kod 15003, eski adı "eGZOZ lounge") içindeki her şey denemeydi; o işletme
**deneme işletmesi** olarak kalıyor, gerçek cafe için yeni temiz işletme açılıyor.

**Why:** Canlı işletmede açılan deneme adisyonu, ayar açıp kapatma gerçek ciroyu ve
kasayı bozar.

**How to apply:** Chrome'da test ederken önce hangi işletmeye girildiğine bak;
deneme işletmesi değilse test etme, Ramazan'a söyle. Ayar değiştiren testler
(ör. Kasa takibini açıp kapatma) yalnız denemede. SQL'lerde işletme filtresi
kuralı aynen geçerli: [[rayopos-panelden-toplu-guncelleme-isletme-filtresi]].
