// İstasyon ekranının veri katmanı.
//
// Ekranın birimi adisyon değil TUR: her kaydetme mutfağa ayrı bir kart olarak
// düşüyor. Adisyon bazlı çalışılsaydı iki saat önce girilen ürünle az önce
// söylenen aynı kartta dururdu ve tezgâh "yeni geleni" ayırt edemezdi.
//
// Kalemin hangi tezgâha ait olduğu kendi kaydında duruyor (`istasyon_id`,
// 2026-09-17-kalem-istasyonu.sql). Kural mutfak fişiyle aynı — ürünün kendi
// istasyonu, yoksa kategorisinden devraldığı — ama sipariş kaydedilirken bir
// kez hesaplanıyor: ekran menüyü indirip her açılışta yeniden çıkarmıyor.

import { supabase } from "./supabase";
import type { AdisyonTipi } from "./adisyonlar";

/**
 * Kalemin geçebileceği duraklar. Hangilerinin kullanıldığını istasyonun
 * anahtarları söylüyor; "hazir" her istasyonda var, diğer ikisi isteğe bağlı.
 */
export type Asama = "hazirlik" | "paketleme" | "hazir";

export const ASAMA_ADI: Record<Asama, { gecmis: string; simdi: string; dugme: string }> = {
  hazirlik: { gecmis: "Hazırlığa alındı", simdi: "Hazırlanıyor", dugme: "Hazırlığa al" },
  paketleme: { gecmis: "Paketlemeye alındı", simdi: "Paketleniyor", dugme: "Paketle" },
  hazir: { gecmis: "Hazır", simdi: "Hazır", dugme: "Hazır" },
};

// Yalnız saat sütunu; "kim yaptı" imzasını sunucu koyuyor
// (2026-09-17-mutfak-imzalari.sql), tarayıcının gönderdiği değer eziliyor.
const SUTUN: Record<Asama, { zaman: string }> = {
  hazirlik: { zaman: "hazirlik_at" },
  paketleme: { zaman: "paketleme_at" },
  hazir: { zaman: "hazir_at" },
};

export type MutfakKalemi = {
  id: number;
  /** Kalemin hazırlandığı tezgâh. Bir ekran birden çok tezgâha bakabildiği
      için aşama akışı kalemin kendi istasyonundan okunuyor: Mutfak'ta
      "Hazırlanıyor" açıkken Bar'da kapalı olabiliyor. */
  istasyonId: number;
  ad: string;
  porsiyon?: string;
  secimler: string[];
  adet: number;
  not?: string;
  /** Aşamaya girildiği an; boşsa o durağa henüz uğranmamış. */
  hazirlikAt?: string;
  paketlemeAt?: string;
  /** Dolu ise kalem hazırlanmış; ekranda "hazırlananlar" tarafına geçiyor. */
  hazirAt?: string;
};

/** İstasyonun akışı. Anahtarların ikisi de kapalıysa tek durak kalıyor. */
export function istasyonAsamalari(istasyon: { pisirme: boolean; paketleme: boolean }): Asama[] {
  return [
    ...(istasyon.pisirme ? (["hazirlik"] as const) : []),
    ...(istasyon.paketleme ? (["paketleme"] as const) : []),
    "hazir",
  ];
}

function asamaZamani(kalem: MutfakKalemi, asama: Asama) {
  if (asama === "hazirlik") return kalem.hazirlikAt;
  if (asama === "paketleme") return kalem.paketlemeAt;
  return kalem.hazirAt;
}

/** Kalemin bulunduğu durak — hiçbirine girilmemişse null ("sırada"). */
export function bulunanAsama(kalem: MutfakKalemi, asamalar: Asama[]): Asama | null {
  let sonuncu: Asama | null = null;
  for (const a of asamalar) if (asamaZamani(kalem, a)) sonuncu = a;
  return sonuncu;
}

