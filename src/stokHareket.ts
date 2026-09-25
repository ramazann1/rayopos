import { supabase } from "./supabase";
import { acikOturum } from "./oturum";

/**
 * Stok hareketleri: giriş, fire, çıkış.
 *
 * Sayım burada değil — o bir hareket değil, başlayıp biten ve sonunda rapor
 * veren bir süreç; kendi ekranında duruyor.
 *
 * Miktarlar stok.ts'teki gibi en küçük birimde tam sayı geçiyor. İşaret
 * burada konuyor: giriş artı, fire ve çıkış eksi. Defterdeki `onceki` ve
 * `sonraki` alanlarını biz yazmıyoruz, veritabanı tetikleyicisi dolduruyor.
 */

export const HAREKET_TIPLERI = [
  {
    kod: "giris",
    ad: "Giriş",
    fiil: "Giren",
    /** Alış fiyatı yalnız girişte sorulur; çıkan malın fiyatı zaten kayıtlı. */
    fiyatli: true,
    yon: 1,
  },
  { kod: "fire", ad: "Fire", fiil: "Fire", fiyatli: false, yon: -1 },
  { kod: "cikis", ad: "Çıkış", fiil: "Çıkan", fiyatli: false, yon: -1 },
] as const;

export type HareketTipi = (typeof HAREKET_TIPLERI)[number]["kod"];

export const tipBilgisi = (kod: string) =>
  HAREKET_TIPLERI.find((t) => t.kod === kod) ?? HAREKET_TIPLERI[0];

/**
 * Deftere elle girilmeyen tipler: satışı adisyon kapanışı, sayımı sayım
 * onayı yazıyor. Elle düzeltilmiyorlar — satış düşümü adisyonun her
 * kapanışında yeniden hesaplanıyor, elle yapılan değişiklik orada kaybolurdu.
 */
const OTOMATIK_TIPLER: Record<string, string> = { satis: "Satış", sayim: "Sayım" };

export const tipAdi = (kod: string) => OTOMATIK_TIPLER[kod] ?? tipBilgisi(kod).ad;

export const elleDuzenlenir = (kod: string) => !(kod in OTOMATIK_TIPLER);

/**
 * Sebepler. Fire kayıptır, çıkış bilinçli tüketimdir — listeler bu yüzden
 * ayrı. "Personel" fire değil çıkıştır: personele giden mal kayıp sayılırsa
 * fire raporu şişer ve yanlış yerde önlem alınır.
 */
export const SEBEPLER: Record<string, { kod: string; ad: string }[]> = {
  fire: [
    { kod: "dokuldu", ad: "Döküldü" },
    { kod: "bozuldu", ad: "Bozuldu / tarihi geçti" },
    { kod: "kirildi", ad: "Kırıldı" },
  ],
  cikis: [
    { kod: "personel", ad: "Personel yemeği" },
    { kod: "iade", ad: "Satıcıya iade" },
    { kod: "numune", ad: "Numune / tadım" },
    { kod: "etkinlik", ad: "Etkinlik" },
  ],
};

export const sebepAdi = (tip: string, kod: string | null) =>
  (kod && SEBEPLER[tip]?.find((s) => s.kod === kod)?.ad) || "";

/** Kaydedilmek üzere hazırlanan tek kalem. */
export type BelgeKalemi = {
  malzemeId: number;
  malzemeAd: string;
  /** İşaretsiz, en küçük birimde. Yönü belge tipi veriyor. */
  miktar: number;
  /** En küçük birim başına alış fiyatı; yalnız girişte dolu. */
  birimMaliyet?: number | null;
};

export type YeniBelge = {
  tip: HareketTipi;
  zaman: string;
  sebep: string | null;
  aciklama: string;
  kalemler: BelgeKalemi[];
};

/** Defterde görünen tek satır. */
export type Hareket = {
  id: number;
  belgeId: number;
  tip: string;
  sebep: string | null;
  malzemeId: number;
  malzemeAd: string;
  birim: string;
  miktar: number;
  onceki: number;
  sonraki: number;
  birimMaliyet: number | null;
  zaman: string;
  kisi: string;
  aciklama: string;
};

