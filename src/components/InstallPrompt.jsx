import { useState, useEffect } from 'react';

// Banner "Installa app", in due nature. SU iOS protegge i dati (vedi utils/installazione.js): quando
// parlare lo decide App, qui arriva solo `installaIOS`. ALTROVE è una comodità: su Chromium si usa
// l'evento `beforeinstallprompt`; Firefox Android non lo ha e mostra le istruzioni dal menu;
// Firefox desktop non può installare una PWA, lì solo un avviso generico. Non compare se l'app è
// già installata.

const DISMISS_KEY = 'turni_install_dismissed';

// localStorage può LANCIARE (cookie bloccati, WebView ristrette): senza protezione l'eccezione
// smonterebbe l'albero (App non ha un error boundary a monte).
const leggiFlag = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const scriviFlag = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* senza storage il banner ricomparirà: non è un errore da mostrare */ }
};

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  // iPadOS si presenta come Mac con touch
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

// Firefox per Android: niente `beforeinstallprompt`, ma "Aggiungi a schermata Home" dal menu. Su
// iOS "Firefox" è WebKit, quindi vale già isIOS().
const isFirefoxAndroid = () => /firefox/i.test(window.navigator.userAgent)
  && /android/i.test(window.navigator.userAgent);

// Firefox desktop: nessuna installazione nativa possibile (vedi commento in
// testa al file). Chiamata solo dopo aver escluso iOS e Firefox Android.
const isFirefoxDesktop = () => /firefox/i.test(window.navigator.userAgent);

/**
 * @param {object} props
 * @param {boolean} props.installaIOS tocca all'avviso iOS (deciso in App)
 * @param {boolean} props.sospeso qualcun altro sta parlando: i banner di comodità tacciono
 * @param {() => void} props.onRifiutaIOS «no» all'avviso iOS: dura, lo registra App
 * @param {() => void} props.onBackup porta al backup, l'alternativa per chi non installa
 */
export default function InstallPrompt({ installaIOS = false, sospeso = false, onRifiutaIOS, onBackup }) {
  const [deferred, setDeferred] = useState(null); // evento beforeinstallprompt
  const [show, setShow] = useState(false);
  const [firefoxHint, setFirefoxHint] = useState(false);
  const [firefoxDesktopHint, setFirefoxDesktopHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Mai se già installata, mai se già rifiutato. iOS ha il suo avviso,
    // deciso fuori da qui.
    if (isStandalone() || isIOS()) return;
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

    // Firefox (Android/desktop): nessun evento, istruzioni manuali.
    if (isFirefoxAndroid()) { setFirefoxHint(true); setShow(true); }
    else if (isFirefoxDesktop()) { setFirefoxDesktopHint(true); setShow(true); }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installaIOS) {
    // Il motivo prima delle istruzioni, e il backup accanto come altra difesa per chi non installa.
    return (
      <div className="install-banner install-banner--ios" role="status">
        <img className="install-banner-icon" src="/pwa-192x192.png" alt="" width="40" height="40" />
        <div className="install-banner-text">
          <strong>Aggiungi Turni alla Home</strong>
          <span>
            Su iPhone, se resta solo in Safari, dopo 7 giorni senza aprirla Safari può
            cancellare i tuoi turni. Tocca <span aria-label="Condividi">Condividi ⬆️</span>
            {' '}e poi «Aggiungi alla schermata Home».
          </span>
          <button type="button" className="install-banner-link" onClick={onBackup}>
            Oppure fai un backup
          </button>
        </div>
        <button className="install-banner-close" onClick={onRifiutaIOS} aria-label="Chiudi">✕</button>
      </div>
    );
  }

  if (!show || sospeso) return null;

  const dismiss = () => {
    scriviFlag(DISMISS_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    // `prompt()` si può chiamare UNA volta per evento: senza guardia un doppio tocco produce una
    // rejection non gestita (`deferred` si azzera solo dopo l'attesa).
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
        {firefoxHint ? (
          <span>Tocca il menu ⋮ in alto e poi «Aggiungi a schermata Home» (o «Installa»).</span>
        ) : firefoxDesktopHint ? (
          <span>Se il tuo browser lo supporta, aggiungila dal menu (⋮ o ≡).</span>
        ) : (
          <span>Aggiungila alla schermata home: si apre a tutto schermo, anche offline.</span>
        )}
      </div>
      {!firefoxHint && !firefoxDesktopHint && (
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
