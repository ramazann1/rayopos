/**
 * Kasadaki köprüye doğrudan yazdırma.
 *
 * Bulut yolu (`yazdirma_kuyrugu`) internet istiyor; kasanın interneti gidince
 * yazıcı aynı odada olduğu hâlde kâğıt çıkmıyordu. Köprü kendi bilgisayarında
 * `127.0.0.1` üzerinde dinliyor: istek makineden dışarı çıkmadığı için
 * tarayıcı bu adresi güvenli sayıyor, sertifika gerekmiyor.
 *
 * Yalnız kasanın kendi ekranı için: tablet ya da telefon başka bir cihaz,
 * oradan `127.0.0.1` kasayı değil kendini gösterir. Cevap gelmezse yoklama
 * kapanıyor ve fiş eski yoldan gidiyor.
 */

import { isletmeAdi, isletmeKodu } from "./isletmeAyarlari";

const PORT = 7423;
const ADRES = `http://127.0.0.1:${PORT}`;

/** Köprü aynı makinede; cevap gelmiyorsa yok demektir, uzun beklenmiyor. */
const ZAMAN_ASIMI = 1500;
/** Yoklamanın tazeliği: her fişte sormak sipariş kaydını yavaşlatır. */
const YOKLAMA_OMRU = 30_000;

async function istek(yol: string, ayar?: RequestInit) {
  const durdurucu = new AbortController();
  const zaman = setTimeout(() => durdurucu.abort(), ZAMAN_ASIMI);
  try {
    const cevap = await fetch(ADRES + yol, { ...ayar, signal: durdurucu.signal });
    return (await cevap.json()) as {
      tamam?: boolean;
      hata?: string;
      cihaz?: string;
      isletme?: string;
      kod?: number | null;
    };
  } finally {
    clearTimeout(zaman);
  }
}

let sonYoklama = 0;
let kopru: { kod: number | null; isletme: string } | null = null;

/**
 * Köprü başka işletmeye bağlıysa (aynı bilgisayarda iki işletmeye girilince)
 * fişi ona vermenin anlamı yok: yazıcıyı tanımıyor. Fiş buluta gidiyor, ama
 * bu işletmenin kendi köprüsü yoksa hiç basılmıyor — kişi bunu her fişte
 * bilmeli.
 */
let uyusmazlikDinleyici: ((mesaj: string) => void) | null = null;

export function kopruUyusmazliginiDinle(dinleyici: (mesaj: string) => void) {
  uyusmazlikDinleyici = dinleyici;
  return () => {
    if (uyusmazlikDinleyici === dinleyici) uyusmazlikDinleyici = null;
  };
}

/**
 * Bu ekranın altında çalışan bir köprü var mı. Cevap kısa süre akılda
 * tutuluyor: köprü açılıp kapandığında en geç yarım dakikada fark ediliyor,
 * o arada her fiş için ayrıca yoklanmıyor.
 */
export async function yerelKopruVarMi() {
  if (Date.now() - sonYoklama >= YOKLAMA_OMRU) {
    sonYoklama = Date.now();
    try {
      const durum = await istek("/durum");
      kopru = durum.tamam === true ? { kod: durum.kod ?? null, isletme: durum.isletme ?? "" } : null;
    } catch {
      kopru = null;
    }
  }
  if (!kopru) return false;

  // Karşılaştırma yoklamadan ayrı, her fişte yapılıyor: sayfa açılırken
  // işletme kimliği henüz okunmamış olabiliyor, işletme de sonradan değişebiliyor.
  const kendiKodu = isletmeKodu();
  if (!kopru.kod || !kendiKodu || kopru.kod === kendiKodu) return true;

  uyusmazlikDinleyici?.(
    `Bu bilgisayardaki köprü "${kopru.isletme}" işletmesine bağlı. ` +
      `${isletmeAdi()} fişleri bu bilgisayardan basılmaz.`
  );
  return false;
}

export type YerelSonuc = { basildi: boolean; hata?: string };

/**
 * Fişi köprüye verir. Dönen `basildi` yalnız kâğıt çıktığında doğru; yazıcı
 * kapalıysa ya da köprü yoksa çağıran eski yola (bulut kuyruğu) düşüyor.
 */
export async function yerelBas(is: {
  kimlik: string;
  yaziciId: number;
  tip: string;
  icerik: string;
}): Promise<YerelSonuc> {
  if (!(await yerelKopruVarMi())) return { basildi: false };

  try {
    const cevap = await istek("/yazdir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(is),
    });
    return { basildi: cevap.tamam === true, hata: cevap.hata };
  } catch {
    // Köprü az önce kapanmış olabilir; bir sonraki fişte yeniden yoklansın.
    sonYoklama = 0;
    return { basildi: false };
  }
}
