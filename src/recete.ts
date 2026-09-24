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
  { kod: "normal", ad: "Normal", aciklama: "Her zaman girer." },
  { kod: "cikarilabilir", ad: "Çıkarılabilir", aciklama: "Girer, müşteri istemezse çıkarılır." },
  { kod: "opsiyonel", ad: "Opsiyonel", aciklama: "Girmez, isteyen ekletir." },
];

export type ReceteSatiri = {
  id?: number;
  malzemeId: number;
  /** En küçük birimde tam sayı. */
  miktar: number;
  tip: ReceteTipi;
};

/** Reçeteden çıkan maliyet; `eksik` = içinde fiyatı hiç girilmemiş malzeme var. */
export type ReceteMaliyeti = { maliyet: number; eksik: boolean };

/** Bütün porsiyonların reçete satırları — menü ekranı hepsini birden okuyor. */
export async function receteleriGetir(): Promise<Map<number, ReceteSatiri[]>> {
  const { data } = await supabase
    .from("recete_satirlari")
    .select("id, porsiyon_id, malzeme_id, miktar, tip")
    .not("porsiyon_id", "is", null)
    .order("sira")
    .order("id");

  const harita = new Map<number, ReceteSatiri[]>();
  for (const r of ((data as any[]) ?? [])) {
    const liste = harita.get(r.porsiyon_id) ?? [];
    liste.push({ id: r.id, malzemeId: r.malzeme_id, miktar: r.miktar, tip: r.tip });
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

/** Ekranda yazılan miktarı ("200", malzeme ml ise) depodaki tam sayıya çevirir. */
export const receteMiktari = (deger: number, birim: string) => tabanaCevir(deger, birim);
