---
name: rayopos-panelden-toplu-guncelleme-isletme-filtresi
description: Supabase panelinden çalışan toplu güncellemede isletme_id koşulu zorunlu; RLS orada korumuyor.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 591408db-17a2-454a-97cc-c288ff344d42
  modified: 2026-09-21T22:28:21.668Z
---

Supabase panelinden (SQL Editor) çalıştırılan her toplu `update`/`insert`'e
**`isletme_id` koşulu** konur. Panelde satır güvenliği devrede değildir.

**Why:** 22 Eyl 2026'da kaleme kategori doldurulurken ad eşleşmesi bütün
işletmelerde yapıldı; 11 kaleme başka bir işletmenin kategorisi yazıldı.
Uygulamadan çalışsa RLS engelleyecekti, panelde engellemedi. Hata ancak
kategori adının yazımı farklı olduğu için ("SICAK İÇECEKLER" ile
"Sıcak İçecekler") fark edildi — tutsaydı sessizce yanlış veri kalacaktı.
Veritabanında birden çok deneme işletmesi var, bu yüzden tekrar etmesi kolay.

**How to apply:** Kimlik üstünden eşleşme güvenli (`urun_id`, `id` sistem
genelinde tekil). **Ad, telefon, kod gibi metin üstünden eşleşme güvenli
değil** — mutlaka `isletme_id` ile sınırla. Göç dosyasına da bu koşullu hâli
yaz, sonradan başka kurulumda tekrarlanmasın. Yazdıktan sonra "yabancı değer
kalmış mı" diye doğrulama sorgusu çalıştır.

İlgili: [[rayopos-supabase-tarayicidan-teshis]], [[rayopos-yetki-grep-ile-olculmez]]
