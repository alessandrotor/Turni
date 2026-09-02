// Chi parla, quando ne avrebbero da dire in più di uno.
//
// PERCHÉ UN MODULO A PARTE
// «Un avviso alla volta» è una delle regole del progetto, e finora era scritta
// a mano nel JSX di App: `aggiornamentoPronto && !avviso && !modal` da una
// parte, `avviso && !modal` dall'altra. Con due avvisi funzionava. Col terzo le
// condizioni incrociate diventano sei, e sono il genere di cosa che si rompe
// in silenzio: nessuno vede MAI l'avviso che è finito in fondo alla catena,
// perché non c'è schermata in cui compaia — e non c'è niente che lo dica.
//
// Qui la regola è una funzione sola, riscontrabile da Node, e il riscontro
// verifica anche la proprietà che nessun occhio umano controlla: che ogni
// avviso abbia almeno una combinazione in cui tocca a lui.
//
// L'ORDINE, E IL PERCHÉ — che è il vero contenuto di questo file
// Vince chi non può tornare.
//
//  1. ANNULLA. È l'unico che SCADE. Passata la sua finestra il turno cancellato
//     non torna più: nasconderlo anche solo per qualche secondo significa
//     perdere un dato per sempre.
//  2. MAGGIORAZIONE. Riguarda soldi contati male, ma «tornerà da sé al turno
//     successivo che la attiva» — sta già scritto in `configurazione.js`.
//  3. AGGIORNAMENTO. Nessuna urgenza: se lo si ignora, «entra da sé alla
//     prossima apertura».
//
// Il modale batte tutti: mentre si compila qualcosa non compare niente. È la
// regola «si chiede DOPO l'azione, mai durante».
//
// Modulo puro, senza React e senza browser: `node scripts/check-avvisi.mjs`.

/**
 * Quanto dura la finestra per annullare una cancellazione.
 *
 * Otto secondi non sono un numero tondo scelto a caso: sono il tempo di vedere
 * la cella tornata vuota, accorgersi che era quella sbagliata e portare il dito
 * sulla striscia. Meno non basta a chi sta guardando altrove nel momento in cui
 * tocca; molto di più e la striscia smette di essere una via d'uscita e diventa
 * un residuo che copre il calendario mentre si sta già facendo altro — cioè
 * esattamente il tipo di avviso che si impara a ignorare.
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
