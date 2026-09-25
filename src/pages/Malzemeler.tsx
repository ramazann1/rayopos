import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  History,
  Layers,
  Package,
  PackageX,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { paraGoster } from "../para";
import StokBasligi from "../components/StokBasligi";
import MalzemeGecmisi from "../components/MalzemeGecmisi";
import Anahtar from "../components/Anahtar";
import AramaKutusu from "../components/AramaKutusu";
import Bilgi from "../components/Bilgi";
import Ipucu from "../components/Ipucu";
import Bildirim from "../components/Bildirim";
import OnayModal from "../components/OnayModal";
import { renkler } from "../components/RenkSecici";
import { eslesiyor } from "../arama";
import { useKutuBoyu } from "../kutuBoyu";
import { yetkiVar } from "../oturum";
import {
  OLCULER,
  gruplariGetir,
  grupEkle,
  grupGuncelle,
  grupSil,
  kritikMi,
  kritikSeviyeleriYaz,
  malzemeEkle,
  malzemeGuncelle,
  malzemeSil,
  malzemeleriGetir,
  miktarGoster,
  miktarSayi,
  miktarYaz,
  olcuKisa,
  olcuyeCevir,
  tabanaCevir,
  type Malzeme,
  type MalzemeAlanlari,
  type MalzemeGrubu,
  type OlcuKodu,
} from "../stok";

// Maliyet depoda en küçük birim başına duruyor (0,032 TL/gram); ekranda
// malzemenin kendi ölçüsüyle okunuyor (₺32,00 / kg).
const olcuFiyati = (tabanFiyat: number, birim: OlcuKodu) =>
  `${paraGoster(tabanFiyat * tabanaCevir(1, birim))} / ${olcuKisa(birim)}`;

const stokDegerHesapla = (m: Malzeme) =>
  m.ortalamaMaliyet == null || m.miktar <= 0 ? null : m.miktar * m.ortalamaMaliyet;

