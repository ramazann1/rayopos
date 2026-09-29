/**
 * Yazıcı programının (köprü) indirme bilgisi.
 *
 * Adres yalnız burada yazıyor — ekranlarda "İndir" düğmesi var, adres yok.
 * Yayın yeri ya da alan adı değişirse tek satır güncelleniyor, ekranlara
 * dokunulmuyor.
 *
 * Dosya GitHub'da "Release" olarak duruyor. Adres sürümsüz ve hep en son
 * yayınlananı veriyor: yeni köprü yüklendiğinde burada bir şey değişmiyor.
 */
export const KOPRU_INDIRME = {
  adres: "https://github.com/ramazann1/rayopos/releases/latest/download/rayopos-kopru-kurulum.exe",
  /** Dosya adreste duruyor mu; değilse kart sönük ve tıklanmıyor. */
  yayinda: true,
};
