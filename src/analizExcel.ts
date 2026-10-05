import {
  TIP_ADLARI,
  aralikMetni,
  donemAraligi,
  donemMetni,
  durumMetni,
  yogunlukTablosu,
  gunlukCiro,
  type AnalizAdisyon,
  type AnalizFiltre,
  type AnalizOzeti,
  type CariHareketSatiri,
  type DenetimSatiri,
  type GiderOzeti,
  type MutfakSuresiOzeti,
  type OdenmezSatiri,
  type PersonelOzeti,
  type UrunOzeti,
} from "./analiz";
import { odemeAdi, type Masraf } from "./masraflar";
import { kayiplariGetir, sebepAdi } from "./stokHareket";
import { miktarGoster } from "./stok";

// Analiz'in her sekmesi kendi tablolarıyla .xlsx olarak iniyor. Rakamlar metin
// değil sayı: muhasebeci dosyayı açınca toplayıp süzebilsin. Ekrandaki arama
// kutusu dosyaya yansımıyor; dönem ve filtreler yansıyor.

type Hucre = import("write-excel-file/browser").CellObject | null;
type Sutun = { ad: string; genislik: number; tur?: "para" | "sayi" | "yuzde" };
type Sayfa = { ad: string; sutunlar: Sutun[]; satirlar: (string | number | null)[][]; toplam?: boolean };

export type AnalizVerisi = {
  filtre: AnalizFiltre;
  adisyonlar: AnalizAdisyon[];
  ozet: AnalizOzeti;
  urunler: UrunOzeti;
  personel: PersonelOzeti;
  mutfak: MutfakSuresiOzeti | null;
  giderler: Masraf[];
  giderOzeti: GiderOzeti;
  odenmezler: OdenmezSatiri[];
  cariHareketler: CariHareketSatiri[];
  denetim: DenetimSatiri[];
};

export const DISA_AKTARILAN_BOLUMLER: Record<string, string> = {
  ozet: "Özet",
  adisyonlar: "Adisyonlar",
  urunler: "Ürünler",
  karlilik: "Kârlılık",
  mutfak: "Mutfak",
  personel: "Personel",
  giderler: "Giderler",
  odenmezler: "İkramlar",
  "acik-hesap": "Açık Hesap",
  denetim: "Denetim",
};

const PARA = "#,##0.00 ₺";

const zaman = (t: string | null) =>
  t
    ? new Date(t).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const dakika = (saniye: number) => Math.round((saniye / 60) * 10) / 10;

const iki = (n: number) => String(n).padStart(2, "0");
const saatAraligi = (saat: number) => `${iki(saat)}:00 – ${iki((saat + 1) % 24)}:00`;

const tahsilatlar = (a: AnalizAdisyon) =>
  a.odemeler.map((o) => `${o.tip} ${o.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`).join(", ");

