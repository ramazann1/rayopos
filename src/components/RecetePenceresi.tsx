import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChefHat, Plus, Search, Trash2, X } from "lucide-react";
import Bilgi from "./Bilgi";
import Ipucu from "./Ipucu";
import { miktarSayi, miktarYaz, olcuKisa, olcuyeCevir, tabanaCevir } from "../stok";
import type { Malzeme } from "../stok";
import type { ReceteSatiri, ReceteTipi } from "../recete";
import { paraGoster } from "../para";

/**
 * Porsiyonun reçetesi kendi penceresinde.
 *
 * Önce ürün panelinin içindeydi; malzeme listesi uzadıkça panel aşağı doğru
 * büyüyüp karışıyordu — seçenek gruplarında da aynı sebeple ayrı pencereye
 * geçilmişti.
 *
 * Miktar ekranda malzemenin kendi ölçüsüyle yazılıyor (süt ml, un kg),
 * saklanırken en küçük birime çevriliyor. Taslakta metin duruyor: her tuşta
 * sayıya çevrilseydi "1," yazılamazdı.
 */

export type ReceteTaslagi = {
  malzemeId: number;
  miktar: string;
  tip: ReceteTipi;
};

export const receteTaslagi = (satirlar: ReceteSatiri[], malzemeler: Malzeme[]): ReceteTaslagi[] =>
  satirlar.map((s) => {
    const m = malzemeler.find((x) => x.id === s.malzemeId);
    return {
      malzemeId: s.malzemeId,
      miktar: m ? String(olcuyeCevir(s.miktar, m.birim)).replace(".", ",") : String(s.miktar),
      tip: s.tip,
    };
  });

export const receteSatirlari = (taslak: ReceteTaslagi[], malzemeler: Malzeme[]): ReceteSatiri[] =>
  taslak
    .map((t) => {
      const m = malzemeler.find((x) => x.id === t.malzemeId);
      const deger = miktarSayi(t.miktar);
      if (!m || !deger || deger <= 0) return null;
      return { malzemeId: t.malzemeId, miktar: tabanaCevir(deger, m.birim), tip: t.tip };
    })
    .filter((s): s is ReceteSatiri => s !== null);

/**
 * Taslaktan çıkan maliyet. `eksik` = içinde alış fiyatı girilmemiş malzeme
 * var, toplam gerçeği söylemiyor. O satırı sıfır sayıp rakam yazmak, çizgi
 * yazmaktan kötü: yanlış maliyet yanlış fiyat kararına götürüyor.
 */
export function receteMaliyeti(taslak: ReceteTaslagi[], malzemeler: Malzeme[]) {
  let maliyet = 0;
  let eksik = false;
  for (const t of taslak) {
    const m = malzemeler.find((x) => x.id === t.malzemeId);
    const deger = miktarSayi(t.miktar);
    if (!m || m.ortalamaMaliyet == null || !deger) {
      eksik = true;
      continue;
    }
    maliyet += tabanaCevir(deger, m.birim) * m.ortalamaMaliyet;
  }
  return { maliyet, eksik };
}

