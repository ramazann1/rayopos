const bul = (ad) => document.getElementById(ad);

let sonDurum = null;
let kunye = { cihaz: "", bilgisayar: "", surum: "" };

ikonlariYerlestir();

const saat = (zaman) =>
  new Date(zaman).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// Yazıcının türü köprüye gelmiyor; adından tahmin ediliyor, bulunamazsa düz
// yazıcı ikonu.
function yaziciIkonu(ad) {
  const kucuk = ad.toLocaleLowerCase("tr-TR");
  if (kucuk.includes("mutfak")) return "mutfak";
  if (kucuk.includes("bar")) return "bar";
  if (kucuk.includes("kasa") || kucuk.includes("adisyon")) return "fis";
  return "yazici";
}

function yaziciSatiri(y) {
  const [hal, etiket] =
    y.durum === "webusb"
      ? ["", "Tarayıcıdan"]
      : y.durum === "bagli"
        ? ["acik", "Hazır"]
        : ["kapali", "Ulaşılamıyor"];

  const baglanti =
    y.durum === "webusb" ? "Tarayıcıdan USB" : y.baglanti === "usb" ? "USB" : y.ip || "Ağ";

  const kutu = document.createElement("div");
  kutu.className = `yazici ${hal}`;
  kutu.innerHTML =
    `<span class="yazici-im">${ikon(yaziciIkonu(y.ad), 22)}</span>` +
    `<span class="yazici-tur">Yazıcı</span>` +
    `<span class="yazici-ad"><strong></strong><span></span></span>` +
    `<span class="durum-etiket ${hal}"></span>`;
  kutu.querySelector("strong").textContent = y.ad;
  // Hata cümlesi satırı iki katına çıkarıyordu; üstüne gelince görünüyor.
  kutu.querySelector(".yazici-ad span").textContent = baglanti;
  if (y.hata) kutu.title = y.hata;
  kutu.querySelector(".durum-etiket").textContent = etiket;
  return kutu;
}

// "KASA kapalı" köprünün kendisi kapalıymış gibi okunuyordu; cümlede yazıcı
// olduğu açıkça söyleniyor.
const yaziciAdi = (ad) => (ad.toLocaleLowerCase("tr-TR").includes("yazıcı") ? ad : `${ad} yazıcısı`);

/**
 * Tek cümle. Sıra önemli: sunucu bağlantısı yoksa yazıcıların durumu zaten
 * anlamsız, önce o söyleniyor.
 */
function nabiz(durum) {
  if (durum.bulut !== "bagli") {
    return { hal: "kapali", baslik: "Sunucuya ulaşılamıyor", alt: durum.bulutHata || "Yeniden deneniyor" };
  }

  const basanlar = durum.yazicilar.filter((y) => y.durum !== "webusb");
  const kapali = basanlar.filter((y) => y.durum !== "bagli");

  if (!basanlar.length) {
    return { hal: "bekliyor", baslik: "Yazıcı bekleniyor", alt: "RayoPOS'ta bu kasaya yazıcı tanımlanmamış" };
  }
  if (kapali.length === basanlar.length) {
    return { hal: "kapali", baslik: "Yazıcılara ulaşılamıyor", alt: kapali.map((y) => y.ad).join(", ") };
  }
  if (kapali.length === 1) {
    return { hal: "bekliyor", baslik: `${yaziciAdi(kapali[0].ad)} kapalı`, alt: "Diğer yazıcılar basıyor" };
  }
  if (kapali.length) {
    return { hal: "bekliyor", baslik: `${kapali.length} yazıcı kapalı`, alt: kapali.map((y) => y.ad).join(", ") };
  }
  return { hal: "acik", baslik: "Her şey yolunda", alt: `${basanlar.length} yazıcı hazır` };
}

