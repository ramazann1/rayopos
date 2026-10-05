import { useEffect, useState } from "react";
import {
  Banknote,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  StickyNote,
  Tags,
  Trash2,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import SaatKutusu from "../components/SaatKutusu";
import TarihKutusu from "../components/TarihKutusu";
import OrtaPencere from "../components/OrtaPencere";
import KasaBasligi from "../components/KasaBasligi";
import Bilgi from "../components/Bilgi";
import Bildirim from "../components/Bildirim";
import OnayModal from "../components/OnayModal";
import { DonemPenceresi, donemAdi, donemAraligiKur, donemAralikMetni, type Donem } from "../components/TarihSuzgeci";
import { eslesiyor } from "../arama";
import { paraGoster, paraSayi, paraYaz } from "../para";
import { kisaAd } from "../personel";
import { SAKIN, useCanli } from "../canli";
import {
  HAZIR_TIPLER,
  ODEME_TIPLERI,
  hazirTipleriEkle,
  masrafEkle,
  masrafGuncelle,
  masrafSil,
  masrafTipiEkle,
  masrafTipiGuncelle,
  masrafTipiSil,
  masrafTipleriniGetir,
  masraflariGetir,
  odemeAdi,
  type Masraf,
  type MasrafAlanlari,
  type MasrafTipi,
  type OdemeKodu,
} from "../masraflar";

// Tarih kutuları yerel saatle çalışıyor; kayıt ISO olarak saklanıyor.
const yerelTarih = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

const yerelSaat = (t: Date) =>
  `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;

const ODEME_IKONU: Record<OdemeKodu, LucideIcon> = {
  nakit: Banknote,
  kart: CreditCard,
  havale: Landmark,
  cek: FileText,
  diger: MoreHorizontal,
};

const gunMetni = (t: string) =>
  new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

const saatMetni = (t: string) =>
  new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export default function Giderler() {
  const [tipler, setTipler] = useState<MasrafTipi[]>([]);
  const [liste, setListe] = useState<Masraf[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [donem, setDonem] = useState<Donem>({ kod: "son30", bas: "", bit: "" });
  const [donemPenceresi, setDonemPenceresi] = useState(false);
  const [ara, setAra] = useState("");
  const [panel, setPanel] = useState<Masraf | null | undefined>(undefined);
  const [tipPenceresi, setTipPenceresi] = useState(false);
  const [silinecek, setSilinecek] = useState<Masraf | null>(null);
  const [bildirim, setBildirim] = useState("");

  const tazele = async () => {
    const aralik = donemAraligiKur(donem);
    const [t, m] = await Promise.all([
      masrafTipleriniGetir(),
      masraflariGetir(aralik?.bas.toISOString(), aralik?.bit.toISOString()),
    ]);
    setTipler(t);
    setListe(m);
  };

  useEffect(() => {
    tazele().then(() => setYukleniyor(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donem]);

  // Gider mobilden ya da başka bir kasadan da girilebiliyor; liste sakin
  // hızda kendiliğinden tazeleniyor.
  useCanli(["masraflar"], tazele, SAKIN);

  const kaydet = async (alanlar: MasrafAlanlari) => {
    if (panel) await masrafGuncelle(panel.id, alanlar);
    else await masrafEkle(alanlar);
    setPanel(undefined);
    await tazele();
    setBildirim("Gider kaydedildi");
  };

  const sil = async () => {
    if (!silinecek) return;
    await masrafSil(silinecek.id);
    setSilinecek(null);
    setPanel(undefined);
    await tazele();
    setBildirim("Gider silindi");
  };

  const gorunen = liste.filter((m) =>
    eslesiyor(`${m.tipAd} ${m.aciklama} ${odemeAdi(m.odemeTipi)} ${gunMetni(m.zaman)}`, ara)
  );
  const toplam = gorunen.reduce((t, m) => t + m.tutar, 0);
  const nakitToplam = gorunen
    .filter((m) => m.odemeTipi === "nakit")
    .reduce((t, m) => t + m.tutar, 0);

  return (
    <>
      <div className="sayfa ayar-sayfa">
        <KasaBasligi ara={ara} araDegistir={setAra} araYer="Gider ara" />

        <Bilgi>
          İşletmenin harcamaları buraya girilir. Nakit ödenen giderler açık
          vardiyanın kasasından düşer; kart, havale ve çekle ödenenler kasayı
          etkilemez.
        </Bilgi>

        {yukleniyor ? (
          <div className="yukleniyor"><div className="cember" /></div>
        ) : tipler.length === 0 ? (
          <section className="ayar-bolum">
            <div className="ayar-bos">
              <Tags size={24} />
              <p>
                Gider girmeden önce gider türlerini tanımlayın. Hazır listeyle
                başlayıp sonra kendinize göre düzenleyebilirsiniz.
              </p>
              <div className="gider-bos-aksiyon">
                <button
                  className="ayar-ekle"
                  onClick={async () => {
                    await hazirTipleriEkle([]);
                    await tazele();
                    setBildirim("Hazır gider türleri eklendi");
                  }}
                >
                  <Plus size={16} /> Hazır türleri ekle
                </button>
                <button className="gider-tur-dugme" onClick={() => setTipPenceresi(true)}>
                  <Tags size={16} /> Kendim tanımlayayım
                </button>
              </div>
              <p className="gider-hazir-liste">{HAZIR_TIPLER.join(" · ")}</p>
            </div>
          </section>
        ) : (
          <section className="ayar-bolum">
            <div className="ayar-bolum-ust">
              <h2><Receipt size={20} /> Giderler</h2>
              {donem.kod !== "tumu" && (
                <span className="ts-aralik">{donemAralikMetni(donem)}</span>
              )}
              <button
                className={donem.kod === "tumu" ? "stok-yan-tus" : "stok-yan-tus dolu"}
                title="Tarihe göre süz"
                onClick={() => setDonemPenceresi(true)}
              >
                <CalendarDays size={16} /> {donemAdi(donem)}
              </button>
              <button className="gider-tur-dugme" onClick={() => setTipPenceresi(true)}>
                <Tags size={16} /> Gider türleri
              </button>
              <button className="ayar-ekle" onClick={() => setPanel(null)}>
                <Plus size={16} /> Gider ekle
              </button>
            </div>

            {gorunen.length === 0 ? (
              <div className="ayar-bos">
                <Receipt size={24} />
                <p>
                  {ara
                    ? `"${ara}" ile eşleşen gider yok.`
                    : "Bu dönemde gider girilmemiş."}
                </p>
              </div>
            ) : (
              <>
                <div className="gider-liste">
                  {gorunen.map((m) => (
                    <div key={m.id} className="gider-satir">
                      <span className="gider-zaman">
                        {gunMetni(m.zaman)}
                        <small>{saatMetni(m.zaman)}</small>
                      </span>
                      <span className="gider-tur">
                        {m.tipAd}
                        <small>{m.aciklama || (kisaAd(m.kisi) ? `${kisaAd(m.kisi)} girdi` : "—")}</small>
                      </span>
                      <span className="gider-odeme">{odemeAdi(m.odemeTipi)}</span>
                      <span className="gider-tutar">{paraGoster(m.tutar)}</span>
                      <button onClick={() => setPanel(m)} title="Düzenle">
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <dl className="kasa-dokum gider-toplam">
                  <div>
                    <dt>Nakit ödenen</dt>
                    <dd>{paraGoster(nakitToplam)}</dd>
                  </div>
                  <div className="kasa-beklenen">
                    <dt>Dönem toplamı</dt>
                    <dd>{paraGoster(toplam)}</dd>
                  </div>
                </dl>
              </>
            )}
          </section>
        )}
      </div>

      {panel !== undefined && (
        <GiderPaneli
          masraf={panel}
          tipler={tipler}
          onKapat={() => setPanel(undefined)}
          onKaydet={kaydet}
          onSil={panel ? () => setSilinecek(panel) : undefined}
          onTurler={() => setTipPenceresi(true)}
        />
      )}

      {tipPenceresi && (
        <TurPenceresi
          tipler={tipler}
          onKapat={() => setTipPenceresi(false)}
          onDegisti={tazele}
        />
      )}

      {silinecek && (
        <OnayModal
          baslik="Gider silinsin mi?"
          mesaj={`*${silinecek.tipAd} · ${paraGoster(silinecek.tutar)}* tutarındaki gider silinecek.`}
          tehlikeli
          onOnay={sil}
          onKapat={() => setSilinecek(null)}
        />
      )}

      {bildirim && <Bildirim mesaj={bildirim} onKapat={() => setBildirim("")} />}
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

function GiderPaneli({
  masraf,
  tipler,
  onKapat,
  onKaydet,
  onSil,
  onTurler,
}: {
  masraf: Masraf | null;
  tipler: MasrafTipi[];
  onKapat: () => void;
  onKaydet: (alanlar: MasrafAlanlari) => void;
  onSil?: () => void;
  onTurler: () => void;
}) {
  const simdi = masraf ? new Date(masraf.zaman) : new Date();
  const [tipId, setTipId] = useState<number | null>(masraf?.tipId ?? tipler[0]?.id ?? null);
  const [odemeTipi, setOdemeTipi] = useState<OdemeKodu>(masraf?.odemeTipi ?? "nakit");
  const [tarih, setTarih] = useState(yerelTarih(simdi));
  const [saat, setSaat] = useState(yerelSaat(simdi));
  const [tutar, setTutar] = useState(masraf ? String(masraf.tutar).replace(".", ",") : "");
  const [aciklama, setAciklama] = useState(masraf?.aciklama ?? "");

  const sayi = paraSayi(tutar) ?? 0;
  const gecerli = tipId !== null && sayi > 0 && tarih !== "" && saat !== "";

  const kaydet = () =>
    gecerli &&
    onKaydet({
      tipId,
      tipAd: tipler.find((t) => t.id === tipId)?.ad ?? "",
      odemeTipi,
      zaman: new Date(`${tarih}T${saat}`).toISOString(),
      tutar: sayi,
      aciklama,
    });

  return (
    <OrtaPencere
      ikon={Receipt}
      baslik={masraf ? "Gideri düzenle" : "Yeni gider"}
      aciklama="Nakit giderler açık vardiyanın kasasından düşer"
      onKapat={onKapat}
      alt={
        <>
          {onSil && (
            <button className="pnc-sil" onClick={onSil} aria-label="Sil">
              <Trash2 size={16} />
            </button>
          )}
          <button className="pnc-vazgec" onClick={onKapat}>Vazgeç</button>
          <button className="pnc-kaydet" disabled={!gecerli} onClick={kaydet}>
            <Check size={16} /> Kaydet
          </button>
        </>
      }
    >
          <label className="gdr-tutar">
            <span>₺</span>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0,00"
              value={tutar}
              onChange={(e) => setTutar(paraYaz(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && kaydet()}
            />
          </label>

          <div className="gdr-bolum">
            <b><Tags size={16} /> Gider türü</b>
            <div className="gdr-secim">
              {tipler.filter((t) => t.aktif || t.id === tipId).map((t) => (
                <button
                  key={t.id}
                  className={tipId === t.id ? "secili" : ""}
                  onClick={() => setTipId(t.id)}
                >
                  {tipId === t.id && <Check size={14} />} {t.ad}
                </button>
              ))}
              <button className="gdr-tur-ekle" onClick={onTurler}>
                <Plus size={14} /> Tür ekle
              </button>
            </div>
          </div>

          <div className="gdr-bolum">
            <b><Wallet size={16} /> Ödeme şekli</b>
            <div className="gdr-odeme">
              {ODEME_TIPLERI.map((o) => {
                const Ikon = ODEME_IKONU[o.kod];
                return (
                  <button
                    key={o.kod}
                    className={odemeTipi === o.kod ? "secili" : ""}
                    onClick={() => setOdemeTipi(o.kod)}
                  >
                    <Ikon size={20} />
                    {o.ad}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gdr-ikili">
            <div className="gdr-alan">
              <label><CalendarDays size={16} /> Tarih</label>
              <TarihKutusu className="" gun={tarih} degis={setTarih} />
            </div>
            <div className="gdr-alan">
              <label><Clock size={16} /> Saat</label>
              <SaatKutusu deger={saat} degis={setSaat} />
            </div>
          </div>

          <div className="gdr-alan">
            <label><StickyNote size={16} /> Açıklama</label>
            <input
              placeholder="Fatura no, satıcı, not"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
            />
          </div>
    </OrtaPencere>
  );
}

/** Gider türleri ayrı bir ekran değil, küçük bir pencere: tek seviyeli düz liste. */
function TurPenceresi({
  tipler,
  onKapat,
  onDegisti,
}: {
  tipler: MasrafTipi[];
  onKapat: () => void;
  onDegisti: () => Promise<void>;
}) {
  const [yeni, setYeni] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null);
  const [ad, setAd] = useState("");
  const [hata, setHata] = useState("");

  const isle = async (f: () => Promise<void>) => {
    try {
      await f();
      await onDegisti();
      setHata("");
    } catch (e) {
      setHata((e as Error).message);
    }
  };

  return (
    <OrtaPencere
      ikon={Tags}
      baslik="Gider türleri"
      aciklama="Giderler bu başlıklarla gruplanır."
      genislik="dar"
      onKapat={onKapat}
      alt={
        <button className="pnc-kaydet" onClick={onKapat}>
          <Check size={16} /> Tamam
        </button>
      }
    >
          <div className="gider-tur-ekleme">
            <input
              placeholder="Yeni tür adı"
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && yeni.trim()) {
                  isle(async () => {
                    await masrafTipiEkle(yeni, tipler.length);
                  });
                  setYeni("");
                }
              }}
            />
            <button
              className="ayar-ekle"
              disabled={!yeni.trim()}
              onClick={() => {
                isle(async () => {
                  await masrafTipiEkle(yeni, tipler.length);
                });
                setYeni("");
              }}
            >
              <Plus size={16} /> Ekle
            </button>
          </div>

          <div className="gider-tur-liste">
            {tipler.map((t) => (
              <div key={t.id} className="gider-tur-satir">
                {duzenlenen === t.id ? (
                  <>
                    <input value={ad} autoFocus onChange={(e) => setAd(e.target.value)} />
                    <button
                      title="Kaydet"
                      onClick={async () => {
                        await isle(() => masrafTipiGuncelle(t.id, ad));
                        setDuzenlenen(null);
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button title="Vazgeç" onClick={() => setDuzenlenen(null)}>
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span>{t.ad}</span>
                    <button
                      title="Adını değiştir"
                      onClick={() => {
                        setDuzenlenen(t.id);
                        setAd(t.ad);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button title="Sil" onClick={() => isle(() => masrafTipiSil(t.id))}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            className="gider-tur-dugme"
            onClick={() => isle(() => hazirTipleriEkle(tipler))}
          >
            <Plus size={16} /> Hazır türlerden eksikleri ekle
          </button>

          {hata && <p className="kasa-hata">{hata}</p>}
    </OrtaPencere>
  );
}
