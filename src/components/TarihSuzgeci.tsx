import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ayarlar } from "../isletmeAyarlari";
import SaatKutusu from "./SaatKutusu";
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

const gunMetni = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

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

const tarihYaz = (gun: string) =>
  new Date(`${gun}T12:00`).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Yazılan rakamlar bir tarihe varabilir mi: gün 31'i, ay 12'yi geçemez,
 * ayın gün sayısı aşılamaz (şubat yıl yazılana kadar 29 sayılıyor), yıl
 * 2 ile başlar.
 */
function tarihOlabilir(r: string) {
  const gun = Number(r.slice(0, 2));
  const ay = Number(r.slice(2, 4));
  if (r[0] > "3") return false;
  if (r.length >= 2 && (gun < 1 || gun > 31)) return false;
  if (r.length >= 3 && r[2] > "1") return false;
  if (r.length >= 5 && r[4] !== "2") return false;
  if (r.length >= 4) {
    if (ay < 1 || ay > 12) return false;
    const yil = r.length === 8 ? Number(r.slice(4)) : 2024;
    if (gun > new Date(yil, ay, 0).getDate()) return false;
  }
  return true;
}

/** Yazarken noktaları kendisi koyuyor: 26092026 → 26.09.2026. */
function tarihMaskesi(yazi: string) {
  const r = yazi.replace(/\D/g, "").slice(0, 8);
  if (r.length <= 2) return r;
  if (r.length <= 4) return `${r.slice(0, 2)}.${r.slice(2)}`;
  return `${r.slice(0, 2)}.${r.slice(2, 4)}.${r.slice(4)}`;
}

/** "26.09.2026" ya da "26.09.26" yazısını gün metnine çeviriyor. */
function tarihOku(yazi: string) {
  const [g, a, y] = yazi.split(/[./\-\s]+/).map(Number);
  if (!g || !a || !y) return null;
  const yil = y < 100 ? 2000 + y : y;
  const t = new Date(yil, a - 1, g, 12);
  if (t.getDate() !== g || t.getMonth() !== a - 1) return null;
  return gunMetni(t);
}

/** Elle yazılabilen tarih kutusu; takvimden seçilince kendini tazeliyor. */
function TarihKutusu({ gun, degis }: { gun: string; degis: (gun: string) => void }) {
  const [yazi, setYazi] = useState(tarihYaz(gun));
  const [hatali, setHatali] = useState(false);

  useEffect(() => {
    setYazi(tarihYaz(gun));
    setHatali(false);
  }, [gun]);

  const bitir = () => {
    const okunan = tarihOku(yazi);
    if (!okunan) return setHatali(true);
    setHatali(false);
    setYazi(tarihYaz(okunan));
    if (okunan !== gun) degis(okunan);
  };

  return (
    <input
      className={hatali ? "ts-tarih hatali" : "ts-tarih"}
      inputMode="numeric"
      value={yazi}
      maxLength={10}
      onChange={(e) => {
        const yeni = tarihMaskesi(e.target.value);
        if (tarihOlabilir(yeni.replace(/\D/g, ""))) setYazi(yeni);
      }}
      onBlur={bitir}
      onKeyDown={(e) => e.key === "Enter" && bitir()}
    />
  );
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
          <span className="stok-modal-im"><CalendarDays size={17} /></span>
          <h3>Tarihe göre süz</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
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
                  <ChevronLeft size={18} />
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
                  <ChevronRight size={18} />
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
