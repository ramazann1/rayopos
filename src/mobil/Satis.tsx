import { useEffect, useRef, useState } from "react";
import {
  Ban, CloudOff, Coffee, Gift, ReceiptText, RotateCw, ShoppingBag, Wallet,
} from "lucide-react";
import { BOS_FILTRE, donemAraligi } from "../analiz";
import { kalemTutari } from "../adisyonlar";
import { yetkiVar } from "../oturum";
import { supabase } from "../supabase";
import { baglantiVar, useBaglanti } from "../baglanti";
import { SAKIN, useCanli } from "../canli";
import { paraGoster } from "../para";
import Analiz from "../pages/Analiz";

/**
 * Mobil Satış ekranı. İşletmenin tamamını gören kişiye kasadaki Analiz'in
 * Özet'i açılıyor — ayrı bir telefon özeti yok, iki yerde iki hesap
 * tutulmuyor. Raporu görmeyen personel yalnız kendi satışını görüyor.
 */
export default function MobilSatis() {
  if (yetkiVar("rapor.gun_sonu") || yetkiVar("rapor.tumu")) return <Analiz mobil />;
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
