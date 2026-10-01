import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

/**
 * Ekranın ortasında açılan form penceresi. Eski sağdan kayan çekmecenin
 * (.panel-fon/.ayar-panel) yerini alıyor; içerik ekranın kendisinde kalıyor,
 * kart, başlık ve alt düğme şeridi burada.
 */
export default function OrtaPencere({
  ikon: Ikon,
  baslik,
  aciklama,
  genislik = "orta",
  onKapat,
  alt,
  children,
}: {
  ikon: LucideIcon;
  baslik: ReactNode;
  aciklama?: ReactNode;
  genislik?: "dar" | "orta" | "genis" | "cok-genis";
  onKapat: () => void;
  alt?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pnc-fon" onClick={onKapat}>
      <div className={`pnc-pencere ${genislik}`} onClick={(e) => e.stopPropagation()}>
        <header className="pnc-ust">
          <span className="pnc-im"><Ikon size={20} /></span>
          <div>
            <h3>{baslik}</h3>
            {aciklama && <p>{aciklama}</p>}
          </div>
          <button className="pnc-kapat" onClick={onKapat} aria-label="Kapat"><X size={20} /></button>
        </header>
        <div className="pnc-govde">{children}</div>
        {alt && <footer className="pnc-alt">{alt}</footer>}
      </div>
    </div>
  );
}
