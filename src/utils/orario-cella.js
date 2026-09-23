// Come si scrive un turno dentro una cella della griglia del mese.
//
// IL DIFETTO
// La pill mostrava la sola ora di INIZIO. Con un turno per giorno era poco,
// col doppio turno diventava sbagliato da leggere: un giorno 10–15 + 18–23:30
// compariva come «10:00 / 18:00», identico a due turni lunghi o a due turni
// attaccati. Del turno spezzato — la pausa in mezzo, che è l'informazione —
// non si vedeva niente, e bisognava aprirli uno per uno.
//
// PERCHÉ NON BASTA SCRIVERE «18:00–23:30»
// Su un telefono una colonna della griglia è larga una quarantina di pixel:
// undici caratteri non ci stanno, e la pill li tagliava coi puntini. E peggio,
// il `nowrap` delle pill allargava la colonna del giorno pieno a spese delle
// altre — le colonne vuote scendevano a 35 px.
//
// IL FORMATO
// Ore sempre, minuti solo quando ci sono, in apice: «10–15», «18–23³⁰». È la
// forma dei cartelli degli orari nei negozi italiani, quindi si legge senza
// spiegazioni, e dimezza la larghezza.
//
// LA REGOLA CHE NON SI PIEGA
// Accorciare non vuol dire arrotondare: «23³⁰» deve tornare «23:30», mai
// «23:00». La cella è il posto dove un orario si controlla di sfuggita, e un
// minuto sparito lì non lo nota nessuno. Il riscontro verifica che dal formato
// corto si ricostruisca sempre l'orario di partenza.
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
