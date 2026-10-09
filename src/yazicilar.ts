import { supabase } from "./supabase";
import { fisIcerigi, fisPaketi } from "./fis";
import type { AdisyonVerisi } from "./adisyonlar";
import { denetimYaz } from "./denetim";
import type { SepetKalemi } from "./types";
import { yerelBas } from "./yerelYazdirma";
import { hataysaFirlat, onbellegiTazele, onbellekliGetir } from "./onbellek";
import { tazeleyiciTanit } from "./tanimAbonelik";
import { satirDenetle } from "./yazmaDenetimi";

/** Yazıcının nasıl bağlandığı — ekranlarda bu sırayla listeleniyor. */
export const BAGLANTILAR = [
  {
    kod: "ethernet",
    ad: "Ağ (Ethernet)",
    aciklama: "Yazıcının kendi IP adresi var, kasa köprüsü doğrudan basar.",
  },
  {
    kod: "usb",
    ad: "USB (kasaya bağlı)",
    aciklama: "Bilgisayara kurulu yazıcı; adı listeden seçilir.",
  },
  {
    kod: "webusb",
    ad: "USB (kurulumsuz)",
    aciklama: "Tek yazıcılı işletme için: program kurmadan tarayıcıdan basar.",
  },
] as const;

export type Baglanti = (typeof BAGLANTILAR)[number]["kod"];

export const TURLER = [
  { kod: "adisyon", ad: "Adisyon" },
  { kod: "mutfak", ad: "Mutfak" },
  { kod: "kurye", ad: "Kurye" },
] as const;

export type YaziciTuru = (typeof TURLER)[number]["kod"];

export const baglantiAdi = (kod: string) =>
  BAGLANTILAR.find((b) => b.kod === kod)?.ad ?? kod;

// Kuyrukta fiş türü olmayan işler de var: çekmece darbesi ve deneme fişi.
const EK_TURLER: Record<string, string> = { cekmece: "Çekmece", deneme: "Deneme" };

export const turAdi = (kod: string) =>
  TURLER.find((t) => t.kod === kod)?.ad ?? EK_TURLER[kod] ?? kod;

/** İstasyon = siparişin hazırlandığı tezgâh: mutfak, bar, nargile, pasta… */
export type Istasyon = {
  id: number;
  ad: string;
  sira: number;
  pisirme: boolean;
  paketleme: boolean;
};

export type Yazici = {
  id: number;
  ad: string;
  baglanti: Baglanti;
  ip: string;
  port: number;
  sistemAd: string;
  /**
   * Yalnız bu kasadaki köprü bu yazıcıya basar. USB yazıcı takılı olduğu
   * bilgisayardan başka yerden basılamıyor; boş bırakılırsa fişi hangi köprü
   * önce alırsa o basıyor (ağ yazıcısının normal hâli).
   */
  cihaz: string;
  /** Kâğıdın milimetre cinsinden genişliği: 58 veya 80. Fiş buna göre çiziliyor. */
  kagitGenislik: number;
  /** Fiş çıkarken yazıcının zili çalsın mı — mutfakta fişin düştüğünü haber veriyor. */
  zil: boolean;
  /** Para çekmecesi bu yazıcının arkasına takılı mı — çekmece yazıcı üzerinden açılıyor. */
  cekmece: boolean;
  turler: YaziciTuru[];
  aktif: boolean;
  sira: number;
  /** Yalnız mutfak türünde anlamlı: hangi istasyonların fişini basıyor. */
  istasyonlar: number[];
};

export type YaziciAlanlari = Omit<Yazici, "id" | "sira">;

/**
 * Fiş şablonunun ayarları. Liste veritabanında değil burada duruyor: bunlar
 * işletmenin tanımladığı satırlar değil, programın bildiği alanlar. Şablona yeni
 * bir alan eklemek bu listeye bir satır yazmak demek — tablo değişmiyor.
 */
export type FisAyari = { kod: string; ad: string; ipucu?: string };

