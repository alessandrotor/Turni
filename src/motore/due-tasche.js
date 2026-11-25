// LE DUE TASCHE dello stesso aiuto, ai 15.000 di reddito (art. 13 TUIR e
// art. 1 DL 3/2020). Sotto: detrazione da lavoro fissa + trattamento
// integrativo. Sopra: niente trattamento integrativo, ma la detrazione salta
// in alto e ne prende il posto. Novembre 2026: chi aveva in busta 251,79 € di
// detrazione e niente tratt. integrativo pensava che sopra i 15.000 la
// detrazione fosse PIÙ BASSA, perché nella fascia scende col reddito. Il
// gradino a 15.000 va nel verso opposto, e va disegnato. → check-due-tasche.mjs

import { detrazioneLavoro } from './net.js';
import { fiscoDi } from './fisco/index.js';

/**
 * Le due tasche, con le cifre dell'anno fiscale e i due momenti in cui si sceglie.
 * @param {number|null} redditoMese reddito presunto su cui il datore decide il mese
 * @param {number|null} redditoAnno reddito dell'anno, di questo passo (conguaglio)
 * @param {object} [settings]
 * @returns {{ soglia: number, sotto: { detrazione: number, ti: number },
 *   sopra: { detrazione: number, reddito: number },
 *   mese: 'sotto'|'sopra'|null, anno: 'sotto'|'sopra'|null }}
 *   La detrazione di sopra è quella al reddito (del mese, se no dell'anno) che
 *   sta sopra; se nessuno dei due, appena oltre la soglia.
 */
export function dueTasche(redditoMese, redditoAnno, settings = {}) {
  const T = fiscoDi(settings);
  const soglia = T.TI_SOGLIA_PIENO;
  const lato = (r) => (r == null || !Number.isFinite(r) ? null : r <= soglia ? 'sotto' : 'sopra');
  const redditoSopra = [redditoMese, redditoAnno].find((r) => lato(r) === 'sopra') ?? soglia + 1;
  return {
    soglia,
    sotto: { detrazione: detrazioneLavoro(soglia, T), ti: T.TI_MASSIMO },
    sopra: { detrazione: detrazioneLavoro(redditoSopra, T), reddito: redditoSopra },
    mese: lato(redditoMese),
    anno: lato(redditoAnno),
  };
}
