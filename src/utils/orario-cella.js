// Come si scrive un turno dentro una cella della griglia del mese.
//
// La pill mostra inizio E fine (non la sola ora d'inizio, che col doppio turno 10–15 + 18–23:30
// si leggeva «10:00 / 18:00»). Il formato è corto perché la colonna è larga una quarantina di
// pixel: ore sempre, minuti solo quando ci sono, in apice («10–15», «18–23³⁰»).
//
// Accorciare non vuol dire arrotondare: «23³⁰» deve tornare «23:30», mai «23:00». Il riscontro
// verifica che dal formato corto si ricostruisca sempre l'orario di partenza.
//
// Modulo puro: `node scripts/check-orario-cella.mjs`.

const ORARIO = /^(\d{1,2}):(\d{2})$/;

/**
 * Un orario «HH:MM» diviso per la cella: ore a due cifre, minuti vuoti se zero.
 * Un valore che non è un orario resta com'è, intero, nelle ore: meglio mostrare
 * il dato strano che inventarne uno pulito.
 *
 * @param {string} hhmm
 * @returns {{ ore: string, minuti: string }}
 */
export function partiOrario(hhmm) {
  const m = ORARIO.exec(String(hhmm ?? '').trim());
  if (!m) return { ore: String(hhmm ?? ''), minuti: '' };
  return { ore: m[1].padStart(2, '0'), minuti: m[2] === '00' ? '' : m[2] };
}

/**
 * Inizio e fine di un turno per la pill. `fine` è null se il turno non ne ha
 * una: si mostra l'inizio da solo, come prima, invece di un trattino sospeso.
 *
 * @returns {{ inizio: {ore, minuti}, fine: {ore, minuti} | null }}
 */
export function intervalloCella(startTime, endTime) {
  return {
    inizio: partiOrario(startTime),
    fine: endTime ? partiOrario(endTime) : null,
  };
}

/** La lettura inversa, per i riscontri: dalle parti all'orario «HH:MM». */
export function ricomponi({ ore, minuti }) {
  return `${ore}:${minuti || '00'}`;
}
