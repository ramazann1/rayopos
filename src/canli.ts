import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Canlı tazeleme. Bir masaya kalem eklendiğinde başka bir cihazdaki ekranın
 * bunu kendiliğinden görmesi için: Supabase "şu tablo değişti" diye küçük bir
 * haber yolluyor, ekran da kendi okumasını tekrarlıyor. Haber verinin kendisini
 * taşımıyor; yük, haberi alınca yaptığımız sorgudan geliyor. Onun için asıl iş
 * burada değil, aşağıdaki dizginlerde: art arda gelen haberler tek tazelemede
 * birleşiyor ve arkaya düşen ekran aboneliğini bırakıyor.
 *
 * Aboneliği bırakma ölçümden çıktı (20 Eyl 2026): arka plandaki iki sekme, bir
 * masanın tam ömrü boyunca 49 mesajın hepsini indirdi ve hiçbirini kullanmadı —
 * ekran arkadayken tazeleme yapmıyor, gelen haber çöpe gidiyordu. Supabase ise
 * o mesajların her birini ayrı ayrı sayıyor: "bir satır değişti, on beş cihaz
 * dinliyor" on beş mesaj demek. Kilitli telefon, kimsenin bakmadığı bir ekran
 * için kotayı yiyordu. Artık ekran öne gelince abonelik geri açılıyor ve
 * koşulsuz bir kez okunuyor.
 */

/**
 * Ekranların dinlediği tablolar. Yeni tablo eklemek serbest, yazımı tutsun.
 *
 * Masa ekranları `masa_degisim` dinliyor: adisyon, kalem, tahsilat ve hesap
 * fişi değişiklikleri sunucuda tek habere indiriliyor (sql/2026-09-20-tek-
 * sinyal.sql). Alttaki dört tablo listede kalmaya devam ediyor çünkü
 * abonelik kurmak serbest — ama yeni bir ekran onları tek tek dinlemeye
 * başlarsa kazanç geri gider, önce `masa_degisim` yetiyor mu diye bakılsın.
 */
export type CanliTablo =
  | "masa_degisim"
  | "adisyonlar"
  | "adisyon_kalemleri"
  | "tahsilatlar"
  | "turlar"
  | "masalar"
  | "kasa_hareketleri"
  | "kasa_vardiyalari"
  | "masraflar"
  | "yazdirma_kuyrugu"
  | "masa_mesguliyet";

/**
 * Tablonun yalnız bir bölümü haber edilsin diye konan süzgeçler. Sunucu
 * tarafında uygulanıyor: eşleşmeyen satır cihaza hiç gönderilmiyor, yani
 * yalnız ekranın işi değil, Supabase'in mesaj sayacı da azalıyor.
 *
 * Ölçüldü (19 Eyl 2026): 15 cihaz açıkken her mutfak fişi 15 ayrı mesaj
 * oluyordu, oysa ekranlardaki fiş işareti yalnız hesap fişine bakıyor
 * (`masa_ozetleri`, `tip = 'adisyon'`). Mutfak fişi ekranda hiçbir şeyi
 * değiştirmiyor.
 */
const SUZGECLER: Partial<Record<CanliTablo, string>> = {
  yazdirma_kuyrugu: "tip=eq.adisyon",
};

type Dinleyici = () => void;

// Aynı tabloyu üç ekran birden dinleyebiliyor; her biri için ayrı bağlantı
// açmak yerine tabloya tek kanal açılıp haber içeride dağıtılıyor. Son ekran
// da kapanınca kanal kapanıyor.
const dinleyiciler = new Map<CanliTablo, Set<Dinleyici>>();
const kanallar = new Map<CanliTablo, RealtimeChannel>();

