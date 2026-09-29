import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bike,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Network,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Server,
  Trash2,
  Usb,
  Zap,
} from "lucide-react";
import { yetkiVar } from "../oturum";
import {
  kopruEslestir,
  kopruHesaplariniGetir,
  kopruKaldir,
  type KopruHesabi,
} from "../yaziciHesabi";
import Ipucu from "../components/Ipucu";
import { koprulariGetir, type KopruCihazi } from "../kopru";
import AyarBasligi from "../components/AyarBasligi";
import Anahtar from "../components/Anahtar";
import Bilgi from "../components/Bilgi";
import KopruIndir from "../components/KopruIndir";
import Bildirim from "../components/Bildirim";
import OnayModal from "../components/OnayModal";
import OrtaPencere from "../components/OrtaPencere";
import {
  BAGLANTILAR,
  TURLER,
  baglantiAdi,
  istasyonKaydet,
  istasyonSil,
  istasyonlariGetir,
  turAdi,
  yaziciKaydet,
  yaziciSil,
  yaziciSirasiniKaydet,
  yazicilariGetir,
  type Baglanti,
  type Istasyon,
  type Yazici,
  type YaziciAlanlari,
  type YaziciTuru,
} from "../yazicilar";

// Bağlantı ve tür seçimleri metin listesi yerine ikonlu kartlarla yapılıyor;
// işletmeci kablonun mu ağın mı söz konusu olduğunu okumadan ayırt ediyor.
const baglantiIkon: Record<string, typeof Network> = {
  ethernet: Network,
  usb: Usb,
  webusb: Zap,
};

const turIkon: Record<string, typeof Receipt> = {
  adisyon: Receipt,
  mutfak: ChefHat,
  kurye: Bike,
};

const turAciklama: Record<string, string> = {
  adisyon: "Müşteriye verilen hesap fişi",
  mutfak: "Siparişin istasyona giden fişi",
  kurye: "Paket siparişin adres fişi",
};

