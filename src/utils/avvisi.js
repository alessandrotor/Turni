// Chi parla, quando ne avrebbero da dire in più di uno («un avviso alla volta»).
//
// Una funzione sola, riscontrabile da Node: le condizioni incrociate scritte a mano nel JSX si
// rompono in silenzio, e il riscontro verifica che ogni avviso abbia almeno una combinazione in
// cui tocca a lui.
//
// Vince chi non può tornare:
//  1. ANNULLA: l'unico che SCADE; passata la finestra il turno cancellato non torna più.
//  2. MAGGIORAZIONE: «tornerà da sé al turno successivo che la attiva» (`configurazione.js`).
//  3. AGGIORNAMENTO: nessuna urgenza, «entra da sé alla prossima apertura».
// Il modale batte tutti: mentre si compila qualcosa non compare niente.
//
// Modulo puro, senza React e senza browser: `node scripts/check-avvisi.mjs`.

/**
 * Quanto dura la finestra per annullare una cancellazione.
 *
 * Otto secondi: il tempo di vedere la cella vuota, accorgersi dell'errore e portare il dito
 * sulla striscia. Di più, e la striscia diventa un residuo che si impara a ignorare.
 */
export const DURATA_ANNULLA = 8000;

/** Gli avvisi che si contendono il fondo dello schermo, dal più urgente. */
export const ORDINE = ['annulla', 'maggiorazione', 'aggiornamento'];

/**
 * Chi deve comparire, dato cosa c'è in ballo.
 *
 * @param {object} stato
 * @param {boolean} stato.modaleAperto un modulo è aperto: non parla nessuno
 * @param {boolean} stato.annulla c'è una cancellazione ancora annullabile
 * @param {boolean} stato.maggiorazione c'è una domanda sulle maggiorazioni
 * @param {boolean} stato.aggiornamento c'è una versione nuova pronta
 * @returns {'annulla'|'maggiorazione'|'aggiornamento'|null}
 */
export function avvisoDaMostrare({
  modaleAperto = false, annulla = false, maggiorazione = false, aggiornamento = false,
} = {}) {
  if (modaleAperto) return null;
  const acceso = { annulla, maggiorazione, aggiornamento };
  return ORDINE.find((nome) => acceso[nome]) ?? null;
}
