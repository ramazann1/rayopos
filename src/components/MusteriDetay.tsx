import { useEffect, useState } from "react";
import { Check, Gift, HandCoins, MapPin, Pencil, Phone, Receipt, Scale, Sparkles, StickyNote, WalletCards, X } from "lucide-react";
import { ayarlar } from "../isletmeAyarlari";
import {
  SADAKAT_HAREKET_ADI,
  cuzdanDuzelt,
  cuzdanOzeti,
  sadakatHareketleri,
  type SadakatHareketi,
} from "../sadakat";
import AdisyonDetay from "./AdisyonDetay";
import Bilgi from "./Bilgi";
import Bildirim from "./Bildirim";
import { paraGoster, paraSayi, paraYaz } from "../para";
import { kisaAd } from "../personel";
import { yetkiVar } from "../oturum";
import { hataMesaji } from "../baglanti";
import { odemeTipleriniGetir, type OdemeTipi } from "../odemeTipleri";
import {
  adresleriGetir,
  bakiyeDuzelt,
  hareketAdi,
  hareketleriGetir,
  tahsilatAl,
  tamAd,
  type Adres,
  type Hareket,
  type Musteri,
} from "../cari";

const gunMetni = (t: string) =>
  new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

const saatMetni = (t: string) =>
  new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

const SEKMELER = [
  { kod: "ekstre", ad: "Hesap Ekstresi" },
  { kod: "adisyonlar", ad: "Adisyonlar" },
  { kod: "odemeler", ad: "Ödemeler" },
  { kod: "cuzdan", ad: "Cüzdan" },
] as const;

type Sekme = (typeof SEKMELER)[number]["kod"];

