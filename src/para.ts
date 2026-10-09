// Para alanları düzenlenirken metin olarak tutulur: her tuşta sayıya çevirip geri
// yazsaydık "12." yazarken nokta silinir, kuruşlu fiyat girilemezdi. Virgül de
// kabul ediliyor — klavyede virgül daha yakın.

export const paraMetin = (v?: number) => (v == null ? "" : String(v));

export const paraSayi = (s: string) => {
  const temiz = s.replace(",", ".").trim();
  return temiz === "" ? undefined : Number(temiz) || 0;
};

export const paraYaz = (s: string) => s.replace(/[^0-9.,]/g, "");

// Ekranda gösterilen tutar her yerde kuruşlu ve Türkçe biçimli olsun: 1110 değil
// "₺1.110,00". Toplam ile döküm arasında biçim farkı kalmıyor.
// Eksi işaret simgenin önünde: "₺-85,00" değil "−₺85,00".
export const paraGoster = (v: number) =>
  (v < 0 ? "−" : "") +
  "₺" +
  Math.abs(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Dar yerde para: kuruş sıfırsa yazılmıyor ("₺1.240"), varsa yazılıyor.
 * Yalnız rakamın sığması gereken yerde (telefondaki masa kartı); geri kalan
 * her yer `paraGoster`.
 */
export const paraKisa = (v: number) =>
  Math.round(v * 100) % 100 === 0
    ? (v < 0 ? "−" : "") + "₺" + Math.abs(Math.round(v)).toLocaleString("tr-TR")
    : paraGoster(v);

// Adet buçuklu olabiliyor (yarım porsiyon, tartılan ürün). Tam sayıda ondalık
// gösterilmiyor: "1" yazması gerekirken "1,0" yazması rakamı ağırlaştırıyor.
export const adetGoster = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
