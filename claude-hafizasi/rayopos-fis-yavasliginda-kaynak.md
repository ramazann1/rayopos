---
name: rayopos-fis-yavasliginda-kaynak
description: Fiş geç çıkıyorsa önce yazdirma_kuyrugu.kaynak (yerel/bulut) ve basilma-olusturma farkına bak
metadata:
  node_type: memory
  type: reference
  originSessionId: 7f914584-6031-4113-b402-ce9192d4fc58
  modified: 2026-10-08T00:49:06.311Z
---

Fiş iki yoldan gidiyor: `yerel` (tarayıcı → aynı bilgisayardaki köprü, 127.0.0.1:7423, anında) ve `bulut` (Supabase kuyruğu → köprü canlı kanaldan alıyor, saniyeler). Yerel deneme 1,5 sn'de cevap alamazsa fiş buluta düşüyor (`yerelYazdirma.ts`).

"Fiş yavaş" şikâyetinde tahmin yürütme, Ramazan'a bu okuma sorgusunu çalıştırt:
`select id, isletme_id, tip, kaynak, durum, basilma - olusturma from yazdirma_kuyrugu order by id desc limit 20;`
Yerelde negatif küçük gecikme (-0,8) bilgisayar saati farkı, sorun değil. Kuyrukta hangi bilgisayardan geldiği yazmıyor (8 Eki 2026).

İlgili: [[rayopos-yavaslikta-once-olc]], [[rayopos-sql-ramazan-calistirir]]
