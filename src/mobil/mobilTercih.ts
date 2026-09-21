import { useEffect, useState } from "react";
import { acikOturum, useOturum } from "../oturum";

/**
 * Mobil arayüz mü, masaüstü mü?
 *
 * Kararı işletmeci veriyor: personel kaydındaki "Arayüz" alanı. Varsayılan
 * "ekrana göre" — o hâlde eski davranış sürüyor, cihazın genişliğine bakılıyor.
 * Kasa bilgisayarı ve mutfak tableti geniş, garsonun telefonu dar. Genişlik tek
 * başına yetmiyordu: 10 inçlik tablette duran kasiyer mobile düşüyor, büyük
 * telefonla masa gezen garson masaüstüne.
 *
 * Cihazın kendi seçimi diye bir şey yok; kişi hangi cihaza girerse girsin kendi
 * arayüzünü açıyor.
 */
const SINIR = 820;

try {
  localStorage.removeItem("rayopos-gorunum");
} catch {
  /* depolama kapalıysa silinecek kayıt da yok */
}

export type Gorunum = "mobil" | "masaustu";

export function darEkran() {
  return window.innerWidth < SINIR;
}

export function gorunum(): Gorunum {
  const tercih = acikOturum()?.arayuz ?? "ekran";
  if (tercih === "mobil") return "mobil";
  if (tercih === "masaustu") return "masaustu";
  return darEkran() ? "mobil" : "masaustu";
}

export function useGorunum() {
  // Giren kişi değişince tercihi de değişiyor; oturuma abone olmak bu yüzden.
  const { oturum } = useOturum();
  const [dar, setDar] = useState(darEkran);

  useEffect(() => {
    // Tablet yan çevrilince sınırın öbür tarafına geçebiliyor.
    const tazele = () => setDar(darEkran());
    window.addEventListener("resize", tazele);
    return () => window.removeEventListener("resize", tazele);
  }, []);

  const tercih = oturum?.arayuz ?? "ekran";
  if (tercih === "mobil") return "mobil" as Gorunum;
  if (tercih === "masaustu") return "masaustu" as Gorunum;
  return (dar ? "mobil" : "masaustu") as Gorunum;
}
