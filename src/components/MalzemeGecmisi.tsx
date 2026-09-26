import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, History, Tag, UserRound, X } from "lucide-react";
import { miktarGoster, type Malzeme } from "../stok";
import { malzemeGecmisi, sebepAdi, tipAdi, type GecmisSatiri } from "../stokHareket";
import { StokTipIkonu } from "./StokDonemi";
import {
  DonemPenceresi,
  donemAdi,
  donemAraligiKur,
  type Donem as StokDonemi,
} from "./TarihSuzgeci";

const TIP_SIRASI = ["giris", "satis", "fire", "cikis", "sayim"];

const zamanMetni = (t: string, saatli: boolean) =>
  new Date(t).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(saatli ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

/**
 * Tek malzemenin defteri. Yalnız bakmak için: düzeltme Hareketler
 * ekranından yapılıyor, burada düğme yok — geçmişe bakan kişi bir şeyi
 * kazara değiştirmesin.
 */
export default function MalzemeGecmisi({
  malzeme,
  onKapat,
}: {
  malzeme: Malzeme;
  onKapat: () => void;
}) {
  const [donem, setDonem] = useState<StokDonemi>({ kod: "buAy", bas: "", bit: "" });
  const [donemPenceresi, setDonemPenceresi] = useState(false);
  const [satirlar, setSatirlar] = useState<GecmisSatiri[] | null>(null);

  useEffect(() => {
    let gecerli = true;
    setSatirlar(null);
    malzemeGecmisi(malzeme.id, donemAraligiKur(donem)).then((s) => {
      if (gecerli) setSatirlar(s);
    });
    return () => {
      gecerli = false;
    };
  }, [malzeme.id, donem]);

  const imli = (m: number) =>
    `${m > 0 ? "+" : "−"}${miktarGoster(Math.abs(m), malzeme.birim)}`;

  // Dönemin tek satırlık hesabı: ne girdi, ne nereye gitti.
  const toplamlar = TIP_SIRASI.map((tip) => ({
    tip,
    miktar: (satirlar ?? []).filter((s) => s.tip === tip).reduce((t, s) => t + s.miktar, 0),
  })).filter((t) => t.miktar !== 0);

  return (
    <>
      <div className="up-fon" onClick={onKapat}>
        <div className="up-modal mg-modal" onClick={(e) => e.stopPropagation()}>
          <header className="mg-ust">
            <span className="mg-im"><History size={20} /></span>
            <div className="mg-ust-yazi">
              <h3>{malzeme.ad}</h3>
              <small>
                Şu an <b>{miktarGoster(malzeme.miktar, malzeme.birim)}</b>
              </small>
            </div>
            <button className="stok-yan-tus" onClick={() => setDonemPenceresi(true)}>
              <CalendarDays size={16} /> {donemAdi(donem)}
            </button>
            <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
          </header>

          {toplamlar.length > 0 && (
            <div className="mg-toplam">
              {toplamlar.map((t) => (
                <span key={t.tip} className={`mg-cip mg-${t.tip}`}>
                  <StokTipIkonu tip={t.tip} boy={14} />
                  {tipAdi(t.tip)}
                  <b>{imli(t.miktar)}</b>
                </span>
              ))}
            </div>
          )}

          <div className="mg-liste">
            {satirlar === null ? (
              <div className="yukleniyor"><div className="cember" /></div>
            ) : satirlar.length === 0 ? (
              <p className="mg-bos">{donemAdi(donem)} içinde bu malzemede hareket yok.</p>
            ) : (
              satirlar.map((s) => (
                <div key={s.anahtar} className={`mg-satir mg-${s.tip}`}>
                  <span className="mg-tip-im"><StokTipIkonu tip={s.tip} boy={16} /></span>
                  <span className="mg-ad">
                    {tipAdi(s.tip)}
                    <small>
                      {zamanMetni(s.zaman, s.tip !== "satis")}
                      {s.tip === "satis" && ` · ${s.adisyon} adisyon`}
                      {s.kisi && (
                        <>
                          {" · "}
                          <UserRound size={12} /> {s.kisi}
                        </>
                      )}
                      {sebepAdi(s.tip, s.sebep) && (
                        <>
                          {" · "}
                          <Tag size={12} /> {sebepAdi(s.tip, s.sebep)}
                        </>
                      )}
                    </small>
                  </span>
                  <span className="hrk-defter">
                    {s.onceki != null && (
                      <>
                        <b>{miktarGoster(s.onceki, malzeme.birim)}</b>
                        <ArrowRight size={14} />
                      </>
                    )}
                    <em className={s.miktar > 0 ? "arti" : "eksi"}>{imli(s.miktar)}</em>
                    {s.sonraki != null && (
                      <>
                        <ArrowRight size={14} />
                        <b className="sonuc">{miktarGoster(s.sonraki, malzeme.birim)}</b>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pencerenin dışında: içinde dursaydı dönem penceresine yapılan
          tıklama arka plana ulaşıp geçmişi de kapatırdı. */}
      {donemPenceresi && (
        <DonemPenceresi
          donem={donem}
          onSec={(d) => {
            setDonem(d);
            setDonemPenceresi(false);
          }}
          onKapat={() => setDonemPenceresi(false)}
        />
      )}
    </>
  );
}
