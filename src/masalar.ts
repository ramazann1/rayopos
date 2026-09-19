import { supabase } from "./supabase";
import { hataysaFirlat, kopyadanGetir, onbellekliGetir } from "./onbellek";
import { satirDenetle, yazmayiDenetle } from "./yazmaDenetimi";
import { tanimTazele, tazeleyiciTanit } from "./tanimAbonelik";
import { ayarlar } from "./isletmeAyarlari";
import type { Bolge, Masa } from "./types";

const MASA_ALANLARI =
  "id, bolge_id, ad, sira, kapasite, aktif, konum_x, konum_y, genislik, yukseklik, sekil";

function masayaCevir(m: any): Masa {
  return {
    id: m.id,
    bolgeId: m.bolge_id,
    ad: m.ad,
    sira: m.sira,
    kapasite: m.kapasite ?? undefined,
    aktif: m.aktif,
    konumX: m.konum_x ?? undefined,
    konumY: m.konum_y ?? undefined,
    genislik: m.genislik ?? undefined,
    yukseklik: m.yukseklik ?? undefined,
    sekil: m.sekil ?? "kare",
  };
}

// Bölge ve masa tanımları da kopukluğa dayanıklı: Salon açılabilsin, garson
// masayı seçebilsin. Masaların üstündeki adisyon durumu ayrı okunuyor ve
// önbelleğe girmiyor — dolu/boş bilgisi bayatlarsa yanlış olur.
/** Ekranların canlı izleme anahtarı (bkz. tanimAbonelik.useTanim). */
export const BOLGE_ANAHTAR = "bolgeler";

/**
 * Tanımlar bu süre geçmeden sunucudan okunmuyor. Emniyet payı: canlı abonelik
 * sessizce ölürse (bağlantı koptu, tarayıcı uyuttu) ekran kendini en geç bu
 * sürede toparlıyor.
 */
export const SEYREK_TANIM = 5 * 60_000;

/**
 * Hesap açılmış ama tanımlarda olmayan masa var mı — başka bir cihazda yeni
 * masa eklenip hemen kullanılmış demektir. Ekran o an tanımları tazeliyor,
 * SEYREK_TANIM süresini beklemiyor.
 */
export function yabanciMasaVar(bolgeler: Bolge[], adisyonlar: Record<number, unknown>) {
  const bilinen = new Set<number>();
  for (const b of bolgeler) for (const m of b.masalar) bilinen.add(m.id);
  return Object.keys(adisyonlar).some((id) => !bilinen.has(Number(id)));
}

/**
 * `tazele` kapalıyken sunucu hiç yoklanmıyor, cihazdaki kopya veriliyor.
 * Salon ve mobil masa ekranı sipariş haberiyle saniyede birkaç kez okuyor;
 * masa tanımı siparişle değişmediği için o okumalarda kapalı çağrılıyor.
 * Tanım gerçekten değişirse `tanimAbonelik` kopyayı tazeliyor.
 */
export function bolgeleriGetir(tazele = true): Promise<Bolge[]> {
  if (!tazele) return kopyadanGetir(BOLGE_ANAHTAR, bolgeleriOku);
  return onbellekliGetir(BOLGE_ANAHTAR, bolgeleriOku, true);
}

async function bolgeleriOku(): Promise<Bolge[]> {
  const [blg, msa] = await Promise.all([
    supabase.from("bolgeler").select("id, ad, sira, plan_modu").order("sira"),
    supabase.from("masalar").select(MASA_ALANLARI).order("sira"),
  ]);
  hataysaFirlat(blg, msa);

  const masalar = ((msa.data ?? []) as any[]).map(masayaCevir);
  return ((blg.data ?? []) as any[]).map((b) => ({
    id: b.id,
    ad: b.ad,
    sira: b.sira,
    planModu: b.plan_modu ?? false,
    masalar: masalar.filter((m) => m.bolgeId === b.id),
  }));
}

// Yazdıktan sonra cihazdaki kopya tazelenmezse ekran eski listeyi okuyor:
// silinen bölge sayfa yenilenene kadar yerinde duruyordu.
const tanimiTazele = () => tanimTazele(BOLGE_ANAHTAR);

export async function masaGetir(id: number): Promise<Masa | null> {
  const { data } = await supabase.from("masalar").select(MASA_ALANLARI).eq("id", id).maybeSingle();
  return data ? masayaCevir(data) : null;
}

export async function bolgeEkle(ad: string, sira: number): Promise<number> {
  const sonuc = await supabase.from("bolgeler").insert({ ad, sira }).select("id").single();
  yazmayiDenetle(sonuc, "Bölge eklenemedi.");
  await tanimiTazele();
  return (sonuc.data as any).id;
}

export async function bolgeGuncelle(
  id: number,
  alanlar: Partial<{ ad: string; sira: number; plan_modu: boolean }>
) {
  const sonuc = await supabase.from("bolgeler").update(alanlar).eq("id", id).select("id");
  satirDenetle(sonuc, "Bölge kaydedilemedi.");
  await tanimiTazele();
}

