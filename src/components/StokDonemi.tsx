import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  History,
  ShoppingBag,
  Trash2,
} from "lucide-react";

/** Hareket türünün ikonu — defter, fiş ve malzeme geçmişi aynı dili konuşsun. */
export function StokTipIkonu({ tip, boy = 17 }: { tip: string; boy?: number }) {
  if (tip === "giris") return <ArrowDownLeft size={boy} />;
  if (tip === "fire") return <Trash2 size={boy} />;
  if (tip === "cikis") return <ArrowUpRight size={boy} />;
  if (tip === "sayim") return <ClipboardCheck size={boy} />;
  if (tip === "satis") return <ShoppingBag size={boy} />;
  return <History size={boy} />;
}
