import { LayoutGrid, X } from "lucide-react";

/**
 * Masa ve sipariş işlem menüleri. Ortak kabukta (.up-fon / .up-modal):
 * telefonda da adisyon ve ödeme pencereleri gibi ortada kart.
 */
export default function IslemPenceresi({
  baslik,
  ozet,
  onKapat,
  children,
}: {
  baslik: string;
  ozet?: React.ReactNode;
  onKapat: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="up-fon ip-fon" onClick={onKapat}>
      <div className="up-modal ip-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust ip-ust">
          <span className="ip-simge">
            <LayoutGrid size={20} />
          </span>
          <div className="ip-baslik">
            <h3>{baslik}</h3>
            {ozet && <span className="ip-ozet">{ozet}</span>}
          </div>
          <button className="up-kapat" onClick={onKapat} aria-label="Kapat">
            <X size={20} />
          </button>
        </header>

        <div className="m-islemler ip-islemler">{children}</div>
      </div>
    </div>
  );
}