function aboneOl(tablo: CanliTablo, dinleyici: Dinleyici) {
  let kume = dinleyiciler.get(tablo);
  if (!kume) {
    kume = new Set();
    dinleyiciler.set(tablo, kume);
    kanallar.set(
      tablo,
      supabase
        .channel(`canli-${tablo}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: tablo, filter: SUZGECLER[tablo] },
          () => dinleyiciler.get(tablo)?.forEach((d) => d())
        )
        .subscribe()
    );
  }
  kume.add(dinleyici);

  return () => {
    const k = dinleyiciler.get(tablo);
    if (!k) return;
    k.delete(dinleyici);
    if (k.size > 0) return;
    const kanal = kanallar.get(tablo);
    if (kanal) supabase.removeChannel(kanal);
    kanallar.delete(tablo);
    dinleyiciler.delete(tablo);
  };
}

/**
 * Emniyet tazelemesi. Haber hiç gelmese bile ekran bu aralıkta bir kez
 * kendiliğinden okuyor.
 *
 * Haberin kendisi artık sunucudaki bir tetikleyiciden çıkıyor; oradaki bir
 * aksaklık ekranı sessizce dondurabilirdi ve kimse sebebini anlamazdı. Bu
 * satır onu "biraz geç güncellenir"e indiriyor. Cihaz başına dakikada bir
 * okumanın altında kalıyor, mesaj sayacına hiç dokunmuyor.
 */
const EMNIYET = 90_000;

/** İş ekranı: masa, sipariş, istasyon. Değişikliği hemen görmesi gerekiyor. */
export const HIZLI = 400;
/**
 * `masa_degisim` dinleyen ekranlar. HIZLI'dan uzun, çünkü bir kaydetme
 * sunucuya ~600 ms'ye yayılan birkaç istek atıyor; bu süre onları tek habere
 * topluyor (21 Eyl 2026'da ölçüldü: 400 ms'de kaydetme başına 2 haber
 * çıkıyordu, 800 ms'de 1).
 *
 * SUNUCUDAKİ PENCEREYLE BİRLİKTE DEĞİŞİR — sql/2026-09-20-tek-sinyal.sql
 * içindeki damga aralığı (500 ms) bundan küçük kalmalı. Büyürse ekran, kendi
 * okumasından sonra yazılan bir satırı kaçırır.
 *
 * Meşguliyet rozeti bu gecikmeyi kullanmıyor, HIZLI'da kalıyor: iki garsonun
 * aynı masaya girmesini engelleyen tek şey o rozetin anında görünmesi.
 */
export const SINYAL = 800;
/** Bakma ekranı: satış, analiz, kasa. Sayılar altından kaymasın diye sakin. */
export const SAKIN = 4000;

/**
 * @param tablolar dinlenecek tablolar
 * @param yenile ekranın kendi okuma fonksiyonu
 * @param gecikme haber ile tazeleme arasındaki bekleme; aynı zamanda iki
 *   tazeleme arasındaki en kısa süre (HIZLI ya da SAKIN)
 */
export function useCanli(
  tablolar: CanliTablo[],
  yenile: () => void,
  gecikme: number = HIZLI
) {
  // Ekran her çizildiğinde yeni bir fonksiyon geliyor; aboneliğin bundan
  // etkilenmemesi için güncel hâli kutuda tutuluyor.
  const yenileRef = useRef(yenile);
  yenileRef.current = yenile;

  const anahtar = tablolar.join(",");

  useEffect(() => {
    let zaman: ReturnType<typeof setTimeout> | null = null;
    let sonCalisma = 0;
    let biraklar: (() => void)[] = [];

    const calistir = () => {
      zaman = null;
      if (document.hidden) return;
      sonCalisma = Date.now();
      yenileRef.current();
    };

    const haber = () => {
      if (zaman) return;
      // Yoğun saatte haberler sağanak gibi geliyor. Son tazelemenin üstünden
      // yeterince geçmediyse fark kadar daha bekleniyor: ekran zıplamıyor,
      // sunucu da her kalem için baştan sorgulanmıyor.
      const gecen = Date.now() - sonCalisma;
      zaman = setTimeout(calistir, Math.max(gecikme, gecikme - gecen));
    };

    let emniyet: ReturnType<typeof setInterval> | null = null;

    const aboneAc = () => {
      if (biraklar.length) return;
      biraklar = tablolar.map((t) => aboneOl(t, haber));
      emniyet = setInterval(calistir, EMNIYET);
    };

    const aboneBirak = () => {
      biraklar.forEach((b) => b());
      biraklar = [];
      if (emniyet) {
        clearInterval(emniyet);
        emniyet = null;
      }
      if (zaman) {
        clearTimeout(zaman);
        zaman = null;
      }
    };

    const gorunurluk = () => {
      if (document.hidden) {
        aboneBirak();
        return;
      }
      aboneAc();
      // Arkadayken haber hiç gelmediği için "kaçan oldu mu" diye bakmanın
      // anlamı yok: ekran öne gelir gelmez koşulsuz bir kez okunuyor. Bu satır
      // atlanırsa garson telefonu cebinden çıkarır ve bayat masa listesi görür.
      calistir();
    };

    document.addEventListener("visibilitychange", gorunurluk);
    if (!document.hidden) aboneAc();

    return () => {
      document.removeEventListener("visibilitychange", gorunurluk);
      aboneBirak();
    };
    // Liste her çizimde yeni bir dizi olarak geliyor; bağımlılık dizinin
    // kendisi değil, içeriğinden çıkan anahtar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, gecikme]);
}
