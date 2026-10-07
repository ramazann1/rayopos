import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Armchair,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Coffee,
  Gift,
  History,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  ChevronRight,
  Plus,
  Receipt,
  Scale,
  Shapes,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import OrtaPencere from "./OrtaPencere";
import Ipucu from "./Ipucu";
import AramaKutusu from "./AramaKutusu";
import { DonemPenceresi } from "./TarihSuzgeci";
import { adetGoster, paraGoster } from "../para";
import {
  analizAdisyonlari,
  analizOzeti,
  analizUrunleri,
  donemAraligi,
  donemMetni,
  kasaGunuBasi,
  kasaSaatSirasi,
  oncekiAralik,
  type AnalizAdisyon,
  type AnalizFiltre as Filtre,
  type AnalizOzeti,
  type DonemKodu,
  type MenuUrunu,
  type UrunKategorisi,
} from "../analiz";

const RENKLER = ["#334155", "#0ea5a4", "#7c3aed", "#d97706"];
const HARFLER = ["A", "B", "C", "D"];
const EN_COK = 4;
const GUN = 86400000;

/**
 * Hazır dönemler A'ya bağlı: üstten dönem değişince onlar da kayıyor.
 * Takvimden seçilen dönem ise sabit kalıyor.
 */
type Ek =
  | { tur: "kaydir"; birim: "onceki" | "hafta" | "ay" | "yil" }
  | { tur: "sabit"; donem: DonemKodu; bas: string; bit: string };

// yazili: aralığı kişi takvimden girdi; tarih kasa gününe çevrilmeden, yazıldığı gibi gösteriliyor.
type Donem = { ad: string; bas: Date; bit: Date; filtre: Filtre; yazili?: boolean };

const HAZIRLAR: { birim: "onceki" | "hafta" | "ay" | "yil"; ad: string; ikon: LucideIcon }[] = [
  { birim: "onceki", ad: "Önceki dönem", ikon: History },
  { birim: "hafta", ad: "Bir hafta önce", ikon: CalendarDays },
  { birim: "ay", ad: "Bir ay önce", ikon: CalendarRange },
  { birim: "yil", ad: "Geçen yıl aynı günler", ikon: CalendarClock },
];

// Sekme değişince bileşen kapanıyor; seçilen dönemler ve inen adisyonlar
// geri dönüldüğünde baştan kurulmasın.
let saklananEkler: Ek[] = [{ tur: "kaydir", birim: "onceki" }];
const onbellek = new Map<string, AnalizAdisyon[]>();

const iki = (n: number) => String(n).padStart(2, "0");
const yerel = (t: Date) =>
  `${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}T${iki(t.getHours())}:${iki(t.getMinutes())}`;

/** Süren dönem kaydırılırken geçen kısmı kadar alınıyor; yoksa bugün hep "geride" görünür. */
function kaydir(bas: Date, bit: Date, birim: "hafta" | "ay" | "yil") {
  const son = bit.getTime() > Date.now() ? new Date() : bit;
  const tasi = (t: Date) => {
    const y = new Date(t);
    if (birim === "hafta") y.setDate(y.getDate() - 7);
    // 364 gün: haftanın günleri tutsun, cumartesi cumartesiyle kıyaslansın.
    else if (birim === "yil") y.setDate(y.getDate() - 364);
    else y.setMonth(y.getMonth() - 1);
    return y;
  };
  return { bas: tasi(bas), bit: tasi(son) };
}

// Özel aralığın tam tarihi çipte ve balonda zaten yazıyor; ad olarak da
// yazılınca uzun saatli metin balonu ekrandan taşırıyordu.
const donemAdi = (f: Filtre) =>
  f.donem === "ozel" && !f.vardiyaId ? "Seçilen aralık" : donemMetni(f);

function donemKur(ek: Ek, ana: Filtre): Donem | null {
  const temel: Filtre = { ...ana, vardiyaId: null, vardiyaBas: "", vardiyaBit: "" };
  if (ek.tur === "sabit") {
    const filtre = { ...temel, donem: ek.donem, ozelBas: ek.bas, ozelBit: ek.bit };
    const { bas, bit } = donemAraligi(filtre);
    return { ad: donemAdi(filtre), bas, bit, filtre, yazili: ek.donem === "ozel" };
  }
  const a = donemAraligi(ana);
  const aralik = ek.birim === "onceki" ? oncekiAralik(ana) : kaydir(a.bas, a.bit, ek.birim);
  if (!aralik) return null;
  const ad = HAZIRLAR.find((h) => h.birim === ek.birim)!.ad;
  const filtre = { ...temel, donem: "ozel" as const, ozelBas: yerel(aralik.bas), ozelBit: yerel(aralik.bit) };
  return { ad, bas: aralik.bas, bit: aralik.bit, filtre };
}

const sonGun = (d: { bit: Date }) => kasaGunuBasi(new Date(d.bit.getTime() - 60000));
const gunSayisi = (d: { bas: Date; bit: Date }) =>
  Math.max(1, Math.round((sonGun(d).getTime() - kasaGunuBasi(d.bas).getTime()) / GUN) + 1);

