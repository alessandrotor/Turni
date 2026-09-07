// "Quanto manca" al limite del trattamento integrativo (bonus in busta paga).
// Versione essenziale: dato il reddito annuo, dice quanto si può ancora
// guadagnare prima di superare le soglie che fanno perdere il bonus.
// Valori 2026.
//
// Le soglie di legge (15.000 / 28.000) sono definite sul REDDITO COMPLESSIVO,
// cioè il lordo al netto dei contributi deducibili. Lo STATO si decide lì, con
// `redditoComplessivo` di net.js — la stessa identica funzione che usa il
// pannello del netto, così le due schermate non possono contraddirsi.
// L'utente però ragiona sul LORDO (è quello che somma dai turni), quindi il
// «quanto manca» resta in lordo: in quella grandezza le soglie valgono circa
// 16.518 € e 30.834 €, e si spostano col CCNL.
// Estensione esplicita: senza, Node puro non importa questo modulo e non si
// puo' scrivere uno script di riscontro — che infatti mancava.
import { redditoComplessivo, taxableToGross } from './net.js';

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
  // L'imponibile viene dalla STESSA funzione che usa il pannello del netto:
  // e' la garanzia che le due schermate non possano contraddirsi.
  const base = { income, thresholdFullGross, thresholdMaxGross, taxable: redditoComplessivo(income, settings) };

  if (income <= 0) {
    return { ...base, income: 0, taxable: 0, status: BONUS_STATUS.ATTESA, marginToFull: null, marginToMax: null, nearThreshold: false };
  }

  // LO STATO SI DECIDE SULL'IMPONIBILE, non sul lordo, ed è l'unico modo per
  // non contraddire `tiDecision`. Le due strade non sono l'inverso esatto
  // l'una dell'altra: convertire la soglia in lordo e convertire il reddito in
  // imponibile arrotondano in punti diversi, e restava una fascia di circa un
  // euro di lordo in cui questa funzione diceva «hai superato la soglia»
  // mentre il pannello del netto erogava ancora il bonus pieno. Un euro di
  // ampiezza, ma centrabile scrivendo il reddito a mano — e due schermate che
  // si contraddicono non sono più credibili nemmeno quando hanno ragione.
  // Le soglie in LORDO restano, ma solo per dire quanto manca: quella è la
  // grandezza che l'utente somma dai turni.
  //
  // I confronti seguono il testo alla lettera (D.L. 3/2020 art. 1 c. 1):
  // pieno se il reddito complessivo «non è superiore a 15.000», fascia ridotta
  // se «superiore a 15.000 ma non a 28.000», niente oltre.
  if (base.taxable > C.SOGLIA_BONUS_MAX) {
    return { ...base, status: BONUS_STATUS.OLTRE, marginToFull: null, marginToMax: null, nearThreshold: false };
  }

  if (base.taxable > C.SOGLIA_BONUS_PIENO) {
    const marginToMax = Math.max(0, thresholdMaxGross - income);
    return {
      ...base,
      status: BONUS_STATUS.PARZIALE,
      marginToFull: null,
      marginToMax,
      nearThreshold: marginToMax <= C.SOGLIA_AVVISO_VICINO,
    };
  }

  // Il margine non può essere negativo: nella fascia di scarto fra le due
  // conversioni il lordo può aver già passato la soglia tradotta mentre
  // l'imponibile no.
  const marginToFull = Math.max(0, thresholdFullGross - income);
  return {
    ...base,
    status: BONUS_STATUS.PIENO,
    marginToFull,
    marginToMax: thresholdMaxGross - income,
    nearThreshold: marginToFull <= C.SOGLIA_AVVISO_VICINO,
  };
}
