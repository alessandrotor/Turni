import { useState, useEffect } from 'react';
import { consigliatiMancanti } from '../utils/configurazione';

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

// Quante voci nominare. Oltre tre diventa un elenco di compiti, e un elenco di
// compiti si chiude senza leggerlo.
const DA_NOMINARE = 2;

// SE parlare lo decide App (`promemoriaHaDaDire` e `chiParlaInAlto`): deve
// saperlo prima di dare la parola al banner di installazione. Il «chiuso»
// vive in App per la stessa ragione — e vale la sessione anche senza storage,
// altrimenti tornerebbe a ogni turno aggiunto.
export default function SetupPrompt({ settings, parla = false, onSistema, onChiudi }) {
  // «Sistemale» apre la finestra: il banner si fa da parte finché le
  // impostazioni non cambiano, poi dice di nuovo quello che manca ancora.
  const [nascosto, setNascosto] = useState(false);
  useEffect(() => { setNascosto(false); }, [settings]);

  if (!parla || nascosto) return null;

  const mancanti = consigliatiMancanti(settings);

  const sistema = () => {
    onSistema();
    setNascosto(true);
  };
  const dismiss = onChiudi;

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
