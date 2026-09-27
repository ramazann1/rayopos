import { useState } from "react";
import { porsiyonFiyat } from "../menu";
import { cikanMetni, eklenenMetni } from "../recete";
import type { MenuPorsiyon, MenuSecenekGrubu, MenuUrun, SiparisTuru } from "../types";

export type ReceteDegisimi = { cikan?: number[]; eklenen?: number[] };

type Props = {
  urun: MenuUrun;
  gruplar: MenuSecenekGrubu[];
  /** Fiyat siparişin türüne göre okunuyor: masa, gel al ve paket ayrı olabilir. */
  tur?: SiparisTuru;
  onEkle: (
    porsiyon: string | undefined,
    fiyat: number,
    secimler: string[],
    degisim: ReceteDegisimi
  ) => void;
  onKapat: () => void;
};

/** Ürünü eklerken pencere açılmalı mı: porsiyon, seçenek ya da değişebilen malzeme var. */
export const secimGerekir = (u: MenuUrun) =>
  u.porsiyonlar.length > 1 ||
  u.porsiyonlar.some((p) => p.grupIdler.length > 0 || (p.degisenler?.length ?? 0) > 0);

export default function UrunSecim({ urun, gruplar, tur = "masa", onEkle, onKapat }: Props) {
  const [porsiyon, setPorsiyon] = useState<MenuPorsiyon | undefined>(
    urun.porsiyonlar.find((p) => p.varsayilan) ?? urun.porsiyonlar[0]
  );
  const grupları = (p?: MenuPorsiyon) => gruplar.filter((g) => p?.grupIdler.includes(g.id));

  // İşletme "önceden işaretli" dediyse o seçenekler hazır gelir; demediyse
  // pencere boş açılır, garson sormadan Ekle'ye basmış olmaz.
  const hazirSecimler = (p?: MenuPorsiyon) => {
    const baslangic: Record<number, number[]> = {};
    for (const g of grupları(p)) {
      const isaretli = g.liste.filter((x) => x.varsayilan).map((x) => x.id!);
      if (isaretli.length) baslangic[g.id] = g.tekli ? isaretli.slice(0, 1) : isaretli;
    }
    return baslangic;
  };

  const [secilenler, setSecilenler] = useState<Record<number, number[]>>(() =>
    hazirSecimler(urun.porsiyonlar.find((p) => p.varsayilan) ?? urun.porsiyonlar[0])
  );

  const [cikan, setCikan] = useState<number[]>([]);
  const [eklenen, setEklenen] = useState<number[]>([]);

  const urunGruplari = grupları(porsiyon);
  const cikarilabilir = porsiyon?.degisenler?.filter((d) => d.tip === "cikarilabilir") ?? [];
  const ekstralar = porsiyon?.degisenler?.filter((d) => d.tip === "opsiyonel") ?? [];

  // Porsiyon değişince eski seçimler geçersiz; grupları da değişebiliyor.
  const porsiyonSec = (p: MenuPorsiyon) => {
    setPorsiyon(p);
    setSecilenler(hazirSecimler(p));
    setCikan([]);
    setEklenen([]);
  };

  const degistir = (liste: number[], id: number) =>
    liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];

  const sec = (grup: MenuSecenekGrubu, secenekId: number) => {
    setSecilenler((s) => {
      const mevcut = s[grup.id] ?? [];
      if (grup.tekli) return { ...s, [grup.id]: [secenekId] };
      const yeni = mevcut.includes(secenekId)
        ? mevcut.filter((x) => x !== secenekId)
        : [...mevcut, secenekId];
      return { ...s, [grup.id]: yeni };
    });
  };

  const secimAdlari: string[] = [];
  let ekToplam = 0;
  for (const grup of urunGruplari) {
    for (const secenekId of secilenler[grup.id] ?? []) {
      const secenek = grup.liste.find((s) => s.id === secenekId);
      if (!secenek) continue;
      secimAdlari.push(secenek.ad);
      ekToplam += secenek.ekFiyat;
    }
  }
  for (const d of cikarilabilir) {
    if (cikan.includes(d.malzemeId)) secimAdlari.push(cikanMetni(d.ad));
  }
  for (const d of ekstralar) {
    if (!eklenen.includes(d.malzemeId)) continue;
    secimAdlari.push(eklenenMetni(d.ad));
    ekToplam += d.ekFiyat;
  }

  const fiyat = (porsiyon ? porsiyonFiyat(porsiyon, tur) : 0) + ekToplam;

  // Zorunlu gruptan seçim yapılmadan ürün sepete eklenemez; çoklu grupta
  // istenen sayıya ulaşılmadan da eklenemiyor.
  const enAzi = (g: MenuSecenekGrubu) => (g.tekli ? 1 : Math.max(1, g.enAz || 1));
  const eksikler = urunGruplari.filter(
    (g) => g.zorunlu && (secilenler[g.id] ?? []).length < enAzi(g)
  );

  return (
    <div className="perde" onClick={onKapat}>
      <div className="pencere" onClick={(e) => e.stopPropagation()}>
        <h3>{urun.ad}</h3>

        {urun.porsiyonlar.length > 1 && (
          <div className="grup">
            <span className="grup-ad">Porsiyon</span>
            <div className="secim-liste">
              {urun.porsiyonlar.map((p) => (
                <button
                  key={p.birimId}
                  className={porsiyon?.birimId === p.birimId ? "secim aktif" : "secim"}
                  onClick={() => porsiyonSec(p)}
                >
                  {p.ad} · ₺{porsiyonFiyat(p, tur)}
                </button>
              ))}
            </div>
          </div>
        )}

        {urunGruplari.map((grup) => (
          <div className="grup" key={grup.id}>
            <span className="grup-ad">
              {grup.ad}
              {grup.zorunlu && (
                <em className="zorunlu-im">
                  {enAzi(grup) > 1 ? `en az ${enAzi(grup)}` : "zorunlu"}
                </em>
              )}
            </span>
            <div className="secim-liste">
              {grup.liste.map((secenek) => (
                <button
                  key={secenek.id}
                  className={(secilenler[grup.id] ?? []).includes(secenek.id!) ? "secim aktif" : "secim"}
                  onClick={() => sec(grup, secenek.id!)}
                >
                  {secenek.ad}
                  {secenek.ekFiyat > 0 && ` (+₺${secenek.ekFiyat})`}
                </button>
              ))}
            </div>
          </div>
        ))}

        {cikarilabilir.length > 0 && (
          <div className="grup">
            <span className="grup-ad">Olmasın</span>
            <div className="secim-liste">
              {cikarilabilir.map((d) => (
                <button
                  key={d.malzemeId}
                  className={cikan.includes(d.malzemeId) ? "secim aktif cikarildi" : "secim"}
                  onClick={() => setCikan((l) => degistir(l, d.malzemeId))}
                >
                  {d.ad}
                </button>
              ))}
            </div>
          </div>
        )}

        {ekstralar.length > 0 && (
          <div className="grup">
            <span className="grup-ad">Ekstra</span>
            <div className="secim-liste">
              {ekstralar.map((d) => (
                <button
                  key={d.malzemeId}
                  className={eklenen.includes(d.malzemeId) ? "secim aktif" : "secim"}
                  onClick={() => setEklenen((l) => degistir(l, d.malzemeId))}
                >
                  {d.ad}
                  {d.ekFiyat > 0 && ` (+₺${d.ekFiyat})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {eksikler.length > 0 && (
          <p className="secim-uyari">
            Önce seçilmeli:{" "}
            {eksikler
              .map((g) => (enAzi(g) > 1 ? g.ad + " (en az " + enAzi(g) + ")" : g.ad))
              .join(", ")}
          </p>
        )}

        <button
          className="kaydet"
          disabled={eksikler.length > 0}
          onClick={() =>
            onEkle(porsiyon?.ad, fiyat, secimAdlari, {
              cikan: cikan.length ? cikan : undefined,
              eklenen: eklenen.length ? eklenen : undefined,
            })
          }
        >
          Ekle
        </button>
      </div>
    </div>
  );
}
