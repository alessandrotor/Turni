// LE ORE DI OGNI SETTIMANA del calendario del mese, e quante stanno oltre il
// contratto. Novembre 2026: «vorrei vedere la somma delle ore della
// settimana». E il supplementare si conta proprio a settimana (lun–dom, oltre
// le ore del contratto: check-supplementare-settimanale.mjs), quindi il «+15»
// accanto a una settimana dice perché quella settimana ha pagato di più.
//
// Non si conta niente di nuovo: le ore sono quelle dei turni, quelle oltre il
// contratto sono le supplementari e straordinarie che `computePayByShift` ha
// già assegnato ai turni. Una settimana a cavallo di due mesi si conta intera,
// coi giorni dell'altro mese: è la settimana del supplementare.
// → src/motore/riscontri/check-settimane.mjs

import { calcShiftMinutes } from './pay.js';
import { tipoTurno, TIPO } from './assenze.js';
import { formatDate } from './date.js';

/**
 * Una voce per riga del calendario del mese (settimane da lunedì).
 * @param {number} anno @param {number} mese indice 0-11
 * @param {Array<any>} turni tutti i turni (servono i giorni dell'altro mese)
 * @param {Record<string, any>|null} mappa uscita di `computePayByShift`
 * @returns {Array<{ dal: string, al: string, minuti: number, oltreMinuti: number }>}
 *   `minuti`: turni e assenze pagate della settimana, senza le festività non
 *   lavorate (non riempiono le ore del contratto); `oltreMinuti`: supplementari
 *   più straordinarie.
 */
export function settimaneDelMese(anno, mese, turni = [], mappa = null) {
  const primo = new Date(anno, mese, 1);
  const scarto = (primo.getDay() + 6) % 7;
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const righe = Math.ceil((scarto + giorniMese) / 7);
  const esito = [];
  for (let r = 0; r < righe; r += 1) {
    const lunedi = new Date(anno, mese, 1 - scarto + r * 7);
    const domenica = new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() + 6);
    const dal = formatDate(lunedi);
    const al = formatDate(domenica);
    let minuti = 0;
    let oltreMinuti = 0;
    for (const t of turni) {
      if (t.date < dal || t.date > al || tipoTurno(t) === TIPO.FESTIVITA) continue;
      minuti += calcShiftMinutes(t);
      const v = mappa?.[t.id];
      if (v) oltreMinuti += (v.overtimeMinutes || 0) + (v.straordinarioMinutes || 0);
    }
    esito.push({ dal, al, minuti, oltreMinuti });
  }
  return esito;
}
