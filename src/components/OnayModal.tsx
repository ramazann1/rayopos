import { useState } from "react";
import { CircleCheck, Info, PackageX, Trash2, TriangleAlert } from "lucide-react";

/**
 * Pencerenin türü ikonu ve rengi belirliyor; her çağıran kendi ikonunu seçince
 * aynı iş farklı ekranlarda farklı görünüyordu.
 */
export type OnayTuru = "bilgi" | "uyari" | "tehlike" | "basarili";

const turIkonu: Record<OnayTuru, React.ReactNode> = {
  bilgi: <Info size={20} />,
  uyari: <TriangleAlert size={20} />,
  tehlike: <Trash2 size={20} />,
  basarili: <CircleCheck size={20} />,
};

/**
 * Mesajın içinde *yıldız arasına* alınan parçalar koyu yazılıyor. Masa adı,
 * tutar gibi kararı belirleyen bilgi cümlenin içinde kaybolmasın diye: "onaylıyor
 * musunuz" diye sorulan şeyin hangi masa olduğu bir bakışta görünmeli.
 */
function vurgula(mesaj: string) {
  return mesaj.split(/\*(.+?)\*/g).map((parca, i) =>
    i % 2 === 1 ? <strong key={i}>{parca}</strong> : parca
  );
}

/**
 * Veritabanının "stok yetersiz" mesajı: "*LATTE* için stok yetersiz" ve altında
 * "*süt*: 1 lt var, 3 lt gerekiyor" satırları. Tablo olarak gösterilsin diye
 * parçalara ayrılıyor; biçim tutmazsa düz mesaj olarak kalıyor.
 */
function stokEksigi(mesaj: string) {
  const [ilk, ...geri] = mesaj.split("\n");
  const baslik = ilk.match(/^\*(.+)\* için stok yetersiz$/);
  if (!baslik || geri.length === 0) return null;
  const satirlar = geri.map((s) => s.match(/^\*(.+)\*: (.+) var, (.+) gerekiyor$/));
  if (satirlar.some((s) => !s)) return null;
  return {
    urun: baslik[1],
    satirlar: satirlar.map((s) => ({ ad: s![1], stok: s![2], gereken: s![3] })),
  };
}

type Props = {
  mesaj: string;
  /** Mesajın üstünde duran kısa başlık; ikonla birlikte kullanılıyor. */
  baslik?: string;
  ikon?: React.ReactNode;
  /** Verilmezse: tehlikeli → tehlike, tek tuşlu → bilgi, öteki → uyarı. */
  tur?: OnayTuru;
  tekTus?: boolean;
  tehlikeli?: boolean;
  /**
   * Verilirse pencere sebep sorar: hazır sebepler düğme olarak çıkar, en sonda
   * serbest yazma kutusu vardır. Sebep seçilmeden onay düğmesi çalışmaz.
   */
  sebepler?: string[];
  /**
   * Verilirse pencere "kime yazılsın" diye sorar: ödenmez listesi düğme olarak
   * çıkar. Seçim zorunlu değil — belirtilmeden de onaylanabiliyor, ikram yine
   * yapılıyor, yalnız kırılımda "belirtilmemiş" kalıyor.
   */
  odenmezler?: { id: number; ad: string }[];
  onayMetni?: string;
  iptalMetni?: string;
  onOnay?: (sebep?: string, odenmezId?: number) => void;
  onKapat: () => void;
  /** Cümlenin altına giren ek alan (adet seçici gibi). */
  children?: React.ReactNode;
};

