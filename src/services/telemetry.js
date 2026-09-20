// Telemetria anonima dell'import immagine: invia i token consumati a un
// raccoglitore esterno (web app Google Apps Script → Foglio Google).
// Fire-and-forget: non deve MAI bloccare o far fallire l'import.
// Nessuna immagine, nessun turno, nessun dato personale — solo metriche.

const ENDPOINT = import.meta.env.VITE_TELEMETRY_URL || '';

// Spegni la telemetria sull'ambiente di TEST (sottodominio test.*). È una
// sicurezza per i deploy manuali su --branch test fatti con la .env.local (che
// contiene l'endpoint): l'auto-deploy CI non imposta VITE_TELEMETRY_URL, quindi
// lì è già off via endpoint vuoto.
// NB: niente 'localhost' — l'APK Capacitor gira su https://localhost, e lì la
// telemetria (unico build con endpoint) DEVE funzionare. In dev locale, se hai
// l'endpoint in .env.local, puoi spegnerla dall'interruttore in Impostazioni.
const IS_TEST_ENV = typeof location !== 'undefined' && location.hostname.startsWith('test.');

// SUL WEB QUESTA CHIAMATA NON PARTE COMUNQUE, anche con l'endpoint impostato:
// `script.google.com` non è in `connect-src` di `public/_headers`, quindi la CSP
// la blocca — e la blocca in silenzio, perché qui sotto `sendBeacon` torna
// `false` e il `fetch` di ripiego ha il `catch` vuoto. È voluto e spiegato in
// quel file: la telemetria è del solo pacchetto Android, dove la CSP di
// Cloudflare Pages non arriva. Chi non lo sapesse la cercherebbe qui dentro.

// La telemetria ESISTE davvero solo se c'è un endpoint. Nel pacchetto di
// produzione non c'è (l'auto-deploy non imposta VITE_TELEMETRY_URL), e senza
// questo l'interfaccia mostrava comunque l'interruttore «Invia statistiche
// anonime»: un comando che non governava niente, e che per di più lasciava
// credere che qualcosa partisse. In un'app che promette di non inviare dati è
// la bugia peggiore — chi lo lascia acceso pensa di aver scelto, e chi lo
// spegne pensa di essersi protetto da qualcosa che non c'era.
export const telemetriaDisponibile = !!ENDPOINT && !IS_TEST_ENV;

// ID installazione casuale e anonimo, per distinguere i tester senza sapere chi.
// NON serve più al proxy AI: quello usa un identificativo di sessione, che non
// viene salvato. Qui invece distinguere le installazioni è proprio lo scopo.
export function installId() {
  try {
    let id = localStorage.getItem('turni_install_id');
    if (!id) {
      id = 'tst_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem('turni_install_id', id);
    }
    return id;
  } catch {
    return 'tst_unknown';
  }
}

// Spegnimento su richiesta dell'utente (interruttore in Impostazioni). Vive in
// localStorage e non nei settings dell'app perché deve essere leggibile da qui
// senza far passare l'oggetto settings attraverso ogni chiamante.
const OPT_OUT_KEY = 'turni_telemetry_off';

export function isTelemetryEnabled() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== '1';
  } catch {
    return true;
  }
}

export function setTelemetryEnabled(on) {
  try {
    if (on) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, '1');
  } catch {
    // Storage non disponibile: la telemetria resta com'è, non è un errore da mostrare.
  }
}

export function sendImportTelemetry(data = {}) {
  if (!ENDPOINT) return; // no-op se non configurato
  if (IS_TEST_ENV) return; // ambiente di test: non inviare
  if (!isTelemetryEnabled()) return;
  try {
    const payload = JSON.stringify({
      ts: new Date().toISOString(),
      installId: installId(),
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
      ...data,
    });
    // Preferisci sendBeacon (fire-and-forget, non blocca); fallback a fetch.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, payload);
      if (ok) return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    }).catch(() => {});
  } catch {
    // Silenzioso: la telemetria non deve mai disturbare l'import.
  }
}
