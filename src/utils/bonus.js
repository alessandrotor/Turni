// "Quanto manca" al limite del trattamento integrativo (bonus in busta paga).
// Versione essenziale: dato il reddito annuo, dice quanto si può ancora
// guadagnare prima di superare le soglie che fanno perdere il bonus.
// Valori 2026.

export const BONUS_CONST = {
  SOGLIA_BONUS_PIENO: 15000, // fino a qui bonus pieno (1200€)
  SOGLIA_BONUS_MAX: 28000,   // oltre questa soglia il bonus non spetta
  SOGLIA_AVVISO_VICINO: 1000, // soglia di "attenzione, sei vicino"
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
 * @param {number} annualIncome reddito annuo lordo complessivo
 */
export function calcBonusMargin(annualIncome) {
  const C = BONUS_CONST;
  const income = Math.max(0, Number(annualIncome) || 0);

  if (income <= 0) {
    return { income: 0, status: BONUS_STATUS.ATTESA, marginToFull: null, marginToMax: null, nearThreshold: false };
  }

  if (income >= C.SOGLIA_BONUS_MAX) {
    return { income, status: BONUS_STATUS.OLTRE, marginToFull: null, marginToMax: null, nearThreshold: false };
  }

  if (income >= C.SOGLIA_BONUS_PIENO) {
    return {
      income,
      status: BONUS_STATUS.PARZIALE,
      marginToFull: null,
      marginToMax: C.SOGLIA_BONUS_MAX - income,
      nearThreshold: (C.SOGLIA_BONUS_MAX - income) <= C.SOGLIA_AVVISO_VICINO,
    };
  }

  const marginToFull = C.SOGLIA_BONUS_PIENO - income;
  return {
    income,
    status: BONUS_STATUS.PIENO,
    marginToFull,
    marginToMax: C.SOGLIA_BONUS_MAX - income,
    nearThreshold: marginToFull <= C.SOGLIA_AVVISO_VICINO,
  };
}
