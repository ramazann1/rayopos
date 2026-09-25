import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  History,
  ListChecks,
  Play,
  TriangleAlert,
  X,
} from "lucide-react";
import StokBasligi from "../components/StokBasligi";
import AramaKutusu from "../components/AramaKutusu";
import Bildirim from "../components/Bildirim";
import Ipucu from "../components/Ipucu";
import OnayModal from "../components/OnayModal";
import { eslesiyor } from "../arama";
import { yetkiVar } from "../oturum";
import { useKutuBoyu } from "../kutuBoyu";
import {
  DonemPenceresi,
  donemAdi,
  donemAraligiKur,
  type StokDonemi as Donem,
} from "../components/StokDonemi";
import { paraGoster } from "../para";
import {
  gruplariGetir,
  kritikMi,
  malzemeleriGetir,
  miktarGoster,
  miktarSayi,
  miktarYaz,
  olcuKisa,
  olcuyeCevir,
  tabanaCevir,
  type MalzemeGrubu,
} from "../stok";
import {
  SAPMA_SINIRI,
  acikSayim,
  gecmisRapor,
  gecmisSayimlar,
  raporGetir,
  satirYaz,
  sayimAc,
  sayimIptal,
  sayimOnayla,
  sayimSatirlari,
  type GecmisSayim,
  type RaporSatiri,
  type SayimKapsami,
  type Sayim,
  type SayimSatiri,
} from "../stokSayim";

/** Kutuda görünen rakam — virgüllü, kendi ölçüsünde. */
const sayilanMetin = (s: SayimSatiri) =>
  s.sayilan == null ? "" : String(olcuyeCevir(s.sayilan, s.birim)).replace(".", ",");

const zamanMetni = (t: string) =>
  new Date(t).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Geçmiş listede yıl da görünüyor; sayımlar yıllar boyu birikiyor. */
const gecmisZamani = (t: string) =>
  new Date(t).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Stok sayımı — üç adım: kapsam seç → say → rapor.
 *
 * Sayarken sistemdeki miktar ekranda YOK (körleme sayım): rakamı gören kişi
 * 24 saysa bile "yanlış saymışımdır" deyip 25 yazıyor. Sistem miktarı ancak
 * raporda, sayım bitince görünüyor.
 *
 * Rapor onaylanmadan stokta hiçbir şey değişmiyor; onaylanınca yalnız farkı
 * olan malzemeye hareket yazılıyor.
 */
