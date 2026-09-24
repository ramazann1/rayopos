# Claude'un hafıza dosyaları

Bu klasör, Claude'un RayoPOS üzerinde çalışırken öğrendiği kuralları tutuyor:
"silik yazı yasak", "her yerde ikon", "yeni modülden önce Adisyo turu" gibi.
Sohbet geçmişi değil — sohbetler taşınmıyor, bu kurallar taşınıyor.

Normalde bu dosyalar projenin içinde durmaz; Claude onları bilgisayarın kendi
klasöründe tutuyor ve git ile taşınmıyorlar. Başka bir bilgisayarda çalışmaya
devam edebilmek için buraya kopyalandılar.

## Yeni bilgisayarda ne yapılacak

Depoyu klonladıktan sonra bu klasörün içindeki dosyalar Claude'un okuduğu yere
kopyalanır. Adres şöyle kurulur:

    C:\Users\<KULLANICI>\.claude\projects\<PROJE-YOLU>\memory\

`<PROJE-YOLU>` projenin bulunduğu klasörün yolundan üretiliyor: iki nokta ve
ters bölü işaretleri tire oluyor. Bu bilgisayarda proje
`C:\Users\Ramazan\Desktop\rayopos` olduğu için klasör adı şu:

    C--Users-Ramazan-Desktop-rayopos

Yani yeni bilgisayarda kullanıcı adı ya da klasör farklıysa **ad da değişir**.
En kolayı: yeni bilgisayarda Claude Code'u projede bir kez çalıştır, klasör
kendiliğinden oluşsun, sonra dosyaları oraya kopyala.

PowerShell'de tek komutla (kendi kullanıcı adına göre yolu düzelt):

    Copy-Item claude-hafizasi\*.md "$env:USERPROFILE\.claude\projects\C--Users-<KULLANICI>-Desktop-rayopos\memory\"

`NASIL-KULLANILIR.md` dosyasını kopyalamana gerek yok, o yalnız bu açıklama
için duruyor.

## Güncel tutmak

Claude yeni bir kural öğrendiğinde kendi klasörüne yazıyor, buraya değil.
Bilgisayar değiştirmeden önce Claude'a "hafızayı tazele" de, dosyaları buraya
yeniden kopyalasın.