function YaziciPaneli({
  yazici,
  istasyonlar,
  onKapat,
  onKaydet,
  onSil,
}: {
  yazici: Yazici | null;
  istasyonlar: Istasyon[];
  onKapat: () => void;
  onKaydet: (alanlar: YaziciAlanlari) => void;
  onSil?: () => void;
}) {
  const [ad, setAd] = useState(yazici?.ad ?? "");
  const [baglanti, setBaglanti] = useState<Baglanti>(yazici?.baglanti ?? "ethernet");
  const [ip, setIp] = useState(yazici?.ip ?? "");
  const [port, setPort] = useState(String(yazici?.port ?? 9100));
  const [sistemAd, setSistemAd] = useState(yazici?.sistemAd ?? "");
  const [cihaz, setCihaz] = useState(yazici?.cihaz ?? "");
  const [kasalar, setKasalar] = useState<KopruCihazi[]>([]);
  const [kagit, setKagit] = useState(yazici?.kagitGenislik ?? 80);
  // Yeni yazıcıda zil açık geliyor. Kapalı başlayınca yazıcı takılıyor, fiş
  // çıkıyor ama ses çıkmıyor ve sebebi aranıyor — sessizlik arıza gibi
  // görünüyor. Ses istenmeyen tek yer kasadaki adisyon yazıcısı; orada
  // anahtar kapatılıyor. Kayıtlı yazıcı kendi ayarıyla geliyor.
  const [zil, setZil] = useState(yazici?.zil ?? true);
  const [cekmece, setCekmece] = useState(yazici?.cekmece ?? false);
  const [turler, setTurler] = useState<YaziciTuru[]>(yazici?.turler ?? ["adisyon"]);
  const [secilenler, setSecilenler] = useState<number[]>(yazici?.istasyonlar ?? []);
  const [aktif, setAktif] = useState(yazici?.aktif ?? true);

  // Kasa listesi köprünün kendi bildirdiği cihazlardan geliyor; elle yazılan
  // bir kimlik yanlış yazıldığında yazıcı sessizce basmaz olurdu.
  useEffect(() => {
    koprulariGetir().then(setKasalar).catch(() => setKasalar([]));
  }, []);

  const turDegis = (kod: YaziciTuru, acik: boolean) =>
    setTurler((eski) => (acik ? [...eski, kod] : eski.filter((t) => t !== kod)));

  const istasyonDegis = (id: number, acik: boolean) =>
    setSecilenler((eski) => (acik ? [...eski, id] : eski.filter((i) => i !== id)));

  const secilenBaglanti = BAGLANTILAR.find((b) => b.kod === baglanti)!;
  const gecerli =
    ad.trim().length > 0 &&
    turler.length > 0 &&
    (baglanti !== "ethernet" || ip.trim().length > 0);

  return (
    <OrtaPencere
      ikon={Printer}
      baslik={yazici ? "Yazıcıyı düzenle" : "Yeni yazıcı"}
      aciklama="Bağlantısı ve hangi fişlerin bu yazıcıdan çıkacağı"
      genislik="cok-genis"
      onKapat={onKapat}
      alt={
        <>
          {onSil && (
            <button className="pnc-sil" onClick={onSil} aria-label="Sil">
              <Trash2 size={17} />
            </button>
          )}
          <button className="pnc-vazgec" onClick={onKapat}>Vazgeç</button>
          <button
            className="pnc-kaydet"
            disabled={!gecerli}
            onClick={() =>
              onKaydet({
                ad,
                baglanti,
                ip,
                port: Number(port) || 9100,
                sistemAd,
                cihaz,
                kagitGenislik: kagit,
                zil,
                cekmece,
                turler,
                aktif,
                istasyonlar: secilenler,
              })
            }
          >
            <Check size={17} /> Kaydet
          </button>
        </>
      }
    >
      <div className="yz-sutunlar">
        <div>
          <div className="alan">
            <label>Yazıcı adı</label>
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Mutfak, Bar, Kasa…"
              autoFocus
            />
          </div>

          <div className="yz-bolum">
            <h4>Bağlantı</h4>
            <div className="yz-kartlar">
              {BAGLANTILAR.map((b) => {
                const Ikon = baglantiIkon[b.kod];
                return (
                  <button
                    key={b.kod}
                    className={baglanti === b.kod ? "yz-kart secili" : "yz-kart"}
                    onClick={() => setBaglanti(b.kod)}
                  >
                    <Ikon size={20} />
                    <strong>{b.ad}</strong>
                  </button>
                );
              })}
            </div>
            <p className="yz-aciklama">{secilenBaglanti.aciklama}</p>

            {baglanti === "ethernet" && (
              <div className="alan ikili">
                <div>
                  <label>IP adresi</label>
                  <input
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="192.168.1.50"
                  />
                </div>
                <div>
                  <label>Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="9100"
                  />
                </div>
              </div>
            )}

            {baglanti === "usb" && (
              <>
                <div className="alan">
                  <label>Bilgisayardaki yazıcı adı</label>
                  <input
                    value={sistemAd}
                    onChange={(e) => setSistemAd(e.target.value)}
                    placeholder="XP-80"
                  />
                </div>

                {/* USB yazıcı yalnız takılı olduğu bilgisayardan basabiliyor;
                    işletmede birden çok kasa varsa fişin hangisine gideceği
                    burada söyleniyor. Tek kasalı işletme bu alana hiç
                    dokunmuyor. */}
                <div className="alan">
                  <label>Bu yazıcı hangi kasada takılı?</label>
                  <div className="yz-cipler">
                    <button
                      className={cihaz ? "yz-cip" : "yz-cip secili"}
                      onClick={() => setCihaz("")}
                    >
                      {!cihaz && <Check size={13} />}
                      Fark etmez
                    </button>
                    {kasalar.map((k) => (
                      <button
                        key={k.cihaz}
                        className={cihaz === k.cihaz ? "yz-cip secili" : "yz-cip"}
                        onClick={() => setCihaz(k.cihaz)}
                      >
                        {cihaz === k.cihaz && <Check size={13} />}
                        {k.cihaz}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="alan">
              <label>Kâğıt genişliği</label>
              <div className="yz-cipler">
                {[80, 58].map((mm) => (
                  <button
                    key={mm}
                    className={kagit === mm ? "yz-cip secili" : "yz-cip"}
                    onClick={() => setKagit(mm)}
                  >
                    {kagit === mm && <Check size={13} />}
                    {mm} mm
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>

          <div className="yz-bolum">
            <h4>Bu yazıcıdan çıkacak fişler</h4>
            <div className="yz-secimler">
              {TURLER.map((t) => {
                const Ikon = turIkon[t.kod];
                const secili = turler.includes(t.kod);
                return (
                  // Mutfak fişinin istasyon seçimi kendi satırının içinde
                  // açılıyor: ayrı bir bölüm olarak aşağıda belirince hangi
                  // seçime ait olduğu anlaşılmıyordu.
                  <div
                    key={t.kod}
                    className={secili ? "yz-secim-kutu secili" : "yz-secim-kutu"}
                  >
                    <button className="yz-secim" onClick={() => turDegis(t.kod, !secili)}>
                      <span className="yz-secim-ikon"><Ikon size={18} /></span>
                      <span className="yz-secim-yazi">
                        <strong>{t.ad} fişi</strong>
                        <em>{turAciklama[t.kod]}</em>
                      </span>
                      <span className="yz-tik">{secili && <Check size={14} />}</span>
                    </button>

                    {t.kod === "mutfak" && secili && (
                      <div className="yz-alt-secim">
                        <label>Hangi istasyonların siparişi bu yazıcıdan çıksın?</label>
                        {istasyonlar.length === 0 ? (
                          <Bilgi>
                            Henüz istasyon yok. İstasyonlar sekmesinden ekledikten sonra
                            buradan seçebilirsiniz.
                          </Bilgi>
                        ) : (
                          <div className="yz-cipler">
                            {istasyonlar.map((i) => {
                              const acik = secilenler.includes(i.id);
                              return (
                                <button
                                  key={i.id}
                                  className={acik ? "yz-cip secili" : "yz-cip"}
                                  onClick={() => istasyonDegis(i.id, !acik)}
                                >
                                  {acik && <Check size={13} />}
                                  {i.ad}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Anahtar
            etiket="Fiş çıkarken zil çalsın"
            ipucu="Fişin düştüğünü haber verir. Kasa yazıcısında kapatabilirsiniz."
            acik={zil}
            degistir={setZil}
          />

          {baglanti !== "webusb" && (
            <Anahtar
              etiket="Para çekmecesi bu yazıcıya bağlı"
              ipucu="Çekmece yazıcının arkasındaki uçtan açılır"
              acik={cekmece}
              degistir={setCekmece}
            />
          )}

          <Anahtar
            etiket="Kullanımda"
            ipucu="Kapatırsanız yazıcı silinmez, fiş gönderilmez"
            acik={aktif}
            degistir={setAktif}
          />
        </div>
      </div>
    </OrtaPencere>
  );
}

function IstasyonPaneli({
  istasyon,
  onKapat,
  onKaydet,
  onSil,
}: {
  istasyon: Istasyon | null;
  onKapat: () => void;
  onKaydet: (alanlar: { ad: string; pisirme: boolean; paketleme: boolean }) => void;
  onSil?: () => void;
}) {
  const [ad, setAd] = useState(istasyon?.ad ?? "");
  // Anahtarlar istasyon ekranındaki akışı uzatıyor; varsayılan kapalı, yani
  // sipariş düşer düşmez tek tuşla hazır işaretleniyor.
  const [pisirme, setPisirme] = useState(istasyon?.pisirme ?? false);
  const [paketleme, setPaketleme] = useState(istasyon?.paketleme ?? false);

  return (
    <OrtaPencere
      ikon={Server}
      baslik={istasyon ? "İstasyonu düzenle" : "Yeni istasyon"}
      aciklama="Siparişin hazırlandığı yer: mutfak, bar, nargile"
      genislik="dar"
      onKapat={onKapat}
      alt={
        <>
          {onSil && (
            <button className="pnc-sil" onClick={onSil} aria-label="Sil">
              <Trash2 size={17} />
            </button>
          )}
          <button className="pnc-vazgec" onClick={onKapat}>Vazgeç</button>
          <button
            className="pnc-kaydet"
            disabled={!ad.trim()}
            onClick={() => onKaydet({ ad, pisirme, paketleme })}
          >
            <Check size={17} /> Kaydet
          </button>
        </>
      }
    >
      <div className="alan">
        <label>İstasyon adı</label>
        <input
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="Mutfak, Bar, Nargile…"
          autoFocus
        />
      </div>

      <Anahtar
        etiket="Hazırlanıyor aşaması"
        ipucu="İstasyon ekranında ürüne başlandığını işaretleyen ayrı bir adım çıkar"
        acik={pisirme}
        degistir={setPisirme}
      />
      <Anahtar
        etiket="Paketleniyor aşaması"
        ipucu="Yemek bittikten sonra kutulanmayı bekleyen ürünler ayrı görünür"
        acik={paketleme}
        degistir={setPaketleme}
      />
    </OrtaPencere>
  );
}

/**
 * Kasa köprüleri. Köprü ilk açılışta 6 haneli bir kod gösteriyor; kod buraya
 * yazılınca köprüye kendi yetkisiz hesabı açılıyor ve bir daha giriş
 * sorulmuyor. Kimsenin şifresi kasadaki bilgisayarda durmuyor.
 */
function KopruHesaplari({
  onHata,
  onBildirim,
}: {
  onHata: (metin: string) => void;
  onBildirim: (metin: string) => void;
}) {
  const [hesaplar, setHesaplar] = useState<KopruHesabi[]>([]);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [kod, setKod] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [kaldirilacak, setKaldirilacak] = useState<KopruHesabi | null>(null);

  const yetkili = yetkiVar("yazici.hesap");

  const tazele = () => kopruHesaplariniGetir().then(setHesaplar);
  useEffect(() => {
    tazele();
  }, []);

  const pencereyiKapat = () => {
    setEkleAcik(false);
    setKod("");
  };

  const eslestir = async () => {
    setBekliyor(true);
    try {
      const cihaz = await kopruEslestir(kod);
      pencereyiKapat();
      onBildirim(cihaz ? `${cihaz} bağlandı` : "Köprü bağlandı");
      tazele();
    } catch (e: any) {
      onHata(e.message);
    }
    setBekliyor(false);
  };

  const kaldir = async () => {
    if (!kaldirilacak) return;
    try {
      await kopruKaldir(kaldirilacak.id);
      tazele();
    } catch (e: any) {
      onHata(e.message);
    }
    setKaldirilacak(null);
  };

  return (
    <section className="ayar-bolum">
      <div className="ayar-bolum-ust">
        <h2>
          <Server size={17} /> Kasa köprüleri
          <Ipucu>Köprüyü kurduğunuz bilgisayarda gördüğünüz 6 haneli kodu buraya yazın; köprü bir daha giriş sormaz.</Ipucu>
        </h2>
        {yetkili && (
          <button className="ayar-ekle" onClick={() => setEkleAcik(true)}>
            <Plus size={15} /> Köprü ekle
          </button>
        )}
      </div>

      {hesaplar.length === 0 ? (
        <div className="ayar-bos">
          <Server size={30} />
          <p>Bağlı köprü yok.</p>
        </div>
      ) : (
        <div className="odeme-tip-liste">
          {hesaplar.map((h) => {
            const [ad, cihaz] = h.ad.split(" · ");
            return (
            <div key={h.id} className="odeme-tip-satir">
              <span className="yazici-ad">
                <Server size={16} /> {ad}
              </span>
              <span className="odeme-tip-etiket">{cihaz ?? "Eski telefonlu hesap"}</span>
              <span className="odeme-tip-islem">
                {yetkili && (
                  <button onClick={() => setKaldirilacak(h)} title="Bağlantıyı kaldır">
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </div>
            );
          })}
        </div>
      )}

      {ekleAcik && (
        <OrtaPencere
          ikon={Server}
          baslik="Köprü ekle"
          aciklama="Köprünün ekranındaki 6 haneli kod"
          genislik="dar"
          onKapat={pencereyiKapat}
          alt={
            <>
              <button className="pnc-vazgec" onClick={pencereyiKapat}>Vazgeç</button>
              <button
                className="pnc-kaydet"
                disabled={kod.replace(/\D/g, "").length !== 6 || bekliyor}
                onClick={eslestir}
              >
                Bağla
              </button>
            </>
          }
        >
          <input
            className="kopru-kod"
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && kod.length === 6 && eslestir()}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
          />
        </OrtaPencere>
      )}

      {kaldirilacak && (
        <OnayModal
          mesaj={`"${kaldirilacak.ad}" bağlantısı kaldırılsın mı? O bilgisayar fiş basmayı bırakır; yeniden bağlamak için köprüde yeni kod alınır.`}
          tehlikeli
          onayMetni="Evet, kaldır"
          onOnay={kaldir}
          onKapat={() => setKaldirilacak(null)}
        />
      )}
    </section>
  );
}

// Ekran sökülüp yeniden kurulduğunda elde kalan son liste.
let sonYazicilar: Yazici[] | null = null;
let sonIstasyonlar: Istasyon[] | null = null;

export default function Yazicilar() {
  const { pathname } = useLocation();
  const istasyonBolumu = pathname === "/ayarlar/istasyonlar";

  // Yazıcılar ve İstasyonlar ayrı adresler ama aynı ekran; adres değişince
  // React ekranı söküp yeniden kuruyor ve liste sıfırlanıyordu. Bir anlığına
  // dönen çember çıkıp içerik geri geliyor, ekran yanıp sönmüş gibi
  // görünüyordu. Son liste modülde duruyor: ekran anında doluyor, tazeleme
  // arkada yapılıyor.
  const [yukleniyor, setYukleniyor] = useState(sonYazicilar === null);
  const [yazicilar, setYazicilar] = useState<Yazici[]>(sonYazicilar ?? []);
  const [istasyonlar, setIstasyonlar] = useState<Istasyon[]>(sonIstasyonlar ?? []);
  const [bildirim, setBildirim] = useState("");
  const [hata, setHata] = useState("");

  const [yaziciPaneli, setYaziciPaneli] = useState<Yazici | null | undefined>(undefined);
  const [istasyonPaneli, setIstasyonPaneli] = useState<Istasyon | null | undefined>(
    undefined
  );
  const [silinecek, setSilinecek] = useState<
    { tur: "yazici" | "istasyon"; id: number; ad: string } | null
  >(null);

  const tazele = async () => {
    const [y, i] = await Promise.all([yazicilariGetir(), istasyonlariGetir()]);
    sonYazicilar = y;
    sonIstasyonlar = i;
    setYazicilar(y);
    setIstasyonlar(i);
    setYukleniyor(false);
  };

  useEffect(() => {
    tazele();
  }, []);

  // Hata metni tek yerden: her çağrının kendi try'ı olsa aynı satır beş kez yazılırdı.
  const calistir = async (is: () => Promise<void>, mesaj: string) => {
    try {
      await is();
      await tazele();
      setBildirim(mesaj);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    }
  };

  const yaziciTasi = async (yazici: Yazici, yon: number) => {
    const sirali = yazicilar.map((y) => y.id);
    const yer = sirali.indexOf(yazici.id);
    const hedef = yer + yon;
    if (hedef < 0 || hedef >= sirali.length) return;
    [sirali[yer], sirali[hedef]] = [sirali[hedef], sirali[yer]];
    await calistir(() => yaziciSirasiniKaydet(sirali), "Sıra kaydedildi");
  };

  const istasyonYazicilari = (id: number) =>
    yazicilar.filter((y) => y.istasyonlar.includes(id));

  return (
    <>
      <div className="sayfa ayar-sayfa">
        <AyarBasligi />

        <div className="bilgi-serit">
          <Bilgi>
            {istasyonBolumu
              ? "İstasyon, siparişin hazırlandığı yerdir: mutfak, bar, nargile. Ürünün hangi istasyona gideceğini kategorisi belirler, gerekirse ürün kendi istasyonunu seçer."
              : "Fişlerin hangi yazıcıdan çıkacağını buradan tanımlarsınız."}
          </Bilgi>
          {/* Program yalnız Yazıcılar sekmesinde: kurulumun ilk adımı orası. */}
          {!istasyonBolumu && <KopruIndir />}
        </div>

        {yukleniyor ? (
          <div className="yukleniyor"><div className="cember" /></div>
        ) : istasyonBolumu ? (
          <section className="ayar-bolum">
            <div className="ayar-bolum-ust">
              <h2><ChefHat size={17} /> İstasyonlar</h2>
              <button className="ayar-ekle" onClick={() => setIstasyonPaneli(null)}>
                <Plus size={15} /> İstasyon ekle
              </button>
            </div>

            {istasyonlar.length === 0 ? (
              <div className="ayar-bos">
                <ChefHat size={30} />
                <p>Henüz istasyon yok. Mutfak ve Bar ile başlayabilirsiniz.</p>
              </div>
            ) : (
              <div className="odeme-tip-liste">
                {istasyonlar.map((i) => {
                  const bagli = istasyonYazicilari(i.id);
                  return (
                    <div key={i.id} className="odeme-tip-satir">
                      <span className="yazici-ad">
                        <ChefHat size={16} /> {i.ad}
                      </span>
                      <span className="odeme-tip-etiket">
                        {[i.pisirme && "Hazırlanıyor", i.paketleme && "Paketleniyor"]
                          .filter(Boolean)
                          .join(" · ") || "Tek adım"}
                        {" · "}
                        {bagli.length > 0
                          ? bagli.map((y) => y.ad).join(", ")
                          : "Yazıcı bağlanmadı"}
                      </span>
                      <span className="odeme-tip-islem">
                        <button onClick={() => setIstasyonPaneli(i)} title="Düzenle">
                          <Pencil size={14} />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <>
          <section className="ayar-bolum">
            <div className="ayar-bolum-ust">
              <h2><Printer size={17} /> Yazıcılar</h2>
              <button className="ayar-ekle" onClick={() => setYaziciPaneli(null)}>
                <Plus size={15} /> Yazıcı ekle
              </button>
            </div>

            <Bilgi>
              Ağa bağlı yazıcılar ve para çekmecesi için kasada RayoPOS Kasa Köprüsü
              çalışır. Tek USB yazıcı kullanıyorsanız kurulum gerekmez.
            </Bilgi>

            {yazicilar.length === 0 ? (
              <div className="ayar-bos">
                <Printer size={30} />
                <p>Henüz yazıcı tanımlanmadı. Kasa yazıcısıyla başlayın.</p>
              </div>
            ) : (
              <div className="odeme-tip-liste">
                {yazicilar.map((y, i) => (
                  <div
                    key={y.id}
                    className={y.aktif ? "odeme-tip-satir" : "odeme-tip-satir kapali"}
                  >
                    <span className="yazici-ad">
                      <Printer size={16} /> {y.ad}
                    </span>
                    <span className="odeme-tip-etiket">
                      {y.turler.map(turAdi).join(" · ")}
                      {" · "}
                      {baglantiAdi(y.baglanti)}
                      {y.baglanti === "ethernet" && y.ip && ` · ${y.ip}`}
                      {y.baglanti === "usb" && y.sistemAd && ` · ${y.sistemAd}`}
                      {y.cekmece && " · Çekmece"}
                      {!y.aktif && " · Kapalı"}
                    </span>
                    <span className="odeme-tip-islem">
                      <button
                        disabled={i === 0}
                        onClick={() => yaziciTasi(y, -1)}
                        title="Yukarı al"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        disabled={i === yazicilar.length - 1}
                        onClick={() => yaziciTasi(y, 1)}
                        title="Aşağı al"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button onClick={() => setYaziciPaneli(y)} title="Düzenle">
                        <Pencil size={14} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <KopruHesaplari onHata={setHata} onBildirim={setBildirim} />
          </>
        )}
      </div>

      {yaziciPaneli !== undefined && (
        <YaziciPaneli
          key={yaziciPaneli?.id ?? "yeni"}
          yazici={yaziciPaneli}
          istasyonlar={istasyonlar}
          onKapat={() => setYaziciPaneli(undefined)}
          onSil={
            yaziciPaneli
              ? () =>
                  setSilinecek({ tur: "yazici", id: yaziciPaneli.id, ad: yaziciPaneli.ad })
              : undefined
          }
          onKaydet={(alanlar) =>
            calistir(async () => {
              await yaziciKaydet(yaziciPaneli?.id ?? null, alanlar);
              setYaziciPaneli(undefined);
            }, "Yazıcı kaydedildi")
          }
        />
      )}

      {istasyonPaneli !== undefined && (
        <IstasyonPaneli
          key={istasyonPaneli?.id ?? "yeni"}
          istasyon={istasyonPaneli}
          onKapat={() => setIstasyonPaneli(undefined)}
          onSil={
            istasyonPaneli
              ? () =>
                  setSilinecek({
                    tur: "istasyon",
                    id: istasyonPaneli.id,
                    ad: istasyonPaneli.ad,
                  })
              : undefined
          }
          onKaydet={(alanlar) =>
            calistir(async () => {
              await istasyonKaydet(istasyonPaneli?.id ?? null, {
                ...alanlar,
                sira: istasyonPaneli?.sira ?? istasyonlar.length + 1,
              });
              setIstasyonPaneli(undefined);
            }, "İstasyon kaydedildi")
          }
        />
      )}

      {silinecek && (
        <OnayModal
          mesaj={
            silinecek.tur === "yazici"
              ? `"${silinecek.ad}" yazıcısı silinsin mi?`
              : `"${silinecek.ad}" istasyonu silinsin mi? Bu istasyona bağlı ürünlerin fişi hiçbir yazıcıya gitmez.`
          }
          tehlikeli
          onayMetni="Evet, sil"
          onOnay={() =>
            calistir(async () => {
              if (silinecek.tur === "yazici") await yaziciSil(silinecek.id);
              else await istasyonSil(silinecek.id);
              setSilinecek(null);
              setYaziciPaneli(undefined);
              setIstasyonPaneli(undefined);
            }, "Silindi")
          }
          onKapat={() => setSilinecek(null)}
        />
      )}

      {hata && (
        <OnayModal mesaj={hata} tekTus onayMetni="Tamam" onKapat={() => setHata("")} />
      )}

      {bildirim && <Bildirim mesaj={bildirim} onKapat={() => setBildirim("")} />}
    </>
  );
}
