// IL FISCO, un file per anno, una riga qui sotto.
//
// Per AGGIUNGERE un anno: copia `2026.js` in `2027.js`, cambia i valori,
// aggiungi la sua riga in `ANNI`. Per TOGLIERLO: cancella riga e file.
//
// COME ARRIVA AI CALCOLI: chi conosce l'anno (il netto del mese, il
// conguaglio, la proiezione, `calcolaMese`) mette la tabella nelle
// impostazioni del calcolo con `conFisco()`, e le funzioni la leggono con
// `fiscoDi()`. Chi non dice l'anno ha l'ultimo anno noto.

import fisco2026 from './2026.js';

const ANNI = [fisco2026].sort((a, b) => a.anno - b.anno);

/** La tabella dell'anno, o quella dell'ultimo anno noto prima di lui. */
export function fiscoDellAnno(anno) {
  return [...ANNI].reverse().find((f) => f.anno <= anno) || ANNI[0];
}

export const TAX_2026 = fiscoDellAnno(2026);

/** L'ultimo anno noto: per chi non dice l'anno. */
export const FISCO_ULTIMO = ANNI[ANNI.length - 1];

/** La tabella delle impostazioni del calcolo, o l'ultima nota. */
export function fiscoDi(impostazioni) {
  return impostazioni?.fisco || FISCO_ULTIMO;
}

/** Le impostazioni del calcolo con la tabella dell'anno `anno`. */
export function conFisco(impostazioni, anno) {
  return Number.isInteger(anno) ? { ...impostazioni, fisco: fiscoDellAnno(anno) } : impostazioni;
}

// L'imposta sostitutiva sui PREMI DI RISULTATO: 1% nel 2026 e nel 2027
// (L. 30 dicembre 2025 n. 199, art. 1 c. 9), 5% negli altri anni.
// Un periodo nuovo è una riga.
const PREMI_DI_RISULTATO = [
  { dal: 2026, al: 2027, aliquota: 0.01 },
];
const PREMIO_DI_LEGGE = 0.05;

/** Aliquota dell'imposta sostitutiva sui premi di risultato nell'anno. */
export function aliquotaPremio(anno) {
  return PREMI_DI_RISULTATO.find((p) => anno >= p.dal && anno <= p.al)?.aliquota ?? PREMIO_DI_LEGGE;
}
