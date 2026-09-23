import { Info } from "lucide-react";

/**
 * Ayarın ya da başlığın yanındaki küçük açıklama işareti. Açıklamayı satırın
 * altına yazmak ekranı metin yığınına çeviriyordu; bilgi duruyor ama yer
 * kaplamıyor.
 *
 * Dokunmatik kasada imleç yok, o yüzden tıklamayla da açılıyor (odaklanınca
 * balon görünüyor).
 *
 * `baslik` verilirse balonun üstünde mercan bir satır çıkıyor — açıklamanın
 * neye dair olduğu, okumadan önce belli olsun. Ayar satırlarında gerekmiyor:
 * orada zaten ayarın adı işaretin hemen solunda duruyor.
 */
export default function Ipucu({
  baslik,
  children,
}: {
  baslik?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="ipucu" tabIndex={0} role="note">
      <Info size={13} />
      <span className="ipucu-balon">
        {baslik && (
          <span className="ipucu-baslik">
            <Info size={14} />
            {baslik}
          </span>
        )}
        {children}
      </span>
    </span>
  );
}
