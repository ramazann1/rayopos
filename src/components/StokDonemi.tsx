import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  Check,
  ClipboardCheck,
  History,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { BOS_FILTRE, DONEMLER, donemAraligi, donemMetni, type DonemKodu } from "../analiz";

/** Hareket türünün ikonu — defter, fiş ve malzeme geçmişi aynı dili konuşsun. */
export function StokTipIkonu({ tip, boy = 17 }: { tip: string; boy?: number }) {
  if (tip === "giris") return <ArrowDownLeft size={boy} />;
  if (tip === "fire") return <Trash2 size={boy} />;
  if (tip === "cikis") return <ArrowUpRight size={boy} />;
  if (tip === "sayim") return <ClipboardCheck size={boy} />;
  if (tip === "satis") return <ShoppingBag size={boy} />;
  return <History size={boy} />;
}

/**
 * Stok ekranlarının dönemi. Liste Analiz'dekinin aynısı; başına "Tüm
 * zamanlar" ekleniyor — stok defteri seyrek dolan bir defter, açılışta her
 * şeyi göstermek "bugün"e daraltıp boş ekranla karşılamaktan iyi.
 */
export type StokDonemi = { kod: "tumu" | DonemKodu; bas: string; bit: string };

const filtreyeCevir = (d: StokDonemi) => ({
  ...BOS_FILTRE,
  donem: d.kod as DonemKodu,
  ozelBas: d.bas,
  ozelBit: d.bit,
});

export const donemAraligiKur = (d: StokDonemi) =>
  d.kod === "tumu" ? undefined : donemAraligi(filtreyeCevir(d));

export const donemAdi = (d: StokDonemi) =>
  d.kod === "tumu" ? "Tüm zamanlar" : donemMetni(filtreyeCevir(d));

const gunMetni = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

/** Tarih süzgeci — Gruba göre süz penceresiyle aynı kart ızgarası. */
export function DonemPenceresi({
  donem,
  onSec,
  onKapat,
}: {
  donem: StokDonemi;
  onSec: (d: StokDonemi) => void;
  onKapat: () => void;
}) {
  const bugun = gunMetni(new Date());
  const [bas, setBas] = useState(donem.bas || bugun);
  const [bit, setBit] = useState(donem.bit || bugun);
  const [ozel, setOzel] = useState(donem.kod === "ozel");

  const secenekler = [
    { kod: "tumu" as const, ad: "Tüm zamanlar" },
    ...DONEMLER.filter((d) => d.kod !== "ozel"),
  ];

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal stok-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><CalendarDays size={17} /></span>
          <h3>Tarihe göre süz</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
        </header>

        <div className="bs-izgara">
          {secenekler.map((s) => (
            <button
              key={s.kod}
              className={!ozel && donem.kod === s.kod ? "bs-kart secili" : "bs-kart"}
              onClick={() => onSec({ kod: s.kod, bas: "", bit: "" })}
            >
              <span className="bs-kart-im">
                {s.kod === "tumu" ? <History size={19} /> : <CalendarDays size={19} />}
              </span>
              <span className="bs-kart-ad">{s.ad}</span>
            </button>
          ))}
          <button
            className={ozel ? "bs-kart secili" : "bs-kart"}
            onClick={() => setOzel(true)}
          >
            <span className="bs-kart-im"><CalendarRange size={19} /></span>
            <span className="bs-kart-ad">Özel aralık</span>
          </button>
        </div>

        {ozel && (
          <div className="donem-ozel">
            <label>
              <span>Başlangıç</span>
              <input type="date" value={bas} max={bit} onChange={(e) => setBas(e.target.value)} />
            </label>
            <label>
              <span>Bitiş</span>
              <input type="date" value={bit} min={bas} onChange={(e) => setBit(e.target.value)} />
            </label>
            <button
              className="up-tus kaydet"
              disabled={!bas || !bit || bas > bit}
              onClick={() => onSec({ kod: "ozel", bas, bit })}
            >
              <Check size={16} /> Uygula
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
