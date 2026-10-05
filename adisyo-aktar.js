import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Adisyo'dan çekilen adisyonları içe aktarılacak hale getirir:
 *   node adisyo-aktar.js 15003
 *
 * Girdi `aktarim/adisyo-adisyonlar.json` ve `adisyo-kalemler.json` (çekme yöntemi tasarım dosyasında,
 * "ADİSYO VERİ ÇEKME YÖNTEMİ"). Çıktı `aktarim/` içinde üç dosya:
 *   1-ara-tablo.sql          SQL Editor'de çalıştırılır
 *   gecmis-adisyonlar-N.csv  Table Editor → adisyo_ara → Import data from CSV (her parça)
 *   2-tasi.sql               SQL Editor'de çalıştırılır
 * İşletme kodu komutta veriliyor — önce Deneme'ye, sorun yoksa gerçek
 * işletmeye aynı dosyalar üretilir.
 *
 * Adisyo bir adisyonu ödeme sayısı kadar satırla veriyor; burada tek
 * adisyona toplanıyor, ödemeler içinde liste olarak duruyor.
 */

const kod = Number(process.argv[2]);
if (!kod) {
  console.error("İşletme kodu verilmedi: node adisyo-aktar.js 15003");
  process.exit(1);
}

const satirlar = JSON.parse(readFileSync("aktarim/adisyo-adisyonlar.json", "utf8"));

// Kalemler adisyon başına ayrı çekiliyor: { adisyonId: [satır, ...] }. Satır
// sırası çekme kodundaki gibi; yalnız kullanılan alanlar okunuyor.
const hamKalemler = JSON.parse(readFileSync("aktarim/adisyo-kalemler.json", "utf8"));
// Adisyo iptal edilen kalemi bu kayıtta tutmuyor; 1 ve 3 ikisi de satılmış kalem.
const KALEM_DURUMU = { 1: "normal", 3: "normal" };
// Tamamı indirimle kapanan hesapta (ikram, personel) Adisyo satırın tutarını
// sıfır yazıyor ama fiyatı bırakıyor; aradaki fark kalem indirimi sayılıyor.
const kalemCevir = (k) => ({
  ad: k[2],
  adet: k[4],
  fiyat: k[5],
  indirim: Math.max(0, Math.round((k[4] * k[5] - k[7]) * 100) / 100) || undefined,
  durum: KALEM_DURUMU[k[9]] ?? "iptal",
  saat: `${k[13]}+03`,
  not: k[12] || undefined,
});

const adisyonlar = new Map();
for (const s of satirlar) {
  // Açık kalmış hesap ciroya girmiyor; kapanınca bir sonraki çekişte gelir.
  if (s.orderStatus !== 7) continue;

  let a = adisyonlar.get(s.id);
  if (!a) {
    const musteri = [s.restaurantCustomerName, s.restaurantCustomerSurname].filter(Boolean).join(" ");
    a = {
      id: s.id,
      no: s.orderNumber,
      tip: s.orderTypeId === 1 ? "masa" : "paket",
      masa: s.tableName,
      garson: s.waiterName,
      musteri,
      // Adisyo saatleri bölgesiz veriyor; işletmenin saati (Türkiye).
      acilis: s.orderDate,
      kapanis: s.closedDate ?? s.collectionDate ?? s.updatedDate ?? s.orderDate,
      kisi: s.customerCount ?? 0,
      indirim: s.totalDiscount ?? 0,
      bahsis: 0,
      servis: (s.serviceCharge ?? 0) + (s.waiterCharge ?? 0),
      toplam: s.totalAmount ?? 0,
      odemeler: [],
      kalemler: (hamKalemler[s.id] ?? []).map(kalemCevir),
    };
    adisyonlar.set(s.id, a);
  }
  if (s.paymentType && s.paymentAmount) {
    a.odemeler.push({ tip: s.paymentType, tutar: s.paymentAmount });
    a.bahsis += s.tipAmount ?? 0;
  }
}

