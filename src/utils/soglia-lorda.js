// Le soglie di legge sono di REDDITO (lordo meno contributi, vedi
// check-cu-2025.mjs); chi usa l'app vede il LORDO in busta. Questa è l'unica
// conversione dall'una all'altro: barra, riquadri e popup la chiedono qui.

import { redditoComplessivo } from './net.js';

/**
 * Il lordo annuo più alto che resta entro un REDDITO dato: «15.000 di reddito,
 * per te, sono X € lordi». Si cerca sul reddito vero (`redditoComplessivo`,
 * con l'Ente Bilaterale e la sua quota ditta), mai dividendo per un'aliquota:
 * `taxableToGross` e `redditoComplessivo` arrotondano in punti diversi, e la
 * barra diceva «soglia ~16.622 € lordi» mentre il popup, sugli stessi dati,
 * «fermarti a 16.596 €». Un numero solo, da qui. → check-costo-soglia.mjs
 */
export function lordoPerReddito(reddito, settings = {}) {
  let lo = 0;
  let hi = Math.max(1000, Number(reddito) * 2);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (redditoComplessivo(mid, settings) <= reddito) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
