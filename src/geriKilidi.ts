import { useEffect, useRef } from "react";

/**
 * Tarayıcının ve telefonun geri hareketi (geri tuşu, kenardan kaydırma)
 * kaydedilmemiş değişiklik varken sayfadan çıkarmasın.
 *
 * Geri hareketi durdurulamıyor, yalnız sonradan haber alınıyor. Bu yüzden
 * değişiklik başlayınca geçmişe aynı adreste bir adım daha ekleniyor: geri
 * basılınca o adım harcanıyor, sayfa yerinde kalıyor ve soru soruluyor.
 * Değişiklik kaydedilince fazladan adım geri alınıyor; yoksa sonraki geri
 * hareketi iki basış isterdi.
 */
// Kilidin kendi geri aldığı adım da tarayıcıdan "geri basıldı" olarak dönüyor;
// o sırada kilit yeniden kurulduysa kullanıcı basmış sanılıp soru açılıyordu.
let kendiGeriAdimi = false;

export function useGeriKilidi(kirli: boolean, onGeri: () => void) {
  const sor = useRef(onGeri);
  sor.current = onGeri;

  useEffect(() => {
    if (!kirli) return;
    const adim = () => window.history.pushState({ ...window.history.state, geriKilidi: true }, "");
    adim();

    const geriBasildi = () => {
      if (kendiGeriAdimi) {
        kendiGeriAdimi = false;
        return;
      }
      adim();
      sor.current();
    };
    window.addEventListener("popstate", geriBasildi);

    return () => {
      window.removeEventListener("popstate", geriBasildi);
      // Sayfadan çıkılırken geçmişin başında artık yeni sayfa duruyor; adım
      // yalnız hâlâ bu sayfadaysak (kaydedildiyse) geri alınıyor.
      if (window.history.state?.geriKilidi) {
        kendiGeriAdimi = true;
        window.history.back();
        // Olay kimse dinlemezken gelirse işaret sonraki gerçek basışı yutmasın.
        setTimeout(() => (kendiGeriAdimi = false), 500);
      }
    };
  }, [kirli]);
}
