import { useEffect, useState } from "react";
import OnayModal from "./OnayModal";
import { siparisFisiSorununuDinle, type SiparisFisiSorunu } from "../yazicilar";

/**
 * Sipariş fişinin sorun uyarısı. Fiş beklenmeden gönderildiği
 * için garson başka ekranda olabiliyor; pencere uygulamanın kökünde, her
 * ekranın üstünde açılıyor. Masaüstü ve telefon aynı pencereyi görüyor.
 */
export default function SiparisFisiUyarisi() {
  const [sorun, setSorun] = useState<SiparisFisiSorunu | null>(null);

  useEffect(() => siparisFisiSorununuDinle(setSorun), []);

  if (!sorun) return null;

  const yer = sorun.yer ? `*${sorun.yer}* · ` : "";
  const basilamayan = sorun.sorunlar.filter((s) => s.hata);
  const ulasmayan = sorun.sorunlar.filter((s) => !s.hata);

  const satirlar = [
    ...basilamayan.map((s) => `*${s.istasyon || "Yazıcı"}*: ${s.hata}`),
    ...(ulasmayan.length
      ? [
          `*${ulasmayan.map((s) => s.istasyon || "Yazıcı").join(", ")}*: yazıcıya ulaşmadı. Kasadaki yazıcı programı açılınca basılacak.`,
        ]
      : []),
  ];

  const mesaj = `${yer}Sipariş fişi basılamadı.\n${satirlar.join("\n")}`;

  return basilamayan.length ? (
    <OnayModal
      baslik="Fiş basılamadı"
      mesaj={mesaj}
      onayMetni="Yeniden yazdır"
      iptalMetni="Tamam"
      onOnay={() => {
        sorun.yenidenYaz();
        setSorun(null);
      }}
      onKapat={() => setSorun(null)}
    />
  ) : (
    <OnayModal tekTus baslik="Fiş basılamadı" mesaj={mesaj} onKapat={() => setSorun(null)} />
  );
}
