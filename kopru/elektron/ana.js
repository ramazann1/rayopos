import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, Tray } from "electron";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SURUM } from "../src/surum.js";
import { kimlikOku, kimlikSil, kimlikYaz } from "./kimlik.js";

/**
 * RayoPOS Kasa Köprüsü — pencereli sürüm.
 *
 * Program ana pencere olarak yaşamıyor: ilk açılışta giriş penceresi çıkıyor,
 * girildikten sonra saat yanındaki simgeye iniyor. Kasadaki kişi bu programa
 * günde bir kez bakıyor; sürekli açık duran bir pencereye ihtiyacı yok. Pencere
 * kapatılınca program da kapanmıyor — X'e basıp fiş basmayı durdurmak kolay
 * olmamalı, çıkış yalnız tepsi menüsünden.
 */

const buDizin = dirname(fileURLToPath(import.meta.url));
const kopruKoku = join(buDizin, "..");

/**
 * Yazı tipi ve çizim kütüphanesi paketin içinden değil, yanındaki açık
 * klasörden okunuyor: kurulumda kaynak tek bir arşive (app.asar) giriyor, ama
 * ne Windows'un yazdırma betiği ne de çizim kütüphanesi arşivin içinden
 * okunabiliyor. Bu ikisi "unpacked" klasörde duruyor (bkz. package.json →
 * asarUnpack).
 *
 * Ayarlar ise Windows'un kullanıcı klasöründe: program klasörüne yazmak
 * yönetici yetkisi istiyor ve güncellemede silinip gidiyor.
 *
 * İkisi de motor yüklenmeden önce yazılmak zorunda — yerler.js/ayar.js açılışta
 * okuyor.
 */
// Klasör adı sabit yazılıyor: geliştirirken Electron adı package.json'daki
// "name"den türetiyor ve ayarlar başka klasöre düşüyor.
const ayarKlasoru = join(app.getPath("appData"), "RayoPOS Kasa Köprüsü");
app.setPath("userData", ayarKlasoru);

// Program eskiden Garso adıyla kuruluyordu. Eski klasördeki ayar dosyası
// taşınmazsa kasa yeniden eşleştirilmek zorunda kalır.
const eskiAyar = join(app.getPath("appData"), "Garso Kasa Köprüsü", "ayarlar.json");
const yeniAyar = join(ayarKlasoru, "ayarlar.json");
if (!existsSync(yeniAyar) && existsSync(eskiAyar)) {
  mkdirSync(ayarKlasoru, { recursive: true });
  copyFileSync(eskiAyar, yeniAyar);
}

process.env.RAYOPOS_KOK = app.isPackaged
  ? kopruKoku.replace("app.asar", "app.asar.unpacked")
  : kopruKoku;
process.env.RAYOPOS_AYAR_YOLU = join(app.getPath("userData"), "ayarlar.json");

const AYAR_YOLU = process.env.RAYOPOS_AYAR_YOLU;
const simge = (boy) => join(kopruKoku, "varliklar", `simge-${boy}.png`);

// İki köprü aynı kuyruğa bakarsa aynı fişi iki kez basma riski doğuyor.
if (!app.requestSingleInstanceLock()) app.quit();

let tepsi = null;
let pencere = null;
let durumPenceresi = null;
let motor = null;
let sonDurum = null;
let cikiliyor = false;

