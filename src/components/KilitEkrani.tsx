import { useEffect, useState } from "react";
import { Delete, LockKeyhole, LogOut, WifiOff } from "lucide-react";
import { oturumuKapat, pinIleAc } from "../oturum";
import { useBaglanti } from "../baglanti";

// Kasa gün boyu açık kalıyor; başındaki kişi değiştiğinde ekran kilitleniyor ve
// gelen kişi PIN'iyle devam ediyor. Program burada kapanmıyor — açık adisyonlar
// olduğu gibi duruyor. PIN'i olmayan için çıkış var; bağlantı yokken gizli,
// çünkü o an çıkan kişi yeniden giriş yapamaz ve kasa kullanılamaz kalır.
export default function KilitEkrani() {
  const [pin, setPin] = useState("");
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [cikiliyor, setCikiliyor] = useState(false);
  const cevrimici = useBaglanti();

  const cik = () => {
    setCikiliyor(true);
    oturumuKapat().catch((e) => {
      setHata(e.message);
      setCikiliyor(false);
    });
  };

  // Dört hane dolunca ayrıca bir düğmeye basılmıyor.
  useEffect(() => {
    if (pin.length !== 4 || bekliyor) return;
    setBekliyor(true);
    pinIleAc(pin)
      .catch((e) => {
        setHata(e.message);
        setPin("");
      })
      .finally(() => setBekliyor(false));
  }, [pin]);

  const tus = (deger: string) => {
    setHata("");
    if (deger === "sil") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < 4 ? p + deger : p));
  };

  // Kasada klavye varsa rakamlar tuş takımına basmadan da girilebilsin.
  useEffect(() => {
    const dinle = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tus(e.key);
      else if (e.key === "Backspace") tus("sil");
    };
    window.addEventListener("keydown", dinle);
    return () => window.removeEventListener("keydown", dinle);
  }, []);

  return (
    <div className="kilit">
      <div className="kilit-kart">
        <span className="giris-marka">
          Rayo<b>POS</b><i />
        </span>

        <span className="kilit-im">
          <LockKeyhole size={22} />
        </span>
        <h1>Ekran kilitli</h1>
        <span className="giris-alt">Devam etmek için PIN'ini gir</span>

        {!cevrimici && (
          <p className="kilit-serit">
            <WifiOff size={16} />
            Bağlantı yok — bu kasada daha önce PIN'le geçenler devam edebilir
          </p>
        )}

        <div className={hata ? "pin-nokta sarsil" : "pin-nokta"}>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i < pin.length ? "dolu" : ""} />
          ))}
        </div>

        <p className={hata ? "giris-hata" : "giris-hata bos"}>{hata || "."}</p>

        <div className="pin-tuslar">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) => (
            <button key={t} onClick={() => tus(t)} disabled={bekliyor}>
              {t}
            </button>
          ))}
          <span />
          <button onClick={() => tus("0")} disabled={bekliyor}>
            0
          </button>
          <button className="sil" onClick={() => tus("sil")} disabled={bekliyor}>
            <Delete size={22} />
          </button>
        </div>

        {cevrimici && (
          <div className="kilit-cikis">
            <button onClick={cik} disabled={cikiliyor}>
              <LogOut size={17} />
              {cikiliyor ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
