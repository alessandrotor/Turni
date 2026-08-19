// "Quanto manca" al limite del trattamento integrativo (bonus in busta paga).
// Versione essenziale: dato il reddito annuo, dice quanto si può ancora
// guadagnare prima di superare le soglie che fanno perdere il bonus.
// Valori 2026.
//
// Le soglie di legge (15.000 / 28.000) sono definite sul REDDITO COMPLESSIVO,
// cioè il lordo al netto dei contributi IVS — la stessa base che usa
// `tiDecision` in net.js. L'utente però ragiona sul LORDO (è quello che somma
// dai turni): qui si converte, così le due schermate non si contraddicono più.
// In lordo le soglie valgono circa 16.518 € e 30.834 €.
// Estensione esplicita: senza, Node puro non importa questo modulo e non si
// puo' scrivere uno script di riscontro — che infatti mancava.
import { grossToTaxable, taxableToGross } from './net.js';

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
 * @param {object} settings serve il CCNL: con i contributi minori l'aliquota
 *   deducibile sale e le soglie in lordo si spostano di qualche decina di euro
 * @returns margini e soglie espressi in LORDO (coerenti con `income`)
 */
export function calcBonusMargin(annualIncome, settings = {}) {
  const C = BONUS_CONST;
  const income = Math.max(0, Number(annualIncome) || 0);
  // Soglie di legge riportate in lordo, per poterle confrontare con `income`.
  const thresholdFullGross = taxableToGross(C.SOGLIA_BONUS_PIENO, settings);
  const thresholdMaxGross = taxableToGross(C.SOGLIA_BONUS_MAX, settings);
  const base = { income, thresholdFullGross, thresholdMaxGross, taxable: grossToTaxable(income, settings) };

  if (income <= 0) {
    return { ...base, income: 0, taxable: 0, status: BONUS_STATUS.ATTESA, marginToFull: null, marginToMax: null, nearThreshold: false };
  }

  if (income >= thresholdMaxGross) {
    return { ...base, status: BONUS_STATUS.OLTRE, marginToFull: null, marginToMax: null, nearThreshold: false };
  }

  if (income >= thresholdFullGross) {
    return {
      ...base,
      status: BONUS_STATUS.PARZIALE,
      marginToFull: null,
      marginToMax: thresholdMaxGross - income,
      nearThreshold: (thresholdMaxGross - income) <= C.SOGLIA_AVVISO_VICINO,
    };
  }

  const marginToFull = thresholdFullGross - income;
  return {
    ...base,
    status: BONUS_STATUS.PIENO,
    marginToFull,
    marginToMax: thresholdMaxGross - income,
    nearThreshold: marginToFull <= C.SOGLIA_AVVISO_VICINO,
  };
}
