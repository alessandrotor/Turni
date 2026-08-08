import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker + storage persistente: SOLO sul web. Nella WebView dell'APK
// Capacitor un SW rischierebbe di servire asset vecchi dalla cache dopo un
// aggiornamento del pacchetto, e la persistenza dello storage è già gestita dall'OS.
if (!Capacitor.isNativePlatform()) {
  // Chiede al browser di NON sfrattare i dati (turni/impostazioni in localStorage)
  // sotto pressione di memoria. Best-effort: se non supportato, si ignora.
  navigator.storage?.persist?.().catch(() => {});
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