export const ADISYON_PARAMETRELERI: FisAyari[] = [
  { kod: "baslik", ad: "Ürün listesi başlıkları", ipucu: "Ürün · Adet · Tutar satırı" },
  { kod: "siparis_no", ad: "Sipariş numarası" },
  { kod: "urun_birimleri", ad: "Ürün birimleri", ipucu: "Tam, Yarım, Kg" },
  {
    kod: "urun_secenekleri",
    ad: "Ürün seçenekleri ve notları",
    ipucu: "Şekersiz, az buzlu, garson notu",
  },
  {
    kod: "urun_birlestir",
    ad: "Aynı ürünleri tek satırda topla",
    ipucu: "Üç turda gelen çay tek satır olur",
  },
  { kod: "kdv_bilgisi", ad: "KDV tutarı" },
  { kod: "kdv_grubu", ad: "KDV grubu dökümü", ipucu: "Orana göre ayrı satırlar" },
  { kod: "hesabi_paylas", ad: "Hesabı paylaş alanı", ipucu: "Kişi başı tutar" },
  { kod: "bahsis", ad: "Bahşiş alanı" },
  { kod: "karekod", ad: "Karekod", ipucu: "İşletme adı, tarih ve tutar" },
  { kod: "logo", ad: "Logo" },
];

export const MUTFAK_PARAMETRELERI: FisAyari[] = [
  { kod: "siparis_no", ad: "Sipariş numarası" },
  { kod: "musteri_sayisi", ad: "Kişi sayısı" },
  { kod: "musteri_bilgileri", ad: "Müşteri bilgileri", ipucu: "Paket siparişlerde ad ve adres" },
  { kod: "urun_fiyatlari", ad: "Ürün fiyatları" },
  { kod: "siparis_toplami", ad: "Sipariş toplamı" },
];

/** Fişteki her satırın bir alanı var; boyu buradan ayarlanıyor. */
export const ADISYON_PUNTOLARI: FisAyari[] = [
  { kod: "isletme_adi", ad: "İşletme adı" },
  { kod: "genel", ad: "Künye satırları", ipucu: "Masa, saat, garson, fiş numarası" },
  { kod: "urun_listesi", ad: "Ürün listesi" },
  { kod: "secenek", ad: "Ürün altı satırlar", ipucu: "Seçenekler ve ürün notu" },
  { kod: "odeme", ad: "Ödeme satırları", ipucu: "KDV, indirim, kişi başı" },
  { kod: "toplam", ad: "Toplam tutar" },
  { kod: "not", ad: "Sipariş notu" },
  { kod: "alt_metin", ad: "Baştaki ve sondaki yazı" },
];

export const MUTFAK_PUNTOLARI: FisAyari[] = [
  { kod: "siparis_no", ad: "Sipariş numarası" },
  { kod: "genel", ad: "Künye satırları", ipucu: "Masa, saat, garson, misafir sayısı" },
  { kod: "urun_listesi", ad: "Ürün listesi" },
  { kod: "secenek", ad: "Ürün altı satırlar", ipucu: "Seçenekler ve ürün notu" },
  { kod: "toplam", ad: "Sipariş toplamı" },
  { kod: "not", ad: "Sipariş notu" },
  { kod: "alt_metin", ad: "Baştaki ve sondaki yazı" },
];

/**
 * Ayarlanmamış anahtarın kapalı sayıldığı yerde varsayılanı açık olması gereken
 * alanlar. Şablona sonradan eklenen bir anahtar, eski işletmelerin fişinde
 * kendiliğinden kapanmasın diye burada duruyor.
 */
export const VARSAYILAN_PARAMETRELER: Record<string, boolean> = {
  urun_secenekleri: true,
  urun_birlestir: true,
};

/** Ayarlanmamış alanın boyu. Fiş Tasarımı açılınca kaydırıcılar burada duruyor. */
export const VARSAYILAN_PUNTOLAR: Record<string, number> = {
  isletme_adi: 28,
  siparis_no: 30,
  // İptal başlığı her işletmede aynı: en büyük punto. Fiş Tasarımı'ndan
  // ayarlanmıyor — tezgâhtaki kişi kâğıda bakmadan, yazıcıdan çıkarken bile
  // bunun iptal olduğunu görmeli, bu küçültülebilecek bir şey değil.
  iptal_basligi: 40,
  genel: 20,
  urun_listesi: 20,
  secenek: 16,
  odeme: 20,
  toplam: 26,
  not: 18,
  alt_metin: 20,
};

/** Punto sınırları: 8'in altı termal kâğıtta okunmuyor, 40 üstü satırı taşırıyor. */
export const EN_KUCUK_PUNTO = 8;
export const EN_BUYUK_PUNTO = 40;

/** Karekodun ne taşıdığı: fişin künyesi mi, işletmenin verdiği adres mi. */
export type KarekodTipi = "fis" | "baglanti";

