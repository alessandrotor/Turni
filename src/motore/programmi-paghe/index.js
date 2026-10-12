// I PROGRAMMI PAGHE, uno per file, una riga qui sotto.
//
// La legge dice cosa è dovuto sull'anno; COME il datore lo anticipa mese per
// mese lo decide il suo programma paghe, ed è lì che stanno regole come il
// reddito presunto. Ogni file esporta le stesse funzioni (oggi:
// `lordoPresuntoAnno`). Per AGGIUNGERNE uno: copia `zucchetti.js`, cambia le
// regole, aggiungi la riga in `PROGRAMMI`. Le impostazioni lo scelgono con
// `programmaPaghe`; senza, vale quello verificato sulle buste.

import zucchetti from './zucchetti.js';

const PROGRAMMI = Object.fromEntries([zucchetti].map((p) => [p.codice, p]));
const VERIFICATO = zucchetti;

/** Il programma paghe delle impostazioni, o quello verificato sulle buste. */
export function programmaPaghe(settings = {}) {
  return PROGRAMMI[settings.programmaPaghe] || VERIFICATO;
}
