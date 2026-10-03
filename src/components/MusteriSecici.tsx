import { useEffect, useState } from "react";
import { Check, Gift, Search, UserRound, UserRoundPlus, Users, X } from "lucide-react";
import Bilgi from "./Bilgi";
import { eslesiyor } from "../arama";
import { paraGoster } from "../para";
import { acikHesapMusterileri, musteriKaydet, musterileriGetir, tamAd, type Musteri } from "../cari";
import { yetkiVar } from "../oturum";

/**
 * Açık hesaba yazarken müşteriyi seçme penceresi. Yalnız "açık hesap
 * müşterisi" işaretli olanlar listeleniyor: herkese veresiye açılmıyor,
 * kimin hesabına yazılabileceğine işletme önceden karar veriyor.
 */
export default function MusteriSecici({
  baslik = "Kimin hesabına yazılsın?",
  hepsi,
  cuzdan,
  onSec,
  onKapat,
}: {
  baslik?: string;
  /** Açık hesabı olmayanlar da listelensin — sipariş müşterisi seçilirken. */
  hepsi?: boolean;
  /**
   * Sadakat için seçiliyor: herkes listelenir, borç yerine cüzdan bakiyesi
   * görünür ve listede olmayan müşteri buradan eklenebilir.
   */
  cuzdan?: boolean;
  onSec: (musteri: Musteri) => void;
  onKapat: () => void;
}) {
  const [liste, setListe] = useState<Musteri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ara, setAra] = useState("");
  const [yeni, setYeni] = useState<{ ad: string; telefon: string } | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");

  useEffect(() => {
    (hepsi || cuzdan
      ? musterileriGetir().then((m) => m.filter((x) => x.aktif))
      : acikHesapMusterileri()
    ).then((m) => {
      setListe(m);
      setYukleniyor(false);
    });
  }, [hepsi, cuzdan]);

  const ekleyebilir = cuzdan && yetkiVar("cari.duzenle");

  // Aranan rakamsa telefon, değilse ad olarak forma taşınıyor: kasiyer
  // aradığını bir daha yazmasın.
  const yeniAc = () => {
    const rakam = /^[\d\s+()-]+$/.test(ara.trim());
    setYeni({ ad: rakam ? "" : ara.trim(), telefon: rakam ? ara.trim() : "" });
    setHata("");
  };

  const yeniKaydet = async () => {
    if (!yeni || !yeni.ad.trim()) {
      setHata("Ad yazılmalı.");
      return;
    }
    setKaydediliyor(true);
    try {
      const alanlar = { ad: yeni.ad, soyad: "", telefon: yeni.telefon, telefon2: "", acikHesap: false, notlar: "", aktif: true };
      const id = await musteriKaydet(null, alanlar);
      onSec({ id, no: 0, ...alanlar, ad: yeni.ad.trim(), telefon: yeni.telefon.trim(), bakiye: 0, cuzdan: 0 });
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Müşteri kaydedilemedi.");
      setKaydediliyor(false);
    }
  };

  useEffect(() => {
    const kacis = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    document.addEventListener("keydown", kacis);
    return () => document.removeEventListener("keydown", kacis);
  }, [onKapat]);

  const gorunen = liste.filter((m) =>
    eslesiyor(`${tamAd(m)} ${m.telefon} ${m.no}`, ara)
  );

  return (
    <div className="up-fon" onClick={onKapat}>
      <div className="up-modal msc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="msc-im">
            <Users size={20} />
          </span>
          <h3>{baslik}</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}>
            <X size={20} />
          </button>
        </header>

        <div className="msc-ara">
          <Search size={16} />
          <input
            value={ara}
            onChange={(e) => setAra(e.target.value)}
            placeholder="Ad veya telefon ara"
            autoFocus
          />
        </div>

        {yeni ? (
          <div className="msc-yeni">
            <label>
              <span>Ad soyad</span>
              <input
                value={yeni.ad}
                autoFocus
                onChange={(e) => setYeni({ ...yeni, ad: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && yeniKaydet()}
              />
            </label>
            <label>
              <span>Telefon</span>
              <input
                value={yeni.telefon}
                inputMode="tel"
                onChange={(e) => setYeni({ ...yeni, telefon: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && yeniKaydet()}
              />
            </label>
            {hata && <p className="msc-hata">{hata}</p>}
            <div className="msc-yeni-eylem">
              <button className="msc-vazgec" onClick={() => setYeni(null)}>Vazgeç</button>
              <button className="msc-kaydet" disabled={kaydediliyor} onClick={yeniKaydet}>
                <Check size={16} />
                Ekle ve bağla
              </button>
            </div>
          </div>
        ) : (
        <div className="msc-liste">
          {yukleniyor ? (
            <div className="yukleniyor"><div className="cember" /></div>
          ) : liste.length === 0 && !ekleyebilir ? (
            <Bilgi>
              {hepsi || cuzdan
                ? "Kayıtlı müşteri yok. Müşteriler ekranından ekleyebilirsiniz."
                : "Açık hesap müşterisi yok. Müşteriler ekranından bir müşteri açıp \"Açık hesap müşterisi\" anahtarını açın."}
            </Bilgi>
          ) : gorunen.length === 0 && !ekleyebilir ? (
            <Bilgi>Aramaya uyan müşteri yok.</Bilgi>
          ) : (
            <>
              {gorunen.map((m) => {
                const cuzdanBakiye = m.cuzdan;
                return (
                  <button key={m.id} className="msc-satir" onClick={() => onSec(m)}>
                    <span className="msc-amblem">
                      {tamAd(m).slice(0, 1).toLocaleUpperCase("tr") || <UserRound size={16} />}
                    </span>
                    <span className="msc-ad">
                      {tamAd(m)}
                      <small>{m.telefon || `#${m.no}`}</small>
                    </span>
                    {cuzdan ? (
                      <em className={cuzdanBakiye > 0 ? "msc-bakiye cuzdan" : "msc-bakiye"}>
                        <Gift size={14} />
                        {paraGoster(cuzdanBakiye)}
                      </em>
                    ) : (
                      <em className={m.bakiye < 0 ? "msc-bakiye borclu" : "msc-bakiye"}>
                        {paraGoster(m.bakiye)}
                      </em>
                    )}
                  </button>
                );
              })}
              {ekleyebilir && (
                <button className="msc-satir msc-ekle" onClick={yeniAc}>
                  <span className="msc-amblem">
                    <UserRoundPlus size={16} />
                  </span>
                  <span className="msc-ad">
                    {ara.trim() ? `"${ara.trim()}" yeni müşteri olarak ekle` : "Yeni müşteri ekle"}
                    <small>Ad ve telefonla hızlı kayıt</small>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
