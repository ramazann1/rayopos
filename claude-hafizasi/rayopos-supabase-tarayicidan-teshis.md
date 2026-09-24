---
name: rayopos-supabase-tarayicidan-teshis
description: "Veritabanı hatalarında Ramazan'ın Chrome'undaki açık Supabase panelinden teşhis yapılabilir; kişiyi taklit edip geri alınan işlemle hata canlandırılır."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 197335a0-40f3-4b49-9361-3e7183fb6c6d
  modified: 2026-09-18T00:47:38.312Z
---

Ramazan Supabase, Cloudflare ve RayoPOS'u tarayıcıda açık tutuyor ve
"istersen bağlanıp kendin kontrol edebilirsin" diyor (16 Eyl 2026). Yetki /
satır güvenliği hatalarında tahmin yürütmek yerine SQL Editor'den bak.

**Why:** "Garson adisyonu iptal edemiyor" hatası dosyalardan okuyarak
çözülemedi — politikalar dosyadaki hâliyle doğru görünüyordu. Sebep ancak
hatayı kişinin kendi kimliğiyle canlandırınca çıktı.

**How to apply:** SQL Editor'de kişiyi taklit et, işlemi dene, geri al:

```
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select auth_id::text from personel where id = N))::text, true);
set local role authenticated;
-- denenecek işlem
rollback;
```

`set_config`'i rol değişmeden önce çalıştır. Satır kimliği gibi değerleri
`postgres` rolündeyken `app.xxx` ayarına yaz, yoksa alt sorgu okuma kuralına
takılıp yanlış hata verir. A/B yap: aynı işlemi bir alanı değiştirerek dene,
hangi alanın hatayı doğurduğu böyle çıkıyor.

Uzun SQL'i tuşlayarak yazma — Monaco'da takılıyor ve yavaş. PowerShell
`Set-Clipboard` ile panoya koy, `ctrl+a` + `ctrl+v` ile yapıştır. Yapıştırdıktan
sonra çalıştırmadan önce bir an bekle; hemen `ctrl+Return` basılırsa çalışmıyor.

Değiştirici işlem yapma — yalnız okuma ve `rollback`'li denemeler. Şemayı
değiştiren SQL için önce [[rayopos-karar-alininca-hemen-dosyaya]] kuralınca
`sql/` altına dosyasını yaz, sonra çalıştır.

**Sonucu geri okuma (18 Eyl 2026).** Sonuç ızgarası sanallaştırılmış, ekrandan
satır satır okumak yavaş ve eksik. Doğru yol: sonuç alanının sağ üstündeki
**Export → Copy as CSV**, sonra PowerShell `Get-Clipboard -Raw`. Çok bölümlü
denetimlerde sorguyu `union all` ile tek sonuç tablosuna indir
(`bolum, konu, detay`) — editör birden çok sorguda yalnız sonuncuyu gösteriyor.

Denenip olmayan yol: panelin kendi sorgu ucunu sayfa JS'inden çağırmak.
`/dashboard/api/pg-meta/<ref>/query` "Endpoint not supported on hosted"
diyor, gerisi 404. Jeton aramaya da girme.

"Potential issue detected — destructive operations" penceresi **metin
içindeki** `delete`/`update` kelimelerine de çıkıyor; salt okuma sorgusunda
da görülebilir, sorguyu okuyup "Run query" ile geç.

**Kendi betiğin tek başına yetmiyor.** Sol menüdeki **Advisors** (Security /
Performance) ve **Logs** ayrıca taranmalı: betik `public` şemasına bakıyor,
dosya deposu (`storage`) ve kova kuralları orada değil. 18 Eyl'de ürün
görsellerinin dışarıdan listelenebildiğini betik değil Advisors yakaladı.