/** Pencerelerin ortak ayarları; ikisi de aynı ön yükleyiciden geçiyor. */
const pencereAyari = (genislik, yukseklik) => ({
  width: genislik,
  height: yukseklik,
  title: "RayoPOS Kasa Köprüsü",
  icon: nativeImage.createFromPath(simge(256)),
  autoHideMenuBar: true,
  backgroundColor: "#f5f6f8",
  show: false,
  webPreferences: {
    preload: join(buDizin, "onyuk.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
  },
});

/** Giriş penceresi: bağlantı kodunu gösteriyor, kurulumun elle yapılan tek adımı. */
function girisPenceresiAc(hata = "") {
  if (pencere && !pencere.isDestroyed()) {
    pencere.show();
    pencere.focus();
    return;
  }

  pencere = new BrowserWindow({
    ...pencereAyari(420, 620),
    resizable: false,
    maximizable: false,
  });

  pencere.loadFile(join(kopruKoku, "arayuz", "giris.html"), {
    query: hata ? { hata } : {},
  });
  pencere.once("ready-to-show", () => pencere.show());
  eslesmeyiBaslat();

  // Kapat düğmesi girişteyken programı gerçekten kapatıyor: henüz çalışan bir
  // köprü yok, tepsiye inecek bir şey de yok.
  pencere.on("closed", () => {
    pencere = null;
    if (!motor && !cikiliyor) app.quit();
  });
}

/**
 * Durum penceresi. Kapatılınca program kapanmıyor: köprü tepside çalışmaya
 * devam ediyor, X'e basıp fiş basmayı durdurmak kolay olmamalı.
 */
function durumPenceresiAc() {
  if (durumPenceresi && !durumPenceresi.isDestroyed()) {
    durumPenceresi.show();
    durumPenceresi.focus();
    return;
  }

  durumPenceresi = new BrowserWindow({ ...pencereAyari(720, 560), minWidth: 560, minHeight: 460 });
  durumPenceresi.loadFile(join(kopruKoku, "arayuz", "durum.html"));
  durumPenceresi.once("ready-to-show", () => durumPenceresi.show());
  durumPenceresi.on("closed", () => {
    durumPenceresi = null;
  });
}

/** Motoru başlatıyor; giriş bilgisi yanlışsa giriş penceresine dönülüyor. */
async function kopruyuBaslat(kimlik) {
  const { ayarlariTamamla } = await import("../src/ayar.js");
  const { motorBaslat } = await import("../src/motor.js");

  const ayar = ayarlariTamamla(kimlik);
  motor = await motorBaslat(ayar, ({ durum }) => {
    sonDurum = durum;
    tepsiyiTazele();
    // Durum penceresi canlı: yenile düğmesi yok, motor her haber verdiğinde
    // kendiliğinden tazeleniyor.
    if (durumPenceresi && !durumPenceresi.isDestroyed()) {
      durumPenceresi.webContents.send("durum", durum);
    }
  });
  sonDurum = motor.durumAl();
  tepsiyiTazele();
}

function tepsiyiKur() {
  if (tepsi) return;
  tepsi = new Tray(nativeImage.createFromPath(simge(32)));
  tepsi.on("double-click", () => (motor ? durumPenceresiAc() : girisPenceresiAc()));
  tepsiyiTazele();
}

/**
 * Köprünün tek cümlelik hâli. Durum penceresindeki nabız satırıyla aynı sıra:
 * sunucu yoksa yazıcıların durumu zaten anlamsız, önce o söyleniyor.
 */
function nabiz() {
  if (!motor) return { isik: "soluk", cumle: "Bağlı değil" };
  if (sonDurum?.bulut !== "bagli") return { isik: "kirmizi", cumle: "Sunucuya ulaşılamıyor" };

  const basanlar = (sonDurum.yazicilar ?? []).filter((y) => y.durum !== "webusb");
  const kapali = basanlar.filter((y) => y.durum !== "bagli");
  if (!basanlar.length) return { isik: "mercan", cumle: "Yazıcı bekleniyor" };
  if (kapali.length === basanlar.length) return { isik: "kirmizi", cumle: "Yazıcılara ulaşılamıyor" };
  if (kapali.length) return { isik: "mercan", cumle: `Basıyor · ${kapali.length} yazıcı kapalı` };
  return { isik: "yesil", cumle: "Fiş basmaya hazır" };
}

function tepsiyiTazele() {
  if (!tepsi) return;

  const oturum = sonDurum?.oturum;
  const { isik, cumle } = nabiz();
  const isikSimgesi = nativeImage.createFromPath(join(kopruKoku, "varliklar", `isik-${isik}.png`));

  tepsi.setToolTip(`RayoPOS Kasa Köprüsü\n${cumle}${oturum ? `\n${oturum.isletme}` : ""}`);
  tepsi.setContextMenu(
    Menu.buildFromTemplate([
      // Menünün ilk satırı durum: kasadaki kişi sağ tıkladığında aradığı cevap
      // bu. Tıklanabilir bırakılıyor — kapalı satırı Windows soluk çiziyor.
      {
        label: oturum ? `${cumle} · ${oturum.isletme}` : cumle,
        icon: isikSimgesi,
        click: () => (motor ? durumPenceresiAc() : girisPenceresiAc()),
      },
      { type: "separator" },
      { label: "Durum panelini aç", enabled: Boolean(motor), click: durumPenceresiAc },
      { label: "Yazıcıları yokla", enabled: Boolean(motor), click: () => motor?.yoklaSimdi() },
      { type: "separator" },
      { label: "Köprüyü kapat", click: cik },
    ])
  );
}

async function oturumuKapat() {
  await motor?.kapat();
  // Sunucuya ulaşılamasa da bağlantı kesiliyor; hesap o durumda RayoPOS'taki
  // listeden elle silinir.
  const { kendiniKaldir } = await import("../src/bulut.js");
  await kendiniKaldir().catch(() => {});
  motor = null;
  sonDurum = null;
  kimlikSil(AYAR_YOLU);
  durumPenceresi?.close();
  tepsiyiTazele();
  girisPenceresiAc();
}

/**
 * Çıkış. Kapanış haberi gidene kadar program açık tutuluyor: bu haber olmazsa
 * Bağlantı Durumu ekranı köprünün kapandığını ancak sessizlik sınırı dolunca
 * anlıyor, o zamana kadar "Çalışıyor" yazıyor.
 */
async function cik() {
  if (cikiliyor) return;
  cikiliyor = true;
  await motor?.kapat();
  app.quit();
}

// Bilgisayar kapanırken ya da program başka yoldan sonlandırılırken de haber
// gitmesi gerekiyor.
app.on("before-quit", (olay) => {
  if (!motor || cikiliyor) return;
  olay.preventDefault();
  cik();
});

/**
 * Eşleşme: giriş penceresi açıkken köprü kod alıp gösteriyor ve RayoPOS'tan
 * onay bekliyor. Onay gelince hesabın bilgileri kaydediliyor ve pencere
 * kendiliğinden kapanıyor; kasadaki kişinin burada bir şeye basması gerekmiyor.
 */
let eslesmeSuruyor = false;
let sonKod = { kod: null, hata: "" };

async function eslesmeyiBaslat() {
  if (eslesmeSuruyor) return;
  eslesmeSuruyor = true;

  const { eslestir } = await import("../src/eslesme.js");
  const bilgi = await eslestir({
    kodGeldi: (kod, hata) => {
      sonKod = { kod, hata: hata ?? "" };
      if (pencere && !pencere.isDestroyed()) pencere.webContents.send("kod", sonKod);
    },
    durduMu: () => cikiliyor || Boolean(motor),
  });
  eslesmeSuruyor = false;
  if (!bilgi) return;

  try {
    await kopruyuBaslat({ ...bilgi, yoklamaSaniye: 3 });
    kimlikYaz(AYAR_YOLU, bilgi);
    pencere?.close();
  } catch (e) {
    motor?.durdur();
    motor = null;
    sonKod = { kod: null, hata: e.message };
    eslesmeyiBaslat();
  }
}

ipcMain.handle("kod", () => sonKod);

// Durum panelinin Ayarlar sekmesinden, onay alındıktan sonra.
ipcMain.handle("baglantiyi-kes", oturumuKapat);

ipcMain.handle("durum", () => sonDurum);

// Yazıcı çalışırken takıldığında yoklama sırasını beklemesin diye elle yoklama.
ipcMain.handle("yazicilari-yokla", async () => {
  if (!motor) return { tamam: false, hata: "Köprü henüz açılmadı." };
  return motor.yoklaSimdi();
});

// Cihaz kimliği giriş penceresinde yazıyor: destek hattı "hangi kasa" sorusunu
// bununla ayırt ediyor.
ipcMain.handle("kunye", async () => {
  const { cihazKimligi } = await import("../src/ayar.js");
  return { cihaz: cihazKimligi(), bilgisayar: hostname(), surum: SURUM };
});

ipcMain.handle("kopyala", (_olay, metin) => clipboard.writeText(String(metin)));

// İkinci kez çalıştırılırsa yeni program açılmıyor, olan program kendini
// gösteriyor.
app.on("second-instance", () => (motor ? durumPenceresiAc() : girisPenceresiAc()));

// Bütün pencereler kapansa da program yaşamaya devam ediyor: köprü tepsiden
// çalışıyor.
app.on("window-all-closed", () => {});

/**
 * Bilgisayar açılınca köprü de açılıyor. Kasada bunu kimsenin elle yapması
 * beklenmiyor: köprü kapalıysa fişler sessizce sırada birikir, kimse fark
 * etmez. Kurulumda değil her açılışta bakılıyor — kayıt silinirse kendini
 * onarıyor.
 */
function baslangicaYaz() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  if (app.getLoginItemSettings().openAtLogin) return;
  app.setLoginItemSettings({ openAtLogin: true, args: ["--gizli"] });
}

app.whenReady().then(async () => {
  baslangicaYaz();
  tepsiyiKur();

  const kimlik = kimlikOku(AYAR_YOLU);
  if (!kimlik) {
    girisPenceresiAc();
    return;
  }
  acilistaBaglan(kimlik);
});

/**
 * Bilgisayar açılırken ağ çoğu zaman köprüden sonra geliyor. Sunucuya
 * ulaşılamadı diye kod ekranına düşülmüyor, yarım dakikada bir yeniden
 * deneniyor. Yalnız hesap RayoPOS'tan kaldırılmışsa yeniden eşleşme isteniyor.
 */
async function acilistaBaglan(kimlik) {
  try {
    await kopruyuBaslat(kimlik);
  } catch (e) {
    motor = null;
    if (e.kaldirildi) {
      kimlikSil(AYAR_YOLU);
      girisPenceresiAc(e.message);
      return;
    }
    setTimeout(() => acilistaBaglan(kimlik), 30_000);
  }
}
