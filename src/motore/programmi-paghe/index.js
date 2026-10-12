// I PROGRAMMI PAGHE, uno per file, una riga qui sotto.
//
// La legge dice cosa è dovuto sull'anno; COME il datore lo anticipa mese per
// mese lo decide il suo programma paghe. Ogni programma è un file con le
// stesse quattro voci: `lordoPresuntoAnno` (il reddito presunto),
// `annoSenzaProgressivo` (quando non si sa che mese è), `quota` (come chiude
// al centesimo) e `primoMeseConcesso`. Per AGGIUNGERNE uno: copia
// `zucchetti.js`, cambia le regole, aggiungi la riga in `PROGRAMMI`. Le
// impostazioni lo scelgono con `programmaPaghe`; senza, vale quello verificato
// sulle buste. → check-programma-paghe.mjs

import zucchetti from './zucchetti.js';

export const PROGRAMMI = Object.fromEntries([zucchetti].map((p) => [p.codice, p]));
const VERIFICATO = zucchetti;

/** Il programma paghe delle impostazioni, o quello verificato sulle buste. */
export function programmaPaghe(settings = {}) {
  return PROGRAMMI[settings.programmaPaghe] || VERIFICATO;
}
