import { useEffect, useState } from "react";
import { ChevronRight, Gift, Sparkles, Trash2, UserRoundPlus, WalletCards } from "lucide-react";
import MusteriSecici from "./MusteriSecici";
import OrtaPencere from "./OrtaPencere";
import { useBaglanti } from "../baglanti";
import { ayarlar } from "../isletmeAyarlari";
import { paraGoster, paraSayi, paraYaz } from "../para";
import { CUZDAN, harcanabilir, sadakatMusterisi, type SadakatMusterisi } from "../sadakat";
import type { Musteri } from "../cari";
import type { Tahsilat } from "../types";

const kurus = (v: number) => Math.round(v * 100) / 100;

/**
 * Ödeme penceresindeki sadakat şeridi. Ödeme tiplerinin sütunu dar; orada
 * yalnız kim bağlı ve cüzdanında ne var yazıyor. Şeride basınca ortada cüzdan
 * penceresi açılıyor, harcama orada yapılıyor. Sadakat kapalıysa hiç görünmüyor.
 *
 * Bakiye pencere açılırken okunuyor; bu ekranda alınıp henüz kaydedilmemiş
 * cüzdan ödemeleri ondan düşülerek gösteriliyor.
 */
export default function SadakatKarti({
  musteriId,
  toplam,
  kalan,
  tahsilatlar,
  onMusteriDegis,
  onCuzdandanOde,
}: {
  musteriId: number | null;
  toplam: number;
  kalan: number;
  tahsilatlar: Tahsilat[];
  onMusteriDegis: (m: Musteri | null) => void;
  onCuzdandanOde: (tutar: number) => void;
}) {
  const kural = ayarlar().sadakat;
  const cevrimici = useBaglanti();
  const [musteri, setMusteri] = useState<SadakatMusterisi | null>(null);
  const [seciciAcik, setSeciciAcik] = useState(false);
  const [pencereAcik, setPencereAcik] = useState(false);
  const [tutar, setTutar] = useState("");

  useEffect(() => {
    if (!musteriId) {
      setMusteri(null);
      return;
    }
    let iptal = false;
    sadakatMusterisi(musteriId)
      .then((m) => !iptal && setMusteri(m))
      .catch(() => !iptal && setMusteri(null));
    return () => {
      iptal = true;
    };
  }, [musteriId]);

  if (!kural.acik) return null;

  const cuzdanla = tahsilatlar.filter((t) => t.tip === CUZDAN);
  const bekleyen = kurus(cuzdanla.filter((t) => !t.id).reduce((t, o) => t + o.tutar, 0));
  const oncekiCuzdan = kurus(cuzdanla.reduce((t, o) => t + o.tutar, 0));
  const bakiye = musteri ? kurus(musteri.bakiye - bekleyen) : 0;
  const kullanilir = harcanabilir(bakiye, kalan, toplam, oncekiCuzdan, kural);
  const kazanacak = kurus(((toplam - oncekiCuzdan) * kural.oran) / 100);
  const altLimitteDegil = kural.altLimit > 0 && bakiye > 0 && bakiye < kural.altLimit;
  const ad = musteri ? `${musteri.ad} ${musteri.soyad}`.trim() : "";

  const girilen = paraSayi(tutar) ?? 0;
  const fazla = girilen > kullanilir;

  const pencereyiAc = () => {
    setTutar(kullanilir > 0 ? String(kullanilir) : "");
    setPencereAcik(true);
  };

  const ode = () => {
    if (girilen <= 0 || fazla) return;
    onCuzdandanOde(kurus(girilen));
    setPencereAcik(false);
  };

  // Neden harcanamadığı tek cümleyle: kasiyer müşteriye ne diyeceğini bilsin.
  const engel = !cevrimici
    ? "Bağlantı yokken cüzdan kullanılamaz."
    : altLimitteDegil
      ? `Cüzdan ${paraGoster(kural.altLimit)} olunca harcanabilir.`
      : bakiye <= 0
        ? "Cüzdanda harcanacak para yok."
        : kalan <= 0
          ? "Hesabın kalanı yok."
          : kullanilir <= 0
            ? `Bu hesabın en fazla %${kural.ustOran} kadarı cüzdanla ödenebilir.`
            : "";

  if (!musteriId) {
    return (
      <>
        <button className="sdk-serit bos" onClick={() => setSeciciAcik(true)} disabled={!cevrimici}>
          <span className="sdk-serit-ikon">
            <UserRoundPlus size={16} />
          </span>
          <span className="sdk-serit-metin">
            <strong>Müşteri bağla</strong>
            <small>{kazanacak > 0 ? `+${paraGoster(kazanacak)} kazanır` : `%${kural.oran} cüzdana`}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        {seciciAcik && (
          <MusteriSecici
            baslik="Hesaba müşteri bağla"
            cuzdan
            onSec={(m) => {
              onMusteriDegis(m);
              setSeciciAcik(false);
            }}
            onKapat={() => setSeciciAcik(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button className="sdk-serit" onClick={pencereyiAc}>
        <span className="sdk-amblem">{ad.slice(0, 1).toLocaleUpperCase("tr") || "·"}</span>
        <span className="sdk-serit-metin">
          <strong>{ad || "Yükleniyor…"}</strong>
          <small>
            <WalletCards size={14} />
            {paraGoster(bakiye)}
          </small>
        </span>
        <ChevronRight size={16} />
      </button>

      {pencereAcik && (
        <OrtaPencere
          ikon={WalletCards}
          baslik="Sadakat cüzdanı"
          aciklama={musteri?.telefon || "Hesaba bağlı müşteri"}
          genislik="dar"
          ust
          onKapat={() => setPencereAcik(false)}
          alt={
            <>
              <button className="pnc-vazgec" onClick={() => setPencereAcik(false)}>Vazgeç</button>
              <button className="pnc-kaydet" disabled={!!engel || girilen <= 0 || fazla} onClick={ode}>
                <Gift size={16} />
                {girilen > 0 && !fazla ? `${paraGoster(girilen)} öde` : "Cüzdandan öde"}
              </button>
            </>
          }
        >
          <div className="sdk-kart">
            <div className="sdk-ust">
              <span className="sdk-amblem">{ad.slice(0, 1).toLocaleUpperCase("tr") || "·"}</span>
              <span className="sdk-kim">
                <strong>{ad}</strong>
                <small>Sadakat üyesi</small>
              </span>
              {/* Cüzdandan ödeme alındıysa müşteri hesaptan ayrılamaz: harcama
                  o müşterinin cüzdanına bağlı. */}
              {cuzdanla.length === 0 && (
                <button
                  className="sdk-cikar"
                  title="Müşteriyi hesaptan çıkar"
                  aria-label="Müşteriyi hesaptan çıkar"
                  onClick={() => {
                    onMusteriDegis(null);
                    setPencereAcik(false);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="sdk-bakiye">
              <span>
                <WalletCards size={16} />
                Cüzdan
              </span>
              <strong>{paraGoster(bakiye)}</strong>
            </div>
            {kazanacak > 0 && (
              <p className="sdk-kazanc">
                <Sparkles size={14} />
                <span>
                  Hesap kapanınca <strong>+{paraGoster(kazanacak)}</strong> kazanacak
                </span>
              </p>
            )}
          </div>

          {engel ? (
            <p className="sdk-engel">{engel}</p>
          ) : (
            <label className="sdk-tutar">
              <span>Cüzdandan alınacak</span>
              <div className={fazla ? "sdk-tutar-kutu hatali" : "sdk-tutar-kutu"}>
                <em>₺</em>
                <input
                  value={tutar}
                  inputMode="decimal"
                  autoFocus
                  onChange={(e) => setTutar(paraYaz(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && ode()}
                />
                <button type="button" onClick={() => setTutar(String(kullanilir))}>
                  Tamamı
                </button>
              </div>
              <small>
                {fazla
                  ? `En fazla ${paraGoster(kullanilir)} kullanılabilir.`
                  : `Bu hesapta en fazla ${paraGoster(kullanilir)} kullanılabilir.`}
              </small>
            </label>
          )}
        </OrtaPencere>
      )}
    </>
  );
}
