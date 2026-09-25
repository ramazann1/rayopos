import { supabase } from "./supabase";

/**
 * Stok tarafının veri katmanı.
 *
 * Miktarlar veritabanında hep EN KÜÇÜK BİRİMDE TAM SAYI duruyor: gram,
 * mililitre, adet. Parada kuruşla yaptığımızın aynısı. Ekranda ise malzemenin
 * kendi ölçüsü görünüyor — un kiloyla, maya gramla sayılıyor.
 */

/** Ekranda görünen ölçü ve onun kaç en küçük birime denk geldiği. */
export const OLCULER = [
  { kod: "kg", ad: "Kilogram", kisa: "kg", taban: "gram", carpan: 1000 },
  { kod: "gram", ad: "Gram", kisa: "g", taban: "gram", carpan: 1 },
  { kod: "litre", ad: "Litre", kisa: "lt", taban: "mililitre", carpan: 1000 },
  { kod: "mililitre", ad: "Mililitre", kisa: "ml", taban: "mililitre", carpan: 1 },
  { kod: "adet", ad: "Adet", kisa: "ad", taban: "adet", carpan: 1 },
] as const;

export type OlcuKodu = (typeof OLCULER)[number]["kod"];

const olcu = (kod: string) => OLCULER.find((o) => o.kod === kod) ?? OLCULER[0];

export const olcuKisa = (kod: string) => olcu(kod).kisa;

/**
 * Ekrandaki sayıyı depodaki tam sayıya çevirir: 1,5 kg → 1500.
 * Yuvarlama burada bir kez yapılıyor; çarpma sonucu 1499,9999 çıkarsa
 * depoya eksik yazılmasın.
 */
export const tabanaCevir = (deger: number, birim: string) =>
  Math.round(deger * olcu(birim).carpan);

/** Depodaki tam sayıyı ekrandaki ölçüye çevirir: 1500 → 1,5 (kg). */
export const olcuyeCevir = (miktar: number, birim: string) =>
  miktar / olcu(birim).carpan;

/**
 * Miktarı okunur hâlde yazar: "1,5 kg", "250 g", "-3 ad".
 * Gereksiz ondalık basılmıyor — "12,000 kg" rakamı ağırlaştırıyor.
 */
export function miktarGoster(miktar: number, birim: string) {
  const o = olcu(birim);
  const deger = miktar / o.carpan;
  const metin = deger.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
  return `${metin} ${o.kisa}`;
}

/** Kullanıcının yazdığı miktar metni: virgül de nokta da kabul. */
export const miktarSayi = (s: string) => {
  const temiz = s.replace(",", ".").trim();
  return temiz === "" ? undefined : Number(temiz);
};

export const miktarYaz = (s: string) => s.replace(/[^0-9.,-]/g, "");

export type MalzemeGrubu = {
  id: number;
  ad: string;
  renk: string | null;
  sira: number;
  aktif: boolean;
};

export type Malzeme = {
  id: number;
  grupId: number | null;
  grupAd: string;
  ad: string;
  kod: string;
  birim: OlcuKodu;
  kritikSeviye: number;
  miktar: number;
  sonAlisFiyati: number | null;
  ortalamaMaliyet: number | null;
  aktif: boolean;
};

/** Malzeme kartında kişinin düzenleyebildiği alanlar — miktar burada yok. */
export type MalzemeAlanlari = {
  grupId: number | null;
  ad: string;
  kod: string;
  birim: OlcuKodu;
  kritikSeviye: number;
  aktif: boolean;
};

/** Kritik seviyenin altına düşmüş mü — 0 "takip etme" demek. */
export const kritikMi = (m: Malzeme) =>
  m.kritikSeviye > 0 && m.miktar <= m.kritikSeviye;

export async function gruplariGetir(): Promise<MalzemeGrubu[]> {
  const { data } = await supabase
    .from("malzeme_gruplari")
    .select("id, ad, renk, sira, aktif")
    .order("sira")
    .order("id");
  return ((data as any[]) ?? []).map((g) => ({
    id: g.id,
    ad: g.ad,
    renk: g.renk,
    sira: g.sira,
    aktif: g.aktif,
  }));
}

export async function grupEkle(ad: string, renk: string | null, sira: number) {
  const { error } = await supabase
    .from("malzeme_gruplari")
    .insert({ ad: ad.trim(), renk, sira });
  if (error) {
    throw new Error(
      error.code === "23505" ? "Bu grup zaten var." : "Grup eklenemedi."
    );
  }
}

export async function grupGuncelle(id: number, alanlar: Partial<MalzemeGrubu>) {
  const { error } = await supabase
    .from("malzeme_gruplari")
    .update({
      ad: alanlar.ad?.trim(),
      renk: alanlar.renk,
      sira: alanlar.sira,
      aktif: alanlar.aktif,
    })
    .eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "Bu grup zaten var." : "Grup kaydedilemedi."
    );
  }
}

