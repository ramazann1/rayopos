import { useEffect, useRef, useState } from "react";

/** Üstte özet şeridi gibi bölümler olduğunda kutu daralmasın diye taban değer. */
const ASGARI = 520;

/**
 * Uzun tablolar sayfayı uzatmasın: kutu ekranda kendisine kalan yeri alıyor,
 * liste onun içinde kayıyor. Alt kenar — yatay kaydırma çubuğuyla birlikte —
 * hep görünür kalıyor, ona ulaşmak için sayfayı aşağı kaydırmak gerekmiyor.
 *
 * `tetik` liste uzunluğu gibi kutunun yerini değiştirebilecek bir değer;
 * değişince yeniden ölçülüyor. `pay` kutunun altında kalması gereken boşluk,
 * `asgari` kutunun inebileceği en kısa boy.
 */
export function useKutuBoyu(tetik: unknown = null, { pay = 20, asgari = ASGARI } = {}) {
  const kutu = useRef<HTMLDivElement>(null);
  const [boy, setBoy] = useState(0);

  useEffect(() => {
    const olc = () => {
      const k = kutu.current;
      if (!k) return;
      const ustten = k.getBoundingClientRect().top + window.scrollY;
      setBoy(Math.max(asgari, window.innerHeight - ustten - pay));
    };
    olc();
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, [tetik, pay, asgari]);

  return { kutu, boy };
}
