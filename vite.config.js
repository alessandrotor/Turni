import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Origine da cui il sito verrà servito. Finisce nei meta dell'anteprima del
// link, che i crawler leggono senza eseguire JavaScript e senza risolvere
// percorsi relativi: deve essere assoluta e deve essere QUELLA GIUSTA per
// l'ambiente. Il default è la produzione; il sito di prova la sovrascrive dal
// workflow (.github/workflows/deploy-test.yml).
const SITE_URL = (process.env.VITE_SITE_URL || 'https://turni-9vr.pages.dev').replace(/\/$/, '');

export default defineConfig({
  plugins: [
    react(),
    {
      // Sostituzione a build time, non a runtime: l'anteprima la legge un
      // crawler, che il JavaScript non lo esegue.
      name: 'origine-nei-meta',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
    },
    VitePWA({
      // La registrazione del service worker la facciamo a mano in src/main.jsx,
      // SOLO su web: nella WebView dell'APK Capacitor un SW servirebbe asset
      // vecchi dalla cache dopo un aggiornamento del pacchetto.
      injectRegister: null,
      registerType: 'autoUpdate',
      // Precache dei soli asset di build (same-origin). Le POST cross-origin al
      // proxy AI e alla telemetria non vengono intercettate.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // L'informativa è una pagina statica vera, non una rotta dell'app.
        // Senza questa esclusione il ripiego la ingoia: dentro la PWA
        // installata il link «Come vengono trattati i tuoi dati» aprirebbe il
        // calendario, e l'informativa risulterebbe pubblicata pur non essendo
        // raggiungibile. È il caso in cui un 200 mente.
        navigateFallbackDenylist: [/^\/privacy/],
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
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
