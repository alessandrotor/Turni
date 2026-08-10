import { useState, useEffect } from 'react';
import { hasAnyRate } from '../utils/pay';

// Banner "Imposta la paga oraria". Stesso pattern di InstallPrompt.jsx:
// dismiss persistente in localStorage, mai un errore bloccante se lo storage
// non è disponibile. Senza hourlyRate l'app non calcola nulla (vedi
// hasAnyRate in utils/pay.js), quindi ha priorità sul banner di installazione.

const DISMISS_KEY = 'turni_setup_dismissed';

const leggiFlag = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const scriviFlag = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* senza storage il banner ricomparirà: non è un errore da mostrare */ }
};

export default function SetupPrompt({ settings, onNavigate }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (hasAnyRate(settings) || leggiFlag(DISMISS_KEY) === '1') { setShow(false); return; }
    setShow(true);
  }, [settings]);

  if (!show) return null;

  const dismiss = () => {
    scriviFlag(DISMISS_KEY, '1');
    setShow(false);
  };

  const goToSettings = () => {
    onNavigate('settings');
    setShow(false);
  };

  return (
    <div className="install-banner">
      <div className="install-banner-text">
        <strong>💰 Imposta la paga oraria</strong>
        <span>Serve per calcolare quanto guadagni dai turni che segni.</span>
      </div>
      <button className="btn btn-primary install-banner-btn" onClick={goToSettings}>
        Vai alle impostazioni
      </button>
      <button className="install-banner-close" onClick={dismiss} aria-label="Chiudi">✕</button>
    </div>
  );
}
