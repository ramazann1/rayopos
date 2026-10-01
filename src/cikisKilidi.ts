// Kaydedilmemiş değişikliği olan ekran buraya kendini kaydeder; sol menü
// başka sayfaya geçmeden önce burayı sorar. Tek kilit yeter — aynı anda iki
// düzenleme ekranı açık olmuyor.
let sorgu: (() => boolean) | null = null;

// Kabuk tarayıcının geri tuşunu da tutabilsin diye kilidin her değişimini
// duyuyor; kilitliMi() yalnız sorulunca cevap veriyor.
let dinleyici: (() => void) | null = null;

export function kilitKur(f: () => boolean) {
  sorgu = f;
  dinleyici?.();
}

export function kilitKaldir() {
  sorgu = null;
  dinleyici?.();
}

export function kilitDinle(f: () => void) {
  dinleyici = f;
  return () => {
    if (dinleyici === f) dinleyici = null;
  };
}

export function kilitliMi() {
  return !!sorgu?.();
}
