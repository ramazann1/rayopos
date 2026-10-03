import { supabase } from "./supabase";

/**
 * Sadakat cüzdanı: müşterinin kapanan hesaplarından kazandığı para puan.
 *
 * Kazanma ve harcamayı veritabanı yazıyor (bkz. sql/2026-10-02-sadakat.sql);
 * burada yalnız okuma ve elle düzeltme var. Bakiye cari hesaptaki gibi
 * hareketlerin toplamı, hiçbir yerde ayrı sütun olarak durmuyor.
 */

/** Cüzdanla alınan tahsilatın tipi. Ödeme tipleri tablosunda yok, kasaya girmiyor. */
export const CUZDAN = "Cüzdan";

export type SadakatHareketTipi = "kazanc" | "harcama" | "duzeltme";

export const SADAKAT_HAREKET_ADI: Record<SadakatHareketTipi, string> = {
  kazanc: "Kazanıldı",
  harcama: "Harcandı",
  duzeltme: "Düzeltme",
};

export type SadakatHareketi = {
  id: number;
  tip: SadakatHareketTipi;
  tutar: number;
  adisyonId: number | null;
  adisyonNo: number | null;
  aciklama: string;
  kisi: string;
  zaman: string;
};

export type CuzdanOzeti = {
  bakiye: number;
  kazanilan: number;
  harcanan: number;
  ziyaret: number;
};

const kurus = (v: number) => Math.round(v * 100) / 100;

export async function cuzdanBakiyesi(musteriId: number): Promise<number> {
  const { data, error } = await supabase
    .from("sadakat_hareketleri")
    .select("tutar")
    .eq("musteri_id", musteriId);
  if (error) throw new Error("Cüzdan okunamadı.");
  return kurus(((data as any[]) ?? []).reduce((t, h) => t + Number(h.tutar), 0));
}


/** Yeniden eskiye; müşteri kartındaki cüzdan sekmesi. */
export async function sadakatHareketleri(musteriId: number): Promise<SadakatHareketi[]> {
  const { data, error } = await supabase
    .from("sadakat_hareketleri")
    .select("id, tip, tutar, adisyon_id, aciklama, olusturma, adisyon:adisyon_id (adisyon_no), personel:personel_id (ad)")
    .eq("musteri_id", musteriId)
    .order("olusturma", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error("Cüzdan hareketleri okunamadı.");

  return ((data as any[]) ?? []).map((h) => ({
    id: h.id,
    tip: h.tip,
    tutar: Number(h.tutar),
    adisyonId: h.adisyon_id,
    adisyonNo: h.adisyon?.adisyon_no ?? null,
    aciklama: h.aciklama ?? "",
    kisi: h.personel?.ad ?? "",
    zaman: h.olusturma,
  }));
}

export function cuzdanOzeti(hareketler: SadakatHareketi[]): CuzdanOzeti {
  let bakiye = 0;
  let kazanilan = 0;
  let harcanan = 0;
  const adisyonlar = new Set<number>();
  for (const h of hareketler) {
    bakiye += h.tutar;
    if (h.tip === "kazanc") {
      kazanilan += h.tutar;
      if (h.adisyonId) adisyonlar.add(h.adisyonId);
    }
    if (h.tip === "harcama") harcanan -= h.tutar;
  }
  return {
    bakiye: kurus(bakiye),
    kazanilan: kurus(kazanilan),
    harcanan: kurus(harcanan),
    ziyaret: adisyonlar.size,
  };
}

/** Bakiyeyi elle doğru değere çekme; fark hareket olarak yazılıyor, sebep zorunlu. */
export async function cuzdanDuzelt(musteriId: number, eskiBakiye: number, yeniBakiye: number, sebep: string) {
  const fark = kurus(yeniBakiye - eskiBakiye);
  if (fark === 0) return;
  const { error } = await supabase.from("sadakat_hareketleri").insert({
    musteri_id: musteriId,
    tip: "duzeltme",
    tutar: fark,
    aciklama: sebep.trim(),
  });
  if (error) {
    throw new Error(
      error.message.includes("Cüzdan") ? error.message : "Cüzdan düzeltilemedi. Yetkinizi kontrol edin."
    );
  }
}

/**
 * Bu hesaptan cüzdanla en fazla ne kadar ödenebilir: bakiye, hesabın kalanı
 * ve işletmenin "hesabın en fazla %X'i" sınırı. Alt limite ulaşmamış cüzdan
 * hiç harcanamıyor.
 */
export function harcanabilir(
  bakiye: number,
  kalan: number,
  hesapToplami: number,
  oncekiCuzdan: number,
  kural: { altLimit: number; ustOran: number }
) {
  if (bakiye <= 0 || kalan <= 0) return 0;
  if (kural.altLimit > 0 && bakiye < kural.altLimit) return 0;
  const tavan = kurus((hesapToplami * kural.ustOran) / 100 - oncekiCuzdan);
  return Math.max(0, kurus(Math.min(bakiye, kalan, tavan)));
}

/**
 * Hesaba müşteri bağlanınca adı ve telefonu da hesabın üstüne geçiyor: masa
 * başlığında, fişte ve listede kimin hesabı olduğu okunuyor. Bağ kaldırılınca
 * elle yazılmış ad duruyor, yalnız kayıtla ilişki kopuyor.
 */
export function musteriyiBagla<
  T extends { musteriAd?: string; musteriTelefon?: string; musteriId?: number | null },
>(bilgi: T, musteri: { id: number; ad: string; soyad: string; telefon: string } | null): T {
  if (!musteri) return { ...bilgi, musteriId: null };
  return {
    ...bilgi,
    musteriId: musteri.id,
    musteriAd: `${musteri.ad} ${musteri.soyad}`.trim(),
    musteriTelefon: musteri.telefon || bilgi.musteriTelefon,
  };
}

export type SadakatMusterisi = {
  id: number;
  ad: string;
  soyad: string;
  telefon: string;
  bakiye: number;
};

/** Ödeme penceresindeki kart için müşterinin adı ve cüzdanı birlikte. */
export async function sadakatMusterisi(musteriId: number): Promise<SadakatMusterisi | null> {
  const [{ data }, bakiye] = await Promise.all([
    supabase.from("musteriler").select("id, ad, soyad, telefon").eq("id", musteriId).maybeSingle(),
    cuzdanBakiyesi(musteriId),
  ]);
  if (!data) return null;
  const m = data as any;
  return { id: m.id, ad: m.ad, soyad: m.soyad ?? "", telefon: m.telefon ?? "", bakiye };
}
