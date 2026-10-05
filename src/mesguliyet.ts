import { durumluModul } from "./sicakGuncelleme";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { acikOturum, yetkiVar } from "./oturum";
import { kisaAd } from "./personel";
import { baglantiVar } from "./baglanti";
import { useCanli } from "./canli";

/**
 * Masa meşguliyeti — "bu masada şu an biri var" işareti.
 *
 * Kilit değil işaret: yetkili devralabiliyor. Sert kilit gerçek işletmede
 * aksatıyor — garson ekranı açık unutur, kasiyer müşteriyi kapıda bekletir.
 * Siparişin kaybolmasına karşı asıl koruma burada değil, adisyonlar.ts'teki
 * "yalnız gördüğünü sil" kuralında; bu katmanın işi insanları birbirinden
 * haberdar etmek.
 */

/** Ekran "buradayım" deme aralığı. */
const KALP_ATISI = 20_000;
/** Bu kadar süredir ses çıkmayan işaret ölü sayılıyor. */
export const OLU_SURE = 60_000;

/**
 * Sahibi canlı hattan düştükten sonra işaretin ekranda kalma süresi. İnternetin
 * kısa titremesi kilidi düşürüp geri koymasın diye.
 */
const HAT_PAYI = 12_000;

/**
 * Canlı hat: masadaki cihaz "buradayım" diyor. Uygulama kapatılınca telefon
 * bir şey yazamadan ölüyor, veritabanındaki işaret yerinde kalıyor; hat ise
 * telefonla birlikte kopuyor ve sunucu bunu hemen herkese duyuruyor. İşaretin
 * kendisi yine tabloda — devralma ve "masa kimde" sorusu oradan çalışıyor,
 * hat yalnız sahibinin hâlâ orada olup olmadığını söylüyor.
 */
type Varlik = { masaId: number; kisiId: number };

let kanal: RealtimeChannel | null = null;
let kanalIsletmesi: number | undefined;
let hatHazir = false;
let hattakiler = new Set<string>();
let bildirilen: Varlik | null = null;
const hatIzleyicileri = new Set<() => void>();

const varlikAnahtari = (masaId: number, kisiId: number | null) => `${masaId}:${kisiId}`;

function hattiAc() {
  const isletme = acikOturum()?.isletmeId;
  if (kanal && kanalIsletmesi === isletme) return kanal;
  if (kanal) supabase.removeChannel(kanal);
  kanalIsletmesi = isletme;
  hatHazir = false;
  hattakiler = new Set();

  const yeni = supabase.channel(`masada-${isletme}`);
  yeni
    .on("presence", { event: "sync" }, () => {
      const kume = new Set<string>();
      for (const liste of Object.values(yeni.presenceState<Varlik>()))
        for (const v of liste) kume.add(varlikAnahtari(v.masaId, v.kisiId));
      hattakiler = kume;
      hatHazir = true;
      hatIzleyicileri.forEach((f) => f());
    })
    // Bağlantı kopup geri gelince hat yeniden kuruluyor; masa hâlâ bizdeyse
    // tekrar söyleniyor.
    .subscribe((durum) => {
      if (durum === "SUBSCRIBED" && bildirilen) yeni.track(bildirilen).catch(() => {});
    });
  kanal = yeni;
  return yeni;
}

function hattaBildir(v: Varlik | null) {
  bildirilen = v;
  const k = hattiAc();
  (v ? k.track(v) : k.untrack()).catch(() => {});
}

export type Mesguliyet = {
  masaId: number;
  kisiId: number | null;
  ad: string;
  guncelleme: string;
};

/** Diri işaretler; ölüler burada eleniyor, ekranların süre bilmesi gerekmiyor. */
export async function mesguliyetleriGetir(): Promise<Record<number, Mesguliyet>> {
  const sinir = new Date(Date.now() - OLU_SURE).toISOString();
  const { data, error } = await supabase
    .from("masa_mesguliyet")
    .select("masa_id, kisi_id, kisi_ad, guncelleme")
    .gte("guncelleme", sinir);
  if (error) console.error("Masa meşguliyetleri okunamadı:", error.message);

  const liste: Record<number, Mesguliyet> = {};
  for (const s of (data as any[]) ?? []) {
    liste[s.masa_id] = {
      masaId: s.masa_id,
      kisiId: s.kisi_id,
      ad: s.kisi_ad,
      guncelleme: s.guncelleme,
    };
  }
  return liste;
}

async function isaretiKoy(masaId: number) {
  const kisi = acikOturum();
  const { error } = await supabase.from("masa_mesguliyet").upsert(
    {
      masa_id: masaId,
      kisi_id: kisi?.id ?? null,
      kisi_ad: kisaAd(kisi?.ad ?? "") || "Bilinmeyen",
      guncelleme: new Date().toISOString(),
    },
    { onConflict: "masa_id" }
  );
  // Sessiz düşerse masa hiç meşgul görünmüyor ve sebebi anlaşılmıyor.
  if (error) console.error("Masa meşguliyeti yazılamadı:", error.message);
}