export default function OnayModal({
  mesaj,
  baslik,
  ikon,
  tur,
  tekTus,
  tehlikeli,
  sebepler,
  odenmezler,
  onayMetni,
  iptalMetni,
  onOnay,
  onKapat,
  children,
}: Props) {
  const [secili, setSecili] = useState("");
  const [serbest, setSerbest] = useState("");
  const [odenmezId, setOdenmezId] = useState<number | null>(null);

  const tip: OnayTuru = tur ?? (tehlikeli ? "tehlike" : tekTus ? "bilgi" : "uyari");
  const sebep = secili === "diger" ? serbest.trim() : secili;
  const onaylanabilir = !sebepler || !!sebep;

  const stok = stokEksigi(mesaj);
  if (stok && tekTus) {
    return (
      <div className="onay-fon" onClick={(e) => { e.stopPropagation(); onKapat(); }}>
        <div className="urt-uyari" onClick={(e) => e.stopPropagation()}>
          <span className="urt-uyari-im tehlike"><PackageX size={24} /></span>
          <h3>Stok yetersiz</h3>
          <p>{vurgula(`*${stok.urun}* için gereken malzeme stokta yok.`)}</p>

          <div className="urt-uyari-liste">
            <div className="urt-uyari-bas">
              <span>Malzeme</span>
              <span>Gereken</span>
              <span>Stokta</span>
            </div>
            {stok.satirlar.map((s) => (
              <div key={s.ad} className="urt-uyari-satir">
                <b>{s.ad}</b>
                <span>{s.gereken}</span>
                <em>{s.stok}</em>
              </div>
            ))}
          </div>

          <footer>
            <button className="up-tus kaydet" autoFocus onClick={onKapat}>Tamam</button>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="onay-fon" onClick={(e) => { e.stopPropagation(); onKapat(); }}>
      <div
        className={baslik ? "onay-modal baslikli" : "onay-modal"}
        onClick={(e) => e.stopPropagation()}
      >
        {baslik && (
          <div className="onay-ust">
            <span className={`onay-im ${tip}`}>{ikon ?? turIkonu[tip]}</span>
            <h3>{baslik}</h3>
          </div>
        )}
        {/* İlk satır cümle, alttaki satırlar liste: "stok yetersiz" gibi
            birden çok kalemi sayan mesaj tek paragrafa sıkışmasın. */}
        {baslik ? (
          <p>{vurgula(mesaj.split("\n")[0])}</p>
        ) : (
          <div className="onay-yan">
            <span className={`onay-im ${tip}`}>{ikon ?? turIkonu[tip]}</span>
            <p>{vurgula(mesaj.split("\n")[0])}</p>
          </div>
        )}
        {mesaj.includes("\n") && (
          <ul className="onay-liste">
            {mesaj
              .split("\n")
              .slice(1)
              .map((satir, i) => (
                <li key={i}>{vurgula(satir)}</li>
              ))}
          </ul>
        )}

        {children}

        {sebepler && (
          <div className="onay-sebepler">
            {sebepler.map((s) => (
              <button
                key={s}
                className={secili === s ? "onay-sebep secili" : "onay-sebep"}
                onClick={() => setSecili(s)}
              >
                {s}
              </button>
            ))}
            <button
              className={secili === "diger" ? "onay-sebep secili" : "onay-sebep"}
              onClick={() => setSecili("diger")}
            >
              Diğer
            </button>
            {secili === "diger" && (
              <input
                className="onay-sebep-metin"
                autoFocus
                value={serbest}
                onChange={(e) => setSerbest(e.target.value)}
                placeholder="Sebebi yazın"
              />
            )}
          </div>
        )}

        {odenmezler && odenmezler.length > 0 && (
          <div className="onay-odenmez">
            <p>Kime yazılsın?</p>
            <div className="onay-sebepler">
              {odenmezler.map((o) => (
                <button
                  key={o.id}
                  className={odenmezId === o.id ? "onay-sebep secili" : "onay-sebep"}
                  onClick={() => setOdenmezId(odenmezId === o.id ? null : o.id)}
                >
                  {o.ad}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal-aksiyonlar">
          {tekTus ? (
            <button className={`uygula ${tip}`} onClick={onKapat}>Tamam</button>
          ) : (
            <>
              <button className="iptal" onClick={onKapat}>{iptalMetni ?? "Vazgeç"}</button>
              <button
                className={`uygula ${tip}`}
                disabled={!onaylanabilir}
                onClick={() => onOnay?.(sebep || undefined, odenmezId ?? undefined)}
              >
                {onayMetni ?? (tip === "tehlike" ? "Evet, sil" : "Evet")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
