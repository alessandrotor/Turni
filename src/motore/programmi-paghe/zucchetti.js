// Il programma paghe ZUCCHETTI, verificato sulle buste del progetto (LUL,
// CCNL Turismo, 2026). Le regole qui sotto sono sue, non della legge: un altro
// programma paghe può fare diversamente, e allora ha il suo file accanto.

import { EXTRA_MONTHS } from '../net.js';

/**
 * Il LORDO PRESUNTO dell'anno, su cui il datore decide ogni mese trattamento
 * integrativo e detrazioni: quanto pagato finora, più questo mese per ogni
 * mese che resta (lui compreso) e per la 13ª ancora da pagare. Non c'è una
 * formula di legge — la legge guarda l'anno vero, al conguaglio — ma è lo
 * schema dei programmi paghe («già pagato + mese proiettato fino a dicembre»,
 * NoiPA), e sulle buste Zucchetti torna: le detrazioni di agosto e settembre
 * 2026 al centesimo, il trattamento integrativo sei mesi su sei.
 * La 14ª NON si anticipa prima di giugno: nessuna busta dice che il datore lo
 * faccia, e anticiparla toglieva il trattamento a febbraio e maggio, che in
 * busta c'era. Il mese con la 14ª dentro si proietta intero, com'è: giugno
 * 2026 non l'ha avuto. → check-reddito-presunto.mjs
 *
 * @returns {number|null} `null` senza l'indice del mese: si torna a lordo × 12.
 */
function lordoPresuntoAnno(lordoMese, settings = {}, progressivo = null) {
  const mese = progressivo?.mese;
  if (!Number.isInteger(mese) || mese < 0 || mese > 11) return null;
  const daPagare = settings.hasTredicesima && mese < EXTRA_MONTHS.tredicesima ? 1 : 0;
  return (Number(progressivo.lordo) || 0) + (Number(lordoMese) || 0) * (12 - mese + daPagare);
}

export default {
  codice: 'zucchetti',
  nome: 'Zucchetti',
  lordoPresuntoAnno,
};