/** Düğmeye basılınca gidilecek durak; kalem hazırsa gidecek yer yok. */
export function siradakiAsama(kalem: MutfakKalemi, asamalar: Asama[]): Asama | null {
  return asamalar.find((a) => !asamaZamani(kalem, a)) ?? null;
}

/** Bir tur = mutfağa tek seferde düşen sipariş; ekranda tek kart. */
export type MutfakKarti = {
  turId: number;
  siparisNo?: number;
  /** Turun kaydedildiği an; kartın sayacı bunu sayıyor. */
  olusturma: string;
  masa: string;
  tip: AdisyonTipi;
  adisyonNo?: number;
  garson?: string;
  kisiSayisi?: number;
  /** Adisyonun geneline yazılan not — "acele", "çocuk var" gibi. */
  not?: string;
  kalemler: MutfakKalemi[];
};

const ALANLAR = `id, siparis_no, olusturma,
       garson:personel!turlar_garson_id_fkey (ad),
       adisyon:adisyonlar!inner (adisyon_no, masa_ad, tip, ad, kisi_sayisi, not_metni,
                                 masa:masalar (ad)),
       adisyon_kalemleri (id, istasyon_id, ad, porsiyon, secimler, adet, durum, not_metni,
                          hazirlik_at, paketleme_at, hazir_at)`;

/**
 * Ekranın iki listesi, iki adımda.
 *
 * Önce hangi adisyonların açık olduğu soruluyor (birkaç satır), sonra o
 * adisyonların turları kalemleriyle alınıyor. Tek soruda "adisyonu açık olan
 * turları ver" demek veritabanını her seferinde tüm geçmişi birleştirmeye
 * zorluyordu: aynı veri 17 Eylül'de ölçüldüğünde tek soruda 1100 ms, bu iki
 * adımda 430 ms sürdü. Kalemin tezgâhı kaydında durduğu için
 * (2026-09-17-kalem-istasyonu.sql) süzme burada bedava.
 */
export async function panoyuGetir(
  istasyonIdler: number[]
): Promise<{ bekleyen: MutfakKarti[]; hazirlanan: MutfakKarti[] }> {
  if (!istasyonIdler.length) return { bekleyen: [], hazirlanan: [] };

  const { data: adisyonlar } = await supabase
    .from("adisyonlar")
    .select("id")
    .eq("durum", "acik");

  const acikIdler = ((adisyonlar as any[]) ?? []).map((a) => a.id);
  if (!acikIdler.length) return { bekleyen: [], hazirlanan: [] };

  const { data } = await supabase
    .from("turlar")
    .select(ALANLAR)
    .in("adisyon_id", acikIdler);

  const satirlar = (data as any[]) ?? [];
  return {
    bekleyen: kartlariDiz(satirlar, istasyonIdler, false),
    hazirlanan: kartlariDiz(satirlar, istasyonIdler, true),
  };
}