export type FisSablonu = {
  tip: "adisyon" | "mutfak";
  parametreler: Record<string, boolean>;
  puntolar: Record<string, number>;
  ustMetin: string;
  altMetin: string;
  /** Fişin başına basılan görsel; siyah-beyaza indirgenmiş, gömülü resim olarak. */
  logo: string;
  karekodTip: KarekodTipi;
  karekodAdres: string;
};

// İstasyon tanımı seyrek değişiyor ama mutfak ekranı her açılışta sunucudan
// indiriyordu; kopyadan anında veriliyor, sunucu arkadan okunuyor. Kartlar
// (bekleyen siparişler) canlı veri, onlar önbelleğe hiç girmiyor.
/** Ekranların canlı izleme anahtarı (bkz. tanimAbonelik.useTanim). */
export const ISTASYON_ANAHTAR = "istasyonlar";

export function istasyonlariGetir(): Promise<Istasyon[]> {
  return onbellekliGetir(ISTASYON_ANAHTAR, istasyonlariOku, true);
}

async function istasyonlariOku(): Promise<Istasyon[]> {
  const sonuc = await supabase
    .from("istasyonlar")
    .select("id, ad, sira, pisirme, paketleme")
    .order("sira")
    .order("id");
  hataysaFirlat(sonuc);
  return ((sonuc.data as any[]) ?? []).map((i) => ({
    id: i.id,
    ad: i.ad,
    sira: i.sira,
    pisirme: i.pisirme,
    paketleme: i.paketleme,
  }));
}

export async function istasyonKaydet(
  id: number | null,
  alanlar: { ad: string; sira: number; pisirme: boolean; paketleme: boolean }
) {
  const satir = {
    ad: alanlar.ad.trim(),
    sira: alanlar.sira,
    pisirme: alanlar.pisirme,
    paketleme: alanlar.paketleme,
  };
  const sonuc = id
    ? await supabase.from("istasyonlar").update(satir).eq("id", id).select("id")
    : await supabase.from("istasyonlar").insert(satir);
  if (sonuc.error) {
    throw new Error(
      sonuc.error.code === "23505" ? "Bu istasyon zaten var." : "İstasyon kaydedilemedi."
    );
  }
  if (id) satirDenetle(sonuc, "İstasyon kaydedilemedi.");
  await onbellegiTazele("istasyonlar", istasyonlariOku);
}

export async function istasyonSil(id: number) {
  const sonuc = await supabase.from("istasyonlar").delete().eq("id", id).select("id");
  if (sonuc.error) throw new Error("İstasyon silinemedi.");
  satirDenetle(sonuc, "İstasyon silinemedi.");
  await onbellegiTazele("istasyonlar", istasyonlariOku);
}

export async function yazicilariGetir(): Promise<Yazici[]> {
  const { data } = await supabase
    .from("yazicilar")
    .select(
      "id, ad, baglanti, ip, port, sistem_ad, cihaz, kagit_genislik, zil, cekmece, turler, aktif, sira, istasyonlar:yazici_istasyonlari (istasyon_id)"
    )
    .order("sira")
    .order("id");

  return ((data as any[]) ?? []).map((y) => ({
    id: y.id,
    ad: y.ad,
    baglanti: y.baglanti,
    ip: y.ip ?? "",
    port: y.port,
    sistemAd: y.sistem_ad ?? "",
    cihaz: y.cihaz ?? "",
    kagitGenislik: y.kagit_genislik ?? 80,
    zil: y.zil ?? false,
    cekmece: y.cekmece ?? false,
    turler: y.turler ?? [],
    aktif: y.aktif,
    sira: y.sira,
    istasyonlar: (y.istasyonlar ?? []).map((i: any) => i.istasyon_id),
  }));
}

/** Bağlantı türüne göre kullanılmayan alanlar boşaltılır; yarım kalan eski
 *  IP'nin sonradan yanlış yazıcıya bağlanması engelleniyor. */
function yaziciSatiri(alanlar: YaziciAlanlari) {
  const ag = alanlar.baglanti === "ethernet";
  return {
    ad: alanlar.ad.trim(),
    baglanti: alanlar.baglanti,
    ip: ag ? alanlar.ip.trim() || null : null,
    port: ag ? alanlar.port : 9100,
    sistem_ad: alanlar.baglanti === "usb" ? alanlar.sistemAd.trim() || null : null,
    // Kasaya bağlama yalnız USB'de anlamlı: ağ yazıcısına her kasa ulaşabiliyor.
    cihaz: alanlar.baglanti === "usb" ? alanlar.cihaz.trim() || null : null,
    kagit_genislik: alanlar.kagitGenislik,
    zil: alanlar.zil,
    // WebUSB yazıcıya köprü dokunmuyor, çekmeceyi de açamaz.
    cekmece: alanlar.baglanti === "webusb" ? false : alanlar.cekmece,
    turler: alanlar.turler,
    aktif: alanlar.aktif,
  };
}

