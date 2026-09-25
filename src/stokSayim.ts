import { supabase } from "./supabase";
import { acikOturum } from "./oturum";

/**
 * Sayım: başlayıp biten bir süreç.
 *
 * Girilen rakamlar deftere değil taslağa yazılıyor; stokta hiçbir şey
 * rapor onaylanana kadar değişmiyor. Sayarken sistemdeki miktar ekrana
 * getirilmiyor — körleme sayım kararı burada da geçerli, bu yüzden sayım
 * ekranı için okunan kalemlerde `sistem` alanı taşınmıyor.
 */

export type SayimKapsami = "tumu" | "grup" | "kritik";

export type Sayim = {
  id: number;
  kapsam: SayimKapsami;
  grupIdler: number[];
  durum: "acik" | "onayli" | "iptal";
  kisi: string;
  baslangic: string;
  bitis: string | null;
  /** Onaylanınca yazılan stok belgesi; fark yoksa boş. */
  belgeId: number | null;
};

/** Sayarken görünen satır — sistemdeki miktar bilerek yok. */
export type SayimSatiri = {
  id: number;
  malzemeId: number;
  malzemeAd: string;
  grupAd: string;
  grupRenk: string | null;
  birim: string;
  sayilan: number | null;
};

/** Raporda görünen satır; sistem miktarı ve fark burada açılıyor. */
export type RaporSatiri = {
  malzemeId: number;
  malzemeAd: string;
  birim: string;
  sistem: number;
  sayilan: number | null;
  fark: number;
  /** Farkın parası — ağırlıklı ortalama maliyetten, kuruş cinsinden. */
  tutar: number;
  /** Sistem miktarına göre sapma oranı; sistem 0 ise yok. */
  sapma: number | null;
};

/** Sapma bu oranı geçen satır raporda işaretleniyor (Ramazan kararı: %8). */
export const SAPMA_SINIRI = 0.08;

const sayima = (s: any): Sayim => ({
  id: s.id,
  kapsam: s.kapsam,
  grupIdler: s.grup_idler ?? [],
  durum: s.durum,
  kisi: s.kisi_ad ?? "",
  baslangic: s.baslangic,
  bitis: s.bitis,
  belgeId: s.belge_id ?? null,
});