export async function grupSil(id: number) {
  // Gruba bağlı malzemeler silinmiyor, grupsuz kalıyor (şemada set null).
  const { error } = await supabase.from("malzeme_gruplari").delete().eq("id", id);
  if (error) throw new Error("Grup silinemedi.");
}

export async function malzemeleriGetir(): Promise<Malzeme[]> {
  const { data } = await supabase
    .from("malzemeler")
    .select(
      "id, grup_id, ad, kod, birim, kritik_seviye, miktar, son_alis_fiyati, ortalama_maliyet, aktif, malzeme_gruplari(ad)"
    )
    .order("ad");
  return ((data as any[]) ?? []).map((m) => ({
    id: m.id,
    grupId: m.grup_id,
    grupAd: m.malzeme_gruplari?.ad ?? "",
    ad: m.ad,
    kod: m.kod ?? "",
    birim: m.birim,
    kritikSeviye: m.kritik_seviye,
    miktar: m.miktar,
    sonAlisFiyati: m.son_alis_fiyati == null ? null : Number(m.son_alis_fiyati),
    ortalamaMaliyet: m.ortalama_maliyet == null ? null : Number(m.ortalama_maliyet),
    aktif: m.aktif,
  }));
}

const satira = (a: MalzemeAlanlari) => ({
  grup_id: a.grupId,
  ad: a.ad.trim(),
  kod: a.kod.trim() || null,
  birim: a.birim,
  kritik_seviye: a.kritikSeviye,
  aktif: a.aktif,
});

export async function malzemeEkle(alanlar: MalzemeAlanlari) {
  const { error } = await supabase.from("malzemeler").insert(satira(alanlar));
  if (error) {
    throw new Error(
      error.code === "23505" ? "Bu adda bir malzeme zaten var." : "Malzeme eklenemedi."
    );
  }
}

/**
 * Hazır ürünün stok karşılığı: kola, su gibi olduğu gibi satılan ürün için
 * aynı adla "adet" ölçülü malzeme. Aynı adda malzeme zaten varsa yenisi
 * açılmıyor, o kullanılıyor — işletme kolayı önce Malzemeler'e girmiş olabilir.
 */
export async function hazirUrunMalzemesi(ad: string): Promise<Malzeme> {
  const temiz = ad.trim();
  const mevcut = (await malzemeleriGetir()).find(
    (m) => m.ad.toLocaleLowerCase("tr") === temiz.toLocaleLowerCase("tr")
  );
  if (mevcut) return mevcut;

  const { error } = await supabase
    .from("malzemeler")
    .insert(satira({ grupId: null, ad: temiz, kod: "", birim: "adet", kritikSeviye: 0, aktif: true }));
  if (error) throw new Error("Stok kaydı açılamadı. Stok yönetme yetkiniz olmayabilir.");

  const yeni = (await malzemeleriGetir()).find((m) => m.ad === temiz);
  if (!yeni) throw new Error("Stok kaydı açılamadı.");
  return yeni;
}

export async function malzemeGuncelle(id: number, alanlar: MalzemeAlanlari) {
  const { error } = await supabase
    .from("malzemeler")
    .update(satira(alanlar))
    .eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "Bu adda bir malzeme zaten var." : "Malzeme kaydedilemedi."
    );
  }
}

export async function malzemeSil(id: number) {
  const { error } = await supabase.from("malzemeler").delete().eq("id", id);
  // Hareket görmüş malzeme silinemiyor (şemada restrict): defteri boşta
  // bırakmamak için. Kişiye kapatmasını söylüyoruz, çünkü çözüm bu.
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "Bu malzemenin stok hareketi var, silinemez. Kullanımdan kaldırabilirsiniz."
        : "Malzeme silinemedi."
    );
  }
}

/**
 * Kritik seviyeyi birden çok malzemeye birden yazar.
 *
 * Adisyo'da bu alan yalnız malzemenin kendi kartından, tek tek giriliyor;
 * sonucu eGZOZ'da otuz malzemenin yalnız birinde dolu olması. Tek tek girilen
 * alan girilmiyor — toplu yazılabilsin ki uyarı sistemi gerçekten çalışsın.
 */
export async function kritikSeviyeleriYaz(degerler: { id: number; kritikSeviye: number }[]) {
  for (const d of degerler) {
    const { error } = await supabase
      .from("malzemeler")
      .update({ kritik_seviye: d.kritikSeviye })
      .eq("id", d.id);
    if (error) throw new Error("Kritik seviyeler kaydedilemedi.");
  }
}
