// LA PORTA DEL MOTORE: quello che un'altra app importa.
//
//   import { calcolaMese } from './motore/index.js';
//
// Una funzione per la domanda di tutti i giorni — quanto vale questo mese —
// coi suoi ingressi divisi per natura: il contratto, il lavoratore, il
// periodo, il programma paghe, la data di oggi. Il fisco dell'anno lo sceglie
// il motore (`fisco/`). Sotto, le funzioni di sempre per chi vuole i pezzi.
// Come aggiungere un contratto, un anno o un programma paghe: LEGGIMI.md.

import { computePayByShift, calcTotalPay, lordoTurno } from './pay.js';
import { lordoDelMese, projectAnnualIncome, computeAnnualGrossFromShifts } from './net.js';
import { capienzaProgressiva } from './capienza.js';
import { progressiviDellAnno, stimaConguaglio } from './conguaglio.js';
import { nettoDelMeseConPremio } from './premio-risultato.js';
import { getDaysInMonth, richiediOggi } from './date.js';
import { CONTRATTI } from './contratti/index.js';
import { fiscoDellAnno } from './fisco/index.js';

/**
 * Dagli ingressi del motore alle impostazioni che le sue funzioni leggono.
 * È l'unico punto in cui i nomi di qui incontrano quelli interni: chi legge
 * questa tabella sa cosa ogni campo fa, senza aprire il resto.
 *
 * @param {object} p
 * @param {string} p.contratto codice di un file in `contratti/` ('' = legge)
 * @param {object} p.lavoratore
 * @param {number} p.lavoratore.pagaOraria € lordi all'ora
 * @param {number} p.lavoratore.oreSettimanali ore del contratto
 * @param {number} [p.lavoratore.oreTempoPieno=40] soglia dello straordinario
 * @param {number} [p.lavoratore.giorniLavorativi=6] giorni della settimana di lavoro
 * @param {string} [p.lavoratore.assunzione] 'YYYY-MM-DD'
 * @param {boolean} [p.lavoratore.tredicesima] @param {boolean} [p.lavoratore.quattordicesima]
 * @param {object} [p.lavoratore.maggiorazioni] percentuali IN PIÙ: supplementare,
 *   straordinario, domenicale, festivo, notturno
 * @param {object} [p.lavoratore.addizionali] { regionale, comunale } in %
 * @param {number} [p.lavoratore.fondoPensionePct] @param {number} [p.lavoratore.cassaSanitariaEuro]
 * @param {object} [p.lavoratore.montante] { importo, fino: 'YYYY-MM-DD' } lordo dell'anno già pagato
 * @param {string} [p.programmaPaghe] codice di un file in `programmi-paghe/`
 * @param {object} [p.altro] impostazioni interne passate così come sono
 */
export function impostazioniDa({ contratto = '', lavoratore = {}, programmaPaghe, altro = {} }) {
  const l = lavoratore;
  const m = l.maggiorazioni || {};
  return {
    ccnl: contratto,
    hourlyRate: l.pagaOraria,
    expectedWeeklyHours: l.oreSettimanali,
    fullTimeWeeklyHours: l.oreTempoPieno ?? 40,
    workingDaysPerWeek: l.giorniLavorativi ?? 6,
    hireDate: l.assunzione,
    hasTredicesima: !!l.tredicesima,
    hasQuattordicesima: !!l.quattordicesima,
    overtimeSurchargePct: m.supplementare ?? 0,
    straordinarioSurchargePct: m.straordinario ?? '',
    sundaySurchargePct: m.domenicale ?? 0,
    holidaySurchargePct: m.festivo ?? 0,
    nightSurchargePct: m.notturno ?? 0,
    addRegionalePct: l.addizionali?.regionale,
    addComunalePct: l.addizionali?.comunale,
    fondoPensionePct: l.fondoPensionePct,
    cassaSanitariaEuro: l.cassaSanitariaEuro,
    priorTaxableIncome: l.montante?.importo,
    priorIncomeDate: l.montante?.fino,
    periodoConteggio: 'calendario',
    programmaPaghe,
    ...altro,
  };
}

/**
 * Quanto vale un mese: paga dei turni, lordo, netto.
 *
 * @param {object} p ingressi di `impostazioniDa`, più:
 * @param {{anno:number, mese:number, turni:Array}} p.periodo `mese` da 0 a 11;
 *   `turni` di tutto l'anno (le settimane a cavallo e il progressivo li usano)
 * @param {Date} p.oggi la data di oggi: il motore non legge l'orologio
 * @returns {{paga:object, lordo:object, netto:object, impostazioni:object}}
 */
export function calcolaMese({ periodo, oggi, ...ingressi }) {
  richiediOggi(oggi, 'calcolaMese');
  const { anno, mese, turni = [] } = periodo;
  const impostazioni = impostazioniDa(ingressi);
  const payMap = computePayByShift(turni, impostazioni);
  const chiave = `${anno}-${String(mese + 1).padStart(2, '0')}`;
  const delMese = turni.filter((t) => String(t.date).startsWith(chiave));
  const paga = calcTotalPay(delMese, impostazioni, turni, payMap);
  const lordo = lordoDelMese(paga?.total, anno, mese, impostazioni);
  const progressivo = progressiviDellAnno({ anno, allShifts: turni, settings: impostazioni, payMap, oggi })[mese];
  const capienza = capienzaProgressiva(lordo.lordo - lordo.premioMese, impostazioni, progressivo);
  const netto = nettoDelMeseConPremio(lordo, impostazioni, getDaysInMonth(anno, mese), anno, capienza);
  return { paga, lordo, netto, impostazioni };
}

// I pezzi, per chi li vuole uno per uno.
export {
  computePayByShift, calcTotalPay, lordoTurno, lordoDelMese, projectAnnualIncome,
  computeAnnualGrossFromShifts, stimaConguaglio, CONTRATTI, fiscoDellAnno,
};