// Bölge silinince masaları da gider (veritabanında cascade); üstünde açık
// adisyon olan masa varsa ekran zaten silmeye izin vermez.
export async function bolgeSil(id: number) {
  const sonuc = await supabase.from("bolgeler").delete().eq("id", id).select("id");
  satirDenetle(sonuc, "Bölge silinemedi.");
  await tanimiTazele();
}

type MasaAlanlari = {
  ad: string;
  sira: number;
  kapasite: number | null;
  sekil: string;
  bolge_id: number;
  konum_x: number;
  konum_y: number;
  genislik: number;
  yukseklik: number;
};

// Salon planındaki yer: tuval birimi cinsinden konum ve boyut.
export type Yerlesim = {
  konumX: number;
  konumY: number;
  genislik: number;
  yukseklik: number;
};

async function yerlesimYaz(id: number, y: Yerlesim) {
  const sonuc = await supabase
    .from("masalar")
    .update({
      konum_x: Math.round(y.konumX),
      konum_y: Math.round(y.konumY),
      genislik: Math.round(y.genislik),
      yukseklik: Math.round(y.yukseklik),
    })
    .eq("id", id)
    .select("id");
  satirDenetle(sonuc, "Masanın yeri kaydedilemedi.");
}

export async function yerlesimKaydet(id: number, y: Yerlesim) {
  await yerlesimYaz(id, y);
  await tanimiTazele();
}

/** Otomatik dizmede ve ilk açılışta çok masa birden yazılıyor. */
export async function yerlesimTopluKaydet(kayitlar: (Yerlesim & { id: number })[]) {
  await Promise.all(kayitlar.map(({ id, ...y }) => yerlesimYaz(id, y)));
  await tanimiTazele();
}

export async function masaEkle(bolgeId: number, alanlar: Partial<MasaAlanlari> & { ad: string }) {
  const sonuc = await supabase
    .from("masalar")
    .insert({ bolge_id: bolgeId, ...alanlar })
    .select("id")
    .single();
  yazmayiDenetle(sonuc, "Masa eklenemedi.");
  await tanimiTazele();
  return (sonuc.data as any).id as number;
}

// Toplu ekleme: "Masa 1, Masa 2, ..." — 20 masalı bir bölgeyi tek tek girmek
// yerine ön ek ve adet veriliyor.
export async function topluMasaEkle(
  bolgeId: number,
  onEk: string,
  adet: number,
  baslangicSira: number,
  sekil: string
) {
  const satirlar = Array.from({ length: adet }, (_, i) => ({
    bolge_id: bolgeId,
    ad: `${onEk} ${i + 1}`.trim(),
    sira: baslangicSira + i,
    sekil,
  }));
  const sonuc = await supabase.from("masalar").insert(satirlar).select("id");
  satirDenetle(sonuc, "Masalar eklenemedi.");
  await tanimiTazele();
}

export async function masaGuncelle(id: number, alanlar: Partial<MasaAlanlari>) {
  const sonuc = await supabase.from("masalar").update(alanlar).eq("id", id).select("id");
  satirDenetle(sonuc, "Masa kaydedilemedi.");
  await tanimiTazele();
}

export async function masaSil(id: number) {
  const sonuc = await supabase.from("masalar").delete().eq("id", id).select("id");
  satirDenetle(sonuc, "Masa silinemedi.");
  await tanimiTazele();
}

// Silmeden önce sorulur: üstünde açık adisyon olan masa silinemez.
export async function acikAdisyonluMasalar(masaIdler: number[]): Promise<Set<number>> {
  if (!masaIdler.length) return new Set();
  const { data } = await supabase
    .from("adisyonlar")
    .select("masa_id")
    .eq("durum", "acik")
    .in("masa_id", masaIdler);
  return new Set(((data as any[]) ?? []).map((a) => a.masa_id));
}

/**
 * Masa üzerinden ne kadardır yeni sipariş geçmediği. Masa kartı bu süreyi
 * işletmenin belirlediği eşikle karşılaştırıp "durgun" rengine geçiyor.
 * Hiç sipariş girilmemiş masada ölçü adisyonun açılışı: masa açıldı ama
 * ürün gelmediyse de bekleyen bir masa var demektir.
 */
export function durgunMu(ozet?: { sonSiparis?: string; acilis?: string }) {
  const esik = ayarlar().masaDurgunlukDk;
  if (!esik || !ozet) return false;
  const an = ozet.sonSiparis ?? ozet.acilis;
  if (!an) return false;
  return (Date.now() - new Date(an).getTime()) / 60000 >= esik;
}

/**
 * Taşıma ve birleştirme onayında sorulan cümle. İki yüzey de buradan okuyor:
 * telefonda ve kasada aynı işin aynı sözle sorulması gerekiyor.
 */
export function hedefOnayMesaji(tip: "tasi" | "birlestir", kaynakAd: string, hedefAd: string) {
  return tip === "tasi"
    ? `*${kaynakAd}* masasındaki adisyon *${hedefAd}* masasına taşınacak. Onaylıyor musunuz?`
    : `*${kaynakAd}* masasındaki adisyon *${hedefAd}* masasının adisyonuna eklenecek. ` +
      `*${kaynakAd}* boşalacak, iki hesap tek adisyonda toplanacak. Onaylıyor musunuz?`;
}

tazeleyiciTanit(BOLGE_ANAHTAR, bolgeleriOku);
