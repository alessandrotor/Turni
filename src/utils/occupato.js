// «C'è del lavoro in sospeso»: chi lo sa lo dice, invece di farlo indovinare.
//
// Serve a decidere se l'app può ricaricarsi da sola per una versione nuova
// (services/aggiornamento.js), perché un ricaricamento sbagliato è una perdita: un turno GIÀ
// COMPILATO in `inAttesa` (App.jsx), il modulo del turno a metà, Impostazioni con modifiche non
// salvate, un import da foto in volo. Ogni componente si dichiara occupato finché lo è, con
// `hooks/useOccupato.js`, invece di elencarli tutti nel modulo dell'aggiornamento.
//
// Modulo puro, senza React e senza browser: si riscontra da Node.

const inSospeso = new Set();

/**
 * @param {string} chiave chi sta dichiarando (una per componente: 'modale',
 *   'impostazioni', 'import'…)
 * @param {boolean} occupato
 */
export function segnaOccupato(chiave, occupato) {
  const prima = inSospeso.has(chiave);
  if (occupato) inSospeso.add(chiave);
  else inSospeso.delete(chiave);
  if (prima !== inSospeso.has(chiave)) {
    for (const fn of ascoltatori) {
      try { fn(chiOccupa()); } catch { /* un ascoltatore rotto non ferma gli altri */ }
    }
  }
}

const ascoltatori = new Set();

/**
 * Iscrive una funzione ai cambi del registro; riceve l'elenco delle chiavi
 * accese. Serve alla striscia «versione nuova»: il suo pulsante ricarica, e
 * con modifiche non salvate in Impostazioni o una foto in riconoscimento le
 * butterebbe via. Restituisce la disiscrizione.
 */
export function iscrivitiOccupato(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

/** C'è almeno una cosa in sospeso? */
export function eOccupato() {
  return inSospeso.size > 0;
}

/** Chi tiene occupato, per i messaggi di diagnostica e per i riscontri. */
export function chiOccupa() {
  return [...inSospeso];
}
