/**
 * Hedef masa her zaman salonun kendisinde seçiliyor. Sipariş ekranından
 * başlatılan taşıma (masa ya da tek ürün) salona bu bilgiyle dönüyor ve salon
 * açılır açılmaz seçim kipine giriyor.
 */
export type TasinanKalem = { id: number; ad: string; adet: number };

export type SalonSecimi = {
  tip: "tasi" | "birlestir" | "kalem";
  masaId: number;
  kalem?: TasinanKalem;
};

export function salonaSecimle(secim: SalonSecimi) {
  return { state: { salonSecimi: secim } };
}

export function gelenSecim(state: unknown): SalonSecimi | null {
  return (state as { salonSecimi?: SalonSecimi } | null)?.salonSecimi ?? null;
}
