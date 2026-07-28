// Telemetria anonima dell'import immagine: invia i token consumati a un
// raccoglitore esterno (web app Google Apps Script → Foglio Google).
// Fire-and-forget: non deve MAI bloccare o far fallire l'import.
// Nessuna immagine, nessun turno, nessun dato personale — solo metriche.

const ENDPOINT = import.meta.env.VITE_TELEMETRY_URL || '';

// ID installazione casuale e anonimo, per distinguere i tester senza sapere chi.
function installId() {
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

export function sendImportTelemetry(data = {}) {
  if (!ENDPOINT) return; // no-op se non configurato
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
