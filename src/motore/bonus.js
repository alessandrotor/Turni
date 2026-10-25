// «Quanto manca» al limite del trattamento integrativo (bonus in busta): dato il
// reddito annuo, quanto si può ancora guadagnare prima delle soglie (valori 2026).
//
// Lo STATO si decide sul REDDITO COMPLESSIVO con `redditoComplessivo` di net.js, la
// stessa funzione del pannello del netto. Il «quanto manca» resta in LORDO, che è
// ciò che l'utente somma dai turni, e le soglie in lordo si spostano col CCNL.
// Estensione esplicita: senza, Node puro non importa questo modulo.
import { redditoComplessivo } from './net.js';
import { lordoPerReddito } from './soglia-lorda.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

export const BONUS_CONST = {
  SOGLIA_BONUS_PIENO: 15000, // imponibile: fino a qui bonus pieno (1200€)
  SOGLIA_BONUS_MAX: 28000,   // imponibile: oltre questa soglia il bonus non spetta
  SOGLIA_AVVISO_VICINO: 1000, // soglia di "attenzione, sei vicino" (in lordo)
  BONUS_MASSIMO: 1200,
};

export const BONUS_STATUS = {
  ATTESA: 'attesa',   // nessun reddito inserito
  PIENO: 'pieno',     // sotto i 15.000
  PARZIALE: 'parziale', // tra 15.000 e 28.000
  OLTRE: 'oltre',     // sopra i 28.000
};

/**
 * Calcola i margini rispetto alle soglie del bonus.
 * @param {number} annualIncome reddito annuo LORDO complessivo
 * @param {Impostazioni} settings serve il CCNL: con i contributi minori l'aliquota
 *   deducibile sale e le soglie in lordo si spostano di qualche decina di euro
 * @returns margini e soglie espressi in LORDO (coerenti con `income`)
 */
/**
 * Il margine convertito in ORE, l'unità in cui si ragiona davvero, con la
 * maggiorazione dei SUPPLEMENTARI.
 *
 * Restituisce `null` senza paga oraria: meglio non dire le ore che dirne zero.
 */
export function margineInOre(margineLordo, settings = {}) {
  const paga = Number(settings.hourlyRate) || 0;
  if (paga <= 0 || !(Number(margineLordo) > 0)) return null;
  const magg = Number.isFinite(Number(settings.overtimeSurchargePct))
    ? Number(settings.overtimeSurchargePct) : 0;
  const oraPiena = paga * (1 + magg / 100);
  if (oraPiena <= 0) return null;
  return Math.floor(Number(margineLordo) / oraPiena);
}

export function calcBonusMargin(annualIncome, settings = {}) {
  const C = BONUS_CONST;
  const income = Math.max(0, Number(annualIncome) || 0);
  // Soglie di legge in lordo, dalla stessa ricerca del popup (`lordoPerReddito`).
  const thresholdFullGross = lordoPerReddito(C.SOGLIA_BONUS_PIENO, settings);
  const thresholdMaxGross = lordoPerReddito(C.SOGLIA_BONUS_MAX, settings);
  // L'imponibile viene dalla stessa funzione del pannello del netto.
  const base = { income, thresholdFullGross, thresholdMaxGross, taxable: redditoComplessivo(income, settings) };

  if (income <= 0) {
    return { ...base, income: 0, taxable: 0, status: BONUS_STATUS.ATTESA, marginToFull: null, marginToMax: null, oreResidue: null, nearThreshold: false };
  }

  // LO STATO SI DECIDE SULL'IMPONIBILE, non sul lordo, per non contraddire
  // `tiDecision`: convertire soglia e reddito arrotonda in punti diversi. Le soglie in
  // LORDO servono solo per dire quanto manca.
  // Confronti alla lettera del D.L. 3/2020 art. 1 c. 1: pieno se «non superiore a
  // 15.000», ridotto se «superiore a 15.000 ma non a 28.000», niente oltre.
  if (base.taxable > C.SOGLIA_BONUS_MAX) {
    return { ...base, status: BONUS_STATUS.OLTRE, marginToFull: null, marginToMax: null, oreResidue: null, nearThreshold: false };
  }

  if (base.taxable > C.SOGLIA_BONUS_PIENO) {
    const marginToMax = Math.max(0, thresholdMaxGross - income);
    return {
      ...base,
      status: BONUS_STATUS.PARZIALE,
      marginToFull: null,
      marginToMax,
      oreResidue: margineInOre(marginToMax, settings),
      nearThreshold: marginToMax <= C.SOGLIA_AVVISO_VICINO,
    };
  }

  // Il margine non può essere negativo (scarto fra le due conversioni).
  const marginToFull = Math.max(0, thresholdFullGross - income);
  return {
    ...base,
    status: BONUS_STATUS.PIENO,
    marginToFull,
    marginToMax: thresholdMaxGross - income,
    oreResidue: margineInOre(marginToFull, settings),
    nearThreshold: marginToFull <= C.SOGLIA_AVVISO_VICINO,
  };
}
