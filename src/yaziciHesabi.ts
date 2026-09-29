import { supabase } from "./supabase";

/**
 * Kasa köprülerinin giriş hesapları.
 *
 * Köprü kimsenin şifresiyle girmiyor: ilk açılışta 6 haneli bir kod
 * gösteriyor, yetkili kişi o kodu buraya yazınca köprüye kendi yetkisiz
 * hesabı açılıyor. Her köprünün ayrı hesabı var; biri kaldırılınca öteki
 * çalışmaya devam ediyor.
 */

export type KopruHesabi = {
  id: number;
  ad: string;
};

export async function kopruHesaplariniGetir(): Promise<KopruHesabi[]> {
  const { data } = await supabase.rpc("kopru_hesaplari");
  return ((data as any[]) ?? []).map((s) => ({ id: s.id, ad: s.ad }));
}

/** Kodu onaylar; köprünün bilgisayar adını döner (varsa). */
export async function kopruEslestir(kod: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("kopru_eslestir", { p_kod: kod });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function kopruKaldir(id: number): Promise<void> {
  const { error } = await supabase.rpc("kopru_kaldir", { p_id: id });
  if (error) throw new Error(error.message);
}
