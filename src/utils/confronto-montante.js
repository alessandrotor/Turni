// Il montante torna coi turni segnati? Solo se il confronto ha senso.
//
//   node scripts/check-confronto-montante.mjs
//
// Il montante è l'imponibile INPS dei progressivi: TUTTO il lordo da gennaio al mese scelto (turni,
// ferie, voci fisse, premi, 14ª). Confrontarlo con i soli turni gridava «non torna» a chi i mesi
// passati non li ha segnati. Si confronta solo quando OGNI mese coperto ha dei turni, e col lordo
// del mese del motore (`lordoDelMese`).
//
// Modulo puro, senza React e senza browser.

import { calcTotalPay } from '../motore/pay.js';
import { lordoDelMese } from '../motore/net.js';

/** Scarto oltre il quale si avvisa: 500 € o il 30%, come prima. */
export function scartoRilevante(montante, turni) {
  return Math.abs(montante - turni) > Math.max(500, 0.30 * turni);
}

/**
 * @returns {null | { lordoTurni:number, mesi:number, scarto:number, avvisa:boolean }}
 *   `null` quando il confronto non ha senso: niente montante in quest'anno, o
 *   almeno un mese coperto senza turni segnati.
 */
export function confrontoMontante({ anno, settings = {}, allShifts = [], payMap = null }) {
  const montante = Number(settings.priorTaxableIncome) || 0;
  const fino = String(settings.priorIncomeDate || '').slice(0, 7);
  if (!(montante > 0) || fino.slice(0, 4) !== String(anno)) return null;
  const ultimo = Number(fino.slice(5, 7)) - 1;

  const assunto = String(settings.hireDate || '');
  const primo = /^\d{4}-\d{2}/.test(assunto) && Number(assunto.slice(0, 4)) === anno
    ? Number(assunto.slice(5, 7)) - 1 : 0;
  if (Number(assunto.slice(0, 4)) > anno) return null;

  let lordoTurni = 0;
  for (let m = primo; m <= ultimo; m += 1) {
    const chiave = `${anno}-${String(m + 1).padStart(2, '0')}`;
    const turni = allShifts.filter((s) => String(s.date).slice(0, 7) === chiave);
    // Un mese senza turni non è un mese a zero: è un mese non segnato.
    if (turni.length === 0) return null;
    const paga = calcTotalPay(turni, settings, allShifts, payMap)?.total || 0;
    lordoTurni += lordoDelMese(paga, anno, m, settings).lordo;
  }
  const scarto = montante - lordoTurni;
  return { lordoTurni, mesi: ultimo - primo + 1, scarto, avvisa: scartoRilevante(montante, lordoTurni) };
}