/**
 * Takvim en son eklenen dönemin günlerinde açılıyor: geçen ayı seçmek için
 * her seferinde bugünden geri sarılmasın. Saatler A'nınki — kaydırılan
 * dönemin dakikası kayık olabiliyor, yeni seçilen günlere o geçmesin.
 */
function takvimBaslangici(donemler: Donem[]) {
  const a = donemler[0];
  const son = donemler[donemler.length - 1];
  const gun = (t: Date) => yerel(t).slice(0, 10);
  const saat = (t: Date) => yerel(t).slice(11);
  // Süren dönem akşam bitiyor; bitiş o kasa gününün sonuna, gerekirse ertesi sabaha.
  const bitis = sonGun(son);
  if (saat(a.bit) <= saat(a.bas)) bitis.setDate(bitis.getDate() + 1);
  return {
    kod: "ozel" as const,
    bas: `${gun(kasaGunuBasi(son.bas))}T${saat(a.bas)}`,
    bit: `${gun(bitis)}T${saat(a.bit)}`,
  };
}

const kisaGun = (t: Date) => t.toLocaleDateString("tr-TR", { weekday: "short" });
const tarihYaz = (t: Date, yil = true) =>
  t.toLocaleDateString("tr-TR", { day: "numeric", month: "short", ...(yil ? { year: "numeric" } : {}) });

function aralikYazisi(d: Donem) {
  if (d.yazili) {
    const saat = (t: Date) => t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const ayniGun = d.bas.toDateString() === d.bit.toDateString();
    const ayniYil = d.bas.getFullYear() === d.bit.getFullYear();
    return {
      tarih: ayniGun ? tarihYaz(d.bas) : `${tarihYaz(d.bas, !ayniYil)} – ${tarihYaz(d.bit)}`,
      gunler: `${kisaGun(d.bas)} ${saat(d.bas)} – ${kisaGun(d.bit)} ${saat(d.bit)}`,
    };
  }
  const ilk = kasaGunuBasi(d.bas);
  const son = sonGun(d);
  if (ilk.toDateString() === son.toDateString()) {
    return { tarih: tarihYaz(ilk), gunler: ilk.toLocaleDateString("tr-TR", { weekday: "long" }) };
  }
  const ayniYil = ilk.getFullYear() === son.getFullYear();
  return { tarih: `${tarihYaz(ilk, !ayniYil)} – ${tarihYaz(son)}`, gunler: `${kisaGun(ilk)} – ${kisaGun(son)}` };
}

const tamPara = (v: number) => (v < 0 ? "−" : "") + "₺" + Math.round(Math.abs(v)).toLocaleString("tr-TR");
const yuvarla = (v: number) => Math.round(v * 100) / 100;

/** Harfin üstüne gelince (telefonda dokununca) dönemin adı ve tarihi. */
// Balon sayfanın en üst katmanına çiziliyor: kartın, pencerenin ya da yan
// menünün kenarında kesilmesin; ekranın kenarına yaklaşınca içeri kayıyor.
function Harf({ i, donem, buyuk }: { i: number; donem: Donem; buyuk?: boolean }) {
  const { tarih, gunler } = aralikYazisi(donem);
  const harf = useRef<HTMLSpanElement>(null);
  const balon = useRef<HTMLSpanElement>(null);
  const [acik, setAcik] = useState(false);
  const [yer, setYer] = useState<{ left: number; top: number; ok: number; alta: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!acik || !harf.current || !balon.current) return;
    const h = harf.current.getBoundingClientRect();
    const b = balon.current.getBoundingClientRect();
    const orta = h.left + h.width / 2;
    const left = Math.min(Math.max(8, orta - b.width / 2), window.innerWidth - b.width - 8);
    const alta = h.top - b.height - 10 < 8;
    setYer({ left, top: alta ? h.bottom + 10 : h.top - b.height - 10, ok: orta - left, alta });
  }, [acik]);

  useEffect(() => {
    if (!acik) return;
    const kapat = () => setAcik(false);
    window.addEventListener("scroll", kapat, true);
    return () => window.removeEventListener("scroll", kapat, true);
  }, [acik]);

  return (
    <span
      ref={harf}
      className={buyuk ? "kys-harf buyuk" : "kys-harf"}
      style={{ background: RENKLER[i] }}
      tabIndex={0}
      onMouseEnter={() => setAcik(true)}
      onMouseLeave={() => {
        setAcik(false);
        setYer(null);
      }}
      onBlur={() => {
        setAcik(false);
        setYer(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        setAcik(true);
      }}
    >
      {HARFLER[i]}
      {acik &&
        createPortal(
          <span
            ref={balon}
            className={yer?.alta ? "kys-balon alta" : "kys-balon"}
            style={{
              left: yer?.left ?? -9999,
              top: yer?.top ?? -9999,
              ["--ok" as string]: `${yer?.ok ?? 0}px`,
            }}
          >
            <b>
              <CalendarDays size={14} /> {donem.ad}
            </b>
            <span>{tarih}</span>
            <small>{gunler}</small>
          </span>,
          document.body
        )}
    </span>
  );
}

