
/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */
// Contributi per gli ammortizzatori sociali (D.Lgs. 148/2015). NON sono parametri del CCNL:
// l'aliquota dipende da QUANTI DIPENDENTI ha l'azienda; del contratto dipende solo a quale
// fondo si è iscritti (`ammortizzatori`).
//
//   FIS  — 0,50% fino a 5 dipendenti, 0,80% oltre. Ripartito 2/3 azienda + 1/3 lavoratore.
//   CIGS — solo oltre i 15 dipendenti: 0,90% totale, di cui 0,30% a carico del lavoratore.
//
// Non modellata la riduzione del 40% sul FIS delle micro-imprese (dal 2025): dipende dalla
// storia dell'azienda, che il lavoratore non può verificare dalla busta.

// Fasce dimensionali: sono le soglie che contano per legge (5 e 15), non
// scaglioni scelti a piacere.
export const FASCE_DIPENDENTI = [
  { id: 'fino5', label: 'Fino a 5' },
  { id: 'da6a15', label: 'Da 6 a 15' },
  { id: 'oltre15', label: 'Oltre 15' },
];

// Default: oltre 15, la fascia delle due buste verificate e il valore che riproduce il
// comportamento precedente dell'app.
export const FASCIA_DEFAULT = 'oltre15';

const FIS_TOTALE = { fino5: 0.5, da6a15: 0.8, oltre15: 0.8 };
const QUOTA_LAVORATORE_FIS = 1 / 3;

const CIGS_LAVORATORE = 0.3;
const CIGS_DA_FASCIA = { fino5: false, da6a15: false, oltre15: true };

function fascia(settings = {}) {
  const f = settings.aziendaDipendenti;
  return FIS_TOTALE[f] !== undefined ? f : FASCIA_DEFAULT;
}

/**
 * Contributi di legge a carico del LAVORATORE, in percentuale sull'imponibile
 * previdenziale. Restituisce le stesse righe che prima stavano scritte a mano
 * nel CCNL, ma calcolate.
 *
 * L'aliquota FIS resta la divisione esatta (0,80 ÷ 3 = 0,2667%), come nella busta Turismo; i
 * servizi fiduciari usano 0,27% tondo (3 centesimi di scarto, nel suo riscontro).
 *
 * @param {Impostazioni} settings deve contenere `aziendaDipendenti`
 * @param {string|null} schema quale fondo si applica: 'fis' o null (non noto)
 * @returns {Array<{label: string, pct: number}>}
 */
export function contributiDiLegge(settings = {}, schema = null) {
  if (schema !== 'fis') return [];
  const f = fascia(settings);
  const righe = [];

  const fis = FIS_TOTALE[f] * QUOTA_LAVORATORE_FIS;
  if (fis > 0) righe.push({ label: 'FIS D.Lgs. 148/2015', pct: fis });

  if (CIGS_DA_FASCIA[f]) righe.push({ label: 'Contributo CIGS', pct: CIGS_LAVORATORE });

  return righe;
}