export async function yaziciKaydet(id: number | null, alanlar: YaziciAlanlari) {
  if (alanlar.turler.length === 0) {
    throw new Error("En az bir yazıcı türü seçilmeli.");
  }

  const satir = yaziciSatiri(alanlar);
  let yaziciId = id;

  if (id) {
    const sonuc = await supabase.from("yazicilar").update(satir).eq("id", id).select("id");
    if (sonuc.error) throw kaydetmeHatasi(sonuc.error);
    satirDenetle(sonuc, "Yazıcı kaydedilemedi.");
  } else {
    const { data, error } = await supabase
      .from("yazicilar")
      .insert(satir)
      .select("id")
      .single();
    if (error) throw kaydetmeHatasi(error);
    yaziciId = data.id as number;
  }

  await istasyonlariYaz(
    yaziciId!,
    alanlar.turler.includes("mutfak") ? alanlar.istasyonlar : []
  );
  yaziciOnbelleginiUnut();
  return yaziciId!;
}

function kaydetmeHatasi(error: { code?: string }) {
  return new Error(
    error.code === "23505" ? "Bu adda bir yazıcı zaten var." : "Yazıcı kaydedilemedi."
  );
}

/** Eşlemeler duruyorsa dokunulmuyor, yalnız fark yazılıyor. */
async function istasyonlariYaz(yaziciId: number, istasyonlar: number[]) {
  const { data } = await supabase
    .from("yazici_istasyonlari")
    .select("istasyon_id")
    .eq("yazici_id", yaziciId);

  const mevcut = ((data as any[]) ?? []).map((i) => i.istasyon_id as number);
  const eklenecek = istasyonlar.filter((i) => !mevcut.includes(i));
  const silinecek = mevcut.filter((i) => !istasyonlar.includes(i));

  if (eklenecek.length > 0) {
    const { error } = await supabase
      .from("yazici_istasyonlari")
      .insert(eklenecek.map((istasyon_id) => ({ yazici_id: yaziciId, istasyon_id })));
    if (error) throw new Error("İstasyon eşlemesi kaydedilemedi.");
  }

  if (silinecek.length > 0) {
    const { error } = await supabase
      .from("yazici_istasyonlari")
      .delete()
      .eq("yazici_id", yaziciId)
      .in("istasyon_id", silinecek);
    if (error) throw new Error("İstasyon eşlemesi kaydedilemedi.");
  }
}

export async function yaziciSil(id: number) {
  const sonuc = await supabase.from("yazicilar").delete().eq("id", id).select("id");
  if (sonuc.error) throw new Error("Yazıcı silinemedi.");
  satirDenetle(sonuc, "Yazıcı silinemedi.");
  yaziciOnbelleginiUnut();
}

export async function yaziciSirasiniKaydet(sirali: number[]) {
  for (let i = 0; i < sirali.length; i++) {
    const sonuc = await supabase
      .from("yazicilar")
      .update({ sira: i + 1 })
      .eq("id", sirali[i])
      .select("id");
    satirDenetle(sonuc, "Yazıcı sırası kaydedilemedi.");
  }
}

export async function fisSablonuGetir(tip: FisSablonu["tip"]): Promise<FisSablonu> {
  const { data } = await supabase
    .from("fis_sablonlari")
    .select("tip, parametreler, puntolar, ust_metin, alt_metin, logo, karekod_tip, karekod_adres")
    .eq("tip", tip)
    .maybeSingle();

  return {
    tip,
    parametreler: { ...VARSAYILAN_PARAMETRELER, ...((data as any)?.parametreler ?? {}) },
    puntolar: (data as any)?.puntolar ?? {},
    ustMetin: (data as any)?.ust_metin ?? "",
    altMetin: (data as any)?.alt_metin ?? "",
    logo: (data as any)?.logo ?? "",
    karekodTip: ((data as any)?.karekod_tip as KarekodTipi) ?? "fis",
    karekodAdres: (data as any)?.karekod_adres ?? "",
  };
}

