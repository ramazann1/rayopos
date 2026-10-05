import { useState } from "react";
import Bildirim from "./Bildirim";
import OnayModal from "./OnayModal";
import { adisyonFisiYaz, bekleyenFisiBirak, type FisSonucu } from "../yazicilar";
import type { AdisyonVerisi } from "../adisyonlar";

/**
 * Hesap fişini gönderip sonucunu söyleyen ortak akış: masaüstü salon ile
 * telefonun masa ve sipariş ekranları aynı akışı kullanıyor. Gönderilince altta
 * kendiliğinden kaybolan bir bildirim çıkıyor, akış durmuyor; pencere yalnız
 * sorun varsa açılıyor: yazıcının bildirdiği sebep ya da köprüye hiç
 * ulaşmadıysa "beklesin mi" sorusu.
 */
export function useFisYazdirma() {
  const [sonuc, setSonuc] = useState<FisSonucu | { durum: "hata" } | null>(null);
  const [gonderildi, setGonderildi] = useState(false);

  const yazdir = async (adisyon: AdisyonVerisi) => {
    setGonderildi(true);
    try {
      const s = await adisyonFisiYaz(adisyon);
      if (s.durum === "yazici_yok") setGonderildi(false);
      if (s.durum !== "basildi") setSonuc(s);
    } catch {
      setGonderildi(false);
      setSonuc({ durum: "hata" });
    }
  };

  const kapat = () => setSonuc(null);

  let pencere: React.ReactNode = null;
  if (sonuc?.durum === "ulasmadi") {
    const kimlikler = sonuc.kimlikler;
    pencere = (
      <OnayModal
        baslik="Fiş yazıcıya ulaşmadı"
        mesaj="Kasadaki yazıcı programı kapalı ya da internete bağlı değil. Bekletirseniz program açıldığında basılır."
        onayMetni="Beklesin"
        iptalMetni="Vazgeç"
        onOnay={kapat}
        onKapat={() => {
          kapat();
          bekleyenFisiBirak(kimlikler).catch(() => {});
        }}
      />
    );
  } else if (sonuc && sonuc.durum !== "basildi") {
    const metin = {
      yazici_yok: "Hesap fişi basacak açık bir yazıcı tanımlı değil.",
      basarisiz: `Fiş basılamadı: *${sonuc.durum === "basarisiz" ? sonuc.hata : ""}* Sorunu giderip fişi yeniden yazdırın.`,
      hata: "Fiş yazdırmaya gönderilemedi.",
    }[sonuc.durum];
    pencere = (
      <OnayModal
        tekTus
        tur="uyari"
        mesaj={metin}
        onKapat={kapat}
      />
    );
  }

  return {
    yazdir,
    pencere: (
      <>
        {gonderildi && (
          <Bildirim mesaj="Fiş yazdırmaya gönderildi" onKapat={() => setGonderildi(false)} />
        )}
        {pencere}
      </>
    ),
  };
}
