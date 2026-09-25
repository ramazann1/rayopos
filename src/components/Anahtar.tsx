import Ipucu from "./Ipucu";

// Açık/kapalı ayarlar için ortak anahtar — menü tanımlarında çok yerde geçiyor.
export default function Anahtar({
  etiket,
  ipucu,
  bilgi,
  acik,
  degistir,
}: {
  etiket: string;
  ipucu?: string;
  /** Etiketin yanındaki "i" işaretinde duran açıklama; dar yerde satırı uzatmıyor. */
  bilgi?: string;
  acik: boolean;
  degistir: (deger: boolean) => void;
}) {
  return (
    <label className={acik ? "anahtar-satir acik" : "anahtar-satir"}>
      <span>
        {etiket}
        {/* İşarete dokunmak anahtarı çevirmesin: etiketin içinde duruyor. */}
        {bilgi && (
          <span className="anahtar-bilgi" onClick={(e) => e.preventDefault()}>
            <Ipucu>{bilgi}</Ipucu>
          </span>
        )}
        {ipucu && <small>{ipucu}</small>}
      </span>
      <input type="checkbox" checked={acik} onChange={(e) => degistir(e.target.checked)} />
      <em className="anahtar" />
    </label>
  );
}