/** Yarım kalan sayım. Aynı anda yalnız bir tane olabiliyor. */
export async function acikSayim(): Promise<Sayim | null> {
  const { data } = await supabase
    .from("stok_sayimlari")
    .select("id, kapsam, grup_idler, durum, kisi_ad, baslangic, bitis, belge_id")
    .eq("durum", "acik")
    .order("baslangic", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? sayima(data) : null;
}

export async function sayimlariGetir(aralik?: { bas: Date; bit: Date }): Promise<Sayim[]> {
  let sorgu = supabase
    .from("stok_sayimlari")
    .select("id, kapsam, grup_idler, durum, kisi_ad, baslangic, bitis, belge_id");
  if (aralik) {
    sorgu = sorgu.gte("baslangic", aralik.bas.toISOString()).lt("baslangic", aralik.bit.toISOString());
  }
  const { data } = await sorgu.order("baslangic", { ascending: false });
  return ((data as any[]) ?? []).map(sayima);
}

export type GecmisSayim = Sayim & {
  /** Stoğa fark yazılan malzeme sayısı. */
  farkli: number;
  /** Net fark, kuruş. Farkların hiçbirinin maliyeti bilinmiyorsa boş. */
  kurus: number | null;
};

/**
 * Kapanmış sayımlar. Tutar defterdeki sayım hareketlerinden okunuyor:
 * hareket onay anının maliyetini taşıyor, malzemenin bugünkü maliyeti
 * sonradan değişse de eski sayımın tutarı kaymıyor.
 */
export async function gecmisSayimlar(aralik?: { bas: Date; bit: Date }): Promise<GecmisSayim[]> {
  const sayimlar = (await sayimlariGetir(aralik)).filter((s) => s.durum !== "acik");
  const belgeler = sayimlar.map((s) => s.belgeId).filter((b): b is number => b != null);

  const toplamlar = new Map<number, { farkli: number; kurus: number | null }>();
  if (belgeler.length > 0) {
    const { data } = await supabase
      .from("stok_hareketleri")
      .select("belge_id, miktar, birim_maliyet")
      .in("belge_id", belgeler);
    for (const h of (data as any[]) ?? []) {
      const t = toplamlar.get(h.belge_id) ?? { farkli: 0, kurus: null };
      t.farkli += 1;
      if (h.birim_maliyet != null) t.kurus = (t.kurus ?? 0) + hareketKurusu(h);
      toplamlar.set(h.belge_id, t);
    }
  }

  return sayimlar.map((s) => ({
    ...s,
    ...((s.belgeId != null && toplamlar.get(s.belgeId)) || { farkli: 0, kurus: null }),
  }));
}

const hareketKurusu = (h: { miktar: number; birim_maliyet: unknown }) =>
  h.birim_maliyet == null ? 0 : Math.round(h.miktar * Number(h.birim_maliyet) * 100);

/**
 * Kapanmış sayımın raporu. Miktarlar kalemden (o gün ekranda ne görüldüyse),
 * tutar stoğa yazılan hareketten.
 */
export async function gecmisRapor(sayim: Sayim): Promise<RaporSatiri[]> {
  const [{ data: kalemler }, { data: hareketler }] = await Promise.all([
    supabase
      .from("stok_sayim_kalemleri")
      .select("malzeme_id, malzeme_ad, sayilan, sistem, malzemeler(birim)")
      .eq("sayim_id", sayim.id)
      .order("malzeme_ad"),
    sayim.belgeId == null
      ? Promise.resolve({ data: [] })
      : supabase
          .from("stok_hareketleri")
          .select("malzeme_id, miktar, birim_maliyet")
          .eq("belge_id", sayim.belgeId),
  ]);

  const tutarlar = new Map<number, number>();
  for (const h of (hareketler as any[]) ?? []) tutarlar.set(h.malzeme_id, hareketKurusu(h));

  return ((kalemler as any[]) ?? []).map((k) => {
    const sistem = k.sistem ?? 0;
    const fark = k.sayilan == null ? 0 : k.sayilan - sistem;
    return {
      malzemeId: k.malzeme_id,
      malzemeAd: k.malzeme_ad,
      birim: k.malzemeler?.birim ?? "kg",
      sistem,
      sayilan: k.sayilan,
      fark,
      tutar: tutarlar.get(k.malzeme_id) ?? 0,
      sapma: k.sayilan == null || sistem === 0 ? null : Math.abs(fark / sistem),
    };
  });
}

/**
 * Sayımı açar ve kapsamdaki malzemeleri kalem olarak yazar.
 *
 * Kalem listesini tarayıcı değil veritabanı kuruyor: kapsamı burada
 * hesaplayıp yüz satır göndermek hem yavaş, hem de araya giren bir satış
 * düşümünde listeyi tutarsız bırakıyor.
 */
export async function sayimAc(
  kapsam: SayimKapsami,
  gruplar: number[]
): Promise<number> {
  const kisi = acikOturum();
  const { data, error } = await supabase.rpc("stok_sayimi_ac", {
    p_kapsam: kapsam,
    p_gruplar: kapsam === "grup" ? gruplar : [],
    p_kisi_id: kisi?.id ?? null,
    p_kisi_ad: kisi?.ad ?? null,
  });

  if (error) {
    const m = error.message ?? "";
    if (m.includes("Zaten acik")) throw new Error("Zaten açık bir sayım var.");
    if (m.includes("Kapsamda malzeme yok"))
      throw new Error("Bu kapsamda sayılacak malzeme yok.");
    throw new Error("Sayım başlatılamadı.");
  }
  return data as number;
}

export async function sayimSatirlari(sayimId: number): Promise<SayimSatiri[]> {
  const { data } = await supabase
    .from("stok_sayim_kalemleri")
    .select(
      "id, malzeme_id, malzeme_ad, sayilan, malzemeler(birim, malzeme_gruplari(ad, renk))"
    )
    .eq("sayim_id", sayimId)
    .order("malzeme_ad");

  return ((data as any[]) ?? []).map((k) => ({
    id: k.id,
    malzemeId: k.malzeme_id,
    malzemeAd: k.malzeme_ad,
    grupAd: k.malzemeler?.malzeme_gruplari?.ad ?? "",
    grupRenk: k.malzemeler?.malzeme_gruplari?.renk ?? null,
    birim: k.malzemeler?.birim ?? "kg",
    sayilan: k.sayilan,
  }));
}

/**
 * Tek satırın sayılan miktarını yazar.
 *
 * Her kutu kendi başına kaydediliyor: sayım yarım saat sürüyor ve telefonun
 * eli her an cebe girebiliyor, toplu kaydet düğmesine bırakılsa yazılan
 * rakamlar kaybolur. Boş bırakmak "sayılmadı" demek, sıfır yazmak "bitmiş".
 */
export async function satirYaz(kalemId: number, sayilan: number | null) {
  const { error } = await supabase
    .from("stok_sayim_kalemleri")
    .update({ sayilan, zaman: sayilan == null ? null : new Date().toISOString() })
    .eq("id", kalemId);
  if (error) throw new Error("Sayılan miktar kaydedilemedi.");
}

/**
 * Raporu hazırlar. Sistem miktarı kalemde DONMUŞ olanı — kişi neyi saydıysa
 * farkı da onun karşılığı görünsün.
 */
export async function raporGetir(sayimId: number): Promise<RaporSatiri[]> {
  const { data } = await supabase
    .from("stok_sayim_kalemleri")
    .select("malzeme_id, malzeme_ad, sayilan, sistem, malzemeler(birim, ortalama_maliyet)")
    .eq("sayim_id", sayimId)
    .order("malzeme_ad");

  return ((data as any[]) ?? []).map((k) => {
    const sistem = k.sistem ?? 0;
    const fark = k.sayilan == null ? 0 : k.sayilan - sistem;
    const maliyet =
      k.malzemeler?.ortalama_maliyet == null
        ? 0
        : Number(k.malzemeler.ortalama_maliyet);
    return {
      malzemeId: k.malzeme_id,
      malzemeAd: k.malzeme_ad,
      birim: k.malzemeler?.birim ?? "kg",
      sistem,
      sayilan: k.sayilan,
      fark,
      // Maliyet en küçük birim başına lira; kuruşa çevirip yuvarlıyoruz ki
      // ekranda ve defterde aynı rakam görünsün.
      tutar: Math.round(fark * maliyet * 100),
      sapma: k.sayilan == null || sistem === 0 ? null : Math.abs(fark / sistem),
    };
  });
}

/** Onay: yalnız farkı olan malzemeye hareket yazılıyor, sıfır fark deftere girmiyor. */
export async function sayimOnayla(sayimId: number) {
  const { error } = await supabase.rpc("stok_sayimi_onayla", {
    p_sayim_id: sayimId,
  });
  if (error) throw new Error("Sayım onaylanamadı.");
}

/** Vazgeçme: kalemler duruyor ama stoğa hiçbir şey yazılmıyor. */
export async function sayimIptal(sayimId: number) {
  const { error } = await supabase
    .from("stok_sayimlari")
    .update({ durum: "iptal", bitis: new Date().toISOString() })
    .eq("id", sayimId);
  if (error) throw new Error("Sayım iptal edilemedi.");
}
