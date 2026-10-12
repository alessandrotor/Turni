// Le soglie di legge sono di REDDITO (lordo meno contributi, vedi
// check-cu-2025.mjs); chi usa l'app vede il LORDO in busta. Questa è l'unica
// conversione dall'una all'altro: barra, riquadri e popup la chiedono qui.

import { redditoComplessivo, nettoDelMese, TAX_2026 } from './net.js';

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

/**
 * Il lordo del MESE da cui il trattamento integrativo arriva in busta. Sotto i
 * 1.250 € non basta: serve un'IRPEF da compensare (art. 1 DL 3/2020, la
 * «capienza»), e con poche ore le detrazioni la azzerano già. Si cerca sullo
 * stesso `nettoDelMese` che fa il netto, così la cifra a schermo e il riquadro
 * non possono dirsi cose diverse. `null` se sotto i 1.250 non arriva mai.
 * → check-ti-capienza.mjs
 */
export function lordoMeseMinimoTi(settings = {}) {
  const ti = (m) => nettoDelMese(m, settings, 30).trattamentoIntegrativo > 0;
  let lo = 0;
  let hi = Math.floor(TAX_2026.TI_SOGLIA_PIENO / 12);
  if (!ti(hi)) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ti(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