async function sayfalar(bolum: string, v: AnalizVerisi): Promise<Sayfa[]> {
  switch (bolum) {
    case "ozet": {
      const o = v.ozet;
      const { bas, bit } = donemAraligi(v.filtre);
      const yogunluk = yogunlukTablosu(v.adisyonlar, bas, bit);
      const gunluk = gunlukCiro(v.adisyonlar, bas, bit);
      return [
        {
          ad: "Özet",
          sutunlar: [{ ad: "Kalem", genislik: 28 }, { ad: "Değer", genislik: 16, tur: "para" }],
          satirlar: [
            ["Ciro (kapanan)", o.ciro],
            ["Açık masalar", o.acikTutar],
            ["Toplam iş", o.toplamIs],
            ["Tahsil edilen", o.tahsilEdilen],
            ["Eksik tahsilat", o.eksikTahsilat],
            ["Ara toplam", o.araToplam],
            ["İndirim", o.indirim],
            ["İkram", o.ikram],
            ["KDV hariç tutar", o.matrah],
            ["KDV", o.kdv],
            ["Kuver ve garsoniye", o.servis],
            ["Bahşiş", o.bahsis],
            ["Ortalama adisyon", o.ortalama],
            ["Kişi başı", o.kisiBasi],
            ["Gider", o.gider],
            ["Kasaya kalan", o.net],
          ],
        },
        {
          ad: "Sayılar",
          sutunlar: [{ ad: "Kalem", genislik: 28 }, { ad: "Adet", genislik: 12, tur: "sayi" }],
          satirlar: [
            ["Kapanan adisyon", o.adisyon],
            ["Açık adisyon", o.acik],
            ["Misafir", o.misafir],
          ],
        },
        {
          ad: "Ödeme tipleri",
          sutunlar: [
            { ad: "Ödeme tipi", genislik: 22 },
            { ad: "Adet", genislik: 10, tur: "sayi" },
            { ad: "Tutar", genislik: 16, tur: "para" },
          ],
          satirlar: o.odemeler.map((d) => [d.ad, d.adet, d.tutar]),
          toplam: true,
        },
        {
          ad: "Sipariş tipi",
          sutunlar: [
            { ad: "Tip", genislik: 22 },
            { ad: "Adet", genislik: 10, tur: "sayi" },
            { ad: "Tutar", genislik: 16, tur: "para" },
          ],
          satirlar: o.tipler.map((d) => [d.ad, d.adet, d.tutar]),
          toplam: true,
        },
        {
          ad: "Saatler",
          sutunlar: [
            { ad: "Saat", genislik: 16 },
            { ad: "Adisyon", genislik: 10, tur: "sayi" },
            { ad: "Ciro", genislik: 16, tur: "para" },
          ],
          satirlar: o.saatler.filter((s) => s.adet > 0).map((s) => [saatAraligi(s.saat), s.adet, s.tutar]),
          toplam: true,
        },
        {
          ad: "Yoğunluk",
          sutunlar: [
            { ad: yogunluk.haftalik ? "Gün" : "Tarih", genislik: 20 },
            ...yogunluk.saatler.map((s): Sutun => ({ ad: `${iki(s)}:00`, genislik: 7, tur: "sayi" })),
            { ad: "Toplam", genislik: 9, tur: "sayi" },
          ],
          satirlar: yogunluk.satirlar.map((s) => [
            s.baslik,
            ...s.hucreler.map((h) => h.adet || null),
            s.adet,
          ]),
          toplam: true,
        },
        {
          ad: "Gün gün",
          sutunlar: [
            { ad: "Gün", genislik: 18 },
            { ad: "Adisyon", genislik: 10, tur: "sayi" },
            ...gunluk.tipler.map((t): Sutun => ({ ad: t, genislik: 14, tur: "para" })),
            { ad: "Tahsil edilmedi", genislik: 15, tur: "para" },
            { ad: "Ciro", genislik: 14, tur: "para" },
          ],
          satirlar: gunluk.satirlar.map((s) => [s.etiket, s.adisyon, ...s.odemeler, s.eksik, s.ciro]),
          toplam: true,
        },
      ];
    }

    case "adisyonlar":
      return [
        {
          ad: "Adisyonlar",
          sutunlar: [
            { ad: "No", genislik: 9, tur: "sayi" },
            { ad: "Açılış", genislik: 17 },
            { ad: "Kapanış", genislik: 17 },
            { ad: "Tip", genislik: 9 },
            { ad: "Bölge", genislik: 14 },
            { ad: "Masa / müşteri", genislik: 18 },
            { ad: "Misafir", genislik: 9, tur: "sayi" },
            { ad: "Açan", genislik: 16 },
            { ad: "Durum", genislik: 14 },
            { ad: "Ara toplam", genislik: 13, tur: "para" },
            { ad: "İndirim", genislik: 12, tur: "para" },
            { ad: "İkram", genislik: 12, tur: "para" },
            { ad: "Kuver", genislik: 11, tur: "para" },
            { ad: "Garsoniye", genislik: 11, tur: "para" },
            { ad: "KDV hariç", genislik: 13, tur: "para" },
            { ad: "KDV", genislik: 11, tur: "para" },
            { ad: "Tutar", genislik: 13, tur: "para" },
            { ad: "Ödenen", genislik: 13, tur: "para" },
            { ad: "Kalan", genislik: 12, tur: "para" },
            { ad: "Bahşiş", genislik: 11, tur: "para" },
            { ad: "Tahsilatlar", genislik: 30 },
            { ad: "İptal sebebi", genislik: 24 },
          ],
          satirlar: v.adisyonlar.map((a) => [
            a.no,
            zaman(a.acilis),
            zaman(a.kapanis),
            TIP_ADLARI[a.tip],
            a.bolgeAd,
            a.tip === "masa" ? a.masaAd : a.musteri || a.ad,
            a.kisiSayisi || null,
            a.garson,
            durumMetni(a),
            a.araToplam,
            a.indirim,
            a.ikram,
            a.kuver,
            a.garsoniye,
            a.matrah,
            a.kdv,
            a.toplam,
            a.odenen,
            a.kalan,
            a.bahsis,
            tahsilatlar(a),
            a.iptalSebep,
          ]),
          toplam: true,
        },
      ];

    case "urunler":
      return [
        {
          ad: "Ürünler",
          sutunlar: [
            { ad: "Ürün", genislik: 26 },
            { ad: "Kategori", genislik: 18 },
            { ad: "Miktar", genislik: 10, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
            { ad: "Pay", genislik: 9, tur: "yuzde" },
            { ad: "Önceki ciro", genislik: 14, tur: "para" },
            { ad: "İkram", genislik: 12, tur: "para" },
            { ad: "İptal", genislik: 10, tur: "sayi" },
          ],
          satirlar: v.urunler.satirlar.map((s) => [
            s.ad,
            s.kategoriAd,
            s.miktar,
            s.ciro,
            v.urunler.ciro > 0 ? s.ciro / v.urunler.ciro : 0,
            s.oncekiCiro ?? null,
            s.ikram,
            s.iptal,
          ]),
          toplam: true,
        },
        {
          ad: "Kategoriler",
          sutunlar: [
            { ad: "Kategori", genislik: 22 },
            { ad: "Miktar", genislik: 10, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
          ],
          satirlar: v.urunler.kategoriler.map((k) => [k.ad, k.adet, k.tutar]),
          toplam: true,
        },
        {
          ad: "Bölgeler",
          sutunlar: [
            { ad: "Bölge", genislik: 22 },
            { ad: "Adisyon", genislik: 10, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
          ],
          satirlar: v.urunler.bolgeler.map((b) => [b.ad, b.adet, b.tutar]),
          toplam: true,
        },
        {
          ad: "Masalar",
          sutunlar: [
            { ad: "Masa", genislik: 24 },
            { ad: "Adisyon", genislik: 10, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
            { ad: "Ortalama", genislik: 14, tur: "para" },
          ],
          satirlar: v.urunler.masalar.map((m) => [m.ad, m.adet, m.tutar, m.adet ? m.tutar / m.adet : 0]),
        },
        {
          ad: "Seçenekler",
          sutunlar: [
            { ad: "Seçenek", genislik: 24 },
            { ad: "Ürün", genislik: 26 },
            { ad: "Adet", genislik: 10, tur: "sayi" },
          ],
          satirlar: v.urunler.secenekler.map((s) => [s.ad, s.urun, s.adet]),
        },
        {
          ad: "Satılmayanlar",
          sutunlar: [
            { ad: "Ürün", genislik: 26 },
            { ad: "Kategori", genislik: 18 },
            { ad: "Durum", genislik: 14 },
          ],
          satirlar: v.urunler.satilmayanlar.map((s) => [
            s.ad,
            s.kategoriAd,
            s.gizli ? "Gizli" : s.tukendi ? "Tükendi" : "",
          ]),
        },
      ];

    case "karlilik": {
      const kayiplar = await kayiplariGetir(donemAraligi(v.filtre));
      return [
        {
          ad: "Kârlılık",
          sutunlar: [
            { ad: "Ürün", genislik: 26 },
            { ad: "Kategori", genislik: 18 },
            { ad: "Adet", genislik: 9, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
            { ad: "Maliyet", genislik: 14, tur: "para" },
            { ad: "Kâr", genislik: 14, tur: "para" },
            { ad: "Kâr oranı", genislik: 11, tur: "yuzde" },
            { ad: "Birim maliyet", genislik: 13, tur: "para" },
            { ad: "Birim kâr", genislik: 13, tur: "para" },
          ],
          satirlar: v.urunler.satirlar
            .filter((s) => s.maliyetliMiktar > 0)
            .map((s) => {
              const kar = s.maliyetliCiro - s.maliyet;
              return [
                s.ad,
                s.kategoriAd,
                s.maliyetliMiktar,
                s.maliyetliCiro,
                s.maliyet,
                kar,
                s.maliyetliCiro > 0 ? kar / s.maliyetliCiro : 0,
                s.maliyet / s.maliyetliMiktar,
                kar / s.maliyetliMiktar,
              ];
            }),
          toplam: true,
        },
        {
          ad: "Maliyeti bilinmeyen",
          sutunlar: [
            { ad: "Ürün", genislik: 26 },
            { ad: "Satılan", genislik: 10, tur: "sayi" },
            { ad: "Maliyeti bilinen", genislik: 16, tur: "sayi" },
          ],
          satirlar: v.urunler.satirlar
            .filter((s) => s.miktar > 0 && s.maliyetliMiktar < s.miktar)
            .map((s) => [s.ad, s.miktar, s.maliyetliMiktar]),
        },
        {
          ad: "Fire ve çıkış",
          sutunlar: [
            { ad: "Malzeme", genislik: 24 },
            { ad: "Tür", genislik: 9 },
            { ad: "Sebep", genislik: 20 },
            { ad: "Miktar", genislik: 14 },
            { ad: "Tutar", genislik: 13, tur: "para" },
          ],
          satirlar: kayiplar.map((k) => [
            k.malzemeAd,
            k.tip === "fire" ? "Fire" : "Çıkış",
            sebepAdi(k.tip, k.sebep) || "",
            miktarGoster(k.miktar, k.birim),
            k.kurus == null ? null : k.kurus / 100,
          ]),
          toplam: true,
        },
      ];
    }

    case "mutfak": {
      const m = v.mutfak;
      return [
        {
          ad: "Hazırlık süreleri",
          sutunlar: [
            { ad: "Ürün", genislik: 26 },
            { ad: "İstasyon", genislik: 16 },
            { ad: "Adet", genislik: 9, tur: "sayi" },
            { ad: "Ortalama (dk)", genislik: 13, tur: "sayi" },
            ...(m?.asamaliVar
              ? [
                  { ad: "Sırada (dk)", genislik: 12, tur: "sayi" } as Sutun,
                  { ad: "Hazırlanma (dk)", genislik: 15, tur: "sayi" } as Sutun,
                ]
              : []),
            { ad: "En uzun (dk)", genislik: 12, tur: "sayi" },
            { ad: "Geciken", genislik: 10, tur: "sayi" },
          ],
          satirlar: (m?.satirlar ?? []).map((s) => [
            s.ad,
            s.istasyonAd,
            s.adet,
            dakika(s.ortalama),
            ...(m?.asamaliVar ? [dakika(s.ortalamaBekleme), dakika(s.ortalamaHazirlik)] : []),
            dakika(s.enUzun),
            s.geciken,
          ]),
        },
      ];
    }

    case "personel":
      return [
        {
          ad: "Personel",
          sutunlar: [
            { ad: "Personel", genislik: 22 },
            { ad: "Açtığı masa", genislik: 12, tur: "sayi" },
            { ad: "Satış yaptığı", genislik: 13, tur: "sayi" },
            { ad: "Ürün", genislik: 9, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
            { ad: "Pay", genislik: 9, tur: "yuzde" },
            { ad: "İkram", genislik: 12, tur: "para" },
            { ad: "İptal", genislik: 9, tur: "sayi" },
          ],
          satirlar: v.personel.satirlar.map((s) => [
            s.ad,
            s.acilan,
            s.adisyon,
            s.adet,
            s.ciro,
            v.personel.ciro > 0 ? s.ciro / v.personel.ciro : 0,
            s.ikram,
            s.iptal,
          ]),
          toplam: true,
        },
        {
          ad: "Personel ürünleri",
          sutunlar: [
            { ad: "Personel", genislik: 22 },
            { ad: "Ürün", genislik: 26 },
            { ad: "Adet", genislik: 9, tur: "sayi" },
            { ad: "Ciro", genislik: 14, tur: "para" },
          ],
          satirlar: v.personel.satirlar.flatMap((s) => s.urunler.map((u) => [s.ad, u.ad, u.adet, u.ciro])),
          toplam: true,
        },
      ];

    case "giderler":
      return [
        {
          ad: "Giderler",
          sutunlar: [
            { ad: "Tarih", genislik: 17 },
            { ad: "Tür", genislik: 18 },
            { ad: "Açıklama", genislik: 30 },
            { ad: "Ödeme", genislik: 14 },
            { ad: "Kaydeden", genislik: 16 },
            { ad: "Tutar", genislik: 13, tur: "para" },
          ],
          satirlar: v.giderler.map((g) => [
            zaman(g.zaman),
            g.tipAd,
            g.aciklama,
            odemeAdi(g.odemeTipi),
            g.kisi,
            g.tutar,
          ]),
          toplam: true,
        },
        {
          ad: "Gider türleri",
          sutunlar: [
            { ad: "Tür", genislik: 22 },
            { ad: "Kayıt", genislik: 9, tur: "sayi" },
            { ad: "Tutar", genislik: 14, tur: "para" },
          ],
          satirlar: v.giderOzeti.turler.map((d) => [d.ad, d.adet, d.tutar]),
          toplam: true,
        },
      ];

    case "odenmezler":
      return [
        {
          ad: "İkramlar",
          sutunlar: [
            { ad: "Kişi", genislik: 22 },
            { ad: "Ürün", genislik: 26 },
            { ad: "Adet", genislik: 9, tur: "sayi" },
            { ad: "Tutar", genislik: 14, tur: "para" },
          ],
          satirlar: v.odenmezler.flatMap((s) => s.urunler.map((u) => [s.ad, u.ad, u.adet, u.tutar])),
          toplam: true,
        },
      ];

    case "acik-hesap": {
      const sutunlar = (tutar: string): Sutun[] => [
        { ad: "Tarih", genislik: 17 },
        { ad: "Müşteri", genislik: 22 },
        { ad: "Açıklama", genislik: 28 },
        { ad: "Ödeme", genislik: 14 },
        { ad: "İşlemi yapan", genislik: 16 },
        { ad: tutar, genislik: 14, tur: "para" },
      ];
      const satir = (h: CariHareketSatiri, tutar: number) => [
        zaman(h.zaman),
        h.musteri,
        h.aciklama,
        h.odemeTipi,
        h.kisi,
        tutar,
      ];
      return [
        {
          ad: "Hesaba yazılanlar",
          sutunlar: sutunlar("Borç"),
          satirlar: v.cariHareketler.filter((h) => h.borc > 0).map((h) => satir(h, h.borc)),
          toplam: true,
        },
        {
          ad: "Tahsilatlar",
          sutunlar: sutunlar("Tahsilat"),
          satirlar: v.cariHareketler.filter((h) => h.alacak > 0).map((h) => satir(h, h.alacak)),
          toplam: true,
        },
      ];
    }

    case "denetim":
      return [
        {
          ad: "Denetim",
          sutunlar: [
            { ad: "Tarih", genislik: 17 },
            { ad: "Kim", genislik: 16 },
            { ad: "İşlem", genislik: 18 },
            { ad: "Yer", genislik: 14 },
            { ad: "Konu", genislik: 26 },
            { ad: "Adet", genislik: 8, tur: "sayi" },
            { ad: "Sebep", genislik: 24 },
            { ad: "Kime", genislik: 16 },
            { ad: "Tutar", genislik: 13, tur: "para" },
          ],
          satirlar: v.denetim.map((d) => [
            zaman(d.zaman),
            d.kisi,
            d.islemAd,
            d.yer,
            d.konu,
            d.adet,
            d.sebep,
            d.odenmez,
            d.tutar,
          ]),
          toplam: true,
        },
      ];

    default:
      return [];
  }
}

/** Sayfanın en üstünde iki satır künye: hangi rapor, hangi dönem. */
function sayfaVerisi(s: Sayfa, baslik: string, donem: string): Hucre[][] {
  const tablo: Hucre[][] = [
    [{ value: baslik, type: String, fontWeight: "bold" }],
    [{ value: donem, type: String }],
    [],
    s.sutunlar.map((c) => ({
      value: c.ad,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#FFE6DE",
      align: c.tur ? "right" : "left",
    })),
  ];

  for (const satir of s.satirlar) {
    tablo.push(
      satir.map((deger, i): Hucre => {
        if (deger == null || deger === "") return null;
        const tur = s.sutunlar[i]?.tur;
        if (typeof deger === "number") {
          return {
            value: tur === "para" || tur === "yuzde" ? deger : Math.round(deger * 1000) / 1000,
            type: Number,
            format: tur === "para" ? PARA : tur === "yuzde" ? "0.0%" : undefined,
          };
        }
        return { value: deger, type: String };
      })
    );
  }

  // Toplam satırı yalnız para ve adet sütunlarında; oran toplanmaz.
  if (s.toplam && s.satirlar.length > 0) {
    tablo.push(
      s.sutunlar.map((c, i): Hucre => {
        if (i === 0) return { value: "Toplam", type: String, fontWeight: "bold" };
        if (c.tur !== "para" && c.tur !== "sayi") return null;
        if (c.ad === "No") return null;
        const toplam = s.satirlar.reduce<number>(
          (t, r) => t + (typeof r[i] === "number" ? (r[i] as number) : 0),
          0
        );
        return {
          value: Math.round(toplam * 100) / 100,
          type: Number,
          fontWeight: "bold",
          format: c.tur === "para" ? PARA : undefined,
        };
      })
    );
  }

  return tablo;
}

const dosyaTarihi = () => {
  const t = new Date();
  return `${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}`;
};

const dosyaAdi = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .replace(/[^a-z0-9]+/g, "-");

export async function analiziIndir(bolum: string, v: AnalizVerisi) {
  const ad = DISA_AKTARILAN_BOLUMLER[bolum];
  if (!ad) return;

  const liste = await sayfalar(bolum, v);
  const { bas, bit } = donemAraligi(v.filtre);
  const donem = `Dönem: ${donemMetni(v.filtre)} (${aralikMetni(bas, bit)})`;
  const { default: excelYaz } = await import("write-excel-file/browser");

  await excelYaz(
    liste.map((s) => ({
      data: sayfaVerisi(s, `RayoPOS · ${ad}${liste.length > 1 ? ` · ${s.ad}` : ""}`, donem),
      // Excel sayfa adında 31 karakter sınırı var.
      sheet: s.ad.slice(0, 31),
      columns: s.sutunlar.map((c) => ({ width: c.genislik })),
      stickyRowsCount: 4,
    }))
  ).toFile(`rayopos-${dosyaAdi(ad)}-${dosyaTarihi()}.xlsx`);
}
