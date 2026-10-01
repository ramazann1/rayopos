import { useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ayarlar } from "../isletmeAyarlari";
import SaatKutusu from "./SaatKutusu";
import TarihKutusu, { gunMetni } from "./TarihKutusu";
import {
  BOS_FILTRE,
  DONEMLER,
  aralikMetni,
  donemAraligi,
  donemMetni,
  type DonemKodu,
} from "../analiz";

/**
 * Bütün raporların ortak tarih süzgeci. "Tüm zamanlar" yalnız seyrek dolan
 * defterlerde (stok, gider) sunuluyor; Analiz'de her şeyi birden çekmek
 * anlamsız ve ağır.
 */
export type Donem = { kod: "tumu" | DonemKodu; bas: string; bit: string };

const filtreyeCevir = (d: Donem) => ({
  ...BOS_FILTRE,
  donem: d.kod as DonemKodu,
  ozelBas: d.bas,
  ozelBit: d.bit,
});

export const donemAraligiKur = (d: Donem) =>
  d.kod === "tumu" ? undefined : donemAraligi(filtreyeCevir(d));

export const donemAdi = (d: Donem) =>
  d.kod === "tumu" ? "Tüm zamanlar" : donemMetni(filtreyeCevir(d));

/** Seçili aralığın saatli yazısı; "Tüm zamanlar"da boş. */
export const donemAralikMetni = (d: Donem) => {
  const a = donemAraligiKur(d);
  return a ? aralikMetni(a.bas, a.bit) : "";
};

const gunKaydir = (gun: string, fark: number) => {
  const t = new Date(`${gun}T12:00`);
  t.setDate(t.getDate() + fark);
  return gunMetni(t);
};

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Bitiş saati başlangıçtan küçük ya da ona eşitse aralık ertesi sabaha
 * uzanıyor — kasa günü 08:45'te açılıp 07:55'te kapanıyorsa 25 Eylül'ün
 * kasa günü 26 Eylül sabahı biter.
 */
const bitisGunu = (gun: string, basSaat: string, bitSaat: string) =>
  bitSaat <= basSaat ? gunKaydir(gun, 1) : gun;

function baslangicDurumu(d: Donem) {
  const a = ayarlar();
  if (d.kod === "ozel" && d.bas.includes("T") && d.bit.includes("T")) {
    const [basGun, basSaat] = d.bas.split("T");
    const [bitTarih, bitSaat] = d.bit.split("T");
    const bitGun = bitSaat <= basSaat ? gunKaydir(bitTarih, -1) : bitTarih;
    return { basGun, bitGun, basSaat, bitSaat };
  }
  const bugun = gunMetni(new Date());
  return {
    basGun: d.kod === "ozel" && d.bas ? d.bas : bugun,
    bitGun: d.kod === "ozel" && d.bit ? d.bit : bugun,
    basSaat: a.kasaGunuBaslangic,
    bitSaat: a.kasaGunuBitis,
  };
}