function ciz(durum) {
  sonDurum = durum;
  if (!durum) return;

  const n = nabiz(durum);
  bul("nabiz").className = `nabiz ${n.hal}`;
  bul("nabizBaslik").textContent = n.baslik;
  bul("nabizAlt").textContent = n.alt;

  const isletme = durum.oturum?.isletme || "—";
  bul("isletme").textContent = isletme;

  const yazicilar = bul("yazicilar");
  if (!durum.yazicilar.length) {
    const bos = document.createElement("p");
    bos.className = "bos";
    bos.textContent = "Henüz yazıcı yok ya da ilk yoklama sürüyor.";
    yazicilar.replaceChildren(bos);
  } else {
    yazicilar.replaceChildren(...durum.yazicilar.map(yaziciSatiri));
  }

  const bagli = durum.bulut === "bagli";
  const sunucu = bul("sunucu");
  sunucu.className = bagli ? "sunucu" : "sunucu kapali";
  sunucu.innerHTML = ikon(bagli ? "bulut" : "bulutYok", 15);
  sunucu.append(bagli ? "Sunucuya bağlı" : "Sunucuya bağlı değil");

  bul("bIsletme").textContent = durum.oturum?.kod ? `${isletme} · ${durum.oturum.kod}` : isletme;}

/** Destek hattına yapıştırılacak özet — tek tek yazdırmaya gerek kalmıyor. */
function ozetMetni() {
  const d = sonDurum;
  if (!d) return "";

  const satirlar = [
    "RayoPOS Kasa Köprüsü",
    `İşletme : ${d.oturum?.isletme ?? "-"} (${d.oturum?.kod ?? "-"})`,
    `Cihaz   : ${d.cihaz}`,
    `Sürüm   : ${d.surum}`,
    `Sunucu  : ${d.bulut === "bagli" ? "bağlı" : `bağlantı yok (${d.bulutHata || "sebep yok"})`}`,
    `Yerel   : ${d.yerel === "acik" ? `açık (port ${d.yerelPort})` : "kapalı"}`,
    "Yazıcılar:",
    ...(d.yazicilar.length
      ? d.yazicilar.map((y) => `  ${y.ad}: ${y.durum}${y.hata ? ` (${y.hata})` : ""}`)
      : ["  yok"]),
    "Son işlemler:",
    ...d.kayitlar.slice(0, 15).map((k) => `  ${saat(k.saat)}  ${k.metin}`),
  ];
  return satirlar.join("\n");
}

kopru.kunye().then((k) => {
  kunye = k;
  bul("bBilgisayar").textContent = k.bilgisayar;
  bul("bSurum").textContent = k.surum;
});

kopru.durumAl().then(ciz);
kopru.durumDinle(ciz);

for (const dugme of document.querySelectorAll("[data-sekme]")) {
  dugme.onclick = () => {
    for (const d of document.querySelectorAll("[data-sekme]")) d.classList.toggle("secili", d === dugme);
    bul("durum").hidden = dugme.dataset.sekme !== "durum";
    bul("ayarlar").hidden = dugme.dataset.sekme !== "ayarlar";
  };
}

// Elle yoklama. Sürerken düğme kapalı ve ikonu dönüyor; sonuç satırlara
// kendiliğinden yansıyor.
bul("yokla").onclick = async (olay) => {
  const dugme = olay.currentTarget;
  dugme.disabled = true;
  try {
    await kopru.yazicilariYokla();
  } finally {
    dugme.disabled = false;
  }
};

bul("kopyala").onclick = async (olay) => {
  const dugme = olay.currentTarget;
  await kopru.kopyala(ozetMetni());
  dugme.lastChild.textContent = " Kopyalandı";
  setTimeout(() => (dugme.lastChild.textContent = " Bilgileri kopyala"), 1500);
};

bul("kes").onclick = () => (bul("onay").hidden = false);
bul("vazgec").onclick = () => (bul("onay").hidden = true);
bul("evet").onclick = () => kopru.baglantiyiKes();