export async function fisSablonuKaydet(sablon: FisSablonu) {
  const { error } = await supabase.from("fis_sablonlari").upsert(
    {
      tip: sablon.tip,
      parametreler: sablon.parametreler,
      puntolar: sablon.puntolar,
      ust_metin: sablon.ustMetin.trim() || null,
      alt_metin: sablon.altMetin.trim() || null,
      logo: sablon.logo || null,
      karekod_tip: sablon.karekodTip,
      karekod_adres: sablon.karekodAdres.trim() || null,
    },
    { onConflict: "isletme_id,tip" }
  );
  if (error) throw new Error("Fiş şablonu kaydedilemedi.");
  yaziciOnbelleginiUnut();
}

/** Ürünün gideceği istasyon: kendi istasyonu varsa o, yoksa kategorisininki. */
export function urununIstasyonu(
  urunIstasyon: number | null,
  kategoriIstasyon: number | null
): number | null {
  return urunIstasyon ?? kategoriIstasyon ?? null;
}

/**
 * Ürün kimliğinden istasyon kimliğine eşleme. Sipariş her kaydedildiğinde
 * menüyü baştan okumamak için bir kez çekilip bellekte duruyor; menü
 * değişirse `istasyonHaritasiniUnut` ile tazeleniyor.
 */
let istasyonHaritasi: Map<number, number> | null = null;

export function istasyonHaritasiniUnut() {
  istasyonHaritasi = null;
}

export async function urunIstasyonlari() {
  if (istasyonHaritasi) return istasyonHaritasi;

  const [urn, kat] = await Promise.all([
    supabase
      .from("urunler")
      .select("id, istasyon_id, mutfakta_gorunur, urun_kategorileri (kategori_id)"),
    supabase.from("kategoriler").select("id, istasyon_id, mutfakta_gorunur"),
  ]);

  // "Mutfak ekranında" kapalıysa ürün hiçbir tezgâha gitmiyor; kategorinin
  // anahtarı kapalıysa istasyonunu ürünlerine devretmiyor. Veritabanındaki
  // `urunun_istasyonu` ile aynı kural — fiş ile ekran ayrışmasın.
  const kategoriIstasyonu = new Map<number, number>();
  for (const k of ((kat.data as any[]) ?? []))
    if (k.istasyon_id && k.mutfakta_gorunur !== false) kategoriIstasyonu.set(k.id, k.istasyon_id);

  const harita = new Map<number, number>();
  for (const u of ((urn.data as any[]) ?? [])) {
    if (u.mutfakta_gorunur === false) continue;
    // Ürün birden çok kategoride durabiliyor; istasyonu tanımlı ilk kategori
    // devralınıyor — Menü Stüdyosu'ndaki "Kategorisine göre" ile aynı kural.
    const kategoriden = (u.urun_kategorileri ?? [])
      .map((x: any) => kategoriIstasyonu.get(x.kategori_id))
      .find((i: number | undefined) => i);
    const istasyon = urununIstasyonu(u.istasyon_id ?? null, kategoriden ?? null);
    if (istasyon) harita.set(u.id, istasyon);
  }

  istasyonHaritasi = harita;
  return harita;
}

/**
 * Fişi yazıcıya ulaştırma.
 *
 * Önce kasadaki köprüye doğrudan veriliyor: kâğıt kasanın interneti olmasa da
 * çıksın. Kâğıt çıktıysa bulut kaydı "basıldı · yerel" olarak yazılıyor —
 * yazdırma geçmişi eksik kalmasın. O kayıt internetsizlikten yazılamazsa
 * sessiz geçiliyor; işin aslı olan kâğıt zaten çıktı.
 *
 * Köprü yoksa (tablet, telefon, kapalı köprü) ya da yazıcı cevap vermezse eski
 * yol işliyor: fiş kuyrukta bekliyor, köprü buluttan alıp basıyor. Her iki
 * kayıt da aynı kimliği taşıyor; köprü aynı kimliği ikinci kez basmıyor.
 */
