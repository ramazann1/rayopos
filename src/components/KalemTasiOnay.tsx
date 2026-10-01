import { useState } from "react";
import { ArrowRightLeft, Minus, Plus } from "lucide-react";
import OnayModal from "./OnayModal";
import { adetGoster } from "../para";
import type { TasinanKalem } from "../salonSecimi";

type Props = {
  kalem: TasinanKalem;
  hedefAd: string;
  onOnay: (adet: number) => void;
  onKapat: () => void;
};

/**
 * Ürün taşımanın son adımı. Birden çok adetli kalemde kaç tanesinin gideceği
 * burada seçiliyor; varsayılan hepsi.
 */
export default function KalemTasiOnay({ kalem, hedefAd, onOnay, onKapat }: Props) {
  const [adet, setAdet] = useState(kalem.adet);
  const tam = Number.isInteger(kalem.adet);

  return (
    <OnayModal
      baslik="Ürün taşınsın mı?"
      ikon={<ArrowRightLeft size={20} />}
      mesaj={`*${kalem.ad}*, *${hedefAd}* masasına taşınacak.`}
      onayMetni="Taşı"
      onOnay={() => onOnay(adet)}
      onKapat={onKapat}
    >
      {tam && kalem.adet > 1 && (
        <div className="kto-adet">
          <span>Adet</span>
          <div>
            <button aria-label="Azalt" disabled={adet <= 1} onClick={() => setAdet(adet - 1)}>
              <Minus size={16} />
            </button>
            <em>
              {adetGoster(adet)} / {adetGoster(kalem.adet)}
            </em>
            <button aria-label="Artır" disabled={adet >= kalem.adet} onClick={() => setAdet(adet + 1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </OnayModal>
  );
}
