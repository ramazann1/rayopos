import { useEffect, useRef, useState } from "react";
import {
  Ban, CloudOff, Coffee, Gift, ReceiptText, RotateCw, ShoppingBag, Utensils, Wallet,
} from "lucide-react";
import { OdemeIkon } from "../odemeIkon";
import { analizAdisyonlari, analizOzeti, BOS_FILTRE, donemAraligi } from "../analiz";
import { kalemTutari } from "../adisyonlar";
import { yetkiVar } from "../oturum";
import { supabase } from "../supabase";
import type { AnalizOzeti } from "../analiz";
import { baglantiVar, useBaglanti } from "../baglanti";
import { SAKIN, useCanli } from "../canli";
import { paraGoster } from "../para";
import Bilgi from "../components/Bilgi";

/**
 * Mobil Satış ekranı — Analiz'in tamamı değil, telefonda bakılacak kadarı.
 *
 * Tek soruya cevap veriyor: bugün ne oldu. Dönem seçimi yok, ekran her zaman
 * içinde bulunulan kasa gününü gösteriyor; işletmeci telefonu açtığında filtre
 * kurmakla uğraşmıyor. Gider ve kâr burada yok — kasa günü kapanışına bağlı
 * işler, yarım gösterilmesi yanlış karar verdiriyor.
 */
export default function MobilSatis() {
  // İşletmenin tamamını gören kişiye kendi dökümü ayrıca gösterilmiyor.
  if (yetkiVar("rapor.gun_sonu") || yetkiVar("rapor.tumu")) return <IsletmeSatisi />;
  return <KendiSatisim />;
}

type SatilanUrun = { ad: string; adet: number; tutar: number };
type KendiOzet = {
  ciro: number;
  adet: number;
  adisyon: number;
  ikram: number;
  iptal: number;
  urunler: SatilanUrun[];
};

async function kendiOzetiniOku(): Promise<KendiOzet> {
  const { bas, bit } = donemAraligi({ ...BOS_FILTRE, donem: "bugun" });
  const { data, error } = await supabase.rpc("kendi_satisim", {
    p_bas: bas.toISOString(),
    p_bit: bit.toISOString(),
  });
  if (error) throw error;

  const ozet: KendiOzet = { ciro: 0, adet: 0, adisyon: 0, ikram: 0, iptal: 0, urunler: [] };
  const urunler = new Map<string, SatilanUrun>();
  const adisyonlar = new Set<number>();
  // Kuruşla toplanıyor, float birikmesin.
  let ciro = 0, ikram = 0, iptal = 0;

  for (const s of (data as any[]) ?? []) {
    const kurus = Math.round(
      kalemTutari({ ad: s.ad, adet: Number(s.adet), fiyat: Number(s.fiyat), indirim: Number(s.indirim) }) * 100
    );
    if (s.durum === "ikram") ikram += kurus;
    else if (s.durum === "iptal") iptal += kurus;
    else {
      ciro += kurus;
      ozet.adet += Number(s.adet);
      adisyonlar.add(s.adisyon_id);
      const u = urunler.get(s.ad) ?? { ad: s.ad, adet: 0, tutar: 0 };
      u.adet += Number(s.adet);
      u.tutar += kurus;
      urunler.set(s.ad, u);
    }
  }

  ozet.ciro = ciro / 100;
  ozet.ikram = ikram / 100;
  ozet.iptal = iptal / 100;
  ozet.adisyon = adisyonlar.size;
  ozet.urunler = [...urunler.values()]
    .map((u) => ({ ...u, tutar: u.tutar / 100 }))
    .sort((a, b) => b.tutar - a.tutar);
  return ozet;
}

/**
 * Garsonun kendi satışı: bugün adisyona yazdığı ürünler. Tahsilat ve ödeme
 * tipi yok — garson para almıyor, onun sorusu "bugün ne sattım".
 */
