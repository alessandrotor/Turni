import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Origine da cui il sito verrà servito. Finisce nei meta dell'anteprima del
// link, che i crawler leggono senza eseguire JavaScript e senza risolvere
// percorsi relativi: deve essere assoluta e deve essere QUELLA GIUSTA per
// l'ambiente. Il default è la produzione; il sito di prova la sovrascrive dal
// workflow (.github/workflows/deploy-test.yml).
const SITE_URL = (process.env.VITE_SITE_URL || 'https://turni-9vr.pages.dev').replace(/\/$/, '');

const FILE_OCR = {
  'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};

export default defineConfig({
  plugins: [
    react(),
    {
      // Sostituzione a build time, non a runtime: l'anteprima la legge un
      // crawler, che il JavaScript non lo esegue.
      name: 'origine-nei-meta',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
    },
    {
      // Tesseract servito DAL SITO (/ocr), non da un CDN: services/lettore-immagine.js.
      // In sviluppo lo serve il server di Vite, in build si copia in dist/.
      name: 'lettore-immagini',
      configureServer(server) {
        server.middlewares.use('/ocr', (req, res, next) => {
          const f = FILE_OCR[req.url.slice(1)];
          if (!f) return next();
          res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
          res.end(readFileSync(f));
        });
      },
      closeBundle() {
        mkdirSync('dist/ocr', { recursive: true });
        for (const [nome, da] of Object.entries(FILE_OCR)) copyFileSync(da, `dist/ocr/${nome}`);
      },
    },
    VitePWA({
      // La registrazione del service worker la facciamo a mano in src/main.jsx
      // (services/aggiornamento.js).
      injectRegister: null,
      // 'prompt' e NON 'autoUpdate', ed è la differenza fra scaricare una
      // versione nuova e IMPORLA.
      //
      // Con 'autoUpdate' il service worker nuovo chiama `skipWaiting()`, prende
      // il posto del vecchio e il client ricarica la pagina da solo: succedeva
      // qualche secondo dopo l'apertura — il tempo di scaricare i 2,3 MB di
      // precache — cioè quasi sempre mentre si stava già facendo qualcosa. Un
      // modulo turno aperto a metà spariva senza che nessuno l'avesse chiesto.
      //
      // Con 'prompt' la versione nuova si scarica lo stesso, in silenzio, ma
      // resta in attesa: entra in servizio quando lo decide chi usa l'app (il
      // pulsante «Aggiorna» dell'avviso) o alla prossima apertura. Nessuno
      // perde quello che stava scrivendo. Vedi services/aggiornamento.js.
      registerType: 'prompt',
      // Precache dei soli asset di build (same-origin). Le POST cross-origin al
      // proxy AI non vengono intercettate.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // L'informativa è una pagina statica vera, non una rotta dell'app.
        // Senza questa esclusione il ripiego la ingoia: dentro la PWA
        // installata il link «Come vengono trattati i tuoi dati» aprirebbe il
        // calendario, e l'informativa risulterebbe pubblicata pur non essendo
        // raggiungibile. È il caso in cui un 200 mente.
        navigateFallbackDenylist: [/^\/privacy/],
        // Il lettore delle immagini (~4,5 MB) NON va nel precache: lo scarica
        // solo chi lo usa, la prima volta. E il gestore della condivisione
        // deve rispondere prima delle regole di Workbox.
        globIgnores: ['ocr/**'],
        importScripts: ['condividi-sw.js'],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Turni',
        short_name: 'Turni',
        description: 'Turni di lavoro: calendario, ore e stima dello stipendio netto.',
        lang: 'it',
        theme_color: '#2563eb',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Tenendo premuta l'icona dell'app si arriva dritti al modulo del turno
        // di oggi, saltando apertura e calendario. Il parametro lo legge
        // `src/App.jsx`, ed è un contratto fra due file che si può rompere
        // rinominandolo da una parte sola — senza accorgersene, perché la
        // scorciatoia aprirebbe semplicemente il calendario nudo. Lo riscontra
        // `scripts/check-configurazione.mjs`.
        //
        // Apre il modulo, NON salva niente: un turno scritto senza che nessuno
        // lo veda è un dato che tocca i soldi senza uno sguardo.
        //
        // «Condividi → Turni» da WhatsApp, Galleria, Lens: testo o immagine
        // arrivano a «Incolla turni» (ImportTesto.jsx) e si leggono sul
        // telefono. POST perché un'immagine in un indirizzo non ci sta: la
        // riceve public/condividi-sw.js. Solo Android con l'app installata;
        // Safari non lo supporta. Contratto fra tre file → check-configurazione.mjs.
        share_target: {
          action: '/condividi',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'titolo', text: 'testo', url: 'link', files: [{ name: 'immagini', accept: ['image/*'] }] },
        },
        shortcuts: [
          {
            name: 'Segna il turno di oggi',
            short_name: 'Turno di oggi',
            url: '/?nuovo=oggi',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