async function kuyrugaEkle(
  tip: FisSablonu["tip"] | "cekmece",
  adisyonId: number | undefined,
  yaziciId: number,
  icerik: string
) {
  const kimlik = crypto.randomUUID();
  const yerel = await yerelBas({ kimlik, yaziciId, tip, icerik });

  const satir = {
    tip,
    adisyon_id: adisyonId ?? null,
    yazici_id: yaziciId,
    icerik,
    istemci_kimlik: kimlik,
    kaynak: yerel.basildi ? "yerel" : "bulut",
    ...(yerel.basildi ? { durum: "basildi", basilma: new Date().toISOString() } : {}),
  };

  const { error } = await supabase.from("yazdirma_kuyrugu").insert(satir);
  if (error) {
    if (yerel.basildi) return null; // kâğıt çıktı; kayıt bağlantı gelince değil, hiç yazılmıyor
    throw new Error(`Fiş kuyruğa yazılamadı: ${error.message}`);
  }
  // Köprüyü beklemesi gereken fişin kimliği; yerelde basılan zaten bitti.
  return yerel.basildi ? null : kimlik;
}

/**
 * Para çekmecesini açma. Çekmece yazıcının arkasına takılı olduğu için istek
 * yazıcıya gidiyor: kuyruğa içeriği boş bir "çekmece" işi düşüyor, köprü onu
 * görünce fiş basmadan yalnız açma darbesini gönderiyor.
 */
export async function cekmeceyiAc() {
  const cekmeceli = (await yazicilariOku()).filter((y) => y.aktif && y.cekmece);
  if (!cekmeceli.length) {
    throw new Error(
      "Çekmecenin bağlı olduğu yazıcı tanımlı değil. Ayarlar › Yazıcılar'dan işaretleyin."
    );
  }
  for (const y of cekmeceli) await kuyrugaEkle("cekmece", undefined, y.id, "");
}

/**
 * Yazıcı listesi ve fiş şablonu her fişte yeniden okunuyordu; ikisi de nadiren
 * değişiyor ve sipariş kaydı sırasında her okuma sunucuya bir gidiş dönüş
 * demek. Bellekte tutuluyorlar, ayar ekranları kaydettiğinde tazeleniyor.
 */
let yaziciOnbellek: Promise<Yazici[]> | null = null;
const sablonOnbellek = new Map<FisSablonu["tip"], Promise<FisSablonu>>();

export function yaziciOnbelleginiUnut() {
  yaziciOnbellek = null;
  sablonOnbellek.clear();
}

function yazicilariOku() {
  if (!yaziciOnbellek) {
    yaziciOnbellek = yazicilariGetir().catch((e) => {
      yaziciOnbellek = null;
      throw e;
    });
  }
  return yaziciOnbellek;
}

function sablonOku(tip: FisSablonu["tip"]) {
  let istek = sablonOnbellek.get(tip);
  if (!istek) {
    istek = fisSablonuGetir(tip).catch((e) => {
      sablonOnbellek.delete(tip);
      throw e;
    });
    sablonOnbellek.set(tip, istek);
  }
  return istek;
}

/** O türde fişi basan, açık yazıcılar. */
function turunYazicilari(yazicilar: Yazici[], tur: YaziciTuru) {
  return yazicilar.filter((y) => y.aktif && y.turler.includes(tur));
}

export type FisSonucu =
  | { durum: "basildi" | "yazici_yok" }
  | { durum: "basarisiz"; hata: string }
  | { durum: "ulasmadi"; kimlikler: string[] };

/**
 * Hesap fişi: adisyon türündeki bütün açık yazıcılara gider. Fiş sıraya
 * konduktan sonra köprünün cevabı en çok üç saniye bekleniyor. Köprü açıksa
 * cevap bir saniyede geliyor; basamadıysa yazıcının bildirdiği sebeple
 * geliyor. Hiç cevap yoksa kasadaki program çalışmıyor demektir.
 */
export async function adisyonFisiYaz(adisyon: AdisyonVerisi): Promise<FisSonucu> {
  const [yazicilar, sablon] = await Promise.all([yazicilariOku(), sablonOku("adisyon")]);
  const hedefler = turunYazicilari(yazicilar, "adisyon");
  if (!hedefler.length) return { durum: "yazici_yok" };

  const icerik = fisPaketi(fisIcerigi(sablon, adisyon));
  const kimlikler: string[] = [];
  for (const y of hedefler) {
    const kimlik = await kuyrugaEkle("adisyon", adisyon.id, y.id, icerik);
    if (kimlik) kimlikler.push(kimlik);
  }
  // Kuyruk doksan günde temizleniyor; fişin ne zaman gönderildiği defterde kalıyor.
  if (adisyon.id) denetimYaz([{ islem: "fis_yazdir", adisyonId: adisyon.id, yer: adisyon.ad }]);

  return kimlikler.length ? fisSonucunuBekle(kimlikler) : { durum: "basildi" };
}