const GUN_ADLARI =["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

export function DonemPenceresi({
  donem,
  onSec,
  onKapat,
  tumu = true,
}: {
  donem: Donem;
  onSec: (d: Donem) => void;
  onKapat: () => void;
  tumu?: boolean;
}) {
  const ilk = baslangicDurumu(donem);
  const [ozel, setOzel] = useState(donem.kod === "ozel");
  const [basGun, setBasGun] = useState(ilk.basGun);
  const [bitGun, setBitGun] = useState<string | null>(ilk.bitGun);
  const [basSaat, setBasSaat] = useState(ilk.basSaat);
  const [bitSaat, setBitSaat] = useState(ilk.bitSaat);
  const [ay, setAy] = useState(() => {
    const t = new Date(`${ilk.basGun}T12:00`);
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const [ayListesi, setAyListesi] = useState(false);

  const secenekler = [
    ...(tumu ? [{ kod: "tumu" as const, ad: "Tüm zamanlar" }] : []),
    ...DONEMLER.filter((d) => d.kod !== "ozel"),
  ];

  const gunSec = (gun: string) => {
    if (bitGun !== null || gun < basGun) {
      setBasGun(gun);
      setBitGun(null);
    } else {
      setBitGun(gun);
    }
  };

  const sonGun = bitGun ?? basGun;
  const saatlerGecerli = SAAT.test(basSaat) && SAAT.test(bitSaat);
  const bitTarih = saatlerGecerli ? bitisGunu(sonGun, basSaat, bitSaat) : sonGun;

  const uygula = () =>
    onSec({ kod: "ozel", bas: `${basGun}T${basSaat}`, bit: `${bitTarih}T${bitSaat}` });

  // Ay ızgarası pazartesiden başlıyor; baştaki boşluk ayın ilk gününe kadar.
  const bosluk = (ay.getDay() + 6) % 7;
  const gunSayisi = new Date(ay.getFullYear(), ay.getMonth() + 1, 0).getDate();
  const bugun = gunMetni(new Date());
  const ayKaydir = (fark: number) => setAy(new Date(ay.getFullYear(), ay.getMonth() + fark, 1));

  const ayaGit = (gun: string) => {
    const t = new Date(`${gun}T12:00`);
    setAy(new Date(t.getFullYear(), t.getMonth(), 1));
    setAyListesi(false);
  };

  const basYaz = (gun: string) => {
    setBasGun(gun);
    if (sonGun < gun) setBitGun(gun);
    ayaGit(gun);
  };

  // Kutuya yazılan bitişin tarihi; gece yarısını aşan kasa gününde bu,
  // bir önceki günün kasa günü demek.
  const bitYaz = (tarih: string) => {
    const gun = SAAT.test(bitSaat) && bitSaat <= basSaat ? gunKaydir(tarih, -1) : tarih;
    setBitGun(gun < basGun ? basGun : gun);
    ayaGit(gun);
  };

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal ts-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><CalendarDays size={20} /></span>
          <h3>Tarihe göre süz</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={20} /></button>
        </header>

        <div className="ts-hazir">
          {secenekler.map((s) => (
            <button
              key={s.kod}
              className={!ozel && donem.kod === s.kod ? "secili" : ""}
              onClick={() => onSec({ kod: s.kod, bas: "", bit: "" })}
            >
              {s.ad}
            </button>
          ))}
          <button className={ozel ? "secili" : ""} onClick={() => setOzel(true)}>
            Özel aralık
          </button>
        </div>

        {ozel && (
          <div className="ts-ozel">
            <div className="ts-takvim">
              <div className="ts-ay">
                <button
                  aria-label={ayListesi ? "Önceki yıl" : "Önceki ay"}
                  onClick={() => ayKaydir(ayListesi ? -12 : -1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button className="ts-ay-ad" onClick={() => setAyListesi(!ayListesi)}>
                  {ayListesi
                    ? ay.getFullYear()
                    : ay.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                </button>
                <button
                  aria-label={ayListesi ? "Sonraki yıl" : "Sonraki ay"}
                  onClick={() => ayKaydir(ayListesi ? 12 : 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              {ayListesi ? (
                <div className="ts-aylar">
                  {Array.from({ length: 12 }, (_, i) => {
                    const t = new Date(ay.getFullYear(), i, 1);
                    return (
                      <button
                        key={i}
                        className={i === ay.getMonth() ? "secili" : ""}
                        onClick={() => {
                          setAy(t);
                          setAyListesi(false);
                        }}
                      >
                        {t.toLocaleDateString("tr-TR", { month: "long" })}
                      </button>
                    );
                  })}
                </div>
              ) : (
              <div className="ts-izgara">
                {GUN_ADLARI.map((g) => (
                  <span key={g} className="ts-gun-adi">{g}</span>
                ))}
                {Array.from({ length: bosluk }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: gunSayisi }, (_, i) => {
                  const gun = gunMetni(new Date(ay.getFullYear(), ay.getMonth(), i + 1));
                  const uc = gun === basGun || gun === sonGun;
                  const ara = gun > basGun && gun < sonGun;
                  const sinif = ["ts-gun", uc && "uc", ara && "ara", gun === bugun && "bugun"]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button key={gun} className={sinif} onClick={() => gunSec(gun)}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            <div className="ts-saatler">
              <label>
                <span>Başlangıç</span>
                <div>
                  <TarihKutusu gun={basGun} degis={basYaz} />
                  <SaatKutusu deger={basSaat} degis={setBasSaat} />
                </div>
              </label>
              <label>
                <span>Bitiş</span>
                <div>
                  <TarihKutusu gun={bitTarih} degis={bitYaz} />
                  <SaatKutusu deger={bitSaat} degis={setBitSaat} />
                </div>
              </label>
              <button className="up-tus ts-uygula" disabled={!saatlerGecerli} onClick={uygula}>
                <Check size={16} /> Uygula
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
