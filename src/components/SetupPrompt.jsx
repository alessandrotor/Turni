import { useState, useEffect, useRef } from 'react';
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

export default function SetupPrompt({ settings, onNavigate, turniInseriti = 0 }) {
  const [show, setShow] = useState(false);
  // Chiuso in QUESTA sessione: vale fino alla prossima apertura dell'app,
  // qualunque cosa succeda ai turni nel frattempo. Senza, il banner
  // ricomparirebbe a ogni turno aggiunto, che è un assillo e non un aiuto.
  const chiusoOra = useRef(false);

  useEffect(() => {
    // La paga c'è: non c'è più niente da chiedere.
    if (hasAnyRate(settings) || chiusoOra.current) { setShow(false); return; }

    // La chiusura salvata vale finché il calendario è vuoto. Appena c'è un
    // turno il banner torna alla prossima apertura, perché è da quel momento
    // che l'app mostra 0 € senza spiegare perché — ed è la storia di chi
    // arriva da un link condiviso, apre per curiosità e chiude il banner.
    if (leggiFlag(DISMISS_KEY) === '1' && turniInseriti === 0) { setShow(false); return; }

    setShow(true);
  }, [settings, turniInseriti]);

  if (!show) return null;

  const dismiss = () => {
    chiusoOra.current = true;
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
