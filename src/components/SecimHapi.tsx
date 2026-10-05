import { ArrowRightLeft, Combine, LockOpen, X } from "lucide-react";
import type { SecimTipi } from "../salonSecimi";

const FIILLER: Record<SecimTipi, string> = {
  tasi: "taşınıyor",
  kalem: "taşınıyor",
  birlestir: "birleştiriliyor",
  aktif: "açılıyor",
};

type Props = {
  tip: SecimTipi;
  /** Taşınan şeyin adı: masa ya da ürün. */
  ad: string;
  onVazgec: () => void;
};

/**
 * Seçim kipinin göstergesi: hangi işin ortasında olunduğunu tek satırda
 * söylüyor, hiçbir masanın üstünü kapatmıyor. Masaüstü ve telefon aynısını
 * kullanıyor.
 */
export default function SecimHapi({ tip, ad, onVazgec }: Props) {
  return (
    <div className="secim-hapi">
      {tip === "birlestir" ? (
        <Combine size={16} />
      ) : tip === "aktif" ? (
        <LockOpen size={16} />
      ) : (
        <ArrowRightLeft size={16} />
      )}
      <strong>
        {ad} {FIILLER[tip]}
      </strong>
      <em>· masa seçin</em>
      <button aria-label="Vazgeç" onClick={onVazgec}>
        <X size={16} />
      </button>
    </div>
  );
}