/** Bir tur = ekranda bir kart. Kalemi olmayan tur karta dönüşmüyor. */
function kartlariDiz(
  satirlar: any[],
  istasyonIdler: number[],
  hazirlananlar: boolean
): MutfakKarti[] {
  const kartlar: MutfakKarti[] = [];

  for (const t of satirlar) {
    const kalemler = ((t.adisyon_kalemleri as any[]) ?? [])
      // İkram da hazırlanıyor, iptal edilen hazırlanmıyor.
      .filter((k) => (k.durum ?? "normal") !== "iptal")
      // İstasyonu olmayan ürün hiçbir tezgâha düşmüyor: kola için mutfağın
      // ekranında satır çıkmasın.
      .filter((k) => k.istasyon_id && istasyonIdler.includes(k.istasyon_id))
      .filter((k) => (hazirlananlar ? k.hazir_at : !k.hazir_at))
      .map(
        (k): MutfakKalemi => ({
          id: k.id,
          istasyonId: k.istasyon_id as number,
          ad: k.ad,
          porsiyon: k.porsiyon ?? undefined,
          secimler: Array.isArray(k.secimler) ? k.secimler : [],
          adet: Number(k.adet),
          not: k.not_metni ?? undefined,
          hazirlikAt: k.hazirlik_at ?? undefined,
          paketlemeAt: k.paketleme_at ?? undefined,
          hazirAt: k.hazir_at ?? undefined,
        })
      );

    if (!kalemler.length) continue;

    kartlar.push({
      turId: t.id,
      siparisNo: t.siparis_no ?? undefined,
      olusturma: t.olusturma,
      // Adisyona serbest ad verilmişse ("Ahmet Bey") o geçerli, yoksa masanın
      // adı. masa_ad eski sütun; masa bağı masa_id'ye taşındığından beri yeni
      // adisyonlarda boş kalıyor, yalnız eski kayıtlar için bakılıyor.
      masa: t.adisyon?.ad || t.adisyon?.masa?.ad || t.adisyon?.masa_ad || "—",
      tip: (t.adisyon?.tip ?? "masa") as AdisyonTipi,
      adisyonNo: t.adisyon?.adisyon_no ?? undefined,
      garson: t.garson?.ad ?? undefined,
      kisiSayisi: t.adisyon?.kisi_sayisi ?? undefined,
      not: t.adisyon?.not_metni ?? undefined,
      kalemler,
    });
  }

  // Bekleyenler en eskiden yeniye: en çok bekleyen tezgâhın önünde dursun.
  // Hazırlananlarda tersi geçerli, en son biten üstte.
  kartlar.sort((a, b) =>
    hazirlananlar
      ? b.olusturma.localeCompare(a.olusturma)
      : a.olusturma.localeCompare(b.olusturma)
  );
  return hazirlananlar ? kartlar.slice(0, 40) : kartlar;
}

/** Aşamaya alma. Tek kalem de olabilir, kartın tamamı da. */
export async function asamayaAl(kalemIdler: number[], asama: Asama) {
  if (!kalemIdler.length) return;
  const sutun = SUTUN[asama];
  const { error } = await supabase
    .from("adisyon_kalemleri")
    .update({ [sutun.zaman]: new Date().toISOString() })
    .in("id", kalemIdler);
  if (error) throw new Error("Kalem işaretlenemedi.");
}

/**
 * Geri alma: kalem bir durak geriye düşüyor. Mutfakta düğmeye onay koymuyoruz —
 * eldivenli elle çalışan biri her seferinde iki kez dokunmak istemiyor.
 * Yanlışlıkla basılanın karşılığı onay değil, bu.
 */
export async function asamadanCik(kalemIdler: number[], asama: Asama) {
  if (!kalemIdler.length) return;
  const sutun = SUTUN[asama];
  const { error } = await supabase
    .from("adisyon_kalemleri")
    .update({ [sutun.zaman]: null })
    .in("id", kalemIdler);
  if (error) throw new Error("Kalem geri alınamadı.");
}

/**
 * Canlı bağlantı: kalem eklenince, iptal edilince ya da başka bir tezgâhta
 * hazır işaretlenince ekran kendini tazeliyor. Yoklamayla beklenseydi garson
 * siparişi kaydettikten sonra mutfak bir tur boyu boş ekrana bakardı.
 */
export function mutfagiDinle(haberVer: () => void) {
  // Haber kalem kalem geliyor: on iki kalemli bir sipariş on iki kez tazeleme
  // demek. Kısa bir bekleme üst üste gelenleri tek tazelemeye topluyor —
  // tezgâh yine anında görüyor, ekran boşuna sorgu atmıyor.
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;
  const topla = () => {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(haberVer, 300);
  };

  const kanal = supabase
    .channel("istasyon-ekrani")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "adisyon_kalemleri" },
      topla
    )
    .subscribe();

  return () => {
    clearTimeout(zamanlayici);
    supabase.removeChannel(kanal);
  };
}
