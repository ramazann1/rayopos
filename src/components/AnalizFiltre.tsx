import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Check, Filter, SlidersHorizontal, X } from "lucide-react";
import Anahtar from "./Anahtar";
import OrtaPencere from "./OrtaPencere";
import { ayarlar } from "../isletmeAyarlari";
import { vardiyaGecmisi, type VardiyaOzeti } from "../kasa";
import { BOLGE_ANAHTAR, bolgeleriGetir } from "../masalar";
import { ODEME_TIPI_ANAHTAR, odemeTipleriniGetir, type OdemeTipi } from "../odemeTipleri";
import { personeliGetir } from "../personel";
import { useTanim } from "../tanimAbonelik";
import { DonemPenceresi } from "./TarihSuzgeci";
import {
  BOS_FILTRE,
  DONEMLER,
  aralikMetni,
  donemAraligi,
  donemMetni,
  filtreSayisi,
  kasaGunuBasi,
  type AnalizFiltre as Filtre,
} from "../analiz";
import type { Bolge } from "../types";

const DURUM_CIPLERI: Record<Filtre["durum"], string> = {
  hepsi: "",
  acik: "Açık hesaplar",
  kapali: "Kapanmış hesaplar",
  ikram: "İkram edilenler",
  iptal: "İptal edilenler",
};

/** Telefondaki başlığın altı: tek kasa günü "Çarşamba, 7 Ekim", aralık "1 Eki – 3 Eki". */
function kisaAralik(bas: Date, bit: Date) {
  const ilk = kasaGunuBasi(bas);
  const son = kasaGunuBasi(new Date(bit.getTime() - 60000));
  if (ilk.toDateString() === son.toDateString()) {
    return ilk.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  }
  const yaz = (t: Date) => t.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return `${yaz(ilk)} – ${yaz(son)}`;
}

/**
 * Bütün rapor sekmelerinin tek filtre şeridi. Dönem düğmeleri hep görünür —
 * en çok değişen şey o; gerisi "Filtreler" panelinde duruyor ve seçilenler
 * altta çip olarak kalıyor ki sekme değiştirince neyin süzüldüğü unutulmasın.
 */
