import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { sunucuBilgisi } from "./sunucu.js";

/**
 * Köprünün işletmeye bağlanması.
 *
 * Köprü kimsenin şifresini sormuyor: 6 haneli bir kod alıp ekranda gösteriyor,
 * yetkili kişi RayoPOS'ta Yazıcılar → Köprü ekle'ye o kodu yazıyor. Onay gelince
 * köprüye kendi hesabının bilgileri bir kez veriliyor.
 *
 * Kod ekranda herkesin gözü önünde; bilgileri almak için yalnız bu köprünün
 * bildiği gizli sözcük de gerekiyor.
 */

const SORMA_ARALIGI = 3_000;
// Sunucu kodu on dakika tutuyor; biraz önce yenisi alınıyor ki ekrandaki kod
// yazılırken geçersiz olmasın.
const KOD_OMRU = 9 * 60_000;

const bekle = (ms) => new Promise((coz) => setTimeout(coz, ms));

export async function eslestir({ kodGeldi, durduMu = () => false }) {
  const { sunucu, anahtar } = sunucuBilgisi();
  const istemci = createClient(sunucu, anahtar, { auth: { persistSession: false } });

  while (!durduMu()) {
    const gizli = randomBytes(32).toString("hex");
    const { data: kod, error } = await istemci.rpc("kopru_kod_al", {
      p_gizli: gizli,
      p_cihaz: hostname(),
    });

    if (error) {
      kodGeldi(null, "Sunucuya ulaşılamıyor, yeniden deneniyor...");
      await bekle(10_000);
      continue;
    }

    kodGeldi(kod);
    const bitis = Date.now() + KOD_OMRU;

    while (Date.now() < bitis && !durduMu()) {
      await bekle(SORMA_ARALIGI);
      const { data } = await istemci.rpc("kopru_eslesme_sonuc", { p_kod: kod, p_gizli: gizli });
      const bilgi = data?.[0];
      if (bilgi) return { eposta: bilgi.eposta, sifre: bilgi.sifre };
    }
  }
  return null;
}
