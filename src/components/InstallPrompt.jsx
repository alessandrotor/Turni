import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Banner "Installa app". Su Android/desktop Chromium (Chrome, Edge, Samsung
// Internet) usa l'evento nativo `beforeinstallprompt`; su iOS Safari, che non
// lo espone, mostra le istruzioni manuali (Condividi → Aggiungi a Home).
// Firefox (mobile e desktop) non implementa `beforeinstallprompt` — è un'API
// solo Chromium — quindi senza un ramo dedicato il banner resta invisibile in
// silenzio: su Firefox per Android mostriamo le istruzioni manuali dal menu
// del browser (l'unico che supporta "Aggiungi a schermata Home" per le PWA;
// Firefox desktop non ha un equivalente affidabile, lì il banner resta
// nascosto). Non compare nell'APK Capacitor né quando l'app è già installata
// (avviata in modalità standalone).

const DISMISS_KEY = 'turni_install_dismissed';

// localStorage può LANCIARE, non solo fallire: Safari con i cookie di terze
// parti bloccati, `dom.storage.enabled=false`, WebView ristrette. Qui la lettura
// avviene dentro un useEffect e in App non c'è error boundary a monte: senza
// protezione l'eccezione smonterebbe l'intero albero, cioè schermo bianco al
// posto di un banner mancante. Stesso trattamento del resto del repo
// (useLocalStorage, telemetry, backup).
const leggiFlag = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const scriviFlag = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* senza storage il banner ricomparirà: non è un errore da mostrare */ }
};

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  // iPadOS si presenta come Mac con touch
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

// Firefox per Android: non espone `beforeinstallprompt`, ma supporta
// "Aggiungi a schermata Home" dal menu del browser. Su iOS "Firefox" è solo
// una skin di Safari (WebKit imposto da Apple), quindi lì vale già isIOS().
const isFirefoxAndroid = () => /firefox/i.test(window.navigator.userAgent)
  && /android/i.test(window.navigator.userAgent);

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null); // evento beforeinstallprompt
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [firefoxHint, setFirefoxHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Mai nell'app nativa, mai se già installata, mai se già rifiutato.
    if (Capacitor.isNativePlatform() || isStandalone()) return;
    if (leggiFlag(DISMISS_KEY) === '1') return;

    // Android / desktop Chromium: intercetta l'evento e mostra il nostro pulsante.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    const onInstalled = () => { setShow(false); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari e Firefox Android: nessun evento, istruzioni manuali.
    if (isIOS()) { setIosHint(true); setShow(true); }
    else if (isFirefoxAndroid()) { setFirefoxHint(true); setShow(true); }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    scriviFlag(DISMISS_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    // `prompt()` si può chiamare UNA volta sola per evento: senza questa guardia
    // un doppio tocco mentre si attende `userChoice` produce una rejection non
    // gestita. `deferred` non basta, viene azzerato solo dopo l'attesa.
    if (!deferred || installing) return;
    setInstalling(true);
    try {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      setShow(false);
      if (outcome !== 'accepted') scriviFlag(DISMISS_KEY, '1');
    } catch {
      // Prompt rifiutato dal browser: si lascia il banner, riprovabile.
      setInstalling(false);
    }
  };

  return (
    <div className="install-banner">
      <img className="install-banner-icon" src="/pwa-192x192.png" alt="" width="40" height="40" />
      <div className="install-banner-text">
        <strong>Installa Turni</strong>
        {iosHint ? (
          <span>Tocca <span aria-label="Condividi">Condividi ⬆️</span> e poi «Aggiungi a Home».</span>
        ) : firefoxHint ? (
          <span>Tocca il menu ⋮ in alto e poi «Aggiungi a schermata Home» (o «Installa»).</span>
        ) : (
          <span>Aggiungila alla schermata home: si apre a tutto schermo, anche offline.</span>
        )}
      </div>
      {!iosHint && !firefoxHint && (
        <button
          className="btn btn-primary install-banner-btn"
          onClick={install}
          disabled={installing}
        >
          {installing ? 'Attendi…' : 'Installa'}
        </button>
      )}
      <button className="install-banner-close" onClick={dismiss} aria-label="Chiudi">✕</button>
    </div>
  );
}