export default function AnalizFiltre({
  filtre,
  degistir,
  ek,
  baslik,
}: {
  filtre: Filtre;
  degistir: (f: Filtre) => void;
  /** Filtre düğmesinin yanında duran, sayfaya ait ek düğme (Excel). */
  ek?: ReactNode;
  /**
   * Telefonun sıkı hâli: sayfa başlığı şeridin solunda, Filtreler yalnız ikon,
   * saatli aralık yazısı yerine kısa tarih. Çipler yalnız süzgeç varken çıkıyor.
   */
  baslik?: string;
}) {
  const [panelAcik, setPanelAcik] = useState(false);
  const [donemAcik, setDonemAcik] = useState(false);
  const bolgeler = useTanim<Bolge[]>(BOLGE_ANAHTAR, bolgeleriGetir, []);
  const [kisiler, setKisiler] = useState<{ id: number; ad: string }[]>([]);
  const odemeTipleri = useTanim<OdemeTipi[]>(ODEME_TIPI_ANAHTAR, odemeTipleriniGetir, []);
  const [vardiyalar, setVardiyalar] = useState<VardiyaOzeti[]>([]);

  useEffect(() => {
    personeliGetir().then((p) => setKisiler(p.map((k) => ({ id: k.id, ad: k.ad }))));
    if (ayarlar().kasaTakibi) vardiyaGecmisi(30).then(setVardiyalar);
  }, []);

  const yaz = (parca: Partial<Filtre>) => degistir({ ...filtre, ...parca });

  const seciliBolgeler = bolgeler.filter((b) => filtre.bolgeIdler.includes(b.id));
  const seciliMasalar = bolgeler
    .flatMap((b) => b.masalar)
    .filter((m) => filtre.masaIdler.includes(m.id));
  const ac = (liste: number[], id: number) =>
    liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
  // Bölge çıkınca o bölgenin masaları seçimde kalırsa rapor sessizce boşalıyor.
  const bolgeDegis = (id: number) => {
    const bolgeIdler = ac(filtre.bolgeIdler, id);
    const kalanMasalar = new Set(
      bolgeler.filter((b) => bolgeIdler.includes(b.id)).flatMap((b) => b.masalar.map((m) => m.id))
    );
    yaz({ bolgeIdler, masaIdler: filtre.masaIdler.filter((m) => kalanMasalar.has(m)) });
  };
  const kisi = kisiler.find((k) => k.id === filtre.garsonId);
  const vardiya = vardiyalar.find((v) => v.id === filtre.vardiyaId);

  const cipler: { ad: string; sil: () => void }[] = [];
  if (vardiya) {
    cipler.push({
      ad: `Vardiya · ${new Date(vardiya.acilis).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })} ${new Date(vardiya.acilis).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      sil: () => yaz({ vardiyaId: null, vardiyaBas: "", vardiyaBit: "" }),
    });
  }
  // Bölge başına tek çip: masalar tek tek sıralanınca şerit kalabalıklaşıyordu.
  // "S 1" gibi bölge adıyla başlayan masa adı bölgenin yanında kısalıyor.
  for (const b of seciliBolgeler) {
    const masalar = seciliMasalar.filter((m) => b.masalar.some((x) => x.id === m.id));
    const kisa = masalar.map((m) => (m.ad.startsWith(`${b.ad} `) ? m.ad.slice(b.ad.length + 1) : m.ad));
    const ad =
      masalar.length === 0 ? b.ad : masalar.length <= 4 ? `${b.ad} · ${kisa.join(", ")}` : `${b.ad} · ${masalar.length} masa`;
    cipler.push({ ad, sil: () => bolgeDegis(b.id) });
  }
  if (kisi) cipler.push({ ad: kisi.ad, sil: () => yaz({ garsonId: null }) });
  if (filtre.tip) {
    const adlar = { masa: "Masa", gelal: "Gel Al", paket: "Paket" };
    cipler.push({ ad: adlar[filtre.tip], sil: () => yaz({ tip: null }) });
  }
  if (filtre.odemeTipi) {
    cipler.push({ ad: filtre.odemeTipi, sil: () => yaz({ odemeTipi: null }) });
  }
  if (filtre.durum !== "hepsi") {
    cipler.push({
      ad: DURUM_CIPLERI[filtre.durum],
      sil: () => yaz({ durum: "hepsi" }),
    });
  }
  if (filtre.indirimli) {
    cipler.push({ ad: "İndirimli", sil: () => yaz({ indirimli: false }) });
  }
  if (filtre.enAz != null || filtre.enCok != null) {
    const alt = filtre.enAz != null ? `₺${filtre.enAz}` : "";
    const ust = filtre.enCok != null ? `₺${filtre.enCok}` : "";
    cipler.push({
      ad: alt && ust ? `${alt} – ${ust}` : alt ? `${alt} ve üzeri` : `${ust} altı`,
      sil: () => yaz({ enAz: null, enCok: null }),
    });
  }
  const sayi = filtreSayisi(filtre);
  const temizle = () =>
    degistir({ ...BOS_FILTRE, donem: filtre.donem, ozelBas: filtre.ozelBas, ozelBit: filtre.ozelBit });
  const { bas, bit } = donemAraligi(filtre);

  const panel = (
    <OrtaPencere
      ikon={Filter}
      baslik="Filtreler"
      aciklama="Seçtikleriniz rapora hemen uygulanır."
      onKapat={() => setPanelAcik(false)}
      alt={
        <>
          {sayi > 0 && (
            <button className="pnc-vazgec" onClick={temizle}>Temizle</button>
          )}
          <button className="pnc-kaydet" onClick={() => setPanelAcik(false)}>
            <Check size={16} /> Tamam
          </button>
        </>
      }
    >
      {bolgeler.length > 0 && (
        <div className="analiz-yer-secimi">
          <div className="alan">
            <label>Bölge <em>boş = tümü</em></label>
            <div className="cip-secim">
              {bolgeler.map((b) => (
                <button
                  key={b.id}
                  className={filtre.bolgeIdler.includes(b.id) ? "aktif" : ""}
                  onClick={() => bolgeDegis(b.id)}
                >
                  {b.ad}
                </button>
              ))}
            </div>
          </div>
          {seciliBolgeler.map((b) => (
            <div className="alan" key={b.id}>
              <label>{b.ad} masaları <em>boş = tümü</em></label>
              <div className="cip-secim">
                {b.masalar.map((m) => (
                  <button
                    key={m.id}
                    className={filtre.masaIdler.includes(m.id) ? "aktif" : ""}
                    onClick={() => yaz({ masaIdler: ac(filtre.masaIdler, m.id) })}
                  >
                    {m.ad}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pnc-sutunlar analiz-filtre-panel">
        <div>
          {vardiyalar.length > 0 && (
            <label>
              <span>Vardiya</span>
              <select
                value={filtre.vardiyaId ?? ""}
                onChange={(e) => {
                  const secilen = vardiyalar.find((v) => v.id === Number(e.target.value));
                  yaz({
                    vardiyaId: secilen?.id ?? null,
                    vardiyaBas: secilen?.acilis ?? "",
                    vardiyaBit: secilen?.kapanis ?? "",
                  });
                }}
              >
                <option value="">Tarih aralığını kullan</option>
                {vardiyalar.map((v) => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.acilis).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    {new Date(v.acilis).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {v.kapanis ? "" : " · açık"}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            <span>Adisyonu açan</span>
            <select
              value={filtre.garsonId ?? ""}
              onChange={(e) =>
                yaz({ garsonId: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">Herkes</option>
              {kisiler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Sipariş tipi</span>
            <select
              value={filtre.tip ?? ""}
              onChange={(e) => yaz({ tip: (e.target.value || null) as Filtre["tip"] })}
            >
              <option value="">Hepsi</option>
              <option value="masa">Masa</option>
              {ayarlar().gelalAcik && <option value="gelal">Gel Al</option>}
              {ayarlar().paketAcik && <option value="paket">Paket</option>}
            </select>
          </label>
        </div>

        <div>
          <label>
            <span>Ödeme tipi</span>
            <select
              value={filtre.odemeTipi ?? ""}
              onChange={(e) => yaz({ odemeTipi: e.target.value || null })}
            >
              <option value="">Hepsi</option>
              {odemeTipleri.map(({ ad: o }) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Durum</span>
            <select
              value={filtre.durum}
              onChange={(e) => yaz({ durum: e.target.value as Filtre["durum"] })}
            >
              <option value="hepsi">Hepsi</option>
              <option value="kapali">Kapanmış</option>
              <option value="acik">Açık</option>
              <option value="ikram">İkram</option>
              <option value="iptal">İptal</option>
            </select>
          </label>

          <label className="analiz-tutar">
            <span>Tutar aralığı</span>
            <div>
              <input
                type="number"
                inputMode="decimal"
                placeholder="En az"
                value={filtre.enAz ?? ""}
                onChange={(e) =>
                  yaz({ enAz: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="En çok"
                value={filtre.enCok ?? ""}
                onChange={(e) =>
                  yaz({ enCok: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </div>
          </label>

          <div className="alan-anahtarlar">
            <Anahtar
              etiket="Yalnız indirimli adisyonlar"
              acik={filtre.indirimli}
              degistir={(v) => yaz({ indirimli: v })}
            />
          </div>
        </div>
      </div>
    </OrtaPencere>
  );

  const pencereler = (
    <>
      {donemAcik && (
        <DonemPenceresi
          tumu={false}
          donem={{ kod: filtre.vardiyaId ? "bugun" : filtre.donem, bas: filtre.ozelBas, bit: filtre.ozelBit }}
          onSec={(d) => {
            yaz({
              donem: d.kod === "tumu" ? "bugun" : d.kod,
              ozelBas: d.bas,
              ozelBit: d.bit,
              vardiyaId: null,
              vardiyaBas: "",
              vardiyaBit: "",
            });
            setDonemAcik(false);
          }}
          onKapat={() => setDonemAcik(false)}
        />
      )}
      {panelAcik && panel}
    </>
  );

  if (baslik) {
    return (
      <div className="analiz-filtre kompakt">
        <div className="analiz-filtre-ust">
          <div className="analiz-filtre-baslik">
            <h1>{baslik}</h1>
            <p>{filtre.vardiyaId ? donemMetni(filtre) : kisaAralik(bas, bit)}</p>
          </div>
          <button className="stok-yan-tus" onClick={() => setDonemAcik(true)}>
            <CalendarDays size={16} />
            {filtre.vardiyaId ? "Vardiya" : DONEMLER.find((d) => d.kod === filtre.donem)?.ad}
          </button>
          <button
            className={sayi > 0 ? "analiz-filtre-dugme dolu" : "analiz-filtre-dugme"}
            onClick={() => setPanelAcik(true)}
            aria-label="Filtreler"
          >
            <SlidersHorizontal size={16} />
            {sayi > 0 && <b>{sayi}</b>}
          </button>
        </div>
        {cipler.length > 0 && (
          <div className="analiz-cipler">
            {cipler.map((c) => (
              <button key={c.ad} className="analiz-cip" onClick={c.sil}>
                {c.ad}
                <X size={14} />
              </button>
            ))}
          </div>
        )}
        {pencereler}
      </div>
    );
  }

  return (
    <div className="analiz-filtre">
      <div className="analiz-filtre-ust">
        <button className="stok-yan-tus" onClick={() => setDonemAcik(true)}>
          <CalendarDays size={16} />
          {filtre.vardiyaId ? "Vardiya" : DONEMLER.find((d) => d.kod === filtre.donem)?.ad}
        </button>

        {/* Arama buraya değil, her sekmenin kendi listesinin başına ait: aranan
            şey sekmeden sekmeye değişiyor (adisyon no, ürün adı, personel). */}
        <div className="analiz-filtre-sag">
          {ek}
          <button
            className={sayi > 0 ? "analiz-filtre-dugme dolu" : "analiz-filtre-dugme"}
            onClick={() => setPanelAcik(true)}
          >
            <SlidersHorizontal size={16} />
            Filtreler
            {sayi > 0 && <b>{sayi}</b>}
          </button>
        </div>
      </div>

      <div className="analiz-cipler">
        <span className="analiz-donem-metni">
          {filtre.vardiyaId ? donemMetni(filtre) : aralikMetni(bas, bit)}
        </span>
        {cipler.map((c) => (
          <button key={c.ad} className="analiz-cip" onClick={c.sil}>
            {c.ad}
            <X size={14} />
          </button>
        ))}
        {sayi > 0 && (
          <button className="analiz-cip-temizle" onClick={temizle}>
            Filtreleri temizle
          </button>
        )}
      </div>

      {pencereler}
    </div>
  );
}
