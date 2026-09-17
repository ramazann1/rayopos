const CIHAZ_ANAHTARI = "rayopos-cihaz";

function uret() {
  // randomUUID güvenli bağlantı ister; kasa her zaman HTTPS'te ama
  // olmadığı bir yerde program durmasın diye basit bir karşılığı var.
  if (crypto.randomUUID) return crypto.randomUUID();
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Bu cihazın kimliği. Sunucu "şu an kim çalışıyor" bilgisini hesaba değil
 * cihaza bağlıyor: aynı hesapla giren kasa ile garson telefonu tek satırı
 * paylaşırsa, birinde PIN'le kişi değiştirmek diğerinin kimliğini ve
 * yetkilerini de değiştiriyor (18 Eyl 2026).
 *
 * Kimlik tarayıcıda kalıcı duruyor. Silinirse cihaz yeni sayılır — zararı
 * yalnız bir kez daha PIN girmek.
 */
export const cihazKimligi = (() => {
  let kimlik: string;
  try {
    kimlik = localStorage.getItem(CIHAZ_ANAHTARI) ?? uret();
    localStorage.setItem(CIHAZ_ANAHTARI, kimlik);
  } catch {
    // Gizli pencerede depolama kapalı olabiliyor. Kimlik o sekme yaşadığı
    // sürece geçerli: kişi ayrımı yine doğru çalışıyor, yalnız sekme
    // kapanınca cihaz yeni sayılıyor.
    kimlik = uret();
  }
  return kimlik;
})();