/** A'nın kıyaslanan döneme göre farkı. "Az iyi" ölçüde renk ters dönüyor. */
function Fark({ a, x, azIyi, kisa, birim }: { a: number; x: number; azIyi?: boolean; kisa?: boolean; birim?: "para" | "adet" }) {
  const fark = yuvarla(a - x);
  if (Math.abs(fark) < 0.005) return <span className="kys-fark esit">Aynı</span>;
  const iyi = azIyi ? fark < 0 : fark > 0;
  const Ikon = fark > 0 ? TrendingUp : TrendingDown;
  const yuzde = x ? Math.abs((fark / x) * 100) : null;
  const metin = kisa
    ? birim === "para"
      ? `${fark > 0 ? "+" : "−"}${tamPara(Math.abs(fark))}`
      : `${fark > 0 ? "+" : "−"}${adetGoster(Math.abs(fark))}`
    : `A ${yuzde != null ? `%${yuzde.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ` : ""}${fark > 0 ? "önde" : "geride"}`;
  return (
    <span className={iyi ? "kys-fark iyi" : "kys-fark kotu"}>
      <Ikon size={13} />
      {metin}
    </span>
  );
}

type Olcu = {
  kod: string;
  ad: string;
  ikon: LucideIcon;
  deger: (o: AnalizOzeti) => number;
  para?: boolean;
  azIyi?: boolean;
};

const OLCULER: Olcu[] = [
  { kod: "ciro", ad: "Toplam satış", ikon: Wallet, deger: (o) => o.ciro, para: true },
  { kod: "adisyon", ad: "Adisyon", ikon: Receipt, deger: (o) => o.adisyon },
  { kod: "ortalama", ad: "Adisyon ortalaması", ikon: Scale, deger: (o) => o.ortalama, para: true },
  { kod: "misafir", ad: "Misafir", ikon: Users, deger: (o) => o.misafir },
  { kod: "kisiBasi", ad: "Kişi başı", ikon: UserRound, deger: (o) => o.kisiBasi, para: true },
  { kod: "indirim", ad: "İndirim ve ikram", ikon: Gift, deger: (o) => o.indirim + o.ikram, para: true, azIyi: true },
];

const olcuYaz = (o: Olcu, v: number) => (o.para ? paraGoster(v) : adetGoster(Math.round(v)));

type Dilim = { tutar: number; adet: number };
type BolgeSatiri = Dilim & { ad: string; masalar: Map<string, Dilim> };

function bolgeDokumu(adisyonlar: AnalizAdisyon[]) {
  const bolgeler = new Map<string, BolgeSatiri>();
  for (const a of adisyonlar) {
    if (a.durum !== "kapali") continue;
    const ad = a.masaId ? a.bolgeAd || "Bölgesiz" : "Masasız";
    const b = bolgeler.get(ad) ?? { ad, tutar: 0, adet: 0, masalar: new Map() };
    const tutar = a.toplam - a.acikHesap;
    b.tutar = yuvarla(b.tutar + tutar);
    b.adet += 1;
    if (a.masaId) {
      const m = b.masalar.get(a.masaAd) ?? { tutar: 0, adet: 0 };
      b.masalar.set(a.masaAd, { tutar: yuvarla(m.tutar + tutar), adet: m.adet + 1 });
    }
    bolgeler.set(ad, b);
  }
  return bolgeler;
}

export default function Karsilastirma({
  filtre,
  adisyonlar,
  kategoriler,
  menu,
}: {
  filtre: Filtre;
  adisyonlar: AnalizAdisyon[];
  kategoriler: Map<number, UrunKategorisi>;
  menu: MenuUrunu[];
}) {
  const [ekler, setEklerHam] = useState<Ek[]>(saklananEkler);
  const setEkler = (e: Ek[]) => {
    saklananEkler = e;
    setEklerHam(e);
  };
  const [takvim, setTakvim] = useState(false);
  const [veri, setVeri] = useState<Record<string, AnalizAdisyon[]>>({});
  const [acikOlcu, setAcikOlcu] = useState<Olcu | null>(null);

  const a = donemAraligi(filtre);
  const donemler: Donem[] = useMemo(
    () => [
      { ad: donemAdi(filtre), bas: a.bas, bit: a.bit, filtre, yazili: filtre.donem === "ozel" && !filtre.vardiyaId },
      ...ekler.map((e) => donemKur(e, filtre)).filter((d): d is Donem => d !== null),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtre, ekler]
  );
  const anahtar = (d: Donem) => JSON.stringify(d.filtre);
  const anahtarlar = donemler.slice(1).map(anahtar).join("|");

  useEffect(() => {
    let gecerli = true;
    for (const d of donemler.slice(1)) {
      const k = anahtar(d);
      const hazir = onbellek.get(k);
      if (hazir) {
        setVeri((v) => (v[k] ? v : { ...v, [k]: hazir }));
        continue;
      }
      analizAdisyonlari(d.filtre).then((liste) => {
        // Süren dönemin verisi eskir; yalnız bitmiş dönem saklanıyor.
        if (d.bit.getTime() < Date.now()) onbellek.set(k, liste);
        if (gecerli) setVeri((v) => ({ ...v, [k]: liste }));
      });
    }
    return () => {
      gecerli = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtarlar]);

  const listeler = donemler.map((d, i) => (i === 0 ? adisyonlar : veri[anahtar(d)] ?? null));
  const ozetler = listeler.map((l) => (l ? analizOzeti(l, []) : null));
  const urunOzetleri = useMemo(
    () => listeler.map((l) => (l ? analizUrunleri(l, kategoriler, { menu }) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listeler.map((l) => (l ? l.length : -1)).join(","), anahtarlar, adisyonlar, kategoriler, menu]
  );
  const bolgeler = useMemo(
    () => listeler.map((l) => (l ? bolgeDokumu(l) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listeler.map((l) => (l ? l.length : -1)).join(","), anahtarlar, adisyonlar]
  );

  const dolu = donemler.length >= EN_COK;
  const ekle = (e: Ek) => !dolu && setEkler([...ekler, e]);
  const sil = (i: number) => setEkler(ekler.filter((_, j) => j !== i - 1));

  const yukleniyor = (i: number) => listeler[i] === null;

  return (
    <div className="kys">
      <div className="kys-ust">
        <div className="kys-donemler">
          <span className="kys-etiket">
            Dönemler
            <Ipucu>
              A, üstteki dönem seçiminden gelir. Filtrelerde seçilen bölge, masa ve diğer süzgeçler bütün dönemlere aynı
              anda uygulanır.
            </Ipucu>
          </span>
          {donemler.map((d, i) => {
            const { tarih } = aralikYazisi(d);
            return (
              <span key={i} className="kys-cip" style={{ ["--renk" as string]: RENKLER[i] }}>
                <Harf i={i} donem={d} />
                <span className="kys-cip-metin">
                  <b>{d.ad}</b>
                  <small>{tarih}</small>
                </span>
                {yukleniyor(i) && <LoaderCircle size={15} className="donen" />}
                {i > 0 && (
                  <button className="kys-cip-sil" onClick={() => sil(i)} aria-label="Dönemi çıkar">
                    <X size={15} />
                  </button>
                )}
              </span>
            );
          })}
          {!dolu && (
            <button className="kys-cip ekle" onClick={() => setTakvim(true)}>
              <Plus size={16} /> Dönem ekle
            </button>
          )}
        </div>
        {!dolu && (
          <div className="kys-hazirlar">
            {HAZIRLAR.map((h) => (
              <button key={h.birim} className="kys-hazir" onClick={() => ekle({ tur: "kaydir", birim: h.birim })}>
                <h.ikon size={15} />
                {h.ad}
              </button>
            ))}
          </div>
        )}
      </div>

      {donemler.length < 2 && (
        <div className="kys-bos">
          <CalendarRange size={22} />
          <span>Kıyaslamak için bir dönem ekleyin ya da hazır seçeneklerden birine dokunun.</span>
        </div>
      )}

      <div className="kys-kartlar">
        {OLCULER.map((o) => (
          <button key={o.kod} className="kys-kart" onClick={() => setAcikOlcu(o)}>
            <span className="kys-kart-bas">
              <span className="kys-ikon">
                <o.ikon size={18} />
              </span>
              {o.ad}
            </span>
            {donemler.map((d, i) => (
              <span key={i} className="kys-kart-satir">
                <Harf i={i} donem={d} />
                <b className={i === 0 ? "" : "ikincil"}>{ozetler[i] ? olcuYaz(o, o.deger(ozetler[i]!)) : "…"}</b>
                {i === 0 ? (
                  donemler.length > 1 && <span className="kys-fark taban">taban</span>
                ) : (
                  ozetler[0] &&
                  ozetler[i] && <Fark a={o.deger(ozetler[0])} x={o.deger(ozetler[i]!)} azIyi={o.azIyi} />
                )}
              </span>
            ))}
          </button>
        ))}
      </div>

      <Bloklar donemler={donemler} urunOzetleri={urunOzetleri} bolgeler={bolgeler} />

      {takvim && (
        <DonemPenceresi
          tumu={false}
          donem={takvimBaslangici(donemler)}
          onSec={(d) => {
            ekle({ tur: "sabit", donem: d.kod === "tumu" ? "bugun" : d.kod, bas: d.bas, bit: d.bit });
            setTakvim(false);
          }}
          onKapat={() => setTakvim(false)}
        />
      )}

      {acikOlcu && <OlcuPenceresi olcu={acikOlcu} donemler={donemler} listeler={listeler} onKapat={() => setAcikOlcu(null)} />}
    </div>
  );
}

type UrunOzetleri = (ReturnType<typeof analizUrunleri> | null)[];
type Bolgeler = (Map<string, BolgeSatiri> | null)[];

const ONIZLEME = 5;
const stil = (n: number) => ({ ["--sutun" as string]: n });

function Basliklar({ donemler, ilk }: { donemler: Donem[]; ilk: string }) {
  return (
    <div className="kys-tablo-bas" style={stil(donemler.length)}>
      <span>{ilk}</span>
      {donemler.map((d, i) => (
        <span key={i}>
          <Harf i={i} donem={d} />
        </span>
      ))}
    </div>
  );
}

/**
 * Ana değer, altında sayısı, kıyaslanan dönemde A'ya göre farkı. Sayı varsa
 * fark sayıdan: fiyat değişince tutar artar, satılan adet artmamış olabilir.
 */
function Hucre({
  i,
  deger,
  aDeger,
  adet,
  aAdet,
  alt,
  para,
}: {
  i: number;
  deger: number | null;
  aDeger: number | null;
  adet?: number | null;
  aAdet?: number | null;
  alt?: string;
  para?: boolean;
}) {
  const sayiyla = adet !== undefined;
  const x = sayiyla ? adet : deger;
  const a = sayiyla ? aAdet ?? null : aDeger;
  return (
    <span className="kys-hucre">
      <b className={i === 0 ? "" : "ikincil"}>{deger == null ? "…" : para ? tamPara(deger) : adetGoster(deger)}</b>
      {deger != null && alt && <small>{alt}</small>}
      {i > 0 && x != null && a != null && <Fark a={a} x={x} kisa birim={para && !sayiyla ? "para" : "adet"} />}
    </span>
  );
}

type KategoriSatiri = { ad: string; renk?: string; degerler: ({ tutar: number; adet: number } | null)[]; yuklu: boolean[] };

function kategoriSatirlari(ozetler: UrunOzetleri): KategoriSatiri[] {
  const adlar = new Map<string, string | undefined>();
  for (const o of ozetler) for (const k of o?.kategoriler ?? []) if (!adlar.has(k.ad)) adlar.set(k.ad, k.renk);
  return [...adlar.entries()]
    .map(([ad, renk]) => ({
      ad,
      renk,
      degerler: ozetler.map((o) => (o ? o.kategoriler.find((k) => k.ad === ad) ?? { tutar: 0, adet: 0 } : null)),
      yuklu: ozetler.map((o) => o !== null),
    }))
    .sort((x, y) => (y.degerler[0]?.tutar ?? 0) - (x.degerler[0]?.tutar ?? 0));
}

type UrunSatiri = { anahtar: string; ad: string; kategoriAd: string; miktarlar: (number | null)[]; cirolar: (number | null)[] };

function urunSatirlari(ozetler: UrunOzetleri): UrunSatiri[] {
  const urunler = new Map<string, UrunSatiri>();
  ozetler.forEach((o, i) => {
    for (const s of o?.satirlar ?? []) {
      const u = urunler.get(s.anahtar) ?? {
        anahtar: s.anahtar,
        ad: s.ad,
        kategoriAd: s.kategoriAd,
        miktarlar: ozetler.map((x) => (x ? 0 : null)),
        cirolar: ozetler.map((x) => (x ? 0 : null)),
      };
      u.miktarlar[i] = (u.miktarlar[i] ?? 0) + s.miktar;
      u.cirolar[i] = yuvarla((u.cirolar[i] ?? 0) + s.ciro);
      urunler.set(s.anahtar, u);
    }
  });
  return [...urunler.values()].sort(
    (x, y) => Math.max(...y.miktarlar.map((m) => m ?? 0)) - Math.max(...x.miktarlar.map((m) => m ?? 0))
  );
}

function KategoriSatirlari({
  donemler,
  satirlar,
  urunler,
  acik,
  ac,
}: {
  donemler: Donem[];
  satirlar: KategoriSatiri[];
  urunler?: UrunSatiri[];
  acik?: string | null;
  ac?: (k: string) => void;
}) {
  return (
    <>
      <Basliklar donemler={donemler} ilk="Kategori" />
      {satirlar.map((s) => {
        const Satir = ac ? "button" : "div";
        return (
          <Fragment key={s.ad}>
            <Satir
              className={acik === s.ad ? "kys-tablo-satir secili" : "kys-tablo-satir"}
              style={stil(donemler.length)}
              onClick={ac ? () => ac(s.ad) : undefined}
            >
              <span className="kys-ad">
                <i className="kys-nokta" style={{ background: s.renk ?? "#94a3b8" }} />
                {s.ad}
                {ac && <ChevronDown size={15} className={acik === s.ad ? "kys-ok ters" : "kys-ok"} />}
              </span>
              {s.degerler.map((d, i) => (
                <Hucre
                  key={i}
                  i={i}
                  para
                  deger={d?.tutar ?? null}
                  aDeger={s.degerler[0]?.tutar ?? null}
                  adet={d?.adet ?? null}
                  aAdet={s.degerler[0]?.adet ?? null}
                  alt={d ? `${adetGoster(d.adet)} adet` : undefined}
                />
              ))}
            </Satir>
            {acik === s.ad && urunler && (
              <div className="kys-ic">
                <UrunSatirlari donemler={donemler} satirlar={urunler.filter((u) => u.kategoriAd === s.ad)} />
              </div>
            )}
          </Fragment>
        );
      })}
      {!satirlar.length && <p className="kys-yok">Bu dönemlerde satış yok.</p>}
    </>
  );
}

function UrunSatirlari({ donemler, satirlar }: { donemler: Donem[]; satirlar: UrunSatiri[] }) {
  return (
    <>
      <Basliklar donemler={donemler} ilk="Ürün" />
      {satirlar.map((s) => (
        <div key={s.anahtar} className="kys-tablo-satir" style={stil(donemler.length)}>
          <span className="kys-ad">{s.ad}</span>
          {s.miktarlar.map((m, i) => (
            <Hucre
              key={i}
              i={i}
              deger={m}
              aDeger={s.miktarlar[0]}
              alt={s.cirolar[i] != null ? tamPara(s.cirolar[i]!) : undefined}
            />
          ))}
        </div>
      ))}
      {!satirlar.length && <p className="kys-yok">Bu dönemlerde satış yok.</p>}
    </>
  );
}

function bolgeAdlari(bolgeler: Bolgeler) {
  return [...new Set(bolgeler.flatMap((b) => (b ? [...b.keys()] : [])))].sort(
    (x, y) => (bolgeler[0]?.get(y)?.tutar ?? 0) - (bolgeler[0]?.get(x)?.tutar ?? 0)
  );
}

function BolgeSatirlari({
  donemler,
  bolgeler,
  adlar,
  acik,
  ac,
}: {
  donemler: Donem[];
  bolgeler: Bolgeler;
  adlar: string[];
  acik?: string | null;
  ac?: (b: string) => void;
}) {
  const enBuyuk = Math.max(1, ...bolgeler.flatMap((b) => (b ? [...b.values()].map((s) => s.tutar) : [])));
  return (
    <div className="kys-bolgeler">
      {adlar.map((ad) => {
        const masalar = [...new Set(bolgeler.flatMap((b) => (b?.get(ad) ? [...b.get(ad)!.masalar.keys()] : [])))].sort(
          (x, y) => (bolgeler[0]?.get(ad)?.masalar.get(y)?.tutar ?? 0) - (bolgeler[0]?.get(ad)?.masalar.get(x)?.tutar ?? 0)
        );
        const acilir = !!ac && masalar.length > 0;
        const Kutu = acilir ? "button" : "div";
        return (
          <Fragment key={ad}>
            <Kutu
              className={acik === ad ? "kys-bolge acik" : acilir ? "kys-bolge" : "kys-bolge sabit"}
              onClick={acilir ? () => ac!(ad) : undefined}
            >
              <span className="kys-bolge-bas">
                <Armchair size={16} />
                <b>{ad}</b>
                {acilir && <ChevronDown size={16} className="kys-ok" />}
              </span>
              {donemler.map((d, i) => {
                const s = bolgeler[i]?.get(ad);
                const t = s?.tutar ?? 0;
                return (
                  <span key={i} className="kys-cubuk-satir">
                    <Harf i={i} donem={d} />
                    <span className="kys-cubuk">
                      <i style={{ width: `${(t / enBuyuk) * 100}%`, background: RENKLER[i] }} />
                    </span>
                    <span className="kys-cubuk-tutar">
                      {bolgeler[i] ? tamPara(t) : "…"}
                      {bolgeler[i] && <small>{s?.adet ?? 0} adisyon</small>}
                    </span>
                    {i > 0 && bolgeler[i] && bolgeler[0] ? (
                      <Fark a={bolgeler[0].get(ad)?.adet ?? 0} x={s?.adet ?? 0} />
                    ) : (
                      <span className="kys-fark-yer" />
                    )}
                  </span>
                );
              })}
            </Kutu>
            {acik === ad && (
              <div className="kys-ic">
                <Basliklar donemler={donemler} ilk="Masa" />
                {masalar.map((m) => (
                  <div key={m} className="kys-tablo-satir" style={stil(donemler.length)}>
                    <span className="kys-ad">{m}</span>
                    {donemler.map((_, i) => {
                      const s = bolgeler[i] ? bolgeler[i]!.get(ad)?.masalar.get(m) ?? { tutar: 0, adet: 0 } : null;
                      return (
                        <Hucre
                          key={i}
                          i={i}
                          para
                          deger={s?.tutar ?? null}
                          aDeger={bolgeler[0] ? bolgeler[0].get(ad)?.masalar.get(m)?.tutar ?? 0 : null}
                          adet={s?.adet ?? null}
                          aAdet={bolgeler[0] ? bolgeler[0].get(ad)?.masalar.get(m)?.adet ?? 0 : null}
                          alt={s ? `${s.adet} adisyon` : undefined}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </Fragment>
        );
      })}
      {!adlar.length && <p className="kys-yok">Bu dönemlerde satış yok.</p>}
    </div>
  );
}

/** Blok kartı: ilk birkaç satırı gösteriyor, dokununca tamamı ortada açılıyor. */
function Onizleme({
  ikon: Ikon,
  baslik,
  ozet,
  kalan,
  onAc,
  children,
}: {
  ikon: LucideIcon;
  baslik: string;
  ozet: string;
  kalan: number;
  onAc: () => void;
  children: ReactNode;
}) {
  return (
    <section className="kys-blok tiklanir" onClick={onAc} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onAc()}>
      <header>
        <span className="kys-ikon">
          <Ikon size={18} />
        </span>
        <span className="kys-blok-baslik">
          <h3>{baslik}</h3>
          <small>{ozet}</small>
        </span>
        <span className="kys-ac">
          <Maximize2 size={16} />
        </span>
      </header>
      {children}
      {kalan > 0 && (
        <span className="kys-daha">
          {kalan} satır daha <ChevronRight size={15} />
        </span>
      )}
    </section>
  );
}

function Bloklar({
  donemler,
  urunOzetleri,
  bolgeler,
}: {
  donemler: Donem[];
  urunOzetleri: UrunOzetleri;
  bolgeler: Bolgeler;
}) {
  const [pencere, setPencere] = useState<"kategori" | "urun" | "bolge" | null>(null);
  const [acikKategori, setAcikKategori] = useState<string | null>(null);
  const [acikBolge, setAcikBolge] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [urunKategori, setUrunKategori] = useState<string | null>(null);

  const kategoriler = useMemo(() => kategoriSatirlari(urunOzetleri), [urunOzetleri]);
  const urunler = useMemo(() => urunSatirlari(urunOzetleri), [urunOzetleri]);
  const bolgeAdlari_ = bolgeAdlari(bolgeler);

  const aranan = arama.trim().toLocaleLowerCase("tr");
  const suzulmusUrunler = urunler.filter(
    (u) => (!urunKategori || u.kategoriAd === urunKategori) && (!aranan || u.ad.toLocaleLowerCase("tr").includes(aranan))
  );
  const kapat = () => {
    setPencere(null);
    setAcikKategori(null);
    setAcikBolge(null);
    setArama("");
    setUrunKategori(null);
  };

  return (
    <>
      <div className="kys-bloklar">
        <Onizleme
          ikon={Shapes}
          baslik="Kategoriler"
          ozet={`${kategoriler.length} kategori · tutar ve adet`}
          kalan={kategoriler.length - ONIZLEME}
          onAc={() => setPencere("kategori")}
        >
          <KategoriSatirlari donemler={donemler} satirlar={kategoriler.slice(0, ONIZLEME)} />
        </Onizleme>
        <Onizleme
          ikon={Coffee}
          baslik="Ürünler"
          ozet={`${urunler.length} ürün · adet ve tutar`}
          kalan={urunler.length - ONIZLEME}
          onAc={() => setPencere("urun")}
        >
          <UrunSatirlari donemler={donemler} satirlar={urunler.slice(0, ONIZLEME)} />
        </Onizleme>
        <Onizleme
          ikon={LayoutGrid}
          baslik="Bölgeler ve masalar"
          ozet={`${bolgeAdlari_.length} bölge · tutar ve adisyon`}
          kalan={bolgeAdlari_.length - ONIZLEME}
          onAc={() => setPencere("bolge")}
        >
          <BolgeSatirlari donemler={donemler} bolgeler={bolgeler} adlar={bolgeAdlari_.slice(0, ONIZLEME)} />
        </Onizleme>
      </div>

      {pencere === "kategori" && (
        <OrtaPencere ikon={Shapes} baslik="Kategoriler" aciklama="Kategoriye dokununca içindeki ürünler açılır." genislik="genis" onKapat={kapat}>
          <div className="kys-pnc-tablo">
            <KategoriSatirlari
              donemler={donemler}
              satirlar={kategoriler}
              urunler={urunler}
              acik={acikKategori}
              ac={(k) => setAcikKategori(acikKategori === k ? null : k)}
            />
          </div>
        </OrtaPencere>
      )}

      {pencere === "urun" && (
        <OrtaPencere ikon={Coffee} baslik="Ürünler" genislik="genis" onKapat={kapat}>
          <div className="kys-pnc-araclar">
            <AramaKutusu deger={arama} degistir={setArama} yer="Ürün ara" />
            <div className="kys-pnc-cipler">
              <button className={urunKategori ? "" : "aktif"} onClick={() => setUrunKategori(null)}>
                Hepsi
              </button>
              {kategoriler.map((k) => (
                <button
                  key={k.ad}
                  className={urunKategori === k.ad ? "aktif" : ""}
                  onClick={() => setUrunKategori(urunKategori === k.ad ? null : k.ad)}
                >
                  <i className="kys-nokta" style={{ background: k.renk ?? "#94a3b8" }} />
                  {k.ad}
                </button>
              ))}
            </div>
          </div>
          <div className="kys-pnc-tablo">
            <UrunSatirlari donemler={donemler} satirlar={suzulmusUrunler} />
          </div>
        </OrtaPencere>
      )}

      {pencere === "bolge" && (
        <OrtaPencere ikon={LayoutGrid} baslik="Bölgeler ve masalar" aciklama="Bölgeye dokununca masaları tek tek açılır." genislik="genis" onKapat={kapat}>
          <BolgeSatirlari
            donemler={donemler}
            bolgeler={bolgeler}
            adlar={bolgeAdlari_}
            acik={acikBolge}
            ac={(b) => setAcikBolge(acikBolge === b ? null : b)}
          />
        </OrtaPencere>
      )}
    </>
  );
}

/**
 * Ölçünün gün gün (tek günlük dönemde saat saat) dökümü. Dönemler sırayla
 * hizalanıyor: her dönemin birinci günü aynı satırda — hazır dönemler aynı
 * gün sırasıyla kaydığı için cumartesi cumartesiyle yan yana düşüyor.
 */
function OlcuPenceresi({
  olcu,
  donemler,
  listeler,
  onKapat,
}: {
  olcu: Olcu;
  donemler: Donem[];
  listeler: (AnalizAdisyon[] | null)[];
  onKapat: () => void;
}) {
  const saatlik = gunSayisi(donemler[0]) === 1;
  const saatSirasi = kasaSaatSirasi();

  const tablo = useMemo(() => {
    const kovalar = donemler.map((d, i) => {
      const liste = listeler[i];
      if (!liste) return null;
      const gruplar = new Map<number, AnalizAdisyon[]>();
      const ilk = kasaGunuBasi(d.bas).getTime();
      for (const a of liste) {
        const an = new Date(a.kapanis ?? a.acilis);
        const yer = saatlik
          ? saatSirasi.indexOf(an.getHours())
          : Math.round((kasaGunuBasi(an).getTime() - ilk) / GUN);
        gruplar.set(yer, [...(gruplar.get(yer) ?? []), a]);
      }
      return gruplar;
    });
    const satirSayisi = saatlik ? 24 : Math.max(...donemler.map(gunSayisi));
    const satirlar = Array.from({ length: satirSayisi }, (_, s) => ({
      etiket: (i: number) => {
        if (saatlik) return `${iki(saatSirasi[s])}:00`;
        const gun = new Date(kasaGunuBasi(donemler[i].bas));
        gun.setDate(gun.getDate() + s);
        return `${kisaGun(gun)} ${gun.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}`;
      },
      degerler: kovalar.map((k, i) => {
        if (!k) return null;
        if (!saatlik && s >= gunSayisi(donemler[i])) return null;
        return olcu.deger(analizOzeti(k.get(s) ?? [], []));
      }),
    }));
    // Saat dökümünde kepenk kapalı saatler satır kaplamasın.
    return saatlik ? satirlar.filter((r) => r.degerler.some((v) => v)) : satirlar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olcu, donemler, listeler]);

  const toplamlar = listeler.map((l) => (l ? olcu.deger(analizOzeti(l, [])) : null));

  let enBuyuk: { satir: string; harf: string; fark: number } | null = null;
  for (const r of tablo) {
    const a = r.degerler[0];
    if (a == null) continue;
    r.degerler.forEach((x, i) => {
      if (i === 0 || x == null) return;
      const fark = yuvarla(a - x);
      if (!enBuyuk || Math.abs(fark) > Math.abs(enBuyuk.fark)) enBuyuk = { satir: r.etiket(0), harf: HARFLER[i], fark };
    });
  }
  const cumle = enBuyuk as { satir: string; harf: string; fark: number } | null;

  return (
    <OrtaPencere ikon={olcu.ikon} baslik={olcu.ad} genislik="genis" onKapat={onKapat}>
      <div className="kys-pnc-toplamlar">
        {donemler.map((d, i) => (
          <div key={i} className="kys-pnc-toplam">
            <span className="kys-pnc-ust">
              <Harf i={i} donem={d} buyuk />
              {d.ad}
            </span>
            <b>{toplamlar[i] == null ? "…" : olcuYaz(olcu, toplamlar[i]!)}</b>
            {i > 0 && toplamlar[0] != null && toplamlar[i] != null && (
              <Fark a={toplamlar[0]} x={toplamlar[i]!} azIyi={olcu.azIyi} />
            )}
          </div>
        ))}
      </div>

      {cumle && Math.abs(cumle.fark) > 0 && (
        <p className="kys-cumle">
          En büyük fark <b>{cumle.satir}</b>: A, {cumle.harf} döneminden{" "}
          <b>{olcu.para ? paraGoster(Math.abs(cumle.fark)) : adetGoster(Math.abs(Math.round(cumle.fark)))}</b>{" "}
          {cumle.fark > 0 ? "fazla" : "az"}.
        </p>
      )}

      <div className="kys-pnc-tablo">
        <Basliklar donemler={donemler} ilk={saatlik ? "Saat" : "Gün"} />
        {tablo.map((r, s) => (
          <div key={s} className="kys-tablo-satir" style={{ ["--sutun" as string]: donemler.length }}>
            <span className="kys-ad">{r.etiket(0)}</span>
            {r.degerler.map((v, i) => (
              <span key={i} className="kys-hucre">
                <b className={i === 0 ? "" : "ikincil"}>{v == null ? "—" : olcuYaz(olcu, v)}</b>
                {i > 0 && !saatlik && v != null && <small>{r.etiket(i)}</small>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </OrtaPencere>
  );
}

