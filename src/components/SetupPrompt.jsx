import { useState, useEffect, useRef } from 'react';
import { haDatiMinimi, consigliatiMancanti } from '../utils/configurazione';

// Il promemoria di quello che resta da sistemare.
//
// COSA FACEVA PRIMA, E PERCHÉ NON PUÒ PIÙ FARLO
// Diceva «Imposta la paga oraria», e compariva all'apertura su un'app vuota.
// Non serve più, per due ragioni: la paga adesso è bloccante al primo turno
// (DatiMinimi.jsx), quindi non si può più arrivare lontano senza; e soprattutto
// il percorso scelto non chiede NIENTE all'apertura — chiedere a chi non ha
// ancora capito cosa fa l'app è il modo migliore per farsi rispondere a caso.
//
// COSA FA ADESSO
// Compare solo a chi sta già usando l'app — almeno un turno segnato, i dati
// minimi a posto — e dice quante cose restano e in che direzione sbagliano i
// conti senza di loro. Non è una richiesta: è un'informazione che si può
// chiudere.
//
// Il CONTRATTO non è elencato qui di proposito: ha già il suo avviso sotto il
// totale del mese, dove c'è un importo da qualificare. Ripeterlo in due posti
// lo farebbe sembrare più urgente di quanto la sua natura rimandabile giustifichi.

const DISMISS_KEY = 'turni_setup_dismissed';

const leggiFlag = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const scriviFlag = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* senza storage il banner ricomparirà: non è un errore da mostrare */ }
};

// Quante voci nominare. Oltre tre diventa un elenco di compiti, e un elenco di
// compiti si chiude senza leggerlo.
const DA_NOMINARE = 2;

export default function SetupPrompt({ settings, onNavigate, onSistema, turniInseriti = 0 }) {
  const [show, setShow] = useState(false);
  // Chiuso in QUESTA sessione: vale fino alla prossima apertura, qualunque cosa
  // succeda ai turni nel frattempo. Senza, tornerebbe a ogni turno aggiunto,
  // che è un assillo e non un aiuto.
  const chiusoOra = useRef(false);

  const mancanti = consigliatiMancanti(settings);

  useEffect(() => {
    // Niente da dire a chi non ha ancora segnato niente: l'apertura dell'app
    // resta senza domande, ed è la scelta che regge tutto il percorso.
    if (turniInseriti === 0 || chiusoOra.current) { setShow(false); return; }
    // I dati minimi mancanti li chiede il blocco al primo turno, non questo.
    if (!haDatiMinimi(settings)) { setShow(false); return; }
    if (mancanti.length === 0) { setShow(false); return; }
    if (leggiFlag(DISMISS_KEY) === '1') { setShow(false); return; }
    setShow(true);
  }, [settings, turniInseriti, mancanti.length]);

  if (!show) return null;

  const dismiss = () => {
    chiusoOra.current = true;
    scriviFlag(DISMISS_KEY, '1');
    setShow(false);
  };

  const sistema = () => {
    onSistema();
    setShow(false);
  };

  const nominate = mancanti.slice(0, DA_NOMINARE);
  const altre = mancanti.length - nominate.length;
  // «l'app conta di meno» e «di più» non sono lo stesso avviso: la prima
  // direzione toglie soldi che ci sono, la seconda ne promette che non
  // arriveranno. Chi legge deve sapere quale delle due lo riguarda.
  const soloMeno = nominate.every((c) => c.direzione === 'meno');
  const soloPiu = nominate.every((c) => c.direzione === 'piu');
  const verso = soloMeno
    ? 'Senza, conto meno del vero.'
    : soloPiu
      ? 'Senza, il netto risulta più alto del vero.'
      : 'Senza, i conti non tornano con la busta.';

  return (
    <div className="install-banner">
      <div className="install-banner-text">
        <strong>
          ⚙️ {mancanti.length === 1
            ? 'Manca ancora una cosa'
            : `Mancano ancora ${mancanti.length} cose`}
        </strong>
        <span>
          {nominate.map((c) => c.etichetta).join(', ')}
          {altre > 0 && ` e altre ${altre}`}. {verso}
        </span>
      </div>
      <button className="btn btn-primary install-banner-btn" onClick={sistema}>
        Sistemale
      </button>
      <button className="install-banner-close" onClick={dismiss} aria-label="Chiudi">✕</button>
    </div>
  );
}