export default function StokSayim({ mobil = false }: { mobil?: boolean }) {
  const [sayim, setSayim] = useState<Sayim | null>(null);
  const [satirlar, setSatirlar] = useState<SayimSatiri[]>([]);
  const [rapor, setRapor] = useState<RaporSatiri[] | null>(null);
  const [gruplar, setGruplar] = useState<MalzemeGrubu[]>([]);
  const [sayilar, setSayilar] = useState({ tumu: 0, kritik: 0 });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ara, setAra] = useState("");
  const [kapsam, setKapsam] = useState<SayimKapsami>("tumu");
  const [secilenGruplar, setSecilenGruplar] = useState<number[]>([]);
  // Kutuya yazılmakta olan metin; satır kimliğine göre. Odak çıkınca siliniyor
  // ve rakam kayıtlı değerden okunuyor.
  const [yazilan, setYazilan] = useState<Record<number, string>>({});
  const [detay, setDetay] = useState(false);
  const [onaylanacak, setOnaylanacak] = useState(false);
  const [iptalEdilecek, setIptalEdilecek] = useState(false);
  const [bildirim, setBildirim] = useState("");
  const [hata, setHata] = useState("");
  const [gecmis, setGecmis] = useState<GecmisSayim[]>([]);
  const [donem, setDonem] = useState<Donem>({ kod: "son30", bas: "", bit: "" });
  const [donemPenceresi, setDonemPenceresi] = useState(false);
  const [acilanGecmis, setAcilanGecmis] = useState<{
    sayim: GecmisSayim;
    rapor: RaporSatiri[] | null;
  } | null>(null);

  const sayabilir = yetkiVar("stok.sayim");
  // Grup seçimi açılınca liste aşağı iniyor; kutu yeniden ölçülmeli.
  const { kutu, boy } = useKutuBoyu(`${gecmis.length}-${kapsam}-${secilenGruplar.length}-${!!sayim}`, {
    pay: 48,
    asgari: 220,
  });

  const tazele = async () => {
    const [s, g, m, gs] = await Promise.all([
      acikSayim(),
      gruplariGetir(),
      malzemeleriGetir(),
      gecmisSayimlar(donemAraligiKur(donem)),
    ]);
    setSayim(s);
    setGecmis(gs);
    setGruplar(g.filter((x) => x.aktif));
    const aktifler = m.filter((x) => x.aktif);
    setSayilar({
      tumu: aktifler.length,
      kritik: aktifler.filter(kritikMi).length,
    });
    setSatirlar(s ? await sayimSatirlari(s.id) : []);
  };

  useEffect(() => {
    tazele().then(() => setYukleniyor(false));
  }, []);

  const ilkAcilis = useRef(true);
  useEffect(() => {
    if (ilkAcilis.current) {
      ilkAcilis.current = false;
      return;
    }
    gecmisSayimlar(donemAraligiKur(donem)).then(setGecmis);
  }, [donem]);

  const gorunen = useMemo(
    () => satirlar.filter((s) => eslesiyor(`${s.malzemeAd} ${s.grupAd}`, ara)),
    [satirlar, ara]
  );

  const sayilanAdet = satirlar.filter((s) => s.sayilan != null).length;

  const basla = async () => {
    try {
      await sayimAc(kapsam, secilenGruplar);
      await tazele();
      setBildirim("Sayım başladı");
    } catch (e) {
      setHata((e as Error).message);
    }
  };

  const yaz = async (satir: SayimSatiri, sayilan: number | null) => {
    // Kutu ekranda anında değişiyor, kayıt arkadan gidiyor: raf başında
    // bekleyen bir kutu sayımı yavaşlatıyor.
    setSatirlar((eski) =>
      eski.map((s) => (s.id === satir.id ? { ...s, sayilan } : s))
    );
    try {
      await satirYaz(satir.id, sayilan);
    } catch (e) {
      setHata((e as Error).message);
      if (sayim) setSatirlar(await sayimSatirlari(sayim.id));
    }
  };

  const raporuAc = async () => {
    if (!sayim) return;
    setRapor(await raporGetir(sayim.id));
  };

  const onayla = async () => {
    if (!sayim) return;
    try {
      await sayimOnayla(sayim.id);
      setOnaylanacak(false);
      setRapor(null);
      await tazele();
      setBildirim("Sayım onaylandı, farklar stoğa işlendi");
    } catch (e) {
      setHata((e as Error).message);
    }
  };

  const iptal = async () => {
    if (!sayim) return;
    try {
      await sayimIptal(sayim.id);
      setIptalEdilecek(false);
      setRapor(null);
      await tazele();
      setBildirim("Sayım iptal edildi, stok değişmedi");
    } catch (e) {
      setHata((e as Error).message);
    }
  };

  const gecmisiAc = async (s: GecmisSayim) => {
    setAcilanGecmis({ sayim: s, rapor: null });
    const r = await gecmisRapor(s);
    setAcilanGecmis((eski) => (eski?.sayim.id === s.id ? { sayim: s, rapor: r } : eski));
  };

  // Bitiş sınırı ertesi günün başı; ekranda son gün yazılsın diye bir an geri.
  const aralik = donemAraligiKur(donem);
  // Saat de yazılıyor: gün başlangıcı işletmeye göre değişebiliyor.
  const anYaz = (t: Date) =>
    t.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const aralikMetni = aralik
    ? `${anYaz(aralik.bas)} – ${anYaz(new Date(aralik.bit.getTime() - 1))}`
    : "";

  const kapsamMetni = (s: Sayim) => {
    if (s.kapsam === "tumu") return "Tüm malzemeler";
    if (s.kapsam === "kritik") return "Kritikler";
    const adlar = s.grupIdler
      .map((id) => gruplar.find((g) => g.id === id)?.ad)
      .filter(Boolean);
    return adlar.length > 0 ? adlar.join(", ") : "Seçili gruplar";
  };

  const farkli = (rapor ?? []).filter((r) => r.fark !== 0);
  const sayilmayan = (rapor ?? []).filter((r) => r.sayilan == null);
  const netTutar = farkli.reduce((t, r) => t + r.tutar, 0);
  const sapanlar = (rapor ?? []).filter(
    (r) => r.sapma != null && r.sapma > SAPMA_SINIRI
  );

  return (
    <>
      <div className={mobil ? "m-sayim sayim-sayfa" : "sayfa ayar-sayfa sayim-sayfa"}>
        {/* Telefonda stok bölüm şeridi yok: mobilde yalnız sayım açılıyor,
            Malzemeler ve Hareketler masa başı işi. Başlık alt sekme
            çubuğundaki diğer ekranlarla aynı desende. */}
        {mobil ? (
          <header className="m-baslik">
            <div>
              <h1>Sayım</h1>
              {sayim && (
                <p className="m-baslik-alt">
                  {sayilanAdet} / {satirlar.length} sayıldı
                </p>
              )}
            </div>
          </header>
        ) : (
          <StokBasligi />
        )}

        {yukleniyor ? (
          <div className="yukleniyor"><div className="cember" /></div>
        ) : !sayabilir ? (
          <section className="ayar-bolum">
            <div className="ayar-bos">
              <ClipboardList size={30} />
              <p>Sayım yapma yetkiniz yok.</p>
            </div>
          </section>
        ) : !sayim ? (
          /* 1. adım — kapsam */
          <>
            <section className="ayar-bolum">
              <div className="ayar-bolum-ust">
                <h2>
                  <ClipboardList size={17} /> Sayım
                  <Ipucu>Fark raporda çıkar, stok onaydan sonra değişir.</Ipucu>
                </h2>
              </div>

              <div className="sayim-kapsam">
                <button
                  className={kapsam === "tumu" ? "sayim-kart secili" : "sayim-kart"}
                  onClick={() => setKapsam("tumu")}
                >
                  <ListChecks size={17} />
                  <b>Tüm malzemeler</b>
                  <small>{sayilar.tumu} malzeme</small>
                </button>
                <button
                  className={kapsam === "grup" ? "sayim-kart secili" : "sayim-kart"}
                  onClick={() => setKapsam("grup")}
                >
                  <FolderOpen size={17} />
                  <b>Grup seç</b>
                  <small>
                    {secilenGruplar.length > 0
                      ? `${secilenGruplar.length} grup seçili`
                      : "Bar, mutfak, temizlik…"}
                  </small>
                </button>
                <button
                  className={kapsam === "kritik" ? "sayim-kart secili" : "sayim-kart"}
                  onClick={() => setKapsam("kritik")}
                >
                  <TriangleAlert size={17} />
                  <b>Yalnız kritikler</b>
                  <small>{sayilar.kritik} malzeme</small>
                </button>
              </div>

              {kapsam === "grup" && (
                <div className="sayim-gruplar">
                  {gruplar.length === 0 ? (
                    <p className="sayim-not">Henüz malzeme grubu yok.</p>
                  ) : (
                    gruplar.map((g) => {
                      const secili = secilenGruplar.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          className={secili ? "sayim-grup secili" : "sayim-grup"}
                          onClick={() =>
                            setSecilenGruplar((eski) =>
                              secili ? eski.filter((x) => x !== g.id) : [...eski, g.id]
                            )
                          }
                        >
                          <span
                            className="stok-grup-nokta"
                            style={{ background: g.renk ?? "var(--cizgi-koyu)" }}
                          />
                          {g.ad}
                          {secili && <Check size={14} />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              <button
                className="ayar-ekle sayim-basla"
                disabled={kapsam === "grup" && secilenGruplar.length === 0}
                onClick={basla}
              >
                <Play size={15} /> Sayımı başlat
              </button>
            </section>

            {(gecmis.length > 0 || donem.kod !== "tumu") && (
              <section className="ayar-bolum sayim-gecmis-kutu">
                <div className="ayar-bolum-ust">
                  <h2>
                    <History size={17} /> Geçmiş sayımlar
                    <Ipucu>Onaylı sayımın rakamları ay sonu maliyet hesabının kapanışıdır.</Ipucu>
                  </h2>
                  {aralikMetni && <span className="sayim-gecmis-aralik">{aralikMetni}</span>}
                  <button
                    className={donem.kod === "tumu" ? "stok-yan-tus" : "stok-yan-tus dolu"}
                    title="Tarihe göre süz"
                    onClick={() => setDonemPenceresi(true)}
                  >
                    <CalendarDays size={16} /> {donemAdi(donem)}
                  </button>
                </div>

                {gecmis.length === 0 && (
                  <p className="sayim-not">Bu tarihlerde yapılmış sayım yok.</p>
                )}

                <div
                  className="sayim-gecmis"
                  ref={kutu}
                  style={mobil ? undefined : { maxHeight: boy || undefined }}
                >
                  {gecmis.map((s) => (
                    <button
                      key={s.id}
                      className={s.durum === "iptal" ? "sayim-gecmis-satir iptal" : "sayim-gecmis-satir"}
                      onClick={() => gecmisiAc(s)}
                    >
                      <span className="sayim-gecmis-im">
                        {s.durum === "iptal" ? <Ban size={16} /> : <ClipboardCheck size={16} />}
                      </span>
                      <span className="sayim-gecmis-ad">
                        <b>{gecmisZamani(s.baslangic)}</b>
                        <small>
                          {kapsamMetni(s)}
                          {s.kisi && ` · ${s.kisi}`}
                        </small>
                      </span>
                      <span className="sayim-gecmis-sonuc">
                        {s.durum === "iptal" ? (
                          <em>İptal edildi</em>
                        ) : s.farkli === 0 ? (
                          <em>Fark yok</em>
                        ) : (
                          <>
                            {s.kurus == null ? (
                              <em>Tutar bilinmiyor</em>
                            ) : (
                              <b className={s.kurus < 0 ? "eksi" : s.kurus > 0 ? "arti" : ""}>
                                {paraGoster(s.kurus / 100)}
                              </b>
                            )}
                            <small>{s.farkli} malzemede fark</small>
                          </>
                        )}
                      </span>
                      <ChevronRight size={16} className="sayim-gecmis-ok" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : rapor ? (
          /* 3. adım — rapor */
          <section className="ayar-bolum">
            <div className="ayar-bolum-ust">
              <h2>
                <ClipboardList size={17} /> Sayım raporu
                <Ipucu>Yalnız farkı olan malzemeye hareket yazılır.</Ipucu>
              </h2>
              <button className="stok-yan-tus" onClick={() => setRapor(null)}>
                <ArrowLeft size={15} /> Sayıma dön
              </button>
            </div>

            <div className="stok-ozet">
              <div className="stok-ozet-kart">
                <span className="stok-ozet-im"><ListChecks size={20} /></span>
                <em>{farkli.length}</em>
                <small>Farklı malzeme</small>
              </div>
              <div className="stok-ozet-kart">
                <span className="stok-ozet-im"><ClipboardList size={20} /></span>
                <em>{paraGoster(netTutar / 100)}</em>
                <small>Net fark tutarı</small>
              </div>
              <div className="stok-ozet-kart">
                <span className="stok-ozet-im"><AlertTriangle size={20} /></span>
                <em>{sayilmayan.length}</em>
                <small>Sayılmayan</small>
              </div>
            </div>

            {/* Uyarılar ekranda kutu kutu sıralanmıyor: elli malzemelik bir
                sayımda o kutular raporun kendisini aşağı itiyordu. Tek satır
                kalıyor, ayrıntı pencerede açılıyor. */}
            {(sapanlar.length > 0 || sayilmayan.length > 0) && (
              <button className="sayim-detay-tus" onClick={() => setDetay(true)}>
                <TriangleAlert size={15} />
                {[
                  sapanlar.length > 0 &&
                    `${sapanlar.length} malzemede %${Math.round(SAPMA_SINIRI * 100)}'i geçen sapma`,
                  sayilmayan.length > 0 && `${sayilmayan.length} malzeme sayılmadı`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                <em>Rapor detayı</em>
              </button>
            )}

            <RaporTablosu rapor={rapor} />

            <div className="sayim-alt">
              <button className="stok-yan-tus" onClick={() => setIptalEdilecek(true)}>
                <X size={15} /> Sayımı iptal et
              </button>
              <button className="ayar-ekle" onClick={() => setOnaylanacak(true)}>
                <Check size={15} /> Onayla ve stoğa işle
              </button>
            </div>
          </section>
        ) : (
          /* 2. adım — körleme sayım */
          <section className="ayar-bolum">
            <div className="ayar-bolum-ust">
              <h2>
                <ClipboardList size={17} /> Sayım
                <Ipucu>Sistemdeki miktar gizli; ne saydıysanız onu yazın.</Ipucu>
              </h2>
              <AramaKutusu deger={ara} degistir={setAra} yer="Malzeme ara" />
              {/* Sayım adımının tek düğmesi; dolu mercan değil. Asıl geri
                  dönüşü olmayan eylem raporun sonundaki onay — mercan orada
                  duruyor, burada da dursa ikisi birbirini bastırıyor. */}
              <button className="stok-yan-tus sayim-bitir" onClick={raporuAc}>
                <Check size={15} /> Bitir ve raporu gör
              </button>
            </div>

            <div className="sayim-ilerleme">
              <div className="sayim-cubuk">
                <span
                  style={{
                    width: `${satirlar.length ? (sayilanAdet / satirlar.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <small>
                {sayilanAdet} / {satirlar.length} sayıldı · başlangıç{" "}
                {zamanMetni(sayim.baslangic)}
                {sayim.kisi && ` · ${sayim.kisi}`}
              </small>
            </div>

            <div className="stok-liste">
              {gorunen.map((s) => (
                <div
                  key={s.id}
                  className={s.sayilan == null ? "sayim-satir" : "sayim-satir dolu"}
                >
                  <span
                    className="sayim-serit"
                    style={{ background: s.grupRenk ?? "var(--cizgi-koyu)" }}
                  />
                  <span className="sayim-ad">
                    {s.malzemeAd}
                    {s.grupAd && <small>{s.grupAd}</small>}
                  </span>
                  <span className="sayim-giris">
                    <input
                      inputMode="decimal"
                      placeholder="—"
                      value={yazilan[s.id] ?? sayilanMetin(s)}
                      onChange={(e) =>
                        // Kutu metin olarak tutuluyor: her tuşta sayıya çevirip
                        // geri yazsaydık "1," yazarken virgül silinir, buçuklu
                        // miktar hiç girilemezdi. Parada da aynı desen var.
                        setYazilan((eski) => ({
                          ...eski,
                          [s.id]: miktarYaz(e.target.value),
                        }))
                      }
                      onBlur={(e) => {
                        const sayi = miktarSayi(miktarYaz(e.target.value));
                        setYazilan((eski) => {
                          const kalan = { ...eski };
                          delete kalan[s.id];
                          return kalan;
                        });
                        yaz(s, sayi == null ? null : tabanaCevir(sayi, s.birim));
                      }}
                    />
                    <em>{olcuKisa(s.birim)}</em>
                  </span>
                  <span className="sayim-im">
                    {s.sayilan != null && <Check size={17} />}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {detay && rapor && (
        <div className="up-fon" onClick={() => setDetay(false)}>
          <div
            className="up-modal stok-modal sayim-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="up-ust">
              <span className="stok-modal-im"><TriangleAlert size={17} /></span>
              <h3>Rapor detayı</h3>
              <button
                className="up-kapat"
                aria-label="Kapat"
                onClick={() => setDetay(false)}
              >
                <X size={19} />
              </button>
            </header>

            <div className="stok-modal-govde">
              {sapanlar.length > 0 && (
                <div className="sayim-detay-bolum">
                  <h4>
                    Sayılan miktar sistemden %{Math.round(SAPMA_SINIRI * 100)}'den
                    fazla sapıyor
                  </h4>
                  <p>
                    Onaylamadan önce tekrar sayılması iyi olur; büyük sapma
                    çoğu zaman yazılmamış fireyi ya da hatalı mal girişini
                    gösteriyor.
                  </p>
                  {sapanlar.map((r) => (
                    <div key={r.malzemeId} className="sayim-detay-satir">
                      <span>{r.malzemeAd}</span>
                      <b>
                        {miktarGoster(r.sistem, r.birim)} →{" "}
                        {miktarGoster(r.sayilan ?? 0, r.birim)}
                      </b>
                      <em>%{Math.round((r.sapma ?? 0) * 100)}</em>
                    </div>
                  ))}
                </div>
              )}

              {sayilmayan.length > 0 && (
                <div className="sayim-detay-bolum">
                  <h4>Sayılmayan malzemeler</h4>
                  <p>
                    Bu malzemelerin stoğuna dokunulmayacak; kutuyu boş bırakmak
                    "bakmadım" demek, sıfır yazmak "hiç kalmamış".
                  </p>
                  {sayilmayan.map((r) => (
                    <div key={r.malzemeId} className="sayim-detay-satir">
                      <span>{r.malzemeAd}</span>
                      <b>{miktarGoster(r.sistem, r.birim)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="up-alt">
              <button className="stok-yan-tus" onClick={() => setDetay(false)}>
                Kapat
              </button>
            </footer>
          </div>
        </div>
      )}

      {onaylanacak && (
        <OnayModal
          baslik="Sayımı onayla"
          ikon={<Check size={18} />}
          mesaj={`*${farkli.length} malzemede* fark bulundu, net tutar *${paraGoster(netTutar / 100)}*. Onaylarsanız bu farklar stok hareketi olarak yazılır ve sayım kapanır.`}
          onayMetni="Onayla"
          onOnay={onayla}
          onKapat={() => setOnaylanacak(false)}
        />
      )}

      {iptalEdilecek && (
        <OnayModal
          baslik="Sayımı iptal et"
          ikon={<X size={18} />}
          tehlikeli
          mesaj="Sayım kapanır ve *girilen rakamlar stoğa işlenmez*. Stokta hiçbir şey değişmez."
          onayMetni="İptal et"
          iptalMetni="Vazgeç"
          onOnay={iptal}
          onKapat={() => setIptalEdilecek(false)}
        />
      )}

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

      {acilanGecmis && (
        <div className="up-fon" onClick={() => setAcilanGecmis(null)}>
          <div
            className="up-modal stok-modal sayim-gecmis-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="up-ust">
              <span className="stok-modal-im"><History size={17} /></span>
              <h3>
                {gecmisZamani(acilanGecmis.sayim.baslangic)} sayımı
                <small>
                  {kapsamMetni(acilanGecmis.sayim)}
                  {acilanGecmis.sayim.kisi && ` · ${acilanGecmis.sayim.kisi}`}
                </small>
              </h3>
              <button
                className="up-kapat"
                aria-label="Kapat"
                onClick={() => setAcilanGecmis(null)}
              >
                <X size={19} />
              </button>
            </header>

            <div className="stok-modal-govde">
              {acilanGecmis.sayim.durum === "iptal" && (
                <p className="sayim-gecmis-not">
                  <Ban size={15} /> Bu sayım iptal edildi; rakamlar stoğa işlenmedi.
                </p>
              )}
              {acilanGecmis.rapor ? (
                <RaporTablosu rapor={acilanGecmis.rapor} />
              ) : (
                <div className="yukleniyor"><div className="cember" /></div>
              )}
            </div>
          </div>
        </div>
      )}

      {bildirim && <Bildirim mesaj={bildirim} onKapat={() => setBildirim("")} />}
      {hata && <Bildirim mesaj={hata} tur="hata" onKapat={() => setHata("")} />}
    </>
  );
}

/**
 * Rapor tablosu — açık sayımın onay ekranı ve geçmiş sayımın penceresi
 * aynı tabloyu gösteriyor.
 */
function RaporTablosu({ rapor }: { rapor: RaporSatiri[] }) {
  return (
    <div className="sayim-rapor">
      <div className="sayim-rapor-bas">
        <span>Malzeme</span>
        <span>Sistem</span>
        <span>Sayılan</span>
        <span>Fark</span>
        <span>Tutar</span>
      </div>
      {rapor.map((r) => {
        const sapti = r.sapma != null && r.sapma > SAPMA_SINIRI;
        return (
          <div
            key={r.malzemeId}
            className={sapti ? "sayim-rapor-satir sapan" : "sayim-rapor-satir"}
          >
            {/* Sütun etiketleri hücrenin üstünde duruyor: telefonda
                başlık satırı gizleniyor, rakam etiketsiz kalmasın. */}
            <span className="sayim-rapor-ad">{r.malzemeAd}</span>
            <span data-etiket="Sistem">{miktarGoster(r.sistem, r.birim)}</span>
            <span data-etiket="Sayılan">
              {r.sayilan == null ? (
                <em className="sayim-bos">Sayılmadı</em>
              ) : (
                miktarGoster(r.sayilan, r.birim)
              )}
            </span>
            <span
              data-etiket="Fark"
              className={r.fark < 0 ? "eksi" : r.fark > 0 ? "arti" : ""}
            >
              {r.sayilan == null
                ? "—"
                : `${r.fark > 0 ? "+" : r.fark < 0 ? "−" : ""}${miktarGoster(Math.abs(r.fark), r.birim)}`}
            </span>
            <span
              data-etiket="Tutar"
              className={r.tutar < 0 ? "eksi" : r.tutar > 0 ? "arti" : ""}
            >
              {r.fark === 0 || r.tutar === 0 ? "—" : paraGoster(r.tutar / 100)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
