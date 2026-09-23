import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Banner "Installa app", in due nature diverse.
//
// SU iOS protegge i dati. Safari cancella lo storage dei siti non aperti per
// sette giorni, e le web app aggiunte alla Home ne sono esenti: lì installare è
// l'unica difesa dei turni (vedi utils/installazione.js). Quando e se parlare lo
// decide App, perché deve anche zittire il promemoria in alto: qui arriva solo
// `installaIOS`.
//
// ALTROVE è una comodità. Su Android/desktop Chromium (Chrome, Edge, Samsung
// Internet) usa l'evento nativo `beforeinstallprompt`. Firefox (mobile e
// desktop) non lo implementa — è un'API solo Chromium — quindi senza un ramo
// dedicato il banner resterebbe invisibile in silenzio: su Firefox per Android
// si mostrano le istruzioni dal menu del browser. Firefox desktop non ha alcun
// modo nativo di installare una PWA (scelta di Mozilla, non un'API mancante):
// lì solo un avviso generico, nessun pulsante che prometta ciò che non può fare.
//
// Non compare nell'APK Capacitor né quando l'app è già installata.

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

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  // iPadOS si presenta come Mac con touch
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

// Firefox per Android: non espone `beforeinstallprompt`, ma supporta
// "Aggiungi a schermata Home" dal menu del browser. Su iOS "Firefox" è solo
// una skin di Safari (WebKit imposto da Apple), quindi lì vale già isIOS().
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
    // Mai nell'app nativa, mai se già installata, mai se già rifiutato. iOS ha
    // il suo avviso, deciso fuori da qui.
    if (Capacitor.isNativePlatform() || isStandalone() || isIOS()) return;
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
    // Il motivo prima delle istruzioni: «aggiungi a Home» senza il perché è
    // un invito come tanti, e si chiude. Il backup accanto non è un ripiego
    // di cortesia: per chi non vuole un'icona in più è l'unica altra difesa.
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
