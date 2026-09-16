/**
 * Yazma işlemlerinin sonucunu denetler. İki ayrı sessizlik var:
 *
 * 1. Veritabanı hata döndürüyor ama sonuç hiç okunmuyor — program "oldu" sanıyor.
 * 2. Hata bile dönmüyor: satır güvenliği (RLS) kişinin göremediği satırı
 *    güncellemeye/silmeye izin vermiyorsa istek başarılı sayılıyor, sadece
 *    hiçbir satıra dokunulmuyor. Bunu yakalamanın tek yolu dönen satırı saymak,
 *    onun için bu tür çağrılara `.select("id")` ekleniyor.
 */

type Sonuc = { error: { code?: string; message?: string } | null; data?: unknown };

function hataMetni(hata: { code?: string; message?: string }, mesaj: string) {
  if (hata.code === "42501" || /row-level security/i.test(hata.message ?? ""))
    return "Bu işlem için yetkiniz yok.";
  if (hata.code === "23505") return `${mesaj} Aynı kayıt zaten var.`;
  if (hata.code === "23503") return `${mesaj} Bu kayıt başka kayıtlarda kullanılıyor.`;
  return hata.message ? `${mesaj} (${hata.message})` : mesaj;
}

/** Hata varsa anlaşılır bir mesajla durdurur. */
export function yazmayiDenetle(sonuc: Sonuc, mesaj: string) {
  if (sonuc.error) throw new Error(hataMetni(sonuc.error, mesaj));
}

/**
 * Belli bir satırı hedefleyen güncelleme/silme için: hata yoksa bile hiçbir
 * satır dönmediyse iş yapılmamış demektir. Çağrıya `.select("id")` gerekiyor.
 */
export function satirDenetle(sonuc: Sonuc, mesaj: string) {
  yazmayiDenetle(sonuc, mesaj);
  const satirlar = sonuc.data as unknown[] | null;
  if (!satirlar?.length) throw new Error(`${mesaj} Kayıt bulunamadı ya da yetkiniz yok.`);
}
