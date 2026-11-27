// Sotto il totale del mese, cosa vale quella cifra rispetto al contratto.
//
// Senza contratto: l'avviso di sempre, con la cifra, perché sbaglia verso l'ALTO.
// Con un contratto che nessuna busta ha ancora confermato (novembre 2026: due su
// oltre mille, Turismo e Vigilanza) una riga sottovoce lo dice e porta a
// «Confronta con la busta». È la regola del progetto — se un valore non è
// verificato su un cedolino, l'interfaccia lo dice — e insieme il modo in cui
// un contratto diventa verificato: dagli scarti che chi lo usa condivide.
// Prima lo diceva solo Impostazioni, dentro una sezione chiusa.

import { contrattoMancante } from '../utils/configurazione';
import { getContratto } from '../utils/ccnl-elenco';

export default function AvvisoContratto({ settings, onNavigate }) {
  if (contrattoMancante(settings)) {
    return (
      <div className="contratto-avviso">
        <div className="contratto-avviso-testo">
          <strong>Senza contratto conto ~45 € in più del vero</strong>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('settings')}>
          Scegli il contratto
        </button>
      </div>
    );
  }
  const contratto = getContratto(settings.ccnl);
  if (contratto.verificato) return null;
  return (
    <p className="bonus-strip-note" style={{ margin: '.4rem 0 0', textAlign: 'center' }}>
      Coi conti del tuo contratto nessuno ha ancora confrontato una busta vera.{' '}
      <button type="button" className="linklike" onClick={() => onNavigate?.('verifica')}>Confronta la tua</button>
    </p>
  );
}
