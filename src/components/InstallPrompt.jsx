import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Banner "Installa app". Su Android/desktop (Chrome/Edge) usa l'evento nativo
// `beforeinstallprompt`; su iOS Safari, che non lo espone, mostra le istruzioni
// manuali (Condividi → Aggiungi a Home). Non compare nell'APK Capacitor né
// quando l'app è già installata (avviata in modalità standalone).

const DISMISS_KEY = 'turni_install_dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  // iPadOS si presenta come Mac con touch
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null); // evento beforeinstallprompt
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // Mai nell'app nativa, mai se già installata, mai se già rifiutato.
    if (Capacitor.isNativePlatform() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    // Android / desktop: intercetta l'evento e mostra il nostro pulsante.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    const onInstalled = () => { setShow(false); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari: nessun evento, mostriamo le istruzioni manuali.
    if (isIOS()) { setIosHint(true); setShow(true); }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    setShow(false);
    if (outcome !== 'accepted') localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div className="install-banner">
      <img className="install-banner-icon" src="/pwa-192x192.png" alt="" width="40" height="40" />
      <div className="install-banner-text">
        <strong>Installa Turni</strong>
        {iosHint ? (
          <span>Tocca <span aria-label="Condividi">Condividi ⬆️</span> e poi «Aggiungi a Home».</span>
        ) : (
          <span>Aggiungila alla schermata home: si apre a tutto schermo, anche offline.</span>
        )}
      </div>
      {!iosHint && (
        <button className="btn btn-primary install-banner-btn" onClick={install}>Installa</button>
      )}
      <button className="install-banner-close" onClick={dismiss} aria-label="Chiudi">✕</button>
    </div>
  );
}