/** Ödeme Al penceresi: kalan borcun tamamı ya da bir kısmı tahsil ediliyor. */
function OdemeAl({
  borc,
  tipler,
  onKapat,
  onKaydet,
}: {
  borc: number;
  tipler: OdemeTipi[];
  onKapat: () => void;
  onKaydet: (tutar: number, tip: string) => void;
}) {
  // Kalan borç hazır geliyor: en sık yapılan iş borcun tamamının kapatılması.
  const [tutar, setTutar] = useState(borc > 0 ? String(borc) : "");
  const [tip, setTip] = useState(tipler[0]?.ad ?? "Nakit");

  const sayi = paraSayi(tutar) ?? 0;

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal cd-kucuk" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="cd-im"><HandCoins size={20} /></span>
          <h3>Ödeme al</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={20} /></button>
        </header>

        <div className="cd-form">
          <div className="cari-borc-satiri">
            <span>Kalan borç</span>
            <strong>{paraGoster(borc)}</strong>
          </div>

          <label className="cd-alan">
            <span>Alınan tutar</span>
            <input
              value={tutar}
              onChange={(e) => setTutar(paraYaz(e.target.value))}
              inputMode="decimal"
              autoFocus
            />
          </label>

          <div className="cd-alan">
            <span>Ödeme tipi</span>
            <div className="cd-tipler">
              {tipler.map((t) => (
                <button
                  key={t.id}
                  className={tip === t.ad ? "aktif" : ""}
                  onClick={() => setTip(t.ad)}
                >
                  {t.ad}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="cd-alt">
          <button className="cd-vazgec" onClick={onKapat}>Vazgeç</button>
          <button className="cd-onay" disabled={sayi <= 0} onClick={() => onKaydet(sayi, tip)}>
            <HandCoins size={16} /> Tahsil et
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Bakiye düzeltme: sayıya elle dokunuluyor, o yüzden sebep zorunlu. */
function BakiyeDuzelt({
  bakiye,
  cuzdan,
  onKapat,
  onKaydet,
}: {
  bakiye: number;
  /** Sadakat cüzdanı düzeltiliyor; fark borç değil cüzdan parası. */
  cuzdan?: boolean;
  onKapat: () => void;
  onKaydet: (yeni: number, sebep: string) => void;
}) {
  const [yeni, setYeni] = useState(String(bakiye));
  const [sebep, setSebep] = useState("");

  const sayi = paraSayi(yeni) ?? 0;
  const fark = sayi - bakiye;

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal cd-kucuk" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="cd-im"><Scale size={20} /></span>
          <h3>{cuzdan ? "Cüzdanı düzelt" : "Bakiye düzelt"}</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={20} /></button>
        </header>

        <div className="cd-form">
          <div className="cari-borc-satiri">
            <span>Şu anki bakiye</span>
            <strong>{paraGoster(bakiye)}</strong>
          </div>

          <label className="cd-alan">
            <span>Yeni bakiye</span>
            <input
              value={yeni}
              onChange={(e) => {
                // Borç eksi yazılıyor; cüzdan eksiye inemediği için orada işaret yok.
                const eksi = !cuzdan && e.target.value.trim().startsWith("-");
                setYeni((eksi ? "-" : "") + paraYaz(e.target.value));
              }}
              inputMode="decimal"
              placeholder={cuzdan ? undefined : "Borç eksi yazılır: -300"}
              autoFocus
            />
            {fark !== 0 && (
              <em className="cd-fark">
                {fark > 0
                  ? `${paraGoster(fark)} ${cuzdan ? "cüzdana eklenecek" : "borç düşülecek"}`
                  : `${paraGoster(-fark)} ${cuzdan ? "cüzdandan düşülecek" : "borç eklenecek"}`}
              </em>
            )}
          </label>

          <label className="cd-alan">
            <span>Sebep</span>
            <input
              value={sebep}
              onChange={(e) => setSebep(e.target.value)}
              placeholder="Neden düzeltiliyor?"
            />
          </label>

          <Bilgi>
            Bakiyenin kendisi ezilmiyor; aradaki fark ekstreye ayrı bir düzeltme
            hareketi olarak yazılıyor.
          </Bilgi>
        </div>

        <footer className="cd-alt">
          <button className="cd-vazgec" onClick={onKapat}>Vazgeç</button>
          <button
            className="cd-onay"
            disabled={fark === 0 || !sebep.trim()}
            onClick={() => onKaydet(sayi, sebep.trim())}
          >
            <Check size={16} /> Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function MusteriDetay({
  musteri,
  onKapat,
  onDegisti,
  onDuzenle,
}: {
  musteri: Musteri;
  onKapat: () => void;
  onDegisti: () => void;
  onDuzenle: () => void;
}) {
  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [adresler, setAdresler] = useState<Adres[]>([]);
  const [tipler, setTipler] = useState<OdemeTipi[]>([]);
  const [sekme, setSekme] = useState<Sekme>("ekstre");
  const [odeme, setOdeme] = useState(false);
  const [duzeltme, setDuzeltme] = useState(false);
  const [acikAdisyon, setAcikAdisyon] = useState<number | null>(null);
  const [bildirim, setBildirim] = useState("");
  const [bildirimTuru, setBildirimTuru] = useState<"basari" | "hata">("basari");

  const [cuzdanHareketleri, setCuzdanHareketleri] = useState<SadakatHareketi[]>([]);
  const [cuzdanDuzeltme, setCuzdanDuzeltme] = useState(false);

  const tahsilatYapabilir = yetkiVar("cari.tahsilat");

  const tazele = async () => setHareketler(await hareketleriGetir(musteri.id));
  const cuzdaniTazele = async () => setCuzdanHareketleri(await sadakatHareketleri(musteri.id));

  useEffect(() => {
    sadakatHareketleri(musteri.id).then(setCuzdanHareketleri).catch(() => setCuzdanHareketleri([]));
  }, [musteri.id]);

  // Sadakat hiç kullanılmayan işletmede cüzdan sekmesi boş bir kalabalık;
  // kapatılmış ama geçmişi olan işletmede eski hareketler görünmeye devam ediyor.
  const cuzdanVar = ayarlar().sadakat.acik || cuzdanHareketleri.length > 0;
  const cuzdan = cuzdanOzeti(cuzdanHareketleri);

  const cuzdaniDuzelt = async (yeni: number, sebep: string) => {
    try {
      await cuzdanDuzelt(musteri.id, cuzdan.bakiye, yeni, sebep);
    } catch (e) {
      setBildirimTuru("hata");
      setBildirim(hataMesaji(e, "Cüzdan düzeltilemedi."));
      return;
    }
    setCuzdanDuzeltme(false);
    await cuzdaniTazele();
    setBildirimTuru("basari");
    setBildirim("Cüzdan düzeltildi");
  };

  useEffect(() => {
    (async () => {
      const [h, a, t] = await Promise.all([
        hareketleriGetir(musteri.id),
        adresleriGetir(musteri.id),
        // Açık hesap tipiyle borç kapatılmaz: borcun kendisi zaten o tiple
        // açılmış oluyor, listede dursa müşteri borcunu borçla öderdi.
        odemeTipleriniGetir(),
      ]);
      setHareketler(h);
      setAdresler(a);
      setTipler(t.filter((x) => !x.acikHesap));
    })();
  }, [musteri.id]);

  const toplamBorc = hareketler.reduce((t, h) => t + h.borc, 0);
  const toplamAlacak = hareketler.reduce((t, h) => t + h.alacak, 0);
  const bakiye = Math.round((toplamAlacak - toplamBorc) * 100) / 100;

  const adisyonlar = hareketler.filter((h) => h.tip === "satis");
  const odemeler = hareketler.filter((h) => h.tip === "tahsilat");

  const tahsilEt = async (tutar: number, tip: string) => {
    let fisNo: number | null;
    try {
      fisNo = await tahsilatAl(musteri.id, tutar, tip);
    } catch (e) {
      // Ödeme penceresi açık kalıyor: tutar girildiği gibi duruyor, bağlantı
      // gelince yeniden gönderilebilsin.
      setBildirimTuru("hata");
      setBildirim(hataMesaji(e, "Ödeme kaydedilemedi."));
      return;
    }
    setOdeme(false);
    await tazele();
    onDegisti();
    setBildirimTuru("basari");
    setBildirim(fisNo ? `Ödeme alındı · Fiş No ${fisNo}` : "Ödeme alındı");
  };

  const duzelt = async (yeni: number, sebep: string) => {
    await bakiyeDuzelt(musteri.id, bakiye, yeni, sebep);
    setDuzeltme(false);
    await tazele();
    onDegisti();
  };

  return (
    <div className="up-fon" onClick={onKapat}>
      <div className="up-modal tam cari-detay" onClick={(e) => e.stopPropagation()}>
        <header className="cari-detay-ust">
          {/* Baş harf amblemi: listede sıradan bir satır olan müşteri burada
              kimlik kazanıyor, hangi karta baktığın bir bakışta belli oluyor. */}
          <span className="cari-amblem">{tamAd(musteri).slice(0, 1).toLocaleUpperCase("tr")}</span>
          <span className="cari-baslik">
            <h3>{tamAd(musteri)}</h3>
            <small>
              #{musteri.no}
              {musteri.telefon && ` · ${musteri.telefon}`}
              {musteri.acikHesap && <em className="cari-rozet">Açık hesap</em>}
            </small>
          </span>
          <div className="cari-detay-aksiyon">
            {tahsilatYapabilir && (
              <>
                <button className="cari-tus one" onClick={() => setOdeme(true)}>
                  <HandCoins size={16} /> Ödeme al
                </button>
                <button className="cari-tus" onClick={() => setDuzeltme(true)}>
                  <Scale size={16} /> Bakiye düzelt
                </button>
              </>
            )}
            <button className="cari-tus" onClick={onDuzenle}>
              <Pencil size={16} /> Düzenle
            </button>
            <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={20} /></button>
          </div>
        </header>

        <div className="cari-detay-govde">
          <aside className="cari-kimlik">
            {/* Kalan bakiye tek başına büyük duruyor: kartı açan kişinin
                sorduğu soru bu. Toplam ve ödenen altında küçük kalıyor. */}
            <div className={bakiye < 0 ? "cari-bakiye borclu" : bakiye > 0 ? "cari-bakiye alacakli" : "cari-bakiye"}>
              <small>Bakiye</small>
              <strong>{paraGoster(bakiye)}</strong>
              <em>{bakiye < 0 ? "müşteri borçlu" : bakiye > 0 ? "işletme borçlu" : "hesap kapalı"}</em>
            </div>

            <div className="cari-sayilar">
              <span>
                <small>Toplam borç</small>
                {paraGoster(toplamBorc)}
              </span>
              <span>
                <small>Ödenen</small>
                {paraGoster(toplamAlacak)}
              </span>
            </div>

            {(musteri.telefon2 || musteri.notlar) && (
              <dl className="cari-kunye">
                {musteri.telefon2 && (
                  <>
                    <dt><Phone size={14} /> İkinci telefon</dt>
                    <dd>{musteri.telefon2}</dd>
                  </>
                )}
                {musteri.notlar && (
                  <>
                    <dt><StickyNote size={14} /> Not</dt>
                    <dd>{musteri.notlar}</dd>
                  </>
                )}
              </dl>
            )}

            {adresler.length > 0 && (
              <div className="cari-adresler">
                <h4><MapPin size={14} /> Adresler</h4>
                {adresler.map((a) => (
                  <p key={a.id}>
                    <strong>{a.baslik}</strong> {a.adres}
                  </p>
                ))}
              </div>
            )}
          </aside>

          <div className="cari-icerik">
            <div className="ms-sekmeler alt">
              {SEKMELER.filter((s) => s.kod !== "cuzdan" || cuzdanVar).map((s) => (
                <button
                  key={s.kod}
                  className={sekme === s.kod ? "aktif" : ""}
                  onClick={() => setSekme(s.kod)}
                >
                  {s.kod === "cuzdan" && <WalletCards size={16} />}
                  {s.ad}
                </button>
              ))}
            </div>

            {sekme === "cuzdan" && (
              <div className="sdk-sekme">
                <div className="sdk-ozet">
                  <div className="sdk-ozet-ana">
                    <span>
                      <WalletCards size={16} />
                      Cüzdan bakiyesi
                    </span>
                    <strong>{paraGoster(cuzdan.bakiye)}</strong>
                    {tahsilatYapabilir && (
                      <button className="sdk-ozet-tus" onClick={() => setCuzdanDuzeltme(true)}>
                        <Scale size={16} /> Düzelt
                      </button>
                    )}
                  </div>
                  <div className="sdk-ozet-sayilar">
                    <span>
                      <small><Sparkles size={14} /> Kazanılan</small>
                      {paraGoster(cuzdan.kazanilan)}
                    </span>
                    <span>
                      <small><Gift size={14} /> Harcanan</small>
                      {paraGoster(cuzdan.harcanan)}
                    </span>
                    <span>
                      <small><Receipt size={14} /> Hesap</small>
                      {cuzdan.ziyaret}
                    </span>
                  </div>
                </div>

                {cuzdanHareketleri.length === 0 ? (
                  <p className="cari-bos">Henüz cüzdan hareketi yok.</p>
                ) : (
                  <table className="cari-tablo">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Hareket</th>
                        <th>Açıklama</th>
                        <th className="sag">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuzdanHareketleri.map((h) => (
                        <tr
                          key={h.id}
                          className={h.adisyonId ? "tiklanir" : ""}
                          onClick={() => h.adisyonId && setAcikAdisyon(h.adisyonId)}
                        >
                          <td>
                            {gunMetni(h.zaman)}
                            <small> {saatMetni(h.zaman)}</small>
                          </td>
                          <td>
                            <span className={`sdk-rozet ${h.tip}`}>{SADAKAT_HAREKET_ADI[h.tip]}</span>
                          </td>
                          <td>
                            {h.aciklama || (h.adisyonNo ? `Adisyon #${h.adisyonNo}` : "—")}
                            {h.kisi && <small> · {kisaAd(h.kisi)}</small>}
                          </td>
                          <td className={h.tutar > 0 ? "sag guclu sdk-arti" : "sag guclu"}>
                            {h.tutar > 0 ? "+" : "−"}
                            {paraGoster(Math.abs(h.tutar))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {sekme === "ekstre" && (
              hareketler.length === 0 ? (
                <p className="cari-bos">Bu müşterinin henüz hesap hareketi yok.</p>
              ) : (
                <table className="cari-tablo">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Hareket</th>
                      <th>Açıklama</th>
                      <th className="sag">Borç</th>
                      <th className="sag">Alacak</th>
                      <th className="sag">Bakiye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hareketler.map((h) => (
                      <tr
                        key={h.id}
                        className={h.adisyonId ? "tiklanir" : ""}
                        onClick={() => h.adisyonId && setAcikAdisyon(h.adisyonId)}
                      >
                        <td>
                          {gunMetni(h.zaman)}
                          <small> {saatMetni(h.zaman)}</small>
                        </td>
                        <td>{hareketAdi(h.tip)}</td>
                        <td>
                          {h.aciklama || h.odemeTipi || "—"}
                          {h.fisNo && <small> · Fiş {h.fisNo}</small>}
                          {h.kisi && <small> · {kisaAd(h.kisi)}</small>}
                        </td>
                        <td className="sag">{h.borc ? paraGoster(h.borc) : "—"}</td>
                        <td className="sag">{h.alacak ? paraGoster(h.alacak) : "—"}</td>
                        <td className="sag guclu">{paraGoster(h.bakiye)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {sekme === "adisyonlar" && (
              adisyonlar.length === 0 ? (
                <p className="cari-bos">
                  Bu müşterinin açık hesaba aktarılmış adisyonu yok.
                </p>
              ) : (
                <table className="cari-tablo">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Adisyon</th>
                      <th>Açıklama</th>
                      <th className="sag">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adisyonlar.map((h) => (
                      // Satıra basınca adisyonun kendisi açılıyor: Analiz'de
                      // kullanılan pencerenin aynısı, ürünleri ve tahsilatıyla.
                      <tr
                        key={h.id}
                        className={h.adisyonId ? "tiklanir" : ""}
                        onClick={() => h.adisyonId && setAcikAdisyon(h.adisyonId)}
                      >
                        <td>
                          {gunMetni(h.zaman)}
                          <small> {saatMetni(h.zaman)}</small>
                        </td>
                        <td>{h.adisyonId ? `#${h.adisyonId}` : "—"}</td>
                        <td>{h.aciklama || h.odemeTipi || "—"}</td>
                        <td className="sag guclu">{paraGoster(h.borc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {sekme === "odemeler" && (
              odemeler.length === 0 ? (
                <p className="cari-bos">Bu müşteriden henüz tahsilat alınmadı.</p>
              ) : (
                <table className="cari-tablo">
                  <thead>
                    <tr>
                      <th>Fiş No</th>
                      <th>Tarih</th>
                      <th>Ödeme tipi</th>
                      <th>Alan</th>
                      <th className="sag">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {odemeler.map((h) => (
                      <tr key={h.id}>
                        <td className="cari-fis-no">{h.fisNo ?? "—"}</td>
                        <td>
                          {gunMetni(h.zaman)}
                          <small> {saatMetni(h.zaman)}</small>
                        </td>
                        <td>{h.odemeTipi || "—"}</td>
                        <td>{kisaAd(h.kisi) || "—"}</td>
                        <td className="sag guclu">{paraGoster(h.alacak)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>

      {odeme && (
        <OdemeAl
          borc={bakiye < 0 ? -bakiye : 0}
          tipler={tipler}
          onKapat={() => setOdeme(false)}
          onKaydet={tahsilEt}
        />
      )}

      {acikAdisyon && (
        <AdisyonDetay
          adisyonId={acikAdisyon}
          onKapat={() => setAcikAdisyon(null)}
          onDegisti={async () => {
            await tazele();
            onDegisti();
          }}
        />
      )}

      {bildirim && (
        <Bildirim mesaj={bildirim} tur={bildirimTuru} onKapat={() => setBildirim("")} />
      )}

      {duzeltme && (
        <BakiyeDuzelt
          bakiye={bakiye}
          onKapat={() => setDuzeltme(false)}
          onKaydet={duzelt}
        />
      )}

      {cuzdanDuzeltme && (
        <BakiyeDuzelt
          bakiye={cuzdan.bakiye}
          cuzdan
          onKapat={() => setCuzdanDuzeltme(false)}
          onKaydet={cuzdaniDuzelt}
        />
      )}
    </div>
  );
}
