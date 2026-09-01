// «C'è del lavoro in sospeso»: chi lo sa lo dice, invece di farlo indovinare.
//
// Serve a una cosa sola, ma delicata: decidere se l'app può ricaricarsi da sola
// per mettere in servizio una versione nuova (services/aggiornamento.js). Un
// ricaricamento nel momento sbagliato non è un fastidio, è una perdita:
//
//  · `inAttesa` in App.jsx tiene un turno GIÀ COMPILATO e non ancora salvato,
//    fermo lì ad aspettare paga oraria e ore settimanali;
//  · il modulo del turno può essere a metà;
//  · Impostazioni è un form vero, con modifiche che valgono solo dopo il salva;
//  · un import da foto può essere in volo, e la richiesta è già stata pagata.
//
// Nessuna di queste cose si vede da fuori. Elencarle in un `if` dentro il
// modulo dell'aggiornamento significherebbe tenere in un posto solo la
// conoscenza di quattro componenti diversi — e dimenticarsene alla quinta, in
// silenzio, scoprendolo quando qualcuno perde un turno. Qui invece è ogni pezzo
// a dichiararsi occupato finché lo è, con `hooks/useOccupato.js`.
//
// Modulo puro, senza React e senza browser: si riscontra da Node.

const inSospeso = new Set();

/**
 * @param {string} chiave chi sta dichiarando (una per componente: 'modale',
 *   'impostazioni', 'import'…)
 * @param {boolean} occupato
 */
export function segnaOccupato(chiave, occupato) {
  if (occupato) inSospeso.add(chiave);
  else inSospeso.delete(chiave);
}

/** C'è almeno una cosa in sospeso? */
export function eOccupato() {
  return inSospeso.size > 0;
}

/** Chi tiene occupato, per i messaggi di diagnostica e per i riscontri. */
export function chiOccupa() {
  return [...inSospeso];
}
