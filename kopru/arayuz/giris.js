const uyari = document.getElementById("uyari");
const haneler = document.getElementById("haneler");
const bekleme = document.getElementById("bekleme");

ikonlariYerlestir();

const uyariGoster = (metin) => {
  uyari.textContent = metin;
  uyari.classList.toggle("acik", Boolean(metin));
};

// Köprünün bağlantısı RayoPOS'tan kaldırıldıysa sebebi adres satırıyla geliyor.
const acilisUyarisi = new URLSearchParams(location.search).get("hata") ?? "";

// Köprü kodu dokuz dakikada bir yeniliyor (bkz. eslesme.js); sayaç yeni kod
// geldiği andan geriye sayıyor.
const KOD_OMRU = 9 * 60;
let bitis = 0;

function sayac() {
  if (!bitis) return;
  const kalan = Math.max(0, Math.round((bitis - Date.now()) / 1000));
  const dakika = Math.floor(kalan / 60);
  const saniye = String(kalan % 60).padStart(2, "0");
  bekleme.textContent = `Onay bekleniyor · ${dakika}:${saniye}`;
}
setInterval(sayac, 1000);

function haneleriCiz(kod) {
  const rakamlar = (kod ?? "------").split("");
  haneler.replaceChildren(
    ...rakamlar.flatMap((r, i) => {
      const hane = document.createElement("span");
      hane.textContent = r === "-" ? "" : r;
      if (i !== 3) return [hane];
      const ara = document.createElement("span");
      ara.className = "ara";
      return [ara, hane];
    })
  );
}

const kodGoster = ({ kod, hata }) => {
  haneleriCiz(kod);
  uyariGoster(hata || acilisUyarisi);
  if (kod) {
    bitis = Date.now() + KOD_OMRU * 1000;
    sayac();
  } else {
    bitis = 0;
    bekleme.textContent = "Kod alınıyor";
  }
};

haneleriCiz(null);
kopru.kodAl().then(kodGoster);
kopru.kodDinle(kodGoster);

kopru.kunye().then(({ bilgisayar, surum }) => {
  document.getElementById("bilgisayar").textContent = bilgisayar;
  document.getElementById("surum").textContent = `v${surum}`;
});
