import { useLocation, useNavigate } from "react-router-dom";
import AramaKutusu from "./AramaKutusu";
import { stokBolumleri } from "./Duzen";
import BolumSecici from "./BolumSecici";
import { yolaGirebilir } from "../rotaYetkileri";

// Stok ekranlarının ortak başlığı — kasa ve ayarlarınkiyle aynı şerit deseni.
// Bölümler sırayla açılacak: bugün Malzemeler var, stok girişi/sayımı ve
// hareket defteri sonraki adımlarda buraya eklenecek.
export default function StokBasligi({
  ara,
  araDegistir,
  araYer,
}: {
  ara?: string;
  araDegistir?: (deger: string) => void;
  araYer?: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="menu-baslik">
      <div className="ayar-baslik-ust">
        <BolumSecici
          baslik="Stok"
          sekmeler={stokBolumleri
            .filter((b) => yolaGirebilir(b.yol))
            .map((b) => ({ kod: b.yol, ad: b.ad, ikon: b.ikon }))}
          secili={pathname}
          sec={(yol) => navigate(yol)}
        />
        {araDegistir && (
          <AramaKutusu deger={ara ?? ""} degistir={araDegistir} yer={araYer} />
        )}
      </div>
    </header>
  );
}
