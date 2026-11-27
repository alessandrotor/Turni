// Perché l'import da foto è fallito, in due famiglie che chiedono gesti diversi.
//
//   node scripts/check-errore-import.mjs
//
//  · CARICAMENTO: l'immagine non è arrivata al riconoscimento o la risposta non è tornata (file
//    illeggibile, rete, tempo, verifica, limiti, servizio giù). La foto può essere perfetta.
//  · LETTURA: il riconoscimento ha risposto ma non ha trovato turni. Qui la foto va rifatta.
//
// Modulo puro, senza browser: la classificazione si verifica in Node.

export const TIPO_ERRORE = {
  CARICAMENTO: 'caricamento',
  LETTURA: 'lettura',
};

export const TITOLO_ERRORE = {
  [TIPO_ERRORE.CARICAMENTO]: 'L\'immagine non è arrivata al riconoscimento.',
  [TIPO_ERRORE.LETTURA]: 'L\'immagine è arrivata, ma non siamo riusciti a leggerci i turni.',
};

/** Un errore dell'import con la sua famiglia attaccata. */
export function erroreImport(tipo, messaggio) {
  const e = /** @type {Error & { tipo?: string }} */ (new Error(messaggio));
  e.tipo = tipo;
  return e;
}

/**
 * La famiglia di una risposta NON riuscita del proxy. Se il proxy la dichiara
 * (`tipo`) vale quella; altrimenti decide lo stato: 422 è l'unico con cui il
 * proxy dice «ho letto, e non c'era niente»; tutto il resto — 4xx sul file,
 * 403 della verifica, 429 dei limiti, 5xx del servizio — è un caricamento.
 */
export function tipoDaRisposta(status, payload) {
  if (Object.values(TIPO_ERRORE).includes(payload?.tipo)) return payload.tipo;
  return status === 422 ? TIPO_ERRORE.LETTURA : TIPO_ERRORE.CARICAMENTO;
}

/** Per lo schermo: la famiglia di un errore qualunque, anche uno imprevisto. */
export function tipoDiErrore(err) {
  return Object.values(TIPO_ERRORE).includes(err?.tipo) ? err.tipo : TIPO_ERRORE.CARICAMENTO;
}
