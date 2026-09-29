import { writeFile } from "node:fs/promises";
import { ayarYolu, dosyaOku } from "./ayar.js";
import { eslestir } from "./eslesme.js";

/**
 * Terminal sürümünün ilk açılışı.
 *
 * Kasaya giden pencereli sürümde bu iş giriş penceresinde yapılıyor; burası
 * geliştirirken köprüyü çıplak Node ile çalıştırmak için duruyor. Aynı kodla
 * eşleşiyor: ekrana yazılan kodu RayoPOS'ta Yazıcılar → Köprü ekle'ye yazın.
 */
export async function ayarlariSor() {
  console.log("\nRayoPOS Kasa Köprüsü ilk kez açılıyor.\n");

  const bilgi = await eslestir({
    kodGeldi: (kod, hata) =>
      console.log(hata ?? `Bağlantı kodu: ${kod}  —  RayoPOS'ta Yazıcılar → Köprü ekle'ye yazın.`),
  });

  // Bu sürümde şifre düz yazılıyor: Windows'un şifreleme servisi yalnız
  // pencereli sürümden (Electron) kullanılabiliyor.
  const ayar = { ...dosyaOku(), eposta: bilgi.eposta, sifre: bilgi.sifre, yoklamaSaniye: 3 };
  await writeFile(ayarYolu(), `${JSON.stringify(ayar, null, 2)}\n`, "utf8");
  console.log(`\nKöprü bağlandı. Bilgiler kaydedildi: ${ayarYolu()}\n`);
}
