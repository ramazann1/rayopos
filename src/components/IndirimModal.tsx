import { useEffect, useState } from "react";
import { BadgePercent, Banknote, Check, Delete, Percent, Tag, X } from "lucide-react";
import OnayModal from "./OnayModal";
import {
  indirimTanimlariniGetir,
  tanimTutari,
  type IndirimKaynagi,
  type IndirimTanimi,
} from "../indirimler";
import { yetkiVar } from "../oturum";
import { paraGoster, paraSayi } from "../para";

type Props = {
  baslik?: string;
  araToplam: number;
  mevcutIndirim: number;
  onKapat: () => void;
  onUygula: (tutar: number, kaynak?: IndirimKaynagi) => void;
};

const TUSLAR = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "sil"];

export default function IndirimModal({ baslik, araToplam, mevcutIndirim, onKapat, onUygula }: Props) {
  const serbest = yetkiVar("odeme.indirim");
  const [mod, setMod] = useState<"yuzde" | "tutar">("tutar");
  const [tutarGirdi, setTutarGirdi] = useState(
    mevcutIndirim > 0 ? String(mevcutIndirim).replace(".", ",") : "",
  );
  const [yuzdeGirdi, setYuzdeGirdi] = useState("");
  const [uyari, setUyari] = useState<string | null>(null);
  // Ön tanımlı indirimler; tanım yoksa pencere eskisi gibi yalnız serbest giriş.
  const [tanimlar, setTanimlar] = useState<IndirimTanimi[]>([]);
  const girdi = mod === "tutar" ? tutarGirdi : yuzdeGirdi;
  const setGirdi = (guncelle: (onceki: string) => string) =>
    mod === "tutar" ? setTutarGirdi(guncelle) : setYuzdeGirdi(guncelle);

  useEffect(() => {
    indirimTanimlariniGetir().then(setTanimlar);
  }, []);

  const hesapla = () => {
    const sayi = paraSayi(girdi) ?? 0;
    if (sayi <= 0) return 0;
    if (mod === "yuzde") return Math.round(araToplam * sayi) / 100;
    return sayi;
  };

  const uygula = () => {
    const tutar = hesapla();
    if (tutar > araToplam) { setUyari("İndirim toplam tutardan büyük olamaz"); return; }
    onUygula(tutar);
  };

  // Virgül bir kez, ardından en çok iki hane: kuruştan küçük indirim yok.
  const tusaBas = (t: string) => {
    if (t === "sil") { setGirdi((g) => g.slice(0, -1)); return; }
    setGirdi((g) => {
      if (t === ",") return g.includes(",") ? g : (g || "0") + ",";
      const [, kurus] = g.split(",");
      if (kurus != null && kurus.length >= 2) return g;
      return g === "0" ? t : g + t;
    });
  };

  const tutar = hesapla();

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal ind-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="ind-simge">
            <BadgePercent size={18} />
          </span>
          <h3>{baslik ?? "İndirim uygula"}</h3>
          <button className="up-kapat" onClick={onKapat} aria-label="Kapat">
            <X size={19} />
          </button>
        </header>

        <div className="ind-govde">
          {tanimlar.length > 0 && (
            <section>
              <span className="ind-etiket">Hazır indirimler</span>
              <div className="ind-tanimlar">
                {tanimlar.map((t) => (
                  <button
                    key={t.id}
                    className="ind-tanim"
                    onClick={() => onUygula(tanimTutari(t, araToplam), { id: t.id, ad: t.ad })}
                  >
                    <span className="ind-tanim-ikon">
                      <Tag size={16} />
                    </span>
                    <span className="ind-tanim-yazi">
                      <strong>{t.ad}</strong>
                      <span>{t.tip === "yuzde" ? `%${t.deger}` : paraGoster(t.deger)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Serbest indirim ayrı bir yetki: yalnız "ön tanımlı indirim" yetkisi
              olan kişi listeden seçer, kendi tutarını yazamaz. */}
          {serbest && (
            <section>
              {tanimlar.length > 0 && <span className="ind-etiket">Serbest indirim</span>}
              <div className="ind-mod">
                <button className={mod === "tutar" ? "secili" : ""} onClick={() => setMod("tutar")}>
                  <Banknote size={16} />
                  Tutar
                </button>
                <button className={mod === "yuzde" ? "secili" : ""} onClick={() => setMod("yuzde")}>
                  <Percent size={16} />
                  Yüzde
                </button>
              </div>

              <div className="ind-gosterge">
                <span className="ind-toplam">Toplam {paraGoster(araToplam)}</span>
                <strong className={girdi ? "" : "bos"}>
                  {mod === "yuzde" ? `%${girdi || "0"}` : `₺${girdi || "0"}`}
                </strong>
                <span className="ind-sonuc">
                  {mod === "yuzde" && tutar > 0
                    ? `${paraGoster(tutar)} indirim · kalan ${paraGoster(Math.max(0, araToplam - tutar))}`
                    : `Kalan ${paraGoster(Math.max(0, araToplam - tutar))}`}
                </span>
              </div>

              <div className="ind-tuslar">
                {TUSLAR.map((t) => (
                  <button key={t} onClick={() => tusaBas(t)} aria-label={t === "sil" ? "Sil" : undefined}>
                    {t === "sil" ? <Delete size={20} /> : t}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="ind-alt">
          <button className="ind-vazgec" onClick={onKapat}>Vazgeç</button>
          {serbest && (
            <button className="ind-uygula" onClick={uygula}>
              <Check size={17} />
              Uygula
            </button>
          )}
        </footer>
      </div>

      {uyari && <OnayModal mesaj={uyari} tekTus onKapat={() => setUyari(null)} />}
    </div>
  );
}
