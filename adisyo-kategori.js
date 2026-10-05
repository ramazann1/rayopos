/**
 * Aktarılmış Adisyo kalemlerine kategori ve ürün karşılığı yazar.
 *
 * Adisyo kalemi yalnız ürün adı ve ürün numarasıyla geliyor; kategori yok.
 * Kategori `aktarim/adisyo-kategoriler.txt`'ten (Adisyo ürün listesi, numara →
 * kategori) bulunuyor. İngilizce menüden satılan ve Adisyo'dan silinmiş
 * ürünler `aktarim/adisyo-eslestirme.txt`'teki elle yazılmış listeyle Türkçe
 * karşılığına bağlanıyor: Analiz'de aynı ürün tek satırda toplansın.
 * Tutara dokunulmuyor; kaleme yalnız `kategoriAd` ve gerekirse `esAd` ekleniyor.
 *
 * Kullanım: node adisyo-kategori.js 15003
 * Çıktı: aktarim/3-kategori.sql (SQL Editor'de çalıştırılır)
 */
import { readFileSync, writeFileSync } from "node:fs";

const kod = process.argv[2];
if (!kod) {
  console.error("İşletme kodu verilmedi: node adisyo-kategori.js 15003");
  process.exit(1);
}

const INGILIZCE = new Set([
  "eGZOZ SHISHA", "HOT DRINKS", "HERBAL TEA", "HOT COFFEES", "ICE DRINKS", "ICE COFFEES",
  "VITAMIN BAR", "MILKSHAKE & FROZEN", "COCTAIL (NON ALCOHOL)", "SELECT YOUR BREAKFAST",
  "BREAKFAST & OMELETTE", "EGGS & MENEMEN", "PANCAKES", "SNACK & SALADS", "TOASTS",
  "MAIN COURSE", "BURGERS & WRAPS", "PASTAS", "PIZZAS", "DESSERTS", "NUTS & EXTRAS",
]);

// Ürün numaraları kategori başına sıralı, farkları 36'lık tabanda yazılı.
const kategori = new Map();
for (const satir of readFileSync("aktarim/adisyo-kategoriler.txt", "utf8").trim().split("\n")) {
  const [ad, farklar] = satir.split("|");
  let no = 0;
  for (const f of farklar.split(",")) kategori.set((no += parseInt(f, 36)), ad);
}

const buyuk = (s) => s.trim().toLocaleUpperCase("tr");

const eslestirme = new Map();
for (const satir of readFileSync("aktarim/adisyo-eslestirme.txt", "utf8").split("\n")) {
  if (!satir.trim() || satir.startsWith("#")) continue;
  const i = satir.indexOf("=");
  eslestirme.set(buyuk(satir.slice(0, i)), satir.slice(i + 1).trim());
}

const kalemler = JSON.parse(readFileSync("aktarim/adisyo-kalemler.json", "utf8"));

// Türkçe menüden satılmış her adın kategorisi; İngilizce karşılık bunun üstünden bulunuyor.
const turkce = new Map();
for (const liste of Object.values(kalemler))
  for (const k of liste) {
    const kat = kategori.get(k[1]);
    if (kat && !INGILIZCE.has(kat)) turkce.set(buyuk(k[2]), kat);
  }

const sonuc = new Map();
const acikta = new Map();
for (const liste of Object.values(kalemler))
  for (const k of liste) {
    const ad = k[2];
    if (sonuc.has(ad)) continue;
    const kat = kategori.get(k[1]);
    if (kat && !INGILIZCE.has(kat)) {
      sonuc.set(ad, { kategori: kat });
      continue;
    }
    // "Türkçe Ad#KATEGORİ": karşılık Adisyo'ya sonradan eklenmiş, geçmişte
    // Türkçe adıyla hiç satılmamış — kategorisi buradan okunuyor.
    const [es, esKategori] = (eslestirme.get(buyuk(ad)) ?? "").split("#");
    if (esKategori && !es) sonuc.set(ad, { kategori: esKategori });
    else if (esKategori) sonuc.set(ad, { kategori: esKategori, esAd: es === ad ? undefined : es });
    else if (es && turkce.has(buyuk(es))) sonuc.set(ad, { kategori: turkce.get(buyuk(es)), esAd: es });
    else if (turkce.has(buyuk(ad))) sonuc.set(ad, { kategori: turkce.get(buyuk(ad)) });
    else acikta.set(ad, (acikta.get(ad) ?? 0) + 1);
  }

if (acikta.size) {
  console.error("Eşleşmeyen adlar:", [...acikta.keys()].join(" | "));
  process.exit(1);
}

const metin = (s) => `'${s.replaceAll("'", "''")}'`;
const degerler = [...sonuc]
  .map(([ad, s]) => `(${metin(ad)}, ${metin(s.kategori)}, ${s.esAd ? metin(s.esAd) : "null"})`)
  .join(",\n");

writeFileSync(
  "aktarim/3-kategori.sql",
  `-- Aktarılmış kalemlere kategori ve ürün karşılığı (node adisyo-kategori.js ${kod}).
-- Tutara dokunmuyor; her kaleme kategoriAd, İngilizce menüden satılanlara esAd ekliyor.
with esl(ad, kategori, es_ad) as (values
${degerler}
)
update gecmis_adisyonlar g
   set kalemler = (
     select jsonb_agg(
              case when m.ad is null then e
                   else e || jsonb_strip_nulls(jsonb_build_object('kategoriAd', m.kategori, 'esAd', m.es_ad))
              end order by o)
       from jsonb_array_elements(g.kalemler) with ordinality t(e, o)
       left join esl m on m.ad = e->>'ad')
 where g.isletme_id = (select id from isletmeler where kod = ${metin(kod)})
   and jsonb_array_length(g.kalemler) > 0;
`
);
console.log(`${sonuc.size} ad eşleşti, aktarim/3-kategori.sql yazıldı.`);
