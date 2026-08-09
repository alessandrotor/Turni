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

// Service worker: SOLO sul web. Nella WebView dell'APK Capacitor rischierebbe
// di servire asset vecchi dalla cache dopo un aggiornamento del pacchetto.
//
// Lo storage persistente NON si chiede più qui: la richiesta fa comparire il
// permesso di Firefox al primo avvio, su un'app ancora vuota, prima che si
// capisca cosa si sta autorizzando. Ora la chiede App quando c'è il primo turno
// da proteggere (src/App.jsx).
if (!Capacitor.isNativePlatform()) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
