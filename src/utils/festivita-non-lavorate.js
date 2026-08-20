// Le festività di un mese in cui non c'è nessun turno segnato.
//
// PERCHÉ ESISTE
// Una festività non lavorata viene pagata — in busta compare come giustificativo
// a sé («GO Festivita'», verificato su un cedolino di agosto) e vale le ore di
// una giornata di contratto. Ma è anche la cosa più facile da dimenticare: sono
// undici o dodici giorni sparsi nell'anno, e chi non lavora quel giorno non ha
// nessun motivo per aprire l'app.
//
// L'app però sa già quali giorni sono festivi (`isHoliday`, che copre le
// festività nazionali, la Pasqua calcolata e il santo patrono impostato).
// Quindi può accorgersene e proporre.
//
// PROPONE, NON AGGIUNGE
// Questo modulo dice soltanto QUALI giorni sarebbero candidati. Crearli è una
// scelta di chi usa l'app: chi ha un contratto mensilizzato, o semplicemente
// non ha diritto alla festività pagata, non deve ritrovarsi il mese gonfiato da
// ore che non ha inserito.
//
// Riscontro: `node scripts/check-festivita.mjs`.

// Estensioni esplicite: senza, Node puro non importa il modulo e i riscontri in
// `scripts/` non partono.
import { formatDate, getDaysInMonth } from './dates.js';
import { isHoliday } from './holidays.js';

/**
 * I giorni festivi del mese senza alcun turno segnato.
 *
 * «Alcun turno» vale per QUALUNQUE tipo: se il primo maggio c'è già una
 * giornata di ferie, o un turno lavorato, non è un candidato — l'utente ha già
 * detto la sua su quel giorno.
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
