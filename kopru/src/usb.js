import { spawn } from "node:child_process";
import { varlik } from "./yerler.js";

/**
 * USB yazıcıya basma.
 *
 * Ağ yazıcısında yazıcıyla doğrudan konuşuyoruz; USB'de araya Windows giriyor.
 * Yazıcı işletim sistemine kurulu, köprü onu adıyla buluyor ve baytları
 * Windows'un yazdırma servisine "ham" olarak veriyor (bkz. ham-yazdir.ps1).
 * Bu yüzden USB yolu yalnız Windows'ta çalışıyor — ağ yazıcısı her yerde.
 */

const BETIK = varlik("ham-yazdir.ps1");

/**
 * İlk istekte betiğin açılıp sınıfı derlemesi birkaç saniye sürebiliyor;
 * sonrakiler kısa. Bu süreyi aşan servis takılmış sayılıyor (Windows
 * yazdırma servisi cevap vermiyor) ve kapatılıyor, sonraki istek yenisini açar.
 */
const ZAMAN_ASIMI = 20_000;

/** Açık duran PowerShell; fiş başına yeniden açılmıyor (bkz. ham-yazdir.ps1). */
let servis = null;

function servisiAc() {
  const surec = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", BETIK],
    { windowsHide: true }
  );
  const s = { surec, bekleyenler: new Map(), sira: 0, tampon: "", sorun: "" };

  surec.stdout.setEncoding("utf8");
  surec.stdout.on("data", (parca) => {
    s.tampon += parca;
    let son;
    while ((son = s.tampon.indexOf("\n")) >= 0) {
      const satir = s.tampon.slice(0, son).replace(/^﻿/, "").trim();
      s.tampon = s.tampon.slice(son + 1);
      let cevap;
      try {
        cevap = JSON.parse(satir);
      } catch {
        continue;
      }
      s.bekleyenler.get(cevap.no)?.(cevap);
    }
  });

  surec.stderr.setEncoding("utf8");
  surec.stderr.on("data", (parca) => {
    s.sorun = (s.sorun + parca).slice(-4000);
  });

  // Süreç düşerse bekleyen her istek hatayla dönüyor; sonraki istek yenisini açıyor.
  const kapandi = (hata) => {
    if (servis === s) servis = null;
    for (const bekleyen of s.bekleyenler.values()) bekleyen({ hata });
    s.bekleyenler.clear();
  };
  surec.once("error", () => kapandi("Windows yazdırma servisi çağrılamadı."));
  surec.once("close", () => kapandi(sadeHata(s.sorun)));
  surec.stdin.on("error", () => {
    /* süreç kapanırken yazılan satır; "close" zaten bekleyenleri bitiriyor */
  });

  return s;
}

/**
 * Betiğe bir istek. Yazıcı adı Türkçe harf taşıyabiliyor; satır ASCII'ye
 * kaçırılarak gönderiliyor ki konsolun kod sayfası adı bozmasın.
 */
function sor(istek) {
  if (!servis) servis = servisiAc();
  const s = servis;
  const no = ++s.sira;
  const satir = JSON.stringify({ no, ...istek }).replace(
    /[\u007f-￿]/g,
    (h) => "\\u" + h.charCodeAt(0).toString(16).padStart(4, "0")
  );

  return new Promise((tamam) => {
    const zaman = setTimeout(() => {
      s.bekleyenler.delete(no);
      s.surec.kill();
      tamam({ hata: "Windows yazdırma servisi cevap vermedi." });
    }, ZAMAN_ASIMI);

    s.bekleyenler.set(no, (cevap) => {
      clearTimeout(zaman);
      s.bekleyenler.delete(no);
      tamam(cevap);
    });
    s.surec.stdin.write(satir + "\n");
  });
}

/**
 * Yazıcı basmaya hazır mı.
 *
 * Windows yazıcı fişten çekilmiş olsa bile işi kuyruğuna alıp "aldım" diyor —
 * fiş çıkmadığı hâlde başarılı görünüyordu. Göndermeden önce yazıcının kendi
 * durumuna bakılıyor: kurulu mu, çevrimdışı mı, kâğıdı var mı.
 */
export async function usbDurumu(sistemAd) {
  if (process.platform !== "win32") {
    return { cevrimici: false, hata: "USB yazıcı yalnız Windows'ta çalışıyor." };
  }

  const durum = await sor({ islem: "durum", yazici: String(sistemAd) });
  if (durum.hata) return { cevrimici: false, hata: "Yazıcı durumu okunamadı." };

  if (!durum.kurulu) {
    return {
      cevrimici: false,
      hata: "Bu adda kurulu bir yazıcı yok — sistemdeki adı birebir yazılmalı.",
    };
  }

  if (durum.cevrimdisi) return { cevrimici: false, hata: "Yazıcı çevrimdışı (kapalı ya da kablosu çıkmış)." };

  // Windows'un hata tablosundan işletmecinin anlayacağı olanlar; gerisi tek
  // cümlede toplanıyor.
  const HATALAR = { 3: "Kapağı açık.", 4: "Kâğıt sıkışmış.", 5: "Kâğıdı bitmiş.", 9: "Çevrimdışı." };
  const kod = durum.hataDurumu;
  if (kod && kod !== 2) {
    return { cevrimici: false, hata: HATALAR[kod] ?? "Yazıcı hata durumunda." };
  }

  return { cevrimici: true, hata: null };
}

export async function usbBas(sistemAd, baytlar) {
  if (process.platform !== "win32") {
    throw new Error("USB yazıcı yalnız Windows'ta çalışıyor.");
  }

  const durum = await usbDurumu(sistemAd);
  if (!durum.cevrimici) throw new Error(durum.hata);

  // ESC/POS baytlarında her değer var, metin satırına olduğu gibi konamıyor.
  const cevap = await sor({
    islem: "bas",
    yazici: String(sistemAd),
    veri: Buffer.from(baytlar).toString("base64"),
  });
  if (cevap.hata) throw new Error(sadeHata(cevap.hata));
}

/**
 * İşletim sistemine kurulu yazıcıların adları. RayoPOS tarayıcıda çalıştığı için
 * kasadaki yazıcı listesini göremiyor; adın birebir doğru yazılması gerektiğinden
 * liste buradan okunuyor.
 */
export async function kuruluYazicilar() {
  if (process.platform !== "win32") return [];

  const cikti = await powershell([
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name",
  ]);

  return cikti
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function powershell(argumanlar) {
  return new Promise((tamam, hata) => {
    const surec = spawn("powershell.exe", argumanlar, { windowsHide: true });

    let cikti = "";
    let sorun = "";
    surec.stdout.on("data", (p) => (cikti += p));
    surec.stderr.on("data", (p) => (sorun += p));

    surec.once("error", () => hata(new Error("Windows yazdırma servisi çağrılamadı.")));
    surec.once("close", (kod) => {
      if (kod === 0) return tamam(cikti);
      hata(new Error(sadeHata(sorun)));
    });
  });
}

/**
 * PowerShell hataları sayfalarca yığın dökümüyle geliyor; kuyruk ekranında
 * okunacak olan tek satır bizim yazdığımız cümle.
 */
function sadeHata(metin) {
  const satir = metin
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.includes("Yazıcı") || s.includes("Yazdırma") || s.includes("Sayfa") || s.includes("Veri"));

  if (satir?.includes("Yazıcı açılamadı")) {
    return "Bu adda kurulu bir yazıcı bulunamadı — sistemdeki adı birebir yazılmalı.";
  }
  return satir || "Windows yazıcıya gönderemedi.";
}