async function fisSonucunuBekle(kimlikler: string[]): Promise<FisSonucu> {
  const sonuclar = [...(await kuyrukSonuclari(kimlikler)).values()];
  const basamayan = sonuclar.find((s) => s.durum === "basarisiz");
  if (basamayan) return { durum: "basarisiz", hata: basamayan.hata || "Yazıcı basamadı." };
  if (sonuclar.length === kimlikler.length && sonuclar.every((s) => s.durum === "basildi")) {
    return { durum: "basildi" };
  }
  return { durum: "ulasmadi", kimlikler };
}

/** Köprüye ulaşmayan fiş sırada beklemesin; program açılınca saatler sonra çıkmasın. */
export async function bekleyenFisiBirak(kimlikler: string[]) {
  const { error } = await supabase.rpc("bekleyen_fisi_birak", { p_kimlikler: kimlikler });
  if (error) throw new Error(error.message || "Fiş sıradan kaldırılamadı.");
}

/** Mutfak fişi: o turda gönderilen ürünler tezgâhlara dağıtılıyor. */
export async function mutfakFisiYaz(
  adisyon: AdisyonVerisi,
  kalemler: SepetKalemi[],
  siparisNo?: number
) {
  const basilacaklar = kalemler.filter((k) => (k.durum ?? "normal") === "normal");
  return istasyonlaraYaz(adisyon, basilacaklar, siparisNo, false);
}

/**
 * İptal fişi: masadan çıkarılan ürünler için tezgâha "bunları yapma" kâğıdı.
 * Sipariş fişi hangi yazıcıdan çıktıysa iptali de oradan çıkıyor — eşleme aynı
 * ürün/istasyon haritasından geliyor, bardaki ürünün iptali mutfağa düşmüyor.
 */
export async function iptalFisiYaz(adisyon: AdisyonVerisi, kalemler: SepetKalemi[]) {
  return istasyonlaraYaz(adisyon, kalemler, undefined, true);
}

/**
 * Mutfak ve iptal fişinin ortak gövdesi: kalemler istasyona göre ayrılır, her
 * istasyonun fişi yalnız o istasyonun yazıcılarına gider. Barın fişinde
 * mutfağın ürünü olmaz.
 */
async function istasyonlaraYaz(
  adisyon: AdisyonVerisi,
  kalemler: SepetKalemi[],
  siparisNo: number | undefined,
  iptal: boolean
) {
  if (!kalemler.length) return 0;

  const [yazicilar, sablon, harita, istasyonlar] = await Promise.all([
    yazicilariOku(),
    sablonOku("mutfak"),
    urunIstasyonlari(),
    istasyonlariGetir(),
  ]);
  const hedefler = turunYazicilari(yazicilar, "mutfak");
  if (!hedefler.length) return 0;

  const gruplar = new Map<number, SepetKalemi[]>();
  for (const k of kalemler) {
    const istasyon = k.urunId ? harita.get(k.urunId) : undefined;
    if (!istasyon) continue; // istasyonu olmayan ürün mutfağa düşmüyor
    const liste = gruplar.get(istasyon) ?? [];
    liste.push(k);
    gruplar.set(istasyon, liste);
  }

  const istasyonAdi = new Map(istasyonlar.map((i) => [i.id, i.ad]));

  // Yazıcılar birbirini beklemiyor: sırayla gönderilince barın fişi mutfağın
  // bulut kaydı bitene kadar kâğıda dökülmüyordu. Aynı yazıcıya düşen fişler
  // (iki tezgâha bağlı yazıcı) yine sırayla gidiyor; ağ yazıcısı çoğu zaman
  // tek bağlantı kabul ediyor.
  const yaziciIsleri = new Map<number, { istasyonId: number; liste: SepetKalemi[]; y: Yazici }[]>();
  for (const [istasyonId, liste] of gruplar)
    for (const y of hedefler.filter((h) => h.istasyonlar.includes(istasyonId)))
      yaziciIsleri.set(y.id, [...(yaziciIsleri.get(y.id) ?? []), { istasyonId, liste, y }]);

  const sonuclar = await Promise.all(
    [...yaziciIsleri.values()].map(async (sira) => {
      const bitenler: SiparisFisi[] = [];
      for (const { istasyonId, liste, y } of sira) {
        // İçerik yazıcı başına üretiliyor: aynı istasyona 58 mm ve 80 mm yazıcı
        // birlikte bağlıysa her biri kendi kâğıdına sığan fişi alıyor.
        const icerik = fisPaketi(
          fisIcerigi(sablon, adisyon, liste, siparisNo, iptal, y.kagitGenislik)
        );
        const kimlik = await kuyrugaEkle("mutfak", adisyon.id, y.id, icerik);
        bitenler.push({ kimlik, istasyon: istasyonAdi.get(istasyonId) ?? "", yaziciId: y.id, icerik });
      }
      return bitenler;
    })
  );
  const isler = sonuclar.flat();
  // İptal fişi izlenmiyor: ürün zaten masadan çıktı, kâğıt gelmese de iş bozulmuyor.
  if (!iptal) siparisFisleriniIzle(isler, adisyon);
  return isler.length;
}

