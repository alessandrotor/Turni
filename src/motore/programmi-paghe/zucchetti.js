// Il programma paghe ZUCCHETTI, verificato sulle buste del progetto (LUL,
// CCNL Turismo, 2026). Le regole qui sotto sono sue, non della legge: un altro
// programma paghe può fare diversamente, e allora ha il suo file accanto.

import { EXTRA_MONTHS } from '../mensilita.js';

/**
 * Il LORDO PRESUNTO dell'anno, su cui il datore decide ogni mese trattamento integrativo e
 * detrazioni: già pagato + questo mese per ogni mese che resta (lui compreso) e per la 13ª ancora
 * da pagare. Non è una formula di legge ma lo schema dei programmi paghe, e sulle buste Zucchetti
 * torna. La 14ª NON si anticipa prima di giugno (nessuna busta lo mostra).
 * → check-reddito-presunto.mjs
 *
 * @returns {number|null} `null` senza l'indice del mese: si torna a lordo × 12.
 */
function lordoPresuntoAnno(lordoMese, settings = {}, progressivo = null) {
  const mese = progressivo?.mese;
  if (!Number.isInteger(mese) || mese < 0 || mese > 11) return null;
  const daPagare = settings.hasTredicesima && mese < EXTRA_MONTHS.tredicesima ? 1 : 0;
  return (Number(progressivo.lordo) || 0) + (Number(lordoMese) || 0) * (12 - mese + daPagare);
}

/**
 * L'anno quando il progressivo non c'è (chi chiama non sa che mese è): il
 * lordo del mese, arrotondato all'euro come l'imponibile INPS, per dodici.
 * È la regola che le buste 2026 mostravano prima del reddito presunto, e dà
 * lo stesso esito su quelle buste. → check-ti-mensile.mjs
 */
function annoSenzaProgressivo(lordoMese) {
  const baseMese = Math.round(Math.max(0, Number(lordoMese) || 0));
  return { baseMese, proiezione: baseMese * 12 };
}

/**
 * Trattamento integrativo, indennità L. 207/24 e quota ditta dell'Ente
 * Bilaterale si TRONCANO al centesimo, non si arrotondano: in busta
 * 1.200 × 31/365 = 101,9178 è 101,91 (luglio 2026).
 */
const quota = (x) => Math.floor(x * 100 + 1e-9) / 100;

export default {
  codice: 'zucchetti',
  nome: 'Zucchetti',
  lordoPresuntoAnno,
  annoSenzaProgressivo,
  quota,
  // Il primo mese dell'anno, senza progressivo, il trattamento integrativo si
  // dà e si smette dopo se serve. Indicato da chi mantiene il progetto, non
  // ancora visto su una busta. → check-ti-capienza.mjs
  primoMeseConcesso: true,
};
