// Le festività di un mese in cui non c'è nessun turno segnato. Una festività non lavorata è pagata
// (in busta è un giustificativo a sé) ed è facile da dimenticare: l'app sa già quali giorni sono
// festivi (`isHoliday`) e PROPONE; crearli è una scelta di chi usa l'app (un mensilizzato può non
// averne diritto).
//
// Riscontro: `node scripts/check-festivita.mjs`.

// Estensioni esplicite: senza, Node puro non importa il modulo.
import { formatDate, getDaysInMonth } from './dates.js';
import { isHoliday } from '../motore/holidays.js';

/**
 * I giorni festivi del mese senza alcun turno segnato.
 *
 * «Alcun turno» vale per QUALUNQUE tipo: se c'è già ferie o lavoro, non è un candidato.
 *
 * @param {number} anno
 * @param {number} mese indice 0-11, come `Date.getMonth()`
 * @param {Array} turni tutti i turni (serve solo la data)
 * @param {object} settings per il santo patrono
 * @returns {string[]} date ISO in ordine
 */
export function festivitaSenzaTurno(anno, mese, turni = [], settings = {}) {
  const occupati = new Set((turni || []).map(t => t?.date).filter(Boolean));
  const out = [];

  for (let g = 1; g <= getDaysInMonth(anno, mese); g++) {
    const iso = formatDate(new Date(anno, mese, g));
    // La domenica NON è una festività: prende la maggiorazione domenicale, che
    // è un'altra cosa e riguarda un giorno lavorato. `isHoliday` distingue già.
    if (isHoliday(iso, settings) && !occupati.has(iso)) out.push(iso);
  }
  return out;
}

/**
 * Le giornate da creare per quelle festività, pronte per `addShifts`.
 *
 * @param {string[]} date da `festivitaSenzaTurno`
 * @param {number} minuti durata di una giornata (da `minutiGiornoAssenza`)
 */
export function giornateFestive(date, minuti) {
  const durata = Math.max(0, Math.round(Number(minuti) || 0));
  return (date || []).map(data => ({
    date: data,
    type: 'festivita',
    durationMinutes: durata,
    note: '',
  }));
}