type SiparisFisi = { kimlik: string | null; istasyon: string; yaziciId: number; icerik: string };

export type SiparisFisiSorunu = {
  yer: string;
  /** Bildirilen sebep; köprüden hiç cevap gelmediyse boş. */
  sorunlar: { istasyon: string; hata: string | null }[];
  yenidenYaz: () => void;
};

const sorunDinleyicileri = new Set<(s: SiparisFisiSorunu) => void>();

/** Uygulamanın kökündeki uyarı penceresi buradan haber alıyor. */
export function siparisFisiSorununuDinle(dinleyici: (s: SiparisFisiSorunu) => void) {
  sorunDinleyicileri.add(dinleyici);
  return () => {
    sorunDinleyicileri.delete(dinleyici);
  };
}

/**
 * Sipariş fişi beklenmeden gönderiliyor; garson salona dönmüş olabilir.
 * Sonuç arkada üç saniye izleniyor, sorun varsa hangi ekran açıksa orada
 * uyarı çıkıyor. Köprüye ulaşmayan fiş sırada kalıyor: sipariş geç de olsa
 * istasyona gitmeli.
 */
async function siparisFisleriniIzle(isler: SiparisFisi[], adisyon: AdisyonVerisi) {
  const izlenen = isler.filter((i) => i.kimlik);
  if (!izlenen.length) return;

  const sonuclar = await kuyrukSonuclari(izlenen.map((i) => i.kimlik!));
  const sorunlu = izlenen.filter((i) => sonuclar.get(i.kimlik!)?.durum !== "basildi");
  if (!sorunlu.length) return;

  const sorun: SiparisFisiSorunu = {
    yer: adisyon.ad ?? "",
    sorunlar: sorunlu.map((i) => {
      const s = sonuclar.get(i.kimlik!);
      return { istasyon: i.istasyon, hata: s?.durum === "basarisiz" ? s.hata || "Yazıcı basamadı." : null };
    }),
    // Yalnız basılamayan fişler yeniden gönderiliyor; sırada bekleyen zaten basılacak.
    yenidenYaz: () => {
      const tekrar = sorunlu.filter((i) => sonuclar.get(i.kimlik!)?.durum === "basarisiz");
      Promise.all(
        tekrar.map(async (i) => ({
          ...i,
          kimlik: await kuyrugaEkle("mutfak", adisyon.id, i.yaziciId, i.icerik),
        }))
      )
        .then((yeni) => siparisFisleriniIzle(yeni, adisyon))
        .catch((e) => console.error("Sipariş fişi yeniden yazılamadı:", e));
    },
  };
  for (const d of sorunDinleyicileri) d(sorun);
}

/** Kuyruktaki fişlerin durumu; hepsi sonuçlanınca ya da süre dolunca dönüyor. */
async function kuyrukSonuclari(kimlikler: string[], sure = 3000) {
  const sonuclar = new Map<string, { durum: string; hata: string | null }>();
  const son = Date.now() + sure;
  while (Date.now() < son) {
    await new Promise((t) => setTimeout(t, 300));
    const { data } = await supabase
      .from("yazdirma_kuyrugu")
      .select("istemci_kimlik, durum, hata")
      .in("istemci_kimlik", kimlikler);
    for (const s of (data as any[]) ?? []) {
      sonuclar.set(s.istemci_kimlik, { durum: s.durum, hata: s.hata });
    }
    if (kimlikler.every((k) => ["basildi", "basarisiz"].includes(sonuclar.get(k)?.durum ?? ""))) {
      break;
    }
  }
  return sonuclar;
}

tazeleyiciTanit(ISTASYON_ANAHTAR, istasyonlariOku);
