const { contextBridge, ipcRenderer } = require("electron");

/**
 * Pencere ile ana süreç arasındaki tek kapı. Pencerenin Node'a doğrudan
 * erişimi yok; yalnız buradaki sayılı işleri çağırabiliyor.
 *
 * Bu dosya CommonJS: ön yükleyici modül sözdizimini kabul etmiyor.
 */
contextBridge.exposeInMainWorld("kopru", {
  kodAl: () => ipcRenderer.invoke("kod"),
  kodDinle: (isle) => ipcRenderer.on("kod", (_olay, bilgi) => isle(bilgi)),
  durumAl: () => ipcRenderer.invoke("durum"),
  baglantiyiKes: () => ipcRenderer.invoke("baglantiyi-kes"),
  kunye: () => ipcRenderer.invoke("kunye"),
  yazicilariYokla: () => ipcRenderer.invoke("yazicilari-yokla"),
  kopyala: (metin) => ipcRenderer.invoke("kopyala", metin),
  durumDinle: (isle) => ipcRenderer.on("durum", (_olay, durum) => isle(durum)),
});
