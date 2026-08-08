import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig({
  plugins: [
    react(),
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
