// Contributi per gli ammortizzatori sociali (D.Lgs. 148/2015).
//
// NON sono parametri del CCNL, e per un po' l'app li ha trattati come se lo
// fossero: FIS e CIGS stavano dentro `contributiExtra` di quattro contratti,
// come se ogni CCNL avesse la sua aliquota. Non è così — l'aliquota dipende da
// QUANTI DIPENDENTI ha l'azienda. Un bar con quattro persone e una catena con
// duecento applicano lo stesso CCNL Turismo e pagano contributi diversi.
//
// Del contratto dipende una cosa sola: a QUALE fondo si è iscritti. Le aziende
// industriali stanno sotto CIGO, l'artigianato sotto FSBA, il terziario e i
// servizi sotto il FIS. Quel dato resta nel CCNL (`ammortizzatori`); le
// aliquote stanno qui.
//
// Aliquote riscontrate su fonti INPS/di categoria (agosto 2026):
//
//   FIS  — contributo ordinario 0,50% fino a 5 dipendenti in media nel
//          semestre, 0,80% oltre i 5. Ripartito 2/3 azienda + 1/3 lavoratore.
//   CIGS — solo oltre i 15 dipendenti: 0,90% totale, di cui 0,30% a carico del
//          lavoratore, sull'imponibile previdenziale.
//
// NON modellata la riduzione del 40% sul FIS delle micro-imprese (0,50% →
// 0,30%) introdotta dal 2025: spetta solo a chi non ha chiesto assegni di
// integrazione per almeno 24 mesi, cioè dipende dalla storia dell'azienda —
// un dato che il lavoratore non ha e non può verificare dalla busta.

// Fasce dimensionali: sono le soglie che contano per legge (5 e 15), non
// scaglioni scelti a piacere.
export const FASCE_DIPENDENTI = [
  { id: 'fino5', label: 'Fino a 5' },
  { id: 'da6a15', label: 'Da 6 a 15' },
  { id: 'oltre15', label: 'Oltre 15' },
];

// Default: oltre 15. È la fascia delle due buste verificate (turismo e servizi
// fiduciari pagano entrambe FIS e CIGS), ed è anche il valore che riproduce il
// comportamento precedente dell'app — cambiare il default sposterebbe i numeri
// già visti da chi usa l'app oggi.
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
 * L'aliquota FIS resta la divisione esatta (0,80 ÷ 3 = 0,2667%): è così che la
 * calcola la busta Turismo verificata. La busta dei servizi fiduciari usa
 * invece 0,27% tondo — stesso contributo, arrotondamento del gestionale paghe,
 * e da lì nascono i 3 centesimi di scarto documentati nel suo riscontro.
 *
 * @param {object} settings deve contenere `aziendaDipendenti`
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