export default function RecetePenceresi({
  porsiyonAd,
  satirlar,
  malzemeler,
  satisFiyati,
  degistir,
  onKapat,
}: {
  porsiyonAd: string;
  satirlar: ReceteTaslagi[];
  malzemeler: Malzeme[];
  satisFiyati: number;
  degistir: (satirlar: ReceteTaslagi[]) => void;
  onKapat: () => void;
}) {
  const [arama, setArama] = useState("");

  const malzeme = (id: number) => malzemeler.find((m) => m.id === id);

  // Aynı malzeme reçetede iki kez yazılamaz; seçim listesinde de görünmüyor.
  const secilebilir = useMemo(() => {
    const kullanilan = new Set(satirlar.map((s) => s.malzemeId));
    const ara = arama.trim().toLocaleLowerCase("tr");
    return malzemeler.filter(
      (m) =>
        m.aktif &&
        !kullanilan.has(m.id) &&
        (!ara || m.ad.toLocaleLowerCase("tr").includes(ara))
    );
  }, [malzemeler, satirlar, arama]);

  const satirTutari = (t: ReceteTaslagi) => {
    const m = malzeme(t.malzemeId);
    const deger = miktarSayi(t.miktar);
    if (!m || m.ortalamaMaliyet == null || !deger) return null;
    return tabanaCevir(deger, m.birim) * m.ortalamaMaliyet;
  };

  // Reçete boşken maliyet sıfır değil, BİLİNMİYOR. "₺0,00 · kâr %100" yazmak
  // ürünü bedavaya mal oluyormuş gibi gösteriyordu.
  const hesap = receteMaliyeti(satirlar, malzemeler);
  const maliyet = hesap.maliyet;
  const eksik = satirlar.length === 0 || hesap.eksik;
  // Malzeme dışındaki giderler (kira, personel, fatura) bu hesaba girmiyor;
  // rakamın yanındaki ipucu bunu söylüyor.
  const kar = satisFiyati > 0 && !eksik ? satisFiyati - maliyet : null;
  const oran = kar != null && satisFiyati > 0 ? (kar / satisFiyati) * 100 : null;

  const satirDegis = (i: number, degisim: Partial<ReceteTaslagi>) =>
    degistir(satirlar.map((s, j) => (j === i ? { ...s, ...degisim } : s)));

  const satirEkle = (malzemeId: number) => {
    degistir([...satirlar, { malzemeId, miktar: "", tip: "normal" }]);
    setArama("");
  };

  /**
   * Pencere doğrudan sayfanın köküne çiziliyor, ürün panelinin içine değil.
   * İç içe perde, dıştakinin `backdrop-filter`ı yüzünden ona bağlanıyor ve
   * onu taşırıyordu: sağda tarayıcının kaydırma çubuğu çıkıp ekran daralıyordu.
   */
  return createPortal(
    <div className="up-fon ust" onClick={onKapat}>
      <div className="rcp-pencere" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <h3>Reçete{porsiyonAd ? ` · ${porsiyonAd}` : ""}</h3>
          <button className="up-kapat" onClick={onKapat} title="Kapat">
            <X size={19} />
          </button>
        </header>

        <div className="rcp-govde">
          <div className="rcp-sol">
            {satirlar.length === 0 ? (
              /* Bilgi kutusu yerine kendi boş ekranı: tek satırlık bir kutu
                 pencerenin geri kalanını boşlukta bırakıyordu. */
              <div className="rcp-yok">
                <ChefHat size={30} />
                <strong>Bu porsiyonun reçetesi yok</strong>
                <p>Sağdaki listeden malzeme seçin, sonra ne kadar harcandığını yazın.</p>
              </div>
            ) : (
              <div className="rcp-tablo">
                <div className="rcp-baslik">
                  <span>Malzeme</span>
                  <span>Miktar</span>
                  <span>Tutar</span>
                  <span />
                </div>
                {satirlar.map((t, i) => {
                  const m = malzeme(t.malzemeId);
                  const tutar = satirTutari(t);
                  return (
                    <div className="rcp-satir" key={t.malzemeId}>
                      <span className="rcp-ad">{m?.ad ?? "Silinmiş malzeme"}</span>
                      <div className="up-sonek">
                        <input
                          value={t.miktar}
                          onChange={(e) => satirDegis(i, { miktar: miktarYaz(e.target.value) })}
                          placeholder="0"
                          inputMode="decimal"
                        />
                        <em>{m ? olcuKisa(m.birim) : ""}</em>
                      </div>
                      <span className={tutar == null ? "rcp-tutar yok" : "rcp-tutar"}>
                        {tutar == null ? "—" : paraGoster(tutar)}
                      </span>
                      <button
                        className="rcp-sil"
                        title="Satırı çıkar"
                        onClick={() => degistir(satirlar.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {eksik && satirlar.length > 0 && (
              <Bilgi>
                Alış fiyatı girilmemiş malzeme var, maliyet çıkmıyor. Stok
                girişinde fiyat yazıldığında rakam kendiliğinden dolar.
              </Bilgi>
            )}
          </div>

          {/* Malzeme seçimi kalıcı duruyor: reçete yazılırken arka arkaya
              birkaç malzeme ekleniyor, her seferinde düğmeye basmak yoruyor. */}
          <aside className="rcp-sag">
            <div className="rcp-sag-basi">Malzeme ekle</div>
            <div className="rcp-arama">
              <Search size={15} />
              <input
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Malzeme ara"
              />
            </div>
            <div className="rcp-liste">
              {secilebilir.map((m) => (
                <button key={m.id} onClick={() => satirEkle(m.id)}>
                  <Plus size={14} />
                  <span>{m.ad}</span>
                  <em>{olcuKisa(m.birim)}</em>
                </button>
              ))}
              {secilebilir.length === 0 && (
                <p className="rcp-bos">
                  {malzemeler.length === 0
                    ? "Henüz malzeme tanımlanmamış. Stok ekranındaki Malzemeler sekmesinden eklenir."
                    : "Eklenecek başka malzeme yok."}
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Özet alt şeritte: reçete uzayınca aşağı kaymıyor, hep görünür
            kalıyor. Alt şerit de tek düğmeyle boş durmuyor. */}
        <footer className="up-alt rcp-alt">
          <div className="rcp-ozet">
            <div>
              <small>Maliyet</small>
              <strong>{eksik ? "—" : paraGoster(maliyet)}</strong>
            </div>
            <div>
              <small>Satış</small>
              <strong>{paraGoster(satisFiyati)}</strong>
            </div>
            <div>
              <small>
                Kâr
                <Ipucu>Yalnız malzeme farkı; kira, personel ve fatura bu hesapta yok.</Ipucu>
              </small>
              <strong>
                {kar == null ? "—" : `${paraGoster(kar)} · %${(oran ?? 0).toFixed(1)}`}
              </strong>
            </div>
          </div>
          <button className="up-tus kaydet" onClick={onKapat}>Tamam</button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
