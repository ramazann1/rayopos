import { ArrowRightLeft, Combine, X } from "lucide-react";

type Props = {
  tip: "tasi" | "birlestir" | "kalem";
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
      {tip === "birlestir" ? <Combine size={17} /> : <ArrowRightLeft size={17} />}
      <strong>
        {ad} {tip === "birlestir" ? "birleştiriliyor" : "taşınıyor"}
      </strong>
      <em>· masa seçin</em>
      <button aria-label="Vazgeç" onClick={onVazgec}>
        <X size={15} />
      </button>
    </div>
  );
}
