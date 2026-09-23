import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  History,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import StokBasligi from "../components/StokBasligi";
import AramaKutusu from "../components/AramaKutusu";
import Bildirim from "../components/Bildirim";
import Ipucu from "../components/Ipucu";
import OnayModal from "../components/OnayModal";
import { eslesiyor } from "../arama";
import { useKutuBoyu } from "../kutuBoyu";
import { yetkiVar } from "../oturum";
import { ayarlar } from "../isletmeAyarlari";
import { paraGoster, paraSayi, paraYaz } from "../para";
import {
  malzemeleriGetir,
  miktarGoster,
  miktarSayi,
  miktarYaz,
  olcuKisa,
  olcuyeCevir,
  tabanaCevir,
  type Malzeme,
} from "../stok";
import {
  HAREKET_TIPLERI,
  SEBEPLER,
  belgeKaydet,
  hareketGuncelle,
  hareketSil,
  hareketleriGetir,
  sebepAdi,
  tipBilgisi,
  type BelgeKalemi,
  type HareketDuzeltme,
  type Hareket,
  type HareketTipi,
} from "../stokHareket";

const gunMetni = (t: string) =>
  new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

const saatMetni = (t: string) =>
  new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

const yerelSaat = (t: Date) =>
  `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;

const yerelTarih = (t: Date) =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

function TipIkonu({ tip, boy = 17 }: { tip: string; boy?: number }) {
  if (tip === "giris") return <ArrowDownLeft size={boy} />;
  if (tip === "fire") return <Trash2 size={boy} />;
  if (tip === "cikis") return <ArrowUpRight size={boy} />;
  return <History size={boy} />;
}

export default function StokHareketleri() {
  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [malzemeler, setMalzemeler] = useState<Malzeme[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ara, setAra] = useState("");
  const [suzgec, setSuzgec] = useState<"tumu" | HareketTipi>("tumu");
  const [pencere, setPencere] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Hareket | null>(null);
  const [silinecek, setSilinecek] = useState<Hareket | null>(null);
  const [bildirim, setBildirim] = useState("");
  const [hata, setHata] = useState("");

  const yonetebilir = yetkiVar("stok.yonet");

  const tazele = async () => {
    const [h, m] = await Promise.all([hareketleriGetir(), malzemeleriGetir()]);
    setHareketler(h);
    setMalzemeler(m);
  };

  useEffect(() => {
    tazele().then(() => setYukleniyor(false));
  }, []);

  const gorunen = useMemo(() => {
    const liste = suzgec === "tumu" ? hareketler : hareketler.filter((h) => h.tip === suzgec);
    return liste.filter((h) =>
      eslesiyor(`${h.malzemeAd} ${h.kisi} ${h.aciklama} ${sebepAdi(h.tip, h.sebep)}`, ara)
    );
  }, [hareketler, suzgec, ara]);

  const { kutu, boy } = useKutuBoyu(gorunen.length);

  const sayac = (tip: string) => hareketler.filter((h) => h.tip === tip).length;

  return (
    <>
      <div className="sayfa ayar-sayfa">
        <StokBasligi />

        {yukleniyor ? (
          <div className="yukleniyor"><div className="cember" /></div>
        ) : (
          <section className="ayar-bolum">
            <div className="alt-serit stok-serit">
              <button
                className={suzgec === "tumu" ? "alt-sekme aktif" : "alt-sekme"}
                onClick={() => setSuzgec("tumu")}
              >
                <History size={15} /> Tümü
                <em className="stok-serit-sayi">{hareketler.length}</em>
              </button>
              {HAREKET_TIPLERI.map((t) => (
                <button
                  key={t.kod}
                  className={suzgec === t.kod ? "alt-sekme aktif" : "alt-sekme"}
                  onClick={() => setSuzgec(t.kod)}
                >
                  <TipIkonu tip={t.kod} boy={15} /> {t.ad}
                  <em className="stok-serit-sayi">{sayac(t.kod)}</em>
                </button>
              ))}
            </div>

            <div className="ayar-bolum-ust">
              <h2>
                <History size={17} /> Hareketler
                <Ipucu baslik="Hareket defteri">
                  Stok yalnız buradaki kayıtlarla değişir. Bir hareketi
                  düzenlediğinizde ya da sildiğinizde o malzemenin geçmişi
                  baştan hesaplanır, stok miktarı kendiliğinden düzelir.
                </Ipucu>
              </h2>
              <AramaKutusu deger={ara} degistir={setAra} yer="Hareket ara" />
              {yonetebilir && (
                <button className="ayar-ekle" onClick={() => setPencere(true)}>
                  <Plus size={15} /> Yeni hareket
                </button>
              )}
            </div>

            {gorunen.length === 0 ? (
              <div className="ayar-bos">
                <History size={30} />
                <p>
                  {ara
                    ? `"${ara}" ile eşleşen hareket yok.`
                    : hareketler.length === 0
                      ? "Henüz stok hareketi yok. Mal girişi, fire ve çıkışlar buradan işlenir."
                      : "Bu tipte hareket yok."}
                </p>
                {yonetebilir && hareketler.length === 0 && (
                  <button className="ayar-ekle" onClick={() => setPencere(true)}>
                    <Plus size={15} /> İlk hareketi gir
                  </button>
                )}
              </div>
            ) : (
              <div className="stok-liste" ref={kutu} style={{ maxHeight: boy || undefined }}>
                {gorunen.map((h) => {
                  const arti = h.miktar > 0;
                  const sebep = sebepAdi(h.tip, h.sebep);
                  return (
                    <div key={h.id} className={`hrk-satir hrk-${h.tip}`}>
                      <span className="hrk-im"><TipIkonu tip={h.tip} boy={18} /></span>

                      <span className="hrk-ad">
                        {h.malzemeAd}
                        <small>
                          {[
                            tipBilgisi(h.tip).ad,
                            sebep,
                            `${gunMetni(h.zaman)} ${saatMetni(h.zaman)}`,
                            h.kisi,
                            h.aciklama,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>

                      {/* Eski → değişim → yeni: stoğun o an ne olduğu değil,
                          nasıl o hâle geldiği okunuyor. */}
                      <span className="hrk-defter">
                        <b>{miktarGoster(h.onceki, h.birim)}</b>
                        <ArrowRight size={14} />
                        <em className={arti ? "arti" : "eksi"}>
                          {arti ? "+" : "−"}
                          {miktarGoster(Math.abs(h.miktar), h.birim)}
                        </em>
                        <ArrowRight size={14} />
                        <b className="sonuc">{miktarGoster(h.sonraki, h.birim)}</b>
                      </span>

                      {yonetebilir && (
                        <span className="stok-islem">
                          <button onClick={() => setDuzenlenen(h)} title="Düzenle">
                            <Pencil size={15} />
                          </button>
                          <button
                            className="tehlike"
                            onClick={() => setSilinecek(h)}
                            title="Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {pencere && (
        <HareketPenceresi
          malzemeler={malzemeler.filter((m) => m.aktif)}
          onKapat={() => setPencere(false)}
          onKaydet={async (belge) => {
            try {
              await belgeKaydet(belge);
              setPencere(false);
              await tazele();
              setBildirim("Stok hareketi kaydedildi");
            } catch (e) {
              setHata((e as Error).message);
            }
          }}
        />
      )}

      {duzenlenen && (
        <DuzenlePenceresi
          hareket={duzenlenen}
          onKapat={() => setDuzenlenen(null)}
          onKaydet={async (d) => {
            const h = duzenlenen;
            try {
              await hareketGuncelle(h.id, h.tip, d);
              setDuzenlenen(null);
              await tazele();
              setBildirim("Hareket güncellendi");
            } catch (e) {
              setHata((e as Error).message);
            }
          }}
        />
      )}

      {silinecek && (
        <OnayModal
          mesaj={`*${silinecek.malzemeAd}* hareketi silinsin mi? Malzemenin stok miktarı yeniden hesaplanacak.`}
          tehlikeli
          onayMetni="Sil"
          onOnay={async () => {
            const h = silinecek;
            setSilinecek(null);
            try {
              await hareketSil(h.id);
              await tazele();
              setBildirim("Hareket silindi");
            } catch (e) {
              setHata((e as Error).message);
            }
          }}
          onKapat={() => setSilinecek(null)}
        />
      )}

      {hata && <OnayModal mesaj={hata} tekTus onKapat={() => setHata("")} />}
      {bildirim && <Bildirim mesaj={bildirim} onKapat={() => setBildirim("")} />}
    </>
  );
}

/** Pencerede düzenlenen tek satır; miktar ve fiyat metin olarak tutuluyor. */
type Satir = { malzemeId: number | null; miktar: string; fiyat: string };

const bosSatir = (): Satir => ({ malzemeId: null, miktar: "", fiyat: "" });

function HareketPenceresi({
  malzemeler,
  onKapat,
  onKaydet,
}: {
  malzemeler: Malzeme[];
  onKapat: () => void;
  onKaydet: (belge: {
    tip: HareketTipi;
    zaman: string;
    sebep: string | null;
    aciklama: string;
    kalemler: BelgeKalemi[];
  }) => void;
}) {
  const [tip, setTip] = useState<HareketTipi>("giris");
  const [tarih, setTarih] = useState(yerelTarih(new Date()));
  const [saat, setSaat] = useState(yerelSaat(new Date()));
  const [sebep, setSebep] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState("");
  const [satirlar, setSatirlar] = useState<Satir[]>([bosSatir()]);

  const bilgi = tipBilgisi(tip);
  const sebepler = SEBEPLER[tip] ?? [];

  const tipDegis = (yeni: HareketTipi) => {
    setTip(yeni);
    // Sebep listesi tipe bağlı; eski seçim yeni tipte geçersiz olurdu.
    setSebep(null);
  };

  const satirDegis = (i: number, parca: Partial<Satir>) =>
    setSatirlar((s) => s.map((satir, j) => (j === i ? { ...satir, ...parca } : satir)));

  const malzeme = (id: number | null) => malzemeler.find((m) => m.id === id);

  /** Satırın kaydedilince malzemeyi hangi miktara getireceği. */
  const yeniMiktar = (satir: Satir) => {
    const m = malzeme(satir.malzemeId);
    const deger = miktarSayi(satir.miktar);
    if (!m || !deger || deger <= 0) return null;
    return m.miktar + tabanaCevir(deger, m.birim) * bilgi.yon;
  };

  const dolu = satirlar.filter((s) => {
    const deger = miktarSayi(s.miktar);
    return s.malzemeId !== null && deger !== undefined && deger > 0;
  });

  const toplam = dolu.reduce((t, s) => {
    const m = malzeme(s.malzemeId);
    const deger = miktarSayi(s.miktar) ?? 0;
    const fiyat = paraSayi(s.fiyat) ?? 0;
    if (!m || !bilgi.fiyatli) return t;
    return t + deger * fiyat;
  }, 0);

  // Aynı malzeme iki satıra girilirse ikinci satır birincinin sonucunu
  // görmez; defter doğru yazar ama ekrandaki "yeni miktar" yanıltır.
  const tekrar = dolu.length !== new Set(dolu.map((s) => s.malzemeId)).size;
  const sebepGerekli = sebepler.length > 0 && !sebep;
  // İşletme eksi stoğa izin vermiyorsa sonucu eksiye düşüren satır kaydı
  // durdurur. İzin açıkken (varsayılan) eksi stok engel değil: malzeme girişi
  // geç kalabiliyor, satış durursa işletme duruyor — kırmızı görünür, geçer.
  const eksiye = dolu.some((s) => (yeniMiktar(s) ?? 0) < 0);
  const eksiEngel = eksiye && !ayarlar().eksiStokIzin;

  const gecerli =
    dolu.length > 0 && !tekrar && !sebepGerekli && !eksiEngel && tarih !== "" && saat !== "";

  const kaydet = () => {
    const kalemler: BelgeKalemi[] = dolu.map((s) => {
      const m = malzeme(s.malzemeId)!;
      const deger = miktarSayi(s.miktar)!;
      const fiyat = paraSayi(s.fiyat);
      return {
        malzemeId: m.id,
        malzemeAd: m.ad,
        miktar: tabanaCevir(deger, m.birim),
        // Fiyat ekranda ölçü başına giriliyor (kilo başına), depoda en küçük
        // birim başına duruyor: 32 TL/kg → 0,032 TL/gram.
        birimMaliyet:
          bilgi.fiyatli && fiyat ? fiyat / (tabanaCevir(1, m.birim) || 1) : null,
      };
    });

    const zaman = new Date(`${tarih}T${saat}`);

    onKaydet({
      tip,
      zaman: zaman.toISOString(),
      sebep,
      aciklama,
      kalemler,
    });
  };

  return (
    <div className="up-fon" onClick={onKapat}>
      <div className="up-modal stok-modal hrk-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><TipIkonu tip={tip} /></span>
          <h3>Yeni stok hareketi</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
        </header>

        <div className="stok-modal-govde">
          <div className="up-izgara">
            <div className="up-alan">
              <label htmlFor="hrk-tip">Hareket tipi</label>
              <select
                id="hrk-tip"
                value={tip}
                onChange={(e) => tipDegis(e.target.value as HareketTipi)}
              >
                <option value="giris">Giriş — mal alımı</option>
                <option value="fire">Fire — döküldü, bozuldu, kırıldı</option>
                <option value="cikis">Çıkış — personel, iade, numune</option>
              </select>
            </div>

            {/* Tarih ve saat ayrı kutular — Giderler ekranındaki desen.
                Saat defterin sırasını belirliyor: aynı gün içinde hangi
                hareketin önce olduğu okunabilsin. */}
            <div className="up-alan hrk-zaman">
              <label htmlFor="hrk-tarih">Tarih ve saat</label>
              <div>
                <input
                  id="hrk-tarih"
                  type="date"
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                />
                <input
                  type="time"
                  aria-label="Saat"
                  value={saat}
                  onChange={(e) => setSaat(e.target.value)}
                />
              </div>
            </div>

            {sebepler.length > 0 && (
              <div className="up-alan genis">
                <label htmlFor="hrk-sebep">Sebep</label>
                <select
                  id="hrk-sebep"
                  value={sebep ?? ""}
                  onChange={(e) => setSebep(e.target.value || null)}
                >
                  <option value="">Seçin</option>
                  {sebepler.map((s) => (
                    <option key={s.kod} value={s.kod}>{s.ad}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="hrk-tablo">
            <div className={bilgi.fiyatli ? "hrk-basliklar fiyatli" : "hrk-basliklar"}>
              <span>Malzeme</span>
              <span>{bilgi.fiil}</span>
              {bilgi.fiyatli && <span>Birim fiyat</span>}
              <span className="hrk-sonuc-basi">Yeni miktar</span>
              <span />
            </div>

            {satirlar.map((satir, i) => {
              const m = malzeme(satir.malzemeId);
              const sonuc = yeniMiktar(satir);
              return (
                <div
                  key={i}
                  className={bilgi.fiyatli ? "hrk-satir-giris fiyatli" : "hrk-satir-giris"}
                >
                  <MalzemeSecici
                    malzemeler={malzemeler}
                    secili={m ?? null}
                    sec={(id) => satirDegis(i, { malzemeId: id })}
                  />

                  <div className="up-sonek">
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={satir.miktar}
                      onChange={(e) => satirDegis(i, { miktar: miktarYaz(e.target.value) })}
                    />
                    <em>{m ? olcuKisa(m.birim) : ""}</em>
                  </div>

                  {bilgi.fiyatli && (
                    <div className="up-sonek">
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={satir.fiyat}
                        onChange={(e) => satirDegis(i, { fiyat: paraYaz(e.target.value) })}
                      />
                      <em>₺</em>
                    </div>
                  )}

                  {/* Kaydetmeden önce sonucu görmek: eksiye düşüyorsa kırmızı,
                      kişi Kaydet'e basmadan fark eder. */}
                  <span
                    className={
                      sonuc === null
                        ? "hrk-sonuc bos"
                        : sonuc < 0
                          ? "hrk-sonuc eksi"
                          : "hrk-sonuc"
                    }
                  >
                    {sonuc === null || !m ? "—" : miktarGoster(sonuc, m.birim)}
                  </span>

                  <button
                    className="hrk-satir-sil"
                    title="Satırı kaldır"
                    disabled={satirlar.length === 1}
                    onClick={() => setSatirlar((s) => s.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}

            <button
              className="hrk-satir-ekle"
              onClick={() => setSatirlar((s) => [...s, bosSatir()])}
            >
              <Plus size={16} /> Malzeme ekle
            </button>
          </div>

          <div className="up-alan">
            <label htmlFor="hrk-aciklama">Açıklama</label>
            <input
              id="hrk-aciklama"
              placeholder={tip === "giris" ? "Fatura no, satıcı" : "Not"}
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
            />
          </div>

          {tekrar && (
            <p className="hrk-uyari">
              Aynı malzeme birden çok satırda. Tek satırda toplayın, yoksa
              yandaki yeni miktar yanıltır.
            </p>
          )}

          {eksiEngel && (
            <p className="hrk-uyari tehlike">
              Bu hareket stoğu eksiye düşürüyor. İşletme ayarlarında eksi stoğa
              izin verilmediği için kaydedilemez.
            </p>
          )}
        </div>

        <footer className="up-alt hrk-alt">
          <span className="hrk-ozet">
            {dolu.length} kalem
            {bilgi.fiyatli && toplam > 0 && ` · toplam ${paraGoster(toplam)}`}
          </span>
          <button className="up-tus vazgec" onClick={onKapat}>Vazgeç</button>
          <button className="up-tus kaydet" disabled={!gecerli} onClick={kaydet}>
            <Check size={16} /> Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Tek bir hareketin düzeltilmesi.
 *
 * Malzeme ve tip değişmiyor: onlar değişecekse yapılan şey düzeltme değil,
 * başka bir harekettir — satır silinip yenisi girilir. Burada yalnız miktar,
 * fiyat, zaman, sebep ve açıklama var.
 *
 * Kaydedilince o malzemenin bütün geçmişi veritabanında baştan sıralanıp
 * "önceki → sonraki" zinciri yeniden kuruluyor; aradan bir satır değiştiği
 * için sonraki satırların rakamları da kayıyor.
 */
function DuzenlePenceresi({
  hareket,
  onKapat,
  onKaydet,
}: {
  hareket: Hareket;
  onKapat: () => void;
  onKaydet: (d: HareketDuzeltme) => void;
}) {
  const bilgi = tipBilgisi(hareket.tip);
  const sebepler = SEBEPLER[hareket.tip] ?? [];
  const baslangic = new Date(hareket.zaman);

  const [miktar, setMiktar] = useState(
    String(olcuyeCevir(Math.abs(hareket.miktar), hareket.birim)).replace(".", ",")
  );
  const [fiyat, setFiyat] = useState(
    hareket.birimMaliyet
      ? String(hareket.birimMaliyet * (tabanaCevir(1, hareket.birim) || 1)).replace(".", ",")
      : ""
  );
  const [tarih, setTarih] = useState(yerelTarih(baslangic));
  const [saat, setSaat] = useState(yerelSaat(baslangic));
  const [sebep, setSebep] = useState<string | null>(hareket.sebep);
  const [aciklama, setAciklama] = useState(hareket.aciklama);

  const deger = miktarSayi(miktar);
  const yeniMiktar =
    deger && deger > 0
      ? hareket.onceki + tabanaCevir(deger, hareket.birim) * bilgi.yon
      : null;

  const gecerli =
    deger !== undefined &&
    deger > 0 &&
    tarih !== "" &&
    saat !== "" &&
    (sebepler.length === 0 || !!sebep);

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal stok-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><TipIkonu tip={hareket.tip} /></span>
          <h3>{hareket.malzemeAd} — {bilgi.ad.toLocaleLowerCase("tr")} düzelt</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
        </header>

        <div className="stok-modal-govde">
          <div className="up-izgara">
            <div className="up-alan">
              <label htmlFor="dzn-miktar">{bilgi.fiil}</label>
              <div className="up-sonek">
                <input
                  id="dzn-miktar"
                  autoFocus
                  inputMode="decimal"
                  value={miktar}
                  onChange={(e) => setMiktar(miktarYaz(e.target.value))}
                />
                <em>{olcuKisa(hareket.birim)}</em>
              </div>
            </div>

            {bilgi.fiyatli && (
              <div className="up-alan">
                <label htmlFor="dzn-fiyat">Birim fiyat</label>
                <div className="up-sonek">
                  <input
                    id="dzn-fiyat"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={fiyat}
                    onChange={(e) => setFiyat(paraYaz(e.target.value))}
                  />
                  <em>₺</em>
                </div>
              </div>
            )}

            <div className="up-alan hrk-zaman genis">
              <label htmlFor="dzn-tarih">Tarih ve saat</label>
              <div>
                <input
                  id="dzn-tarih"
                  type="date"
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                />
                <input
                  type="time"
                  aria-label="Saat"
                  value={saat}
                  onChange={(e) => setSaat(e.target.value)}
                />
              </div>
            </div>

            {sebepler.length > 0 && (
              <div className="up-alan genis">
                <label htmlFor="dzn-sebep">Sebep</label>
                <select
                  id="dzn-sebep"
                  value={sebep ?? ""}
                  onChange={(e) => setSebep(e.target.value || null)}
                >
                  <option value="">Seçin</option>
                  {sebepler.map((s) => (
                    <option key={s.kod} value={s.kod}>{s.ad}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="up-alan genis">
              <label htmlFor="dzn-aciklama">Açıklama</label>
              <input
                id="dzn-aciklama"
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
              />
            </div>
          </div>

          {/* Bu satırdan sonraki hareketler de kayacağı için burada yazan
              rakam yalnız bu satırın sonucu. Malzemenin güncel stoğu
              kaydedildikten sonra listede görünüyor. */}
          <div className="stok-panel-durum">
            <span>
              <History size={15} /> Bu satırın sonucu
              <b>
                {yeniMiktar === null ? "—" : miktarGoster(yeniMiktar, hareket.birim)}
              </b>
            </span>
            <p>
              Önceki değer {miktarGoster(hareket.onceki, hareket.birim)}. Kayıt
              değişince malzemenin sonraki hareketleri de baştan hesaplanır.
            </p>
          </div>
        </div>

        <footer className="up-alt">
          <button className="up-tus vazgec" onClick={onKapat}>Vazgeç</button>
          <button
            className="up-tus kaydet"
            disabled={!gecerli}
            onClick={() =>
              onKaydet({
                miktar: tabanaCevir(deger!, hareket.birim),
                birimMaliyet:
                  bilgi.fiyatli && paraSayi(fiyat)
                    ? paraSayi(fiyat)! / (tabanaCevir(1, hareket.birim) || 1)
                    : null,
                zaman: new Date(`${tarih}T${saat}`).toISOString(),
                aciklama,
                sebep,
              })
            }
          >
            <Check size={16} /> Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Malzeme seçimi yazdıkça süzen kutuyla yapılıyor, açılır listeyle değil:
 * iki yüz malzemesi olan işletmede açılır liste kullanılmaz hâle geliyor.
 */
function MalzemeSecici({
  malzemeler,
  secili,
  sec,
}: {
  malzemeler: Malzeme[];
  secili: Malzeme | null;
  sec: (id: number) => void;
}) {
  const [yazi, setYazi] = useState("");
  const [acik, setAcik] = useState(false);

  const gorunen = malzemeler
    .filter((m) => eslesiyor(`${m.ad} ${m.kod} ${m.grupAd}`, yazi))
    .slice(0, 8);

  const secildi = (m: Malzeme) => {
    sec(m.id);
    setYazi("");
    setAcik(false);
  };

  return (
    <div className="hrk-secici">
      <Search size={15} />
      <input
        value={acik ? yazi : secili?.ad ?? ""}
        placeholder="Malzeme ara"
        onFocus={() => {
          setAcik(true);
          setYazi("");
        }}
        onBlur={() => setTimeout(() => setAcik(false), 120)}
        onChange={(e) => setYazi(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && gorunen[0] && secildi(gorunen[0])}
      />

      {acik && gorunen.length > 0 && (
        <div className="hrk-oneriler">
          {gorunen.map((m) => (
            <button key={m.id} onMouseDown={() => secildi(m)}>
              <Package size={15} />
              <span>
                {m.ad}
                <small>{m.grupAd || "Grupsuz"}</small>
              </span>
              <em>{miktarGoster(m.miktar, m.birim)}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
