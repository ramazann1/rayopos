import { useState } from "react";
import { Check, CircleMinus, CirclePlus, ListChecks, Ruler, UtensilsCrossed, X } from "lucide-react";
import { paraGoster } from "../para";
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

  const secimSayisi = (g: MenuSecenekGrubu) => (secilenler[g.id] ?? []).length;

  const kural = (g: MenuSecenekGrubu) => {
    if (g.tekli) return g.zorunlu ? "Birini seçin" : "En fazla bir";
    if (g.zorunlu && enAzi(g) > 1) return `En az ${enAzi(g)}`;
    return g.zorunlu ? "En az bir" : "İsteğe bağlı";
  };

  return (
    <div className="up-fon" onClick={onKapat}>
      <div className="up-modal us-pencere" onClick={(e) => e.stopPropagation()}>
        <header className="up-ust">
          <span className="us-simge">
            <UtensilsCrossed size={20} />
          </span>
          <div className="us-baslik">
            <h3>{urun.ad}</h3>
            {porsiyon && <span>{paraGoster(porsiyonFiyat(porsiyon, tur))}</span>}
          </div>
          <button className="up-kapat" aria-label="Kapat" onClick={onKapat}>
            <X size={20} />
          </button>
        </header>

        <div className="us-govde">
          {urun.porsiyonlar.length > 1 && (
            <section className="us-bolum">
              <div className="us-bolum-bas">
                <Ruler size={16} />
                <b>Porsiyon</b>
              </div>
              <div className="us-secenekler">
                {urun.porsiyonlar.map((p) => {
                  const secili = porsiyon?.birimId === p.birimId;
                  return (
                    <button
                      key={p.birimId}
                      className={secili ? "us-secenek secili" : "us-secenek"}
                      onClick={() => porsiyonSec(p)}
                    >
                      <span className="us-isaret">{secili && <Check size={14} />}</span>
                      <span className="us-ad">{p.ad}</span>
                      <em>{paraGoster(porsiyonFiyat(p, tur))}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {urunGruplari.map((grup) => {
            const eksik = eksikler.includes(grup);
            return (
              <section className="us-bolum" key={grup.id}>
                <div className="us-bolum-bas">
                  <ListChecks size={16} />
                  <b>{grup.ad}</b>
                  <small className={eksik ? "us-kural eksik" : secimSayisi(grup) ? "us-kural tamam" : "us-kural"}>
                    {kural(grup)}
                  </small>
                </div>
                <div className="us-secenekler">
                  {grup.liste.map((secenek) => {
                    const secili = (secilenler[grup.id] ?? []).includes(secenek.id!);
                    return (
                      <button
                        key={secenek.id}
                        className={secili ? "us-secenek secili" : "us-secenek"}
                        onClick={() => sec(grup, secenek.id!)}
                      >
                        <span className={grup.tekli ? "us-isaret yuvarlak" : "us-isaret"}>
                          {secili && <Check size={14} />}
                        </span>
                        <span className="us-ad">{secenek.ad}</span>
                        {secenek.ekFiyat > 0 && <em>+{paraGoster(secenek.ekFiyat)}</em>}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {cikarilabilir.length > 0 && (
            <section className="us-bolum">
              <div className="us-bolum-bas">
                <CircleMinus size={16} />
                <b>Olmasın</b>
              </div>
              <div className="us-secenekler">
                {cikarilabilir.map((d) => {
                  const secili = cikan.includes(d.malzemeId);
                  return (
                    <button
                      key={d.malzemeId}
                      className={secili ? "us-secenek cikan" : "us-secenek"}
                      onClick={() => setCikan((l) => degistir(l, d.malzemeId))}
                    >
                      <span className="us-isaret">{secili && <X size={14} />}</span>
                      <span className="us-ad">{d.ad}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {ekstralar.length > 0 && (
            <section className="us-bolum">
              <div className="us-bolum-bas">
                <CirclePlus size={16} />
                <b>Ekstra</b>
              </div>
              <div className="us-secenekler">
                {ekstralar.map((d) => {
                  const secili = eklenen.includes(d.malzemeId);
                  return (
                    <button
                      key={d.malzemeId}
                      className={secili ? "us-secenek secili" : "us-secenek"}
                      onClick={() => setEklenen((l) => degistir(l, d.malzemeId))}
                    >
                      <span className="us-isaret">{secili && <Check size={14} />}</span>
                      <span className="us-ad">{d.ad}</span>
                      <em>{d.ekFiyat > 0 ? `+${paraGoster(d.ekFiyat)}` : "Ücretsiz"}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <footer className="us-alt">
          <div className="us-ozet">
            <strong>{paraGoster(fiyat)}</strong>
            <span>
              {eksikler.length > 0
                ? `Seçilmeli: ${eksikler.map((g) => g.ad).join(", ")}`
                : secimAdlari.join(" · ") || porsiyon?.ad || ""}
            </span>
          </div>
          <button
            className="us-ekle"
            disabled={eksikler.length > 0}
            onClick={() =>
              onEkle(porsiyon?.ad, fiyat, secimAdlari, {
                cikan: cikan.length ? cikan : undefined,
                eklenen: eklenen.length ? eklenen : undefined,
              })
            }
          >
            <Check size={16} /> Ekle
          </button>
        </footer>
      </div>
    </div>
  );
}