// SQL Editor birkaç MB'lık sorguyu kabul etmiyor. Satırlar CSV olarak
// Table Editor'ün içe aktarmasıyla ara tabloya yükleniyor, oradan tek
// sorguyla işletmeye taşınıyor.
const hucre = (d) => (d == null || d === "" ? "" : `"${String(d).replace(/"/g, '""')}"`);
const para = (n) => (Math.round(n * 100) / 100).toFixed(2);

const SUTUNLAR = [
  "kaynak_id", "no", "tip", "masa_ad", "garson_ad", "musteri_ad", "acilis", "kapanis",
  "kisi_sayisi", "indirim", "bahsis", "servis", "toplam", "odemeler", "kalemler",
];
const csv = [SUTUNLAR.join(",")];
for (const a of adisyonlar.values()) {
  csv.push(
    [
      a.id, a.no ?? "", a.tip, hucre(a.masa), hucre(a.garson), hucre(a.musteri),
      `${a.acilis}+03`, `${a.kapanis}+03`, a.kisi, para(a.indirim), para(a.bahsis),
      para(a.servis), para(a.toplam), hucre(JSON.stringify(a.odemeler)),
      hucre(JSON.stringify(a.kalemler)),
    ].join(",")
  );
}

mkdirSync("aktarim", { recursive: true });
// Table Editor'ün içe aktarması 10 MB'tan büyük dosyayı almıyor; her parça
// başlık satırıyla kendi başına yüklenebilir.
const SINIR = 8 * 1024 * 1024;
let parca = [], boy = 0, parcaNo = 0;
const parcaYaz = () => {
  writeFileSync(`aktarim/gecmis-adisyonlar-${++parcaNo}.csv`, [csv[0], ...parca].join("\n") + "\n");
  parca = [];
  boy = 0;
};
for (const satir of csv.slice(1)) {
  const b = Buffer.byteLength(satir) + 1;
  if (boy + b > SINIR) parcaYaz();
  parca.push(satir);
  boy += b;
}
if (parca.length) parcaYaz();

// Numara RayoPOS'un: açılış sırasına göre, RayoPOS'un ilk numarası 3000'den
// başlayarak veriliyor; işletmenin sayacı sondan devam ediyor. Adisyo'nun
// fişteki numarası kaynak_no'da kalıyor.
const ILK_NO = 3000;
const digerleri = SUTUNLAR.filter((s) => s !== "kaynak_id" && s !== "no");
writeFileSync(
  "aktarim/2-tasi.sql",
  `-- Ara tablodaki adisyonları işletme koduna ${kod} taşır, ara tabloyu siler.

delete from gecmis_adisyonlar where isletme_id = (select id from isletmeler where kod = ${kod});

insert into gecmis_adisyonlar
  (isletme_id, kaynak_id, no, kaynak_no, ${digerleri.join(", ")})
select i.id, a.kaynak_id, ${ILK_NO - 1} + row_number() over (order by a.acilis, a.kaynak_id), a.no,
       ${digerleri.map((s) => `a.${s}`).join(", ")}
  from (select id from isletmeler where kod = ${kod}) i, adisyo_ara a;

update isletmeler
   set son_adisyon_no = greatest(son_adisyon_no,
         (select max(no) from gecmis_adisyonlar g where g.isletme_id = isletmeler.id))
 where kod = ${kod};

drop table adisyo_ara;
`
);

writeFileSync(
  "aktarim/1-ara-tablo.sql",
  `-- CSV'nin yükleneceği geçici tablo. Taşıma sorgusu bitince siliniyor.

create table adisyo_ara (
  kaynak_id bigint, no integer, tip text, masa_ad text, garson_ad text, musteri_ad text,
  acilis timestamptz, kapanis timestamptz, kisi_sayisi integer, indirim numeric(12, 2),
  bahsis numeric(12, 2), servis numeric(12, 2), toplam numeric(12, 2), odemeler jsonb,
  kalemler jsonb
);
alter table adisyo_ara enable row level security;
`
);

const toplam = [...adisyonlar.values()].reduce((t, a) => t + a.toplam, 0);
console.log(`Toplam ${adisyonlar.size} adisyon, ${para(toplam)} TL, ${parcaNo} CSV parçası`);
