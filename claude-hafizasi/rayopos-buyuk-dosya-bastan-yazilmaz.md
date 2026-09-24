---
name: rayopos-buyuk-dosya-bastan-yazilmaz
description: index.css gibi büyük dosyalar baştan yazılmaz, Edit ile yerinde düzenlenir.
metadata:
  type: feedback
---

`src/index.css` (17 bin satır) gibi büyük dosyalarda blok değiştirmek için
dosyayı parçalara ayırıp baştan yazma. Edit aracıyla yerinde düzenle.

**Why:** 3 Eyl 2026'da Sıralama penceresi işinde bir CSS bloğu değiştirilirken
dosya üç parçadan birleştirilerek yeniden yazıldı; dosya bir an boş kaldı,
Vite boş kopyayı aldı ve sayfada hiç CSS kalmadı. Ramazan tamamen stilsiz bir
ekran gördü ("ne oldu lan böyle"). Dosya aslında sağlamdı, sorun yalnız dev
server'ın yakaladığı andı.

**How to apply:** Blok silinip yenisi yazılacaksa iki Edit yap (eskiyi yenisiyle
değiştir), `cat > dosya` veya parça birleştirme kullanma. Kaza olursa önce
dosyanın bütünlüğünü doğrula (satır sayısı, süslü parantez dengesi), sonra dev
server'ı yeniden başlattır — bkz. [[rayopos-gorsel-hatada-once-onbellek]].
