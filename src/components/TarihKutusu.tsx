import { useEffect, useState } from "react";

export const gunMetni = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

const tarihYaz = (gun: string) =>
  new Date(`${gun}T12:00`).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Yazılan rakamlar bir tarihe varabilir mi: gün 31'i, ay 12'yi geçemez,
 * ayın gün sayısı aşılamaz (şubat yıl yazılana kadar 29 sayılıyor), yıl
 * 2 ile başlar.
 */
function tarihOlabilir(r: string) {
  const gun = Number(r.slice(0, 2));
  const ay = Number(r.slice(2, 4));
  if (r[0] > "3") return false;
  if (r.length >= 2 && (gun < 1 || gun > 31)) return false;
  if (r.length >= 3 && r[2] > "1") return false;
  if (r.length >= 5 && r[4] !== "2") return false;
  if (r.length >= 4) {
    if (ay < 1 || ay > 12) return false;
    const yil = r.length === 8 ? Number(r.slice(4)) : 2024;
    if (gun > new Date(yil, ay, 0).getDate()) return false;
  }
  return true;
}

/** Yazarken noktaları kendisi koyuyor: 26092026 → 26.09.2026. */
function tarihMaskesi(yazi: string) {
  const r = yazi.replace(/\D/g, "").slice(0, 8);
  if (r.length <= 2) return r;
  if (r.length <= 4) return `${r.slice(0, 2)}.${r.slice(2)}`;
  return `${r.slice(0, 2)}.${r.slice(2, 4)}.${r.slice(4)}`;
}

/** "26.09.2026" ya da "26.09.26" yazısını gün metnine çeviriyor. */
function tarihOku(yazi: string) {
  const [g, a, y] = yazi.split(/[./\-\s]+/).map(Number);
  if (!g || !a || !y) return null;
  const yil = y < 100 ? 2000 + y : y;
  const t = new Date(yil, a - 1, g, 12);
  if (t.getDate() !== g || t.getMonth() !== a - 1) return null;
  return gunMetni(t);
}

/** Elle yazılabilen tarih kutusu; dışarıdan değişince kendini tazeliyor. */
export default function TarihKutusu({
  gun,
  degis,
  className = "ts-tarih",
  id,
}: {
  gun: string;
  degis: (gun: string) => void;
  className?: string;
  id?: string;
}) {
  const [yazi, setYazi] = useState(tarihYaz(gun));
  const [hatali, setHatali] = useState(false);

  useEffect(() => {
    setYazi(tarihYaz(gun));
    setHatali(false);
  }, [gun]);

  const bitir = () => {
    const okunan = tarihOku(yazi);
    if (!okunan) return setHatali(true);
    setHatali(false);
    setYazi(tarihYaz(okunan));
    if (okunan !== gun) degis(okunan);
  };

  return (
    <input
      id={id}
      className={hatali ? `${className} hatali` : className}
      inputMode="numeric"
      placeholder="gg.aa.yyyy"
      value={yazi}
      maxLength={10}
      onChange={(e) => {
        const yeni = tarihMaskesi(e.target.value);
        if (tarihOlabilir(yeni.replace(/\D/g, ""))) setYazi(yeni);
      }}
      onBlur={bitir}
      onKeyDown={(e) => e.key === "Enter" && bitir()}
    />
  );
}