export default function Malzemeler() {
  const [gruplar, setGruplar] = useState<MalzemeGrubu[]>([]);
  const [liste, setListe] = useState<Malzeme[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ara, setAra] = useState("");
  const [grupSuzgec, setGrupSuzgec] = useState<number | "tumu" | "kritik">("tumu");
  const [panel, setPanel] = useState<Malzeme | null | undefined>(undefined);
  const [grupPenceresi, setGrupPenceresi] = useState(false);
  const [kritikPenceresi, setKritikPenceresi] = useState(false);
  const [silinecek, setSilinecek] = useState<Malzeme | null>(null);
  const [gecmis, setGecmis] = useState<Malzeme | null>(null);
  const [bildirim, setBildirim] = useState("");
  const [hata, setHata] = useState("");

  // Stoğu görmek ayrı, değiştirmek ayrı yetki: mutfak sorumlusu neyin
  // bittiğine bakabilsin, alış tarafına dokunamasın.
  const yonetebilir = yetkiVar("stok.yonet");

  const tazele = async () => {
    const [g, m] = await Promise.all([gruplariGetir(), malzemeleriGetir()]);
    setGruplar(g);
    setListe(m);
  };

  useEffect(() => {
    tazele().then(() => setYukleniyor(false));
  }, []);

  // Burası tanım ekranı, satış ekranı değil: malzeme günde birkaç kez
  // değişiyor. Canlı aboneliğe bağlanmıyor, her açılışta okunuyor — canlı
  // mesaj faturanın en pahalı kalemi, tanım ekranı için ödenmesi gereksiz.

  const kritikler = liste.filter(kritikMi);
  const eksiler = liste.filter((m) => m.miktar < 0);
  // Eksi stok toplama katılmıyor: sayılmamış bir açık, depodaki malı
  // olduğundan az gösterir.
  const stokDegeri = liste.reduce((t, m) => t + (stokDegerHesapla(m) ?? 0), 0);

  const gorunen = useMemo(() => {
    let sonuc = liste;
    if (grupSuzgec === "kritik") sonuc = sonuc.filter(kritikMi);
    else if (grupSuzgec !== "tumu") sonuc = sonuc.filter((m) => m.grupId === grupSuzgec);
    return sonuc.filter((m) => eslesiyor(`${m.ad} ${m.kod} ${m.grupAd}`, ara));
  }, [liste, grupSuzgec, ara]);

  // Liste sayfayı uzatmıyor: kutu ekranda kendine kalan yeri alıyor, malzemeler
  // onun içinde kayıyor. Otuz malzemede sayfanın kendi kaydırma çubuğu uzuyor,
  // başlık ve süzgeç yukarı kaçıyordu.
  const { kutu, boy } = useKutuBoyu(gorunen.length);

  const isle = async (f: () => Promise<void>, mesaj: string) => {
    try {
      await f();
      await tazele();
      setBildirim(mesaj);
    } catch (e) {
      setHata((e as Error).message);
    }
  };

  const kaydet = async (alanlar: MalzemeAlanlari) => {
    const duzenlenen = panel;
    await isle(
      () => (duzenlenen ? malzemeGuncelle(duzenlenen.id, alanlar) : malzemeEkle(alanlar)),
      duzenlenen ? "Malzeme güncellendi" : "Malzeme eklendi"
    );
    setPanel(undefined);
  };

  return (
    <>
      <div className="sayfa ayar-sayfa">
        <StokBasligi />

        {yukleniyor ? (
          <div className="yukleniyor"><div className="cember" /></div>
        ) : liste.length === 0 ? (
          <section className="ayar-bolum">
            <div className="ayar-bos">
              <Package size={30} />
              <p>
                Henüz malzeme yok. Mutfakta kullandığınız hammaddeleri ekleyin —
                un, süt, kahve çekirdeği gibi. Reçeteler ve stok düşümü bu listeye
                dayanacak.
              </p>
              {yonetebilir && (
                <button className="ayar-ekle" onClick={() => setPanel(null)}>
                  <Plus size={15} /> İlk malzemeyi ekle
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="ayar-bolum">
            <div className={yonetebilir ? "stok-ozet dortlu" : "stok-ozet"}>
              <div className="stok-ozet-kart">
                <span className="stok-ozet-im"><Boxes size={20} /></span>
                <em>{liste.length}</em>
                <small>Malzeme</small>
              </div>
              <div className={kritikler.length ? "stok-ozet-kart uyari" : "stok-ozet-kart"}>
                <span className="stok-ozet-im"><TriangleAlert size={20} /></span>
                <em>{kritikler.length}</em>
                <small>Kritik seviyede</small>
              </div>
              <div className={eksiler.length ? "stok-ozet-kart tehlike" : "stok-ozet-kart"}>
                <span className="stok-ozet-im"><PackageX size={20} /></span>
                <em>{eksiler.length}</em>
                <small>Eksiye düşen</small>
              </div>
              {yonetebilir && (
                <div className="stok-ozet-kart">
                  <span className="stok-ozet-im"><Wallet size={20} /></span>
                  <em>{paraGoster(stokDegeri)}</em>
                  <small>Stok değeri</small>
                </div>
              )}
            </div>

            {/* Süzgeç ile eylem aynı şeritte, aynı kılıkta durunca göz
                hangisinin listeyi daralttığını, hangisinin bir şey yaptığını
                ayıramıyordu. Süzgeç yukarıda kendi şeridinde (ayar
                ekranlarındaki alt şeridin aynısı), eylemler bölüm başlığında. */}
            <div className="alt-serit stok-serit">
              <button
                className={grupSuzgec === "tumu" ? "alt-sekme aktif" : "alt-sekme"}
                onClick={() => setGrupSuzgec("tumu")}
              >
                <Boxes size={15} /> Tümü
                <em className="stok-serit-sayi">{liste.length}</em>
              </button>
              {kritikler.length > 0 && (
                <button
                  className={grupSuzgec === "kritik" ? "alt-sekme aktif" : "alt-sekme"}
                  onClick={() => setGrupSuzgec("kritik")}
                >
                  <TriangleAlert size={15} /> Kritik
                  <em className="stok-serit-sayi">{kritikler.length}</em>
                </button>
              )}
              {gruplar.length > 0 && (
                <GrupSuzgeci
                  gruplar={gruplar}
                  secili={typeof grupSuzgec === "number" ? grupSuzgec : null}
                  sayi={(id) => liste.filter((m) => m.grupId === id).length}
                  sec={(id) => setGrupSuzgec(id === null ? "tumu" : id)}
                />
              )}
            </div>

            <div className="ayar-bolum-ust">
              {/* Açıklama tam genişlikte bir kutu olarak duruyordu: tek cümle
                  için sayfanın en değerli yerini kaplıyordu. Aynı bilgi
                  başlığın yanındaki işarette — duruyor ama yer tutmuyor. */}
              <h2>
                <Package size={17} /> Malzemeler
                <Ipucu baslik="Malzeme nedir">
                  Mutfağın hammaddesidir; menüdeki ürünlerden ayrı durur ve
                  satılmaz. Miktarını yalnız stok hareketi değiştirir.
                </Ipucu>
              </h2>
              {/* Arama sayfa başlığında değil burada: süzgeç şeridiyle aynı
                  hizada dursun, "hangi listeyi daraltıyorum" belli olsun. */}
              <AramaKutusu deger={ara} degistir={setAra} yer="Malzeme ara" />
              {yonetebilir && (
                <>
                  <button
                    className="stok-yan-tus"
                    title="Malzeme grupları"
                    onClick={() => setGrupPenceresi(true)}
                  >
                    <Layers size={16} /> Gruplar
                  </button>
                  <button
                    className="stok-yan-tus"
                    title="Kritik seviyeleri toplu gir"
                    onClick={() => setKritikPenceresi(true)}
                  >
                    <TriangleAlert size={16} /> Kritik seviyeler
                  </button>
                  <button className="ayar-ekle" onClick={() => setPanel(null)}>
                    <Plus size={15} /> Malzeme ekle
                  </button>
                </>
              )}
            </div>

            {gorunen.length === 0 ? (
              <div className="ayar-bos">
                <Package size={30} />
                <p>{ara ? `"${ara}" ile eşleşen malzeme yok.` : "Bu süzgeçte malzeme yok."}</p>
              </div>
            ) : (
              <div className="stok-liste" ref={kutu} style={{ maxHeight: boy || undefined }}>
                {gorunen.map((m) => {
                  const grup = gruplar.find((g) => g.id === m.grupId);
                  const eksi = m.miktar < 0;
                  const kritik = kritikMi(m);
                  return (
                    <div
                      key={m.id}
                      className={
                        "stok-satir" + (yonetebilir ? " maliyetli" : "") +
                        (eksi ? " eksi" : kritik ? " kritik" : "") +
                        (m.aktif ? "" : " pasif")
                      }
                      style={grup?.renk ? { ["--satir-renk" as any]: grup.renk } : undefined}
                    >
                      <span className="stok-im">
                        {eksi ? <PackageX size={18} /> : kritik ? <TriangleAlert size={18} /> : <Package size={18} />}
                      </span>

                      <span className="stok-ad">
                        {m.ad}
                        <small>
                          {[grup?.ad, m.kod, m.aktif ? null : "Kullanım dışı"]
                            .filter(Boolean)
                            .join(" · ") || "Grupsuz"}
                        </small>
                      </span>

                      <span className="stok-miktar">
                        {miktarGoster(m.miktar, m.birim)}
                        <small>
                          {m.kritikSeviye > 0
                            ? `Kritik: ${miktarGoster(m.kritikSeviye, m.birim)}`
                            : "Kritik seviye yok"}
                        </small>
                      </span>

                      {yonetebilir && (
                        <span className="stok-maliyet">
                          {m.ortalamaMaliyet == null ? (
                            "Fiyat yok"
                          ) : (
                            <>
                              {olcuFiyati(m.ortalamaMaliyet, m.birim)}
                              <small>
                                {stokDegerHesapla(m) == null
                                  ? "Stok değeri yok"
                                  : `Stok değeri ${paraGoster(stokDegerHesapla(m)!)}`}
                              </small>
                            </>
                          )}
                        </span>
                      )}

                      <span className="stok-durum">
                        {eksi ? (
                          <b className="stok-rozet tehlike"><PackageX size={13} /> Eksi stok</b>
                        ) : kritik ? (
                          <b className="stok-rozet uyari"><TriangleAlert size={13} /> Azaldı</b>
                        ) : null}
                      </span>

                      {/* Geçmişe bakmak bir şey değiştirmiyor: stoğu yalnız
                          görebilen kişi de "süt neden eksik" sorusunu sorabilsin. */}
                      <span className="stok-islem">
                        <button onClick={() => setGecmis(m)} title="Geçmiş">
                          <History size={15} />
                        </button>
                        {yonetebilir && (
                          <>
                            <button onClick={() => setPanel(m)} title="Düzenle">
                              <Pencil size={15} />
                            </button>
                            <button
                              className="tehlike"
                              onClick={() => setSilinecek(m)}
                              title="Sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {panel !== undefined && (
        <MalzemePaneli
          malzeme={panel}
          gruplar={gruplar}
          onKapat={() => setPanel(undefined)}
          onKaydet={kaydet}
          onSil={panel ? () => setSilinecek(panel) : undefined}
          onGruplar={() => setGrupPenceresi(true)}
          onGecmis={panel ? () => setGecmis(panel) : undefined}
        />
      )}

      {gecmis && <MalzemeGecmisi malzeme={gecmis} onKapat={() => setGecmis(null)} />}

      {grupPenceresi && (
        <GrupPenceresi
          gruplar={gruplar}
          sayi={(id) => liste.filter((m) => m.grupId === id).length}
          onKapat={() => setGrupPenceresi(false)}
          onDegisti={tazele}
        />
      )}

      {kritikPenceresi && (
        <KritikPenceresi
          malzemeler={liste}
          onKapat={() => setKritikPenceresi(false)}
          onKaydet={async (degerler) => {
            await isle(() => kritikSeviyeleriYaz(degerler), "Kritik seviyeler kaydedildi");
            setKritikPenceresi(false);
          }}
        />
      )}

      {silinecek && (
        <OnayModal
          mesaj={`*${silinecek.ad}* silinsin mi? Reçetelerde kullanılıyorsa önce oradan çıkarılmalı.`}
          tehlikeli
          onOnay={async () => {
            const m = silinecek;
            setSilinecek(null);
            setPanel(undefined);
            await isle(() => malzemeSil(m.id), "Malzeme silindi");
          }}
          onKapat={() => setSilinecek(null)}
        />
      )}

      {hata && <OnayModal mesaj={hata} tekTus onKapat={() => setHata("")} />}
      {bildirim && <Bildirim mesaj={bildirim} onKapat={() => setBildirim("")} />}
    </>
  );
}

/**
 * Grup süzgeci — şeritte tek düğme, aramalı listeyle açılıyor.
 *
 * Gruplar önce şeride tek tek diziliyordu; elli grubu olan bir işletmede
 * şerit dört satır olup listeyi aşağı itiyordu. Bölüm seçicide çözülmüş
 * problemin aynısı: sığmayan seçim düğmenin arkasına girer, aramayla bulunur.
 */
function GrupSuzgeci({
  gruplar,
  secili,
  sayi,
  sec,
}: {
  gruplar: MalzemeGrubu[];
  secili: number | null;
  sayi: (id: number) => number;
  sec: (id: number | null) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState("");

  const simdiki = gruplar.find((g) => g.id === secili);
  const gorunen = gruplar.filter((g) => eslesiyor(g.ad, ara));

  const git = (id: number | null) => {
    setAcik(false);
    setAra("");
    sec(id);
  };

  return (
    <>
      <button
        className={secili !== null ? "alt-sekme aktif" : "alt-sekme"}
        onClick={() => setAcik(true)}
      >
        {simdiki ? (
          <>
            <i
              className="stok-grup-nokta"
              style={{ background: simdiki.renk ?? "var(--cizgi-koyu)" }}
            />
            {simdiki.ad}
            <em className="stok-serit-sayi">{sayi(simdiki.id)}</em>
          </>
        ) : (
          <>
            <Layers size={15} /> Grup
          </>
        )}
        <ChevronDown size={15} />
      </button>

      {acik && (
        <div className="up-fon ust" onClick={() => setAcik(false)}>
          <div className="up-modal stok-modal" onClick={(e) => e.stopPropagation()}>
            <header className="up-ust">
              <span className="stok-modal-im"><Layers size={17} /></span>
              <h3>Gruba göre süz</h3>
              <button className="up-kapat" aria-label="Kapat" onClick={() => setAcik(false)}>
                <X size={19} />
              </button>
            </header>

            <div className="bs-ara">
              <Search size={16} />
              <input
                value={ara}
                onChange={(e) => setAra(e.target.value)}
                placeholder="Grup ara"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && gorunen[0] && git(gorunen[0].id)}
              />
            </div>

            <div className="bs-izgara">
              <button
                className={secili === null ? "bs-kart secili" : "bs-kart"}
                onClick={() => git(null)}
              >
                <span className="bs-kart-im"><Boxes size={19} /></span>
                <span className="bs-kart-ad">Tüm gruplar</span>
              </button>
              {gorunen.map((g) => (
                <button
                  key={g.id}
                  className={secili === g.id ? "bs-kart secili" : "bs-kart"}
                  onClick={() => git(g.id)}
                >
                  <span className="bs-kart-im">
                    <i
                      className="stok-grup-nokta buyuk"
                      style={{ background: g.renk ?? "var(--cizgi-koyu)" }}
                    />
                  </span>
                  <span className="bs-kart-ad">{g.ad}</span>
                  <em className="bs-kart-sayi">{sayi(g.id)}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Malzeme kartı. Miktar alanı bilerek yok: stok yalnız hareketle değişir. */
function MalzemePaneli({
  malzeme,
  gruplar,
  onKapat,
  onKaydet,
  onSil,
  onGruplar,
  onGecmis,
}: {
  malzeme: Malzeme | null;
  gruplar: MalzemeGrubu[];
  onKapat: () => void;
  onKaydet: (alanlar: MalzemeAlanlari) => void;
  onSil?: () => void;
  onGruplar: () => void;
  onGecmis?: () => void;
}) {
  const [ad, setAd] = useState(malzeme?.ad ?? "");
  const [kod, setKod] = useState(malzeme?.kod ?? "");
  const [grupId, setGrupId] = useState<number | null>(malzeme?.grupId ?? null);
  const [birim, setBirim] = useState<OlcuKodu>(malzeme?.birim ?? "kg");
  const [aktif, setAktif] = useState(malzeme?.aktif ?? true);
  const [kritik, setKritik] = useState(
    malzeme && malzeme.kritikSeviye > 0
      ? String(olcuyeCevir(malzeme.kritikSeviye, malzeme.birim)).replace(".", ",")
      : ""
  );

  const kritikDeger = miktarSayi(kritik);
  const gecerli = ad.trim() !== "" && (kritikDeger === undefined || kritikDeger >= 0);

  return (
    <div className="up-fon" onClick={onKapat}>
      <div className="up-modal stok-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><Package size={17} /></span>
          <h3>{malzeme ? "Malzemeyi düzenle" : "Yeni malzeme"}</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
        </header>

        <div className="stok-modal-govde">
          {/* Alan düzeni Menü Stüdyosu'ndaki ürün paneliyle aynı: etiketli
              kutular, iki sütun. Ölçü ve grup önce çip sırasıydı; beş hap yan
              yana dizilince hepsi aynı ağırlıkta bağırıyor, form da uzuyordu. */}
          <div className="up-izgara">
            <div className="up-alan genis">
              <label htmlFor="stok-ad">Malzeme adı</label>
              <input
                id="stok-ad"
                autoFocus
                placeholder="Un, süt, kahve çekirdeği"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
              />
            </div>

            <div className="up-alan">
              <label htmlFor="stok-birim">Ölçü birimi</label>
              <select
                id="stok-birim"
                value={birim}
                onChange={(e) => setBirim(e.target.value as OlcuKodu)}
              >
                {OLCULER.map((o) => (
                  <option key={o.kod} value={o.kod}>{o.ad}</option>
                ))}
              </select>
            </div>

            <div className="up-alan">
              <label htmlFor="stok-grup">Grup</label>
              <div className="stok-grup-alan">
                <select
                  id="stok-grup"
                  value={grupId ?? ""}
                  onChange={(e) => setGrupId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Grupsuz</option>
                  {gruplar
                    .filter((g) => g.aktif || g.id === grupId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.ad}</option>
                    ))}
                </select>
                <button type="button" title="Yeni grup" onClick={onGruplar}>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="up-alan">
              <label htmlFor="stok-kritik">Kritik seviye</label>
              <div className="up-sonek">
                <input
                  id="stok-kritik"
                  inputMode="decimal"
                  placeholder="Uyarı yok"
                  value={kritik}
                  onChange={(e) => setKritik(miktarYaz(e.target.value))}
                />
                <em>{olcuKisa(birim)}</em>
              </div>
            </div>

            <div className="up-alan">
              <label htmlFor="stok-kod">Stok kodu</label>
              <input
                id="stok-kod"
                placeholder="İsteğe bağlı"
                value={kod}
                onChange={(e) => setKod(e.target.value)}
              />
            </div>
          </div>

          {malzeme && (
            <div className="stok-panel-durum">
              <span>
                <Boxes size={15} /> Mevcut stok
                <b>{miktarGoster(malzeme.miktar, malzeme.birim)}</b>
              </span>
              <span>
                <Wallet size={15} /> Ortalama maliyet
                <b>
                  {malzeme.ortalamaMaliyet == null
                    ? "Fiyat yok"
                    : olcuFiyati(malzeme.ortalamaMaliyet, malzeme.birim)}
                </b>
              </span>
              <span>
                <ReceiptText size={15} /> Son alış fiyatı
                <b>
                  {malzeme.sonAlisFiyati == null
                    ? "Fiyat yok"
                    : olcuFiyati(malzeme.sonAlisFiyati, malzeme.birim)}
                </b>
              </span>
              <p>
                Miktar buradan değiştirilemez; stok girişi, sayım ve fire
                ekranlarından yapılan her hareket deftere yazılır.
              </p>
              {onGecmis && (
                <button type="button" className="stok-panel-gecmis" onClick={onGecmis}>
                  <History size={15} /> Geçmişi gör
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
          )}

          {/* Artık alınmayan malzeme silinmiyor — geçmiş hareketleri ve eski
              reçeteleri durduğu için silinemiyor da. Kapatılıyor: listede
              "kullanım dışı" olarak kalıyor, yeni reçete ve sayım
              ekranlarında çıkmıyor. */}
          <Anahtar
            etiket="Kullanımda"
            ipucu="Kapatırsanız yeni reçete ve sayım listelerinde çıkmaz; geçmiş kayıtları durur."
            acik={aktif}
            degistir={setAktif}
          />
        </div>

        <footer className="up-alt">
          {onSil && (
            <button className="up-tus sil" onClick={onSil}>
              <Trash2 size={15} /> Sil
            </button>
          )}
          <button className="up-tus vazgec" onClick={onKapat}>Vazgeç</button>
          <button
            className="up-tus kaydet"
            disabled={!gecerli}
            onClick={() =>
              onKaydet({
                grupId,
                ad,
                kod,
                birim,
                kritikSeviye: kritikDeger ? tabanaCevir(kritikDeger, birim) : 0,
                aktif,
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
 * Küçük renk noktası — tıklayınca sekiz hazır rengi olan minik bir pencere
 * açılıyor. Ortak renk seçici bütün paletini satır içine seriyor; geniş
 * kategori panelinde yeri var ama dar bir liste satırında ekranı boyuyordu.
 */
function RenkNoktasi({
  renk,
  degistir,
}: {
  renk: string | null;
  degistir: (r: string | null) => void;
}) {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <button
        className="stok-renk-tus"
        title="Renk"
        style={{ background: renk ?? "transparent" }}
        onClick={() => setAcik(true)}
      >
        {!renk && <Ban size={13} />}
      </button>

      {acik && (
        <div className="up-fon ust" onClick={() => setAcik(false)}>
          <div className="up-modal stok-renk-modal" onClick={(e) => e.stopPropagation()}>
            <header className="up-ust">
              <h3>Grup rengi</h3>
              <button className="up-kapat" aria-label="Kapat" onClick={() => setAcik(false)}>
                <X size={19} />
              </button>
            </header>
            <div className="stok-renk-izgara">
              <button
                className={renk ? "stok-renk-kare" : "stok-renk-kare secili"}
                title="Renksiz"
                onClick={() => {
                  degistir(null);
                  setAcik(false);
                }}
              >
                <Ban size={15} />
              </button>
              {renkler.map((r) => (
                <button
                  key={r}
                  className={r === renk ? "stok-renk-kare secili" : "stok-renk-kare"}
                  style={{ background: r }}
                  onClick={() => {
                    degistir(r);
                    setAcik(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Gruplar penceresi — tek ritim.
 *
 * Önce üç ayrı blok vardı: açıklama kutusu, ekleme formu, liste. Üçü de
 * farklı yükseklikte ve farklı çerçevedeydi, pencere derli toplu durmuyordu.
 * Şimdi tek liste var: ekleme de listenin son satırı, düzenleme de satırın
 * kendi içinde oluyor. İşlemler satırın üstüne gelince çıkıyor — yedi grupta
 * on dört ikon birden görünmüyor.
 */
function GrupPenceresi({
  gruplar,
  sayi,
  onKapat,
  onDegisti,
}: {
  gruplar: MalzemeGrubu[];
  sayi: (id: number) => number;
  onKapat: () => void;
  onDegisti: () => Promise<void>;
}) {
  const [yeni, setYeni] = useState("");
  const [yeniRenk, setYeniRenk] = useState(renkler[gruplar.length % renkler.length]);
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null);
  const [ad, setAd] = useState("");
  const [silinecek, setSilinecek] = useState<MalzemeGrubu | null>(null);
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

  const ekle = async () => {
    if (!yeni.trim()) return;
    const renk = yeniRenk;
    setYeni("");
    // Sıradaki grup paletten bir sonraki rengi alıyor: renge hiç dokunmayan
    // işletmede bile liste tek renge düşmüyor.
    setYeniRenk(renkler[(gruplar.length + 1) % renkler.length]);
    await isle(() => grupEkle(yeni, renk, gruplar.length));
  };

  const adiKaydet = async (id: number) => {
    await isle(() => grupGuncelle(id, { ad }));
    setDuzenlenen(null);
  };

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal gp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><Layers size={17} /></span>
          <h3>Gruplar</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
        </header>

        <div className="gp-liste">
          {gruplar.map((g) => (
            <div
              key={g.id}
              className={duzenlenen === g.id ? "gp-satir duzenleniyor" : "gp-satir"}
              style={{ ["--grup-renk" as any]: g.renk ?? "var(--cizgi-koyu)" }}
            >
              <RenkNoktasi
                renk={g.renk}
                degistir={(r) => isle(() => grupGuncelle(g.id, { renk: r }))}
              />

              {duzenlenen === g.id ? (
                <>
                  <input
                    className="gp-giris"
                    value={ad}
                    autoFocus
                    onChange={(e) => setAd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") adiKaydet(g.id);
                      if (e.key === "Escape") setDuzenlenen(null);
                    }}
                  />
                  <button className="gp-onay" title="Kaydet" onClick={() => adiKaydet(g.id)}>
                    <Check size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="gp-ad"
                    title="Adını değiştir"
                    onClick={() => {
                      setDuzenlenen(g.id);
                      setAd(g.ad);
                    }}
                  >
                    {g.ad}
                  </button>
                  <span className="gp-sayi">{sayi(g.id)}</span>
                  <button className="gp-islem" title="Sil" onClick={() => setSilinecek(g)}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Ekleme satırı listenin devamı: ayrı bir form bloğu olmadığı için
              pencere tek akış hâlinde okunuyor. */}
          <div className="gp-satir gp-yeni">
            <RenkNoktasi renk={yeniRenk} degistir={(r) => setYeniRenk(r ?? renkler[0])} />
            <input
              className="gp-giris"
              placeholder="Yeni grup"
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ekle()}
            />
            <button className="gp-onay" title="Ekle" disabled={!yeni.trim()} onClick={ekle}>
              <Plus size={17} />
            </button>
          </div>
        </div>

        {hata && <p className="gp-hata">{hata}</p>}
      </div>

      {/* Silinen grup malzemeleri götürmüyor, yalnız etiketlerini düşürüyor.
          Onay cümlesi bunu söylüyor: "ne kaybedeceğim" sorusu pencerede
          cevaplanmazsa kullanıcı silmeye çekiniyor. */}
      {silinecek && (
        <OnayModal
          mesaj={
            sayi(silinecek.id) > 0
              ? `*${silinecek.ad}* grubu silinsin mi? İçindeki ${sayi(silinecek.id)} malzeme silinmez, grupsuz kalır.`
              : `*${silinecek.ad}* grubu silinsin mi?`
          }
          tehlikeli
          onayMetni="Sil"
          onOnay={async () => {
            const g = silinecek;
            setSilinecek(null);
            await isle(() => grupSil(g.id));
          }}
          onKapat={() => setSilinecek(null)}
        />
      )}
    </div>
  );
}


/**
 * Kritik seviyeleri tek pencerede toplu girme.
 *
 * Adisyo'da bu alan yalnız malzemenin kendi kartından giriliyor; otuz
 * malzemenin yalnız birinde dolu olmasının sebebi bu. Burada hepsi alt alta:
 * bir oturuşta doldurulabilir, dolayısıyla uyarı gerçekten çalışır.
 */
function KritikPenceresi({
  malzemeler,
  onKapat,
  onKaydet,
}: {
  malzemeler: Malzeme[];
  onKapat: () => void;
  onKaydet: (degerler: { id: number; kritikSeviye: number }[]) => void;
}) {
  const [degerler, setDegerler] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      malzemeler.map((m) => [
        m.id,
        m.kritikSeviye > 0
          ? String(olcuyeCevir(m.kritikSeviye, m.birim)).replace(".", ",")
          : "",
      ])
    )
  );
  const [ara, setAra] = useState("");

  const gorunen = malzemeler.filter((m) => eslesiyor(`${m.ad} ${m.grupAd}`, ara));

  const kaydet = () => {
    const degisen = malzemeler
      .map((m) => {
        const sayi = miktarSayi(degerler[m.id] ?? "");
        const yeni = sayi && sayi > 0 ? tabanaCevir(sayi, m.birim) : 0;
        return { id: m.id, kritikSeviye: yeni, eski: m.kritikSeviye };
      })
      .filter((d) => d.kritikSeviye !== d.eski)
      .map(({ id, kritikSeviye }) => ({ id, kritikSeviye }));
    onKaydet(degisen);
  };

  return (
    <div className="up-fon ust" onClick={onKapat}>
      <div className="up-modal stok-modal stok-kritik-panel" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="stok-modal-im"><TriangleAlert size={17} /></span>
          <h3>Kritik seviyeler</h3>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}><X size={19} /></button>
        </header>

        <div className="stok-modal-govde">
          <Bilgi>
            Malzeme bu miktarın altına düştüğünde listede uyarı olarak görünür.
            Boş bırakılan malzeme için uyarı çıkmaz. Hepsini burada tek seferde
            girebilirsiniz.
          </Bilgi>

          <div className="ayar-arama stok-kritik-ara">
            <Search size={16} />
            <input
              placeholder="Malzeme ara"
              value={ara}
              onChange={(e) => setAra(e.target.value)}
            />
          </div>

          <div className="stok-kritik-liste">
            {gorunen.map((m) => (
              <div key={m.id} className="stok-kritik-satir">
                <span className="stok-kritik-ad">
                  {m.ad}
                  <small>{miktarGoster(m.miktar, m.birim)} mevcut</small>
                </span>
                <div className="stok-kritik-giris">
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={degerler[m.id] ?? ""}
                    onChange={(e) =>
                      setDegerler((d) => ({ ...d, [m.id]: miktarYaz(e.target.value) }))
                    }
                  />
                  <em>{olcuKisa(m.birim)}</em>
                </div>
              </div>
            ))}
            {gorunen.length === 0 && (
              <p className="stok-bos-satir">
                <CircleAlert size={15} /> Eşleşen malzeme yok.
              </p>
            )}
          </div>
        </div>

        <footer className="up-alt">
          <button className="up-tus vazgec" onClick={onKapat}>Vazgeç</button>
          <button className="up-tus kaydet" onClick={kaydet}>
            <Check size={16} /> Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
}
