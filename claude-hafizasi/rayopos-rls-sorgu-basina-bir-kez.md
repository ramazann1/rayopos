---
name: rayopos-rls-sorgu-basina-bir-kez
description: Yeni RLS politikasında kişiye bağlı fonksiyonlar (select ...) içinde yazılır; alt tablo üst satıra exists ile bakar.
metadata:
  node_type: memory
  type: project
  originSessionId: 4b6648ff-882d-4bdc-b315-543214b8b293
  modified: 2026-10-01T21:49:11.916Z
---

RLS politikalarında `oturum_isletmesi()`, `oturum_yetkisi()` gibi kişiye bağlı çağrılar her satırda çalışınca rapor 14 sn sürüyordu (584 kalem 2,8 sn). `(select fn())` biçimine alınınca sorgu başına bir kez hesaplandı; rapor 0,6 sn (2 Eki 2026, `sql/2026-10-02-adisyon-okuma-hizi.sql`). Alt tablolar (tur, kalem, tahsilat) `exists (select 1 from adisyonlar a where a.id = ...)` ile üst satırın kuralından geçiyor.

**Why:** Satır başına yetki fonksiyonu veri büyüdükçe dakikalara çıkıyor; canlı işletmede rapor açılmaz olur.
**How to apply:** Yeni ya da değişen her politikada bu kalıbı kullan. Denetim, masraf vb. diğer tablolarda hâlâ eski kalıp var; yavaşlık görülürse önce orada ölç ([[rayopos-yavaslikta-once-olc]]).