function KendiSatisim() {
  const cevrimici = useBaglanti();
  const [ozet, setOzet] = useState<KendiOzet | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [okunamadi, setOkunamadi] = useState(false);

  const oku = async (sessiz = false) => {
    if (!baglantiVar()) {
      setOkunamadi(true);
      setYukleniyor(false);
      return;
    }
    if (!sessiz) setYukleniyor(true);
    setOkunamadi(false);
    try {
      setOzet(await kendiOzetiniOku());
    } catch {
      setOkunamadi(true);
    }
    setYukleniyor(false);
  };

  useEffect(() => {
    oku();
  }, []);

  useCanli(["masa_degisim"], () => oku(true), SAKIN);

  const oncekiDurum = useRef(cevrimici);
  useEffect(() => {
    if (cevrimici && !oncekiDurum.current) oku();
    oncekiDurum.current = cevrimici;
  }, [cevrimici]);

  const bugun = new Date().toLocaleDateString("tr", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
  const enCok = ozet?.urunler[0]?.tutar || 1;

  return (
    <>
      <header className="m-baslik">
        <div>
          <h1>Satışım</h1>
          <p className="m-baslik-alt">{bugun}</p>
        </div>
        <button className="m-ikon-dugme" onClick={() => oku()} aria-label="Yenile">
          <RotateCw size={20} />
        </button>
      </header>

      {yukleniyor && !ozet ? (
        <div className="yukleniyor"><div className="cember" /></div>
      ) : okunamadi ? (
        <div className="m-bos">
          <p>{cevrimici ? "Satışlar okunamadı." : "Bağlantı yok, satışlar okunamıyor."}</p>
          <button className="m-dugme" onClick={() => oku()}>
            {cevrimici ? <RotateCw size={16} /> : <CloudOff size={16} />}
            Yeniden dene
          </button>
        </div>
      ) : ozet ? (
        <div className="m-satis">
          <section className="ks-ozet">
            <div className="ks-ozet-ust">
              <span className="ks-rozet"><Wallet size={20} /></span>
              <span className="ks-ozet-etiket">Bugün sattığım</span>
            </div>
            <strong className="ks-ozet-tutar">{paraGoster(ozet.ciro)}</strong>
            <div className="ks-ozet-alt">
              <span><ShoppingBag size={16} /><b>{ozet.adet.toLocaleString("tr")}</b> ürün</span>
              <span><ReceiptText size={16} /><b>{ozet.adisyon}</b> adisyon</span>
            </div>
          </section>

          {(ozet.ikram > 0 || ozet.iptal > 0) && (
            <div className="ks-ek">
              {ozet.ikram > 0 && (
                <div className="ks-ek-kart">
                  <Gift size={16} />
                  <span>İkram</span>
                  <b>{paraGoster(ozet.ikram)}</b>
                </div>
              )}
              {ozet.iptal > 0 && (
                <div className="ks-ek-kart iptal">
                  <Ban size={16} />
                  <span>İptal</span>
                  <b>{paraGoster(ozet.iptal)}</b>
                </div>
              )}
            </div>
          )}

          <section className="m-kutu">
            <p className="m-alt-baslik">Sattığım ürünler</p>
            {ozet.urunler.length === 0 ? (
              <div className="ks-bos">
                <Coffee size={24} />
                <p>Bugün henüz ürün girmediniz.</p>
              </div>
            ) : (
              ozet.urunler.map((u) => (
                <div key={u.ad} className="ks-urun">
                  <span className="ks-urun-ad">{u.ad}</span>
                  <span className="ks-urun-adet">×{u.adet.toLocaleString("tr")}</span>
                  <span className="ks-urun-tutar">{paraGoster(u.tutar)}</span>
                  <div className="ks-cubuk">
                    <div style={{ width: `${Math.max(4, (u.tutar / enCok) * 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function IsletmeSatisi() {
  const cevrimici = useBaglanti();
  const [ozet, setOzet] = useState<AnalizOzeti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [okunamadi, setOkunamadi] = useState(false);

  // Sessiz okuma canlı tazeleme için: halka her seferinde dönerse ekran
  // işletmecinin gözünün önünde titrer, oysa sayılar sadece güncelleniyor.
  const oku = async (sessiz = false) => {
    if (!baglantiVar()) {
      setOkunamadi(true);
      setYukleniyor(false);
      return;
    }
    if (!sessiz) setYukleniyor(true);
    setOkunamadi(false);
    try {
      // Gider listesi boş geçiliyor: bu ekranda kâr yazmıyoruz, giderler kasada.
      const adisyonlar = await analizAdisyonlari({ ...BOS_FILTRE, donem: "bugun" });
      setOzet(analizOzeti(adisyonlar, []));
    } catch {
      setOkunamadi(true);
    }
    setYukleniyor(false);
  };

  useEffect(() => {
    oku();
  }, []);

  // Gün içinde satış oldukça sayılar kendiliğinden ilerliyor. Sakin tempoda:
  // bakma ekranı, hesap ağır ve rakamın gözün önünde zıplaması rahatsız eder.
  // Ekran arkadayken (telefon cepte) hiç sorgu yapılmıyor.
  useCanli(["masa_degisim"], () => oku(true), SAKIN);

  // Bağlantı geri gelince ekran kendini tazeliyor; işletmeci "yenile"ye
  // basmayı beklemesin.
  const oncekiDurum = useRef(cevrimici);
  useEffect(() => {
    if (cevrimici && !oncekiDurum.current) oku();
    oncekiDurum.current = cevrimici;
  }, [cevrimici]);

  const bugun = new Date().toLocaleDateString("tr", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });

  return (
    <>
      <header className="m-baslik">
        <div>
          <h1>Satış</h1>
          <p className="m-baslik-alt">{bugun}</p>
        </div>
        <button className="m-ikon-dugme" onClick={() => oku()} aria-label="Yenile">
          <RotateCw size={20} />
        </button>
      </header>

      {yukleniyor && !ozet ? (
        <div className="yukleniyor"><div className="cember" /></div>
      ) : okunamadi ? (
        <div className="m-bos">
          {/* Bayat ciro yanlış bilgidir: rakam gösterilmiyor, durum söyleniyor. */}
          <p>{cevrimici ? "Satışlar okunamadı." : "Bağlantı yok, satışlar okunamıyor."}</p>
          <button className="m-dugme" onClick={() => oku()}>
            {cevrimici ? <RotateCw size={16} /> : <CloudOff size={16} />}
            Yeniden dene
          </button>
        </div>
      ) : ozet ? (
        <div className="m-satis">
          <section className="m-ciro">
            <p className="m-ciro-etiket">Bugünün cirosu</p>
            <strong className="m-ciro-tutar">{paraGoster(ozet.ciro)}</strong>
            <div className="m-ciro-alt">
              <span>
                <b>{ozet.adisyon}</b> adisyon
              </span>
              <span>
                ortalama <b>{paraGoster(ozet.ortalama)}</b>
              </span>
            </div>
          </section>

          {/* Cironun altındaki her şey tek kartta, aralarında ince çizgi.
              Ayrı ayrı çerçevelenince ekran kutu yığınına dönüyordu. */}
          <section className="m-kutu">
            {/* Açık masa ciroya girmiyor ama işletmecinin gördüğü paranın
                yarısı orada; ikisi ayrı yazılıp altta toplanıyor. */}
            <div className="m-kutu-satir">
              <span>
                <Utensils size={16} />
                Açık masa
              </span>
              <span className="m-kutu-deger">
                {ozet.acik} masa · {paraGoster(ozet.acikTutar)}
              </span>
            </div>
            <div className="m-kutu-satir toplam">
              <span>Günün toplam işi</span>
              <strong>{paraGoster(ozet.toplamIs)}</strong>
            </div>

            <div className="m-kutu-grup">
              <p className="m-alt-baslik">Ödeme tipleri</p>
              {ozet.odemeler.length === 0 ? (
                <p className="m-kutu-bos">Bugün henüz tahsilat yok.</p>
              ) : (
                ozet.odemeler.map((o) => {
                  const enBuyuk = ozet.odemeler[0].tutar || 1;
                  return (
                    <div key={o.ad} className="m-pay">
                      <span className="m-pay-ad">
                        <OdemeIkon ad={o.ad} size={16} />
                        {o.ad}
                        <small>{o.adet} tahsilat</small>
                      </span>
                      <span className="m-kutu-deger">{paraGoster(o.tutar)}</span>
                      {/* Çubuk rakamın süsü değil: hangi tipin ağır bastığı
                          listeye bakmadan görünsün. */}
                      <div className="m-pay-cubuk">
                        <div style={{ width: `${Math.max(4, (o.tutar / enBuyuk) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {(ozet.eksikTahsilat > 0 || ozet.bahsis > 0 || ozet.ikram > 0) && (
              <div className="m-kutu-grup">
                <div className="m-kutu-satir">
                  <span>Kasaya giren</span>
                  <span className="m-kutu-deger">{paraGoster(ozet.tahsilEdilen)}</span>
                </div>
                {ozet.eksikTahsilat > 0 && (
                  <div className="m-kutu-satir eksik">
                    <span>Eksik tahsilat</span>
                    <span className="m-kutu-deger">{paraGoster(ozet.eksikTahsilat)}</span>
                  </div>
                )}
                {ozet.ikram > 0 && (
                  <div className="m-kutu-satir">
                    <span>İkram</span>
                    <span className="m-kutu-deger">{paraGoster(ozet.ikram)}</span>
                  </div>
                )}
                {ozet.bahsis > 0 && (
                  <div className="m-kutu-satir">
                    <span>Bahşiş</span>
                    <span className="m-kutu-deger">{paraGoster(ozet.bahsis)}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          <Bilgi>Gider, kâr ve ayrıntılı raporlar kasadaki Analiz ekranında.</Bilgi>
        </div>
      ) : null}
    </>
  );
}
