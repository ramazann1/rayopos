import { supabase } from "./supabase";
import { tabanaCevir } from "./stok";

/**
 * Reçete: bir porsiyonun hangi malzemeden ne kadar harcadığı.
 *
 * Miktarlar stok tarafının tamamında olduğu gibi en küçük birimde tam sayı
 * duruyor (gram / mililitre / adet); ekranda malzemenin kendi ölçüsü görünüyor.
 */

export type ReceteTipi = "normal" | "cikarilabilir" | "opsiyonel";

export const RECETE_TIPLERI: { kod: ReceteTipi; ad: string; aciklama: string }[] = [
  { kod: "normal", ad: "Sabit", aciklama: "Her zaman girer." },
  { kod: "cikarilabilir", ad: "Çıkarılabilir", aciklama: "Girer; müşteri istemezse siparişte çıkarılır." },
  { kod: "opsiyonel", ad: "Ekstra", aciklama: "Girmez; müşteri isterse siparişte eklenir." },
];

export type ReceteSatiri = {
  id?: number;
  malzemeId: number;
  /** En küçük birimde tam sayı. */
  miktar: number;
  tip: ReceteTipi;
  /** Yalnız ekstrada; boşsa ücretsiz. */
  ekFiyat?: number;
};

/** Reçeteden çıkan maliyet; `eksik` = içinde fiyatı hiç girilmemiş malzeme var. */
export type ReceteMaliyeti = { maliyet: number; eksik: boolean };

/** Bütün porsiyonların reçete satırları — menü ekranı hepsini birden okuyor. */
export async function receteleriGetir(): Promise<Map<number, ReceteSatiri[]>> {
  const { data } = await supabase
    .from("recete_satirlari")
    .select("id, porsiyon_id, malzeme_id, miktar, tip, ek_fiyat")
    .not("porsiyon_id", "is", null)
    .order("sira")
    .order("id");

  const harita = new Map<number, ReceteSatiri[]>();
  for (const r of ((data as any[]) ?? [])) {
    const liste = harita.get(r.porsiyon_id) ?? [];
    liste.push({
      id: r.id,
      malzemeId: r.malzeme_id,
      miktar: r.miktar,
      tip: r.tip,
      ekFiyat: r.ek_fiyat != null ? Number(r.ek_fiyat) : undefined,
    });
    harita.set(r.porsiyon_id, liste);
  }
  return harita;
}

/**
 * Reçeteden çıkan porsiyon maliyetleri.
 *
 * Maliyet kopyalanıp saklanmıyor, görünüm her okunuşta hesaplıyor: süt
 * zamlandığında kopyalanmış rakamı kimse tazelemez, sessizce eskirdi.
 */
export async function receteMaliyetleriGetir(): Promise<Map<number, ReceteMaliyeti>> {
  const { data } = await supabase
    .from("porsiyon_recete_maliyetleri")
    .select("id, maliyet, eksik");

  const harita = new Map<number, ReceteMaliyeti>();
  for (const p of ((data as any[]) ?? [])) {
    harita.set(p.id, { maliyet: Number(p.maliyet ?? 0), eksik: !!p.eksik });
  }
  return harita;
}

/**
 * Porsiyonun reçetesini yazar: önce eskisi siliniyor, sonra yenisi.
 *
 * Satır satır karşılaştırmak yerine baştan yazmak, reçetenin birkaç satırlık
 * bir liste olmasından: sıra değiştiğinde, satır silindiğinde ve miktar
 * düzeltildiğinde ayrı ayrı yollar açmak fazladan karmaşa olurdu.
 */
export async function receteYaz(porsiyonId: number, satirlar: ReceteSatiri[]) {
  const { error: silme } = await supabase
    .from("recete_satirlari")
    .delete()
    .eq("porsiyon_id", porsiyonId);
  if (silme) throw new Error("Reçete kaydedilemedi.");

  const temiz = satirlar.filter((s) => s.malzemeId && s.miktar > 0);
  if (temiz.length === 0) return;

  const { error } = await supabase.from("recete_satirlari").insert(
    temiz.map((s, i) => ({
      porsiyon_id: porsiyonId,
      malzeme_id: s.malzemeId,
      miktar: s.miktar,
      tip: s.tip,
      ek_fiyat: s.tip === "opsiyonel" && s.ekFiyat ? s.ekFiyat : null,
      sira: i,
    }))
  );
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Aynı malzeme reçetede iki kez yazılamaz."
        : "Reçete kaydedilemedi."
    );
  }
}

/** Mutfakta hazırlanan malzemenin tarifi: hangi hammaddeden ne kadar. */
export type TarifSatiri = { malzemeId: number; miktar: number };

export async function tarifGetir(malzemeId: number): Promise<TarifSatiri[]> {
  const { data } = await supabase
    .from("recete_satirlari")
    .select("malzeme_id, miktar")
    .eq("sahip_malzeme_id", malzemeId)
    .order("sira")
    .order("id");
  return ((data as any[]) ?? []).map((r) => ({ malzemeId: r.malzeme_id, miktar: r.miktar }));
}

/** Porsiyon reçetesi gibi baştan yazılıyor. */
export async function tarifYaz(malzemeId: number, satirlar: TarifSatiri[]) {
  const { error: silme } = await supabase
    .from("recete_satirlari")
    .delete()
    .eq("sahip_malzeme_id", malzemeId);
  if (silme) throw new Error("Tarif kaydedilemedi.");

  const temiz = satirlar.filter((s) => s.malzemeId && s.miktar > 0);
  if (temiz.length === 0) return;

  const { error } = await supabase.from("recete_satirlari").insert(
    temiz.map((s, i) => ({
      sahip_malzeme_id: malzemeId,
      malzeme_id: s.malzemeId,
      miktar: s.miktar,
      tip: "normal",
      sira: i,
    }))
  );
  if (error) {
    throw new Error(
      error.code === "P0001"
        ? error.message
        : error.code === "23505"
          ? "Aynı malzeme tarifte iki kez yazılamaz."
          : "Tarif kaydedilemedi."
    );
  }
}

/**
 * Çıkarılan malzemenin sepette ve mutfakta okunan hâli: "Soğansız". Tek
 * kelimede ek ünlü uyumuyla geliyor; "kaşar peyniri" gibi tamlamaya ek
 * yapışmıyor, "Kaşar peyniri olmasın" yazılıyor.
 */
export function cikanMetni(ad: string) {
  const temiz = ad.trim();
  if (/\s/.test(temiz)) return `${temiz} olmasın`;
  const unluler = temiz.toLocaleLowerCase("tr").match(/[aıoueiöü]/g);
  const son = unluler?.[unluler.length - 1] ?? "ı";
  const ek = { a: "sız", ı: "sız", e: "siz", i: "siz", o: "suz", u: "suz", ö: "süz", ü: "süz" }[son];
  const buyuk = temiz === temiz.toLocaleUpperCase("tr");
  return temiz + (buyuk ? ek!.toLocaleUpperCase("tr") : ek);
}

export const eklenenMetni = (ad: string) => `+ ${ad.trim()}`;

/** Ekranda yazılan miktarı ("200", malzeme ml ise) depodaki tam sayıya çevirir. */
export const receteMiktari = (deger: number, birim: string) => tabanaCevir(deger, birim);
