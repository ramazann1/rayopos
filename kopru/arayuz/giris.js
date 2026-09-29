const uyari = document.getElementById("uyari");
const kod = document.getElementById("kod");

const uyariGoster = (metin) => {
  uyari.textContent = metin;
  uyari.classList.toggle("acik", Boolean(metin));
};

// Köprünün bağlantısı RayoPOS'tan kaldırıldıysa sebebi adres satırıyla geliyor.
const acilisUyarisi = new URLSearchParams(location.search).get("hata") ?? "";

// Kod üçerli gruplanıyor: 482915 yerine "482 915" okunup yazılması kolay.
const kodGoster = ({ kod: yeni, hata }) => {
  kod.textContent = yeni ? `${yeni.slice(0, 3)} ${yeni.slice(3)}` : "— — —";
  uyariGoster(hata || acilisUyarisi);
};

kopru.kodAl().then(kodGoster);
kopru.kodDinle(kodGoster);

kopru.kunye().then(({ cihaz, surum }) => {
  document.getElementById("cihaz").textContent = cihaz;
  document.getElementById("surum").textContent = `s${surum}`;
  document.getElementById("kopyala").onclick = () => kopru.kopyala(cihaz);
});