/**
 * Belgeyi ve kalemlerini kaydeder.
 *
 * Önce başlık, sonra kalemler: kalemler belgeye bağlı. Kalem yazımı yarıda
 * kalırsa başlık boş kalmasın diye belge geri siliniyor — yarım fiş defteri
 * okunamaz hâle getirir. Kalemler tek istekte gidiyor; tetikleyici her satır
 * için sırayla çalışıp malzemenin miktarını güncelliyor.
 */
export async function belgeKaydet(belge: YeniBelge) {
  const kisi = acikOturum();
  const yon = tipBilgisi(belge.tip).yon;

  const { data, error } = await supabase
    .from("stok_belgeleri")
    .insert({
      tip: belge.tip,
      zaman: belge.zaman,
      sebep: belge.sebep,
      aciklama: belge.aciklama.trim() || null,
      kisi_id: kisi?.id ?? null,
      kisi_ad: kisi?.ad ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Stok belgesi kaydedilemedi.");

  const satirlar = belge.kalemler.map((k) => ({
    belge_id: data.id,
    malzeme_id: k.malzemeId,
    malzeme_ad: k.malzemeAd,
    tip: belge.tip,
    miktar: k.miktar * yon,
    // Tetikleyici yazıyor ama sütunlar not null; sıfır konup üstüne yazılıyor.
    onceki: 0,
    sonraki: 0,
    birim_maliyet: k.birimMaliyet ?? null,
    kisi_id: kisi?.id ?? null,
  }));

  const { error: kalemHatasi } = await supabase.from("stok_hareketleri").insert(satirlar);

  if (kalemHatasi) {
    await supabase.from("stok_belgeleri").delete().eq("id", data.id);
    throw new Error("Stok hareketleri kaydedilemedi, belge geri alındı.");
  }
}

export async function hareketleriGetir(
  aralik?: { bas: Date; bit: Date },
  sinir = 500
): Promise<Hareket[]> {
  let sorgu = supabase
    .from("stok_hareketleri")
    .select(
      "id, belge_id, tip, malzeme_id, malzeme_ad, miktar, onceki, sonraki, birim_maliyet, zaman, malzemeler(birim), stok_belgeleri(sebep, aciklama, kisi_ad)"
    )
    // Satış düşümü defterde duruyor ama bu ekranda gösterilmiyor: günde yüz
    // elli adisyon alış ve fire fişlerini listenin dibine iterdi.
    .neq("tip", "satis");

  if (aralik) {
    sorgu = sorgu.gte("zaman", aralik.bas.toISOString()).lt("zaman", aralik.bit.toISOString());
  }

  const { data } = await sorgu.order("zaman", { ascending: false }).limit(sinir);

  return ((data as any[]) ?? []).map((h) => ({
    id: h.id,
    belgeId: h.belge_id,
    tip: h.tip,
    sebep: h.stok_belgeleri?.sebep ?? null,
    malzemeId: h.malzeme_id,
    malzemeAd: h.malzeme_ad,
    birim: h.malzemeler?.birim ?? "kg",
    miktar: h.miktar,
    onceki: h.onceki,
    sonraki: h.sonraki,
    birimMaliyet: h.birim_maliyet == null ? null : Number(h.birim_maliyet),
    zaman: h.zaman,
    kisi: h.stok_belgeleri?.kisi_ad ?? "",
    aciklama: h.stok_belgeleri?.aciklama ?? "",
  }));
}

/** Malzeme geçmişindeki tek satır; satışlar gün gün toplanmış hâlde. */
export type GecmisSatiri = {
  anahtar: string;
  tip: string;
  zaman: string;
  miktar: number;
  /** Tek hareketin önceki/sonraki miktarı; satış gün toplamında yok. */
  onceki: number | null;
  sonraki: number | null;
  kisi: string;
  sebep: string | null;
  /** Satış gününde kaç adisyon kapandı. */
  adisyon: number;
};

/**
 * Tek malzemenin geçmişi — "stok neden tutmuyor" sorusunun cevabı. Satış
 * burada görünüyor, çünkü eksiğin çoğu oradan; ama her adisyon ayrı satır
 * olsaydı bir günde yüz satır olurdu. Satışlar o günün tek satırında
 * toplanıyor, elle girilen hareketler olduğu gibi duruyor.
 */
export async function malzemeGecmisi(
  malzemeId: number,
  aralik?: { bas: Date; bit: Date }
): Promise<GecmisSatiri[]> {
  let sorgu = supabase
    .from("stok_hareketleri")
    .select("id, tip, miktar, onceki, sonraki, zaman, stok_belgeleri(sebep, kisi_ad, adisyon_id)")
    .eq("malzeme_id", malzemeId);

  if (aralik) {
    sorgu = sorgu.gte("zaman", aralik.bas.toISOString()).lt("zaman", aralik.bit.toISOString());
  }

  const { data } = await sorgu.order("zaman", { ascending: false }).limit(2000);

  const satirlar: GecmisSatiri[] = [];
  const gunler = new Map<string, GecmisSatiri & { adisyonlar: Set<number> }>();

  for (const h of (data as any[]) ?? []) {
    const belge = h.stok_belgeleri ?? {};
    if (h.tip !== "satis") {
      satirlar.push({
        anahtar: `h${h.id}`,
        tip: h.tip,
        zaman: h.zaman,
        miktar: h.miktar,
        onceki: h.onceki,
        sonraki: h.sonraki,
        kisi: belge.kisi_ad ?? "",
        sebep: belge.sebep ?? null,
        adisyon: 0,
      });
      continue;
    }

    const t = new Date(h.zaman);
    const gun = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
    let g = gunler.get(gun);
    if (!g) {
      g = {
        anahtar: `s${gun}`,
        tip: "satis",
        zaman: h.zaman,
        miktar: 0,
        onceki: null,
        sonraki: null,
        kisi: "",
        sebep: null,
        adisyon: 0,
        adisyonlar: new Set(),
      };
      gunler.set(gun, g);
      satirlar.push(g);
    }
    g.miktar += h.miktar;
    if (belge.adisyon_id) g.adisyonlar.add(belge.adisyon_id);
    g.adisyon = g.adisyonlar.size;
  }

  // Yeniden açılıp iptal edilen adisyonlar bir günün satışını sıfırlayabiliyor;
  // değişimsiz satır bir şey anlatmıyor.
  return satirlar.filter((s) => s.miktar !== 0);
}

/**
 * Hareketi siler.
 *
 * Silme doğrudan tabloya yazılmıyor: bir satır kalkınca o malzemenin ondan
 * sonraki bütün satırlarındaki "önceki → sonraki" zinciri yalan olur.
 * Veritabanındaki işlev silmeyi yapıp zinciri ve malzemenin miktarını baştan
 * kuruyor, hepsi tek işlemde.
 */
export async function hareketSil(id: number) {
  const { error } = await supabase.rpc("stok_hareketi_sil", { p_id: id });
  if (error) throw new Error("Hareket silinemedi.");
}

/** Düzenlenebilen alanlar; malzeme ve tip değişmiyor. */
export type HareketDuzeltme = {
  /** İşaretsiz, en küçük birimde. Yönü hareketin kendi tipi veriyor. */
  miktar: number;
  birimMaliyet: number | null;
  zaman: string;
  aciklama: string;
  sebep: string | null;
};

export async function hareketGuncelle(
  id: number,
  tip: string,
  d: HareketDuzeltme
) {
  const { error } = await supabase.rpc("stok_hareketi_duzenle", {
    p_id: id,
    p_miktar: d.miktar * tipBilgisi(tip).yon,
    p_birim_maliyet: d.birimMaliyet,
    p_zaman: d.zaman,
    p_aciklama: d.aciklama,
    p_sebep: d.sebep,
  });
  if (error) throw new Error("Hareket güncellenemedi.");
}
