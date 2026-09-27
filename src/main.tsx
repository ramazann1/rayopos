import './anahtarGocu'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Poppins pakete gömülü geliyor; kasa internetsizken de yazı tipi doğru görünsün.
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import App from './App.tsx'

// Yazı tipi ilk çizimden sonra gelirse ekran bir an yedek yazıyla görünüp
// kayıyor. Dosyalar pakette, beklemek birkaç on milisaniye; yine de bir
// aksilikte açılış takılmasın diye bir saniyeden fazla beklenmiyor.
const yaziTipi = Promise.all(
  ['400', '500', '600', '700'].map((k) => document.fonts.load(`${k} 1em Poppins`, 'aığşçöüİ')),
)
const sinir = new Promise((r) => setTimeout(r, 1000))

Promise.race([yaziTipi, sinir])
  .catch(() => {})
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