/**
 * Kalp atışı yalnız kendi satırımızı tazeliyor. Körü körüne yazsaydı masayı
 * geri çalardı: biri devralır, yirmi saniye sonra öteki farkında olmadan geri
 * alır, ikisine birden "devraldı" uyarısı giderdi. Satıra dokunulamıyorsa masa
 * elimizden alınmış demektir — bu, devralmanın en hızlı haberi.
 */
async function kalpAtisi(masaId: number, kisiId: number) {
  const { data } = await supabase
    .from("masa_mesguliyet")
    .update({ guncelleme: new Date().toISOString() })
    .eq("masa_id", masaId)
    .eq("kisi_id", kisiId)
    .select("masa_id");
  return ((data as any[]) ?? []).length > 0;
}

/** Masada şu an başka biri var mı — ölü işaret sayılmıyor. */
async function baskasindaMi(masaId: number, kisiId: number) {
  const sinir = new Date(Date.now() - OLU_SURE).toISOString();
  const { data } = await supabase
    .from("masa_mesguliyet")
    .select("kisi_id")
    .eq("masa_id", masaId)
    .neq("kisi_id", kisiId)
    .gte("guncelleme", sinir)
    .maybeSingle();
  return !!data;
}

/** Masa bizdeyse bırakılıyor; başkasına geçtiyse onun işaretine dokunulmuyor. */
async function isaretiKaldir(masaId: number, kisiId: number) {
  const { error } = await supabase
    .from("masa_mesguliyet")
    .delete()
    .eq("masa_id", masaId)
    .eq("kisi_id", kisiId);
  // Satır dönmemesi olağan: masa bu arada başkasına geçmiş olabilir. Hata
  // başka şey; kalırsa masa boşalmadığı hâlde boş sanılıyor.
  if (error) console.error("Masa meşguliyeti kaldırılamadı:", error.message);
}

/**
 * Masa ekranı açık olduğu sürece işareti diri tutuyor, ekrandan çıkınca
 * kaldırıyor. Ekran arkaya alınınca (telefon cebe girince) masa hemen serbest
 * kalıyor, garsonun geri dönmesi beklenmiyor.
 *
 * Çevrimdışıyken hiç denenmiyor — işaret sunucuda yaşıyor, bağlantı yoksa
 * konulamıyor. Kalem kaybına karşı koruma zaten ayrı katmanda.
 */
export function useMasayiTut(masaId: number | null) {
  // Masa elimizden alındıysa devralanın adı; ekran bunu görünce uyarıyor.
  const [devralan, setDevralan] = useState<string | null>(null);

  // Masanın kimde olduğunu sorup sonucu ekrana bildiriyor. İki yerden
  // çağrılıyor: canlı yayın haber verdiğinde (anında) ve kalp atışı satıra
  // dokunamadığında (en geç yirmi saniye). İkinci yol yedek — canlı yayın
  // kurulmamışsa ya da düşmüşse devralma sessiz kalmasın.
  const sahibiSor = async () => {
    if (masaId === null) return;
    const { data } = await supabase
      .from("masa_mesguliyet")
      .select("kisi_id, kisi_ad")
      .eq("masa_id", masaId)
      .maybeSingle();
    const sahip = data as { kisi_id: number | null; kisi_ad: string } | null;
    const benimId = acikOturum()?.id;
    setDevralan(sahip && sahip.kisi_id !== benimId ? sahip.kisi_ad : null);
  };

  useEffect(() => {
    if (masaId === null) return;
    const kisiId = acikOturum()?.id;
    if (!kisiId) return;

    let birakildi = false;
    let bizde = false;
    let ilkGiris = true;

    const vur = async () => {
      if (birakildi || document.hidden || !baglantiVar()) return;
      if (!bizde) {
        // Arkadan dönüşte masa bu arada başkasına geçmiş olabilir; ondan
        // geri alınmıyor, garson devralma uyarısıyla masadan çıkıyor.
        if (!ilkGiris && (await baskasindaMi(masaId, kisiId))) {
          birakildi = true;
          sahibiSor().catch(() => {});
          return;
        }
        ilkGiris = false;
        await isaretiKoy(masaId).catch(() => {});
        bizde = true;
        hattaBildir({ masaId, kisiId });
        return;
      }
      // Masa alınmışsa atış duruyor. Yeniden konulsaydı geri çalmış olurduk;
      // devralanı masadan atmak devralmanın kendisini anlamsız kılardı.
      const duruyor = await kalpAtisi(masaId, kisiId).catch(() => true);
      if (duruyor) return;
      birakildi = true;
      hattaBildir(null);
      sahibiSor().catch(() => {});
    };

    // Uygulama arkaya atılınca ya da kapatılınca masa beklemeden bırakılıyor;
    // öteki ekranlar ölme süresini beklemesin. Pil biterse haber gidemiyor,
    // o zaman OLU_SURE devreye giriyor.
    const birak = () => {
      if (!bizde || birakildi) return;
      bizde = false;
      hattaBildir(null);
      isaretiKaldir(masaId, kisiId).catch(() => {});
    };
    const gorunurlukDegisti = () => (document.hidden ? birak() : vur());

    vur();
    const zaman = setInterval(vur, KALP_ATISI);
    document.addEventListener("visibilitychange", gorunurlukDegisti);
    window.addEventListener("pagehide", birak);

    return () => {
      birakildi = true;
      clearInterval(zaman);
      document.removeEventListener("visibilitychange", gorunurlukDegisti);
      window.removeEventListener("pagehide", birak);
      hattaBildir(null);
      if (baglantiVar()) isaretiKaldir(masaId, kisiId).catch(() => {});
    };
  }, [masaId]);

  // Devralma sessiz olmamalı: kişi hâlâ ekranda sipariş giriyor olabilir.
  useCanli(["masa_mesguliyet"], () => {
    sahibiSor().catch(() => {});
  });

  return devralan;
}

