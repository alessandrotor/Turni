// Quanto conviene versare DA SOLI al fondo pensione, e quanto si risparmia.
//
// Il versamento diretto (bonifico al fondo, non trattenuto in busta) si deduce
// col 730 (art. 10 c. 1 lett. e-bis TUIR, art. 8 D.Lgs. 252/2005), entro
// 5.300 € l'anno dal 2026 (L. 199/2025) contando anche quello trattenuto in
// busta. La deduzione abbassa SOLO la base dell'imposta e delle addizionali:
// il reddito complessivo resta quello, quindi la detrazione da lavoro, la
// soglia dei 15.000 e l'Indennità L. 207/24 non si muovono.
//
// Il trattamento integrativo invece SÌ, per due strade opposte, e da qui
// nasce il motivo di questo modulo:
//   - sotto i 15.000 spetta solo se l'imposta lorda supera la detrazione da
//     lavoro (la capienza): una deduzione troppo grande la porta sotto, e il
//     trattamento sparisce tutto. Oltre quel versamento si perde più di quanto
//     si risparmia;
//   - fra 15.000 e 28.000 spetta la parte di detrazioni che supera l'imposta
//     lorda: abbassare l'imposta lo fa (ri)comparire.
// Il rimborso arriva col 730 dell'anno dopo, non in busta.
//
// Nessuna regola nuova: i conti sono due `calcNetAnnual`, con e senza
// deduzione. Dalla norma, non da una busta: il 730 non passa dal cedolino.
// → riscontri/check-fondo-pensione.mjs

import { calcNetAnnual } from './net.js';
import { TETTO_FONDO_PENSIONE, trattenuteFuoriReddito } from './previdenza.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

const PASSO = 50; // € della ricerca del versamento migliore

/** Quanto resta deducibile dopo il fondo già trattenuto in busta. */
export function spazioDeducibile(lordoAnno, settings = {}) {
  const inBusta = trattenuteFuoriReddito(lordoAnno, settings, 12)
    .filter((r) => r.label === 'Fondo pensione').reduce((s, r) => s + r.importo, 0);
  return Math.max(0, TETTO_FONDO_PENSIONE - inBusta);
}

/**
 * Cosa cambia nell'anno versando `versamento` € di tasca propria.
 * @param {number} lordoAnno lordo previsto dell'anno (`projectAnnualIncome`)
 * @param {Impostazioni} settings
 * @param {number} versamento
 * @returns {{ versamento: number, risparmio: number,
 *   voci: { irpef: number, addizionali: number, trattamentoIntegrativo: number } }}
 *   `risparmio` è quanto torna col 730 (le voci sommano a lui, in euro interi);
 *   `trattamentoIntegrativo` è negativo se lo si perde.
 */
export function effettoVersamento(lordoAnno, settings = {}, versamento = 0) {
  const v = Math.min(Math.max(0, Number(versamento) || 0), spazioDeducibile(lordoAnno, settings));
  const prima = calcNetAnnual(lordoAnno, settings);
  const dopo = calcNetAnnual(lordoAnno, settings, { deduzioni: v });
  const irpef = Math.round(prima.irpefNetta - dopo.irpefNetta);
  const addizionali = Math.round(prima.addRegionale + prima.addComunale - dopo.addRegionale - dopo.addComunale);
  const trattamentoIntegrativo = Math.round(dopo.trattamentoIntegrativo - prima.trattamentoIntegrativo);
  return { versamento: v, risparmio: irpef + addizionali + trattamentoIntegrativo, voci: { irpef, addizionali, trattamentoIntegrativo } };
}

/**
 * Il versamento che fa risparmiare di più, e dove si comincia a perdere.
 * @returns {{ massimo: number, migliore: number, risparmioMigliore: number,
 *   perdeTiDa: number|null }} `massimo` lo spazio deducibile; `perdeTiDa` il
 *   primo versamento (a passi di 50 €) che toglie il trattamento integrativo.
 */
export function versamentoMigliore(lordoAnno, settings = {}) {
  const massimo = spazioDeducibile(lordoAnno, settings);
  let migliore = 0, risparmioMigliore = 0, perdeTiDa = null;
  for (let v = PASSO; v < massimo + PASSO; v += PASSO) {
    const e = effettoVersamento(lordoAnno, settings, Math.min(v, massimo));
    if (perdeTiDa === null && e.voci.trattamentoIntegrativo < 0) perdeTiDa = Math.min(v, massimo);
    if (e.risparmio > risparmioMigliore) { migliore = e.versamento; risparmioMigliore = e.risparmio; }
  }
  return { massimo, migliore, risparmioMigliore, perdeTiDa };
}
