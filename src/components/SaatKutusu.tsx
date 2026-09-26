import { useEffect, useState, type InputHTMLAttributes } from "react";

/**
 * Tarayıcının saat seçicisi yerine düz yazılan saat kutusu. İki nokta
 * kendiliğinden geliyor, olmayan saat (25, 60) yazılamıyor; tarih
 * süzgecindeki tarih kutusuyla aynı davranış.
 */

/** Yazılan rakamlar bir saate varabilir mi. */
function saatOlabilir(r: string) {
  if (r[0] > "2") return false;
  if (r.length >= 2 && Number(r.slice(0, 2)) > 23) return false;
  if (r.length >= 3 && r[2] > "5") return false;
  return true;
}

function saatMaskesi(yazi: string) {
  const r = yazi.replace(/\D/g, "").slice(0, 4);
  return r.length <= 2 ? r : `${r.slice(0, 2)}:${r.slice(2)}`;
}

export default function SaatKutusu({
  deger,
  degis,
  bosOlabilir,
  yazarken,
  className,
  ...kalan
}: {
  deger: string;
  degis: (saat: string) => void;
  /** Boş bırakılınca "" bildiriyor; ayarı kapatmanın yolu buysa. */
  bosOlabilir?: boolean;
  /** Her tuşta haber veriyor; saat tamamlanmadan önce de. */
  yazarken?: () => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [yazi, setYazi] = useState(deger);

  useEffect(() => setYazi(deger), [deger]);

  return (
    <input
      {...kalan}
      className={["saat-kutusu", className].filter(Boolean).join(" ")}
      inputMode="numeric"
      maxLength={5}
      placeholder="00:00"
      value={yazi}
      onChange={(e) => {
        const yeni = saatMaskesi(e.target.value);
        if (!saatOlabilir(yeni.replace(/\D/g, ""))) return;
        setYazi(yeni);
        yazarken?.();
        if (yeni.length === 5) degis(yeni);
      }}
      onBlur={(e) => {
        // Yarım bırakılan saat kaydedilmiyor, kutu son geçerli saate dönüyor.
        if (yazi === "" && bosOlabilir) {
          if (deger !== "") degis("");
        } else if (yazi.length !== 5) setYazi(deger);
        kalan.onBlur?.(e);
      }}
    />
  );
}