/**
 * Devralma: masa çağırana geçiyor, öteki kişinin ekranı masadan çıkıyor.
 * Başkasının işini bölen bir karar olduğu için yetkiye bağlı — uyarıyı herkes
 * görüyor, devralmayı yalnız yetkisi olan yapabiliyor.
 */
export const devralabilir = () => yetkiVar("masa.devral");

export async function masayiDevral(masaId: number) {
  await isaretiKoy(masaId);
}

/**
 * Masa ızgarasının okuduğu liste. Kendi işaretimiz elenmiş geliyor: kişi kendi
 * açtığı masayı "meşgul" görmemeli.
 */
export function useMesguliyetler() {
  const [liste, setListe] = useState<Record<number, Mesguliyet>>({});
  // İşaretin bu cihazda ilk görüldüğü ve sahibinin hattan düştüğü an. Yeni
  // girilen masanın sahibi hatta birkaç saniye geç görünebiliyor; o arada
  // işaret gizlenmesin diye ilk görülme de HAT_PAYI kadar korunuyor.
  const ilkGorulme = useRef(new Map<string, number>());
  const dustu = useRef(new Map<string, number>());
  const [, setTik] = useState(0);

  useEffect(() => {
    hattiAc();
    let onceki = new Set(hattakiler);
    const degisti = () => {
      const simdi = Date.now();
      for (const a of onceki) if (!hattakiler.has(a)) dustu.current.set(a, simdi);
      for (const a of hattakiler) dustu.current.delete(a);
      onceki = new Set(hattakiler);
      setTik((t) => t + 1);
    };
    hatIzleyicileri.add(degisti);
    // Düşen sahibin payı dolunca ekran olay beklemeden yeniden çiziliyor.
    const zaman = setInterval(() => setTik((t) => t + 1), 3000);
    return () => {
      hatIzleyicileri.delete(degisti);
      clearInterval(zaman);
    };
  }, []);

  const oku = () => {
    if (!baglantiVar()) return;
    mesguliyetleriGetir()
      .then((m) => {
        const benimId = acikOturum()?.id;
        const suzulmus: Record<number, Mesguliyet> = {};
        for (const [masaId, kayit] of Object.entries(m)) {
          if (kayit.kisiId && kayit.kisiId === benimId) continue;
          suzulmus[Number(masaId)] = kayit;
        }
        setListe(suzulmus);
      })
      .catch(() => {});
  };

  // Başkası masaya girip çıktığında ızgara anında değişiyor.
  useCanli(["masa_mesguliyet"], oku);

  // Ölme olay üretmiyor, sadece zaman geçiyor: telefonun pili bittiyse kimse
  // "bıraktım" demiyor. Onun için liste ayrıca aralıklı tazeleniyor.
  useEffect(() => {
    oku();
    const zaman = setInterval(oku, KALP_ATISI);
    return () => clearInterval(zaman);
  }, []);

  // Hat kurulamadıysa tablo tek başına karar veriyor (OLU_SURE).
  if (!hatHazir) return liste;
  const simdi = Date.now();
  const gorunen: Record<number, Mesguliyet> = {};
  for (const [masaId, kayit] of Object.entries(liste)) {
    const a = varlikAnahtari(kayit.masaId, kayit.kisiId);
    if (!ilkGorulme.current.has(a)) ilkGorulme.current.set(a, simdi);
    const yeni = simdi - ilkGorulme.current.get(a)! < HAT_PAYI;
    const dusme = dustu.current.get(a);
    const payda = dusme !== undefined && simdi - dusme < HAT_PAYI;
    if (hattakiler.has(a) || yeni || payda) gorunen[Number(masaId)] = kayit;
  }
  // Kalkan işaretin kaydı siliniyor; aynı kişi masaya yeniden girince yeni sayılsın.
  const duran = new Set(Object.values(liste).map((k) => varlikAnahtari(k.masaId, k.kisiId)));
  for (const a of ilkGorulme.current.keys()) if (!duran.has(a)) ilkGorulme.current.delete(a);
  return gorunen;
}

// Modül kendi durumunu bellekte tutuyor: sıcak güncelleme yerine tam yenileme.
durumluModul(import.meta.hot);
