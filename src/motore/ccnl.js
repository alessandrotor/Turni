// Le regole del contratto scelto, lette da `contratti/`.
//
// Servono al motore per ciò che la sola paga oraria non dice: il divisore
// orario del mese, la mensilizzazione, le trattenute minori, la fascia
// notturna. Ogni contratto è un file in `contratti/`; quello che non dichiara
// vale la regola di legge (`LEGGE`).
//
// ATTENZIONE alla fedeltà dei dati: solo le voci con `verificato: true` sono
// state riscontrate su una busta paga reale. La UI deve dirlo.

import { CONTRATTI, LEGGE } from './contratti/index.js';

export const DEFAULT_MONTHLY_HOURS_FACTOR = LEGGE.monthlyHoursFactor;

// Le regole di un contratto, complete: i campi che non scrive valgono LEGGE.
function toPreset(entry) {
  return {
    ...LEGGE,
    ...entry,
    label: entry.nome || '',
    // Un factor mancante o non valido non deve azzerare la mensilità.
    monthlyHoursFactor: Number(entry.monthlyHoursFactor) || DEFAULT_MONTHLY_HOURS_FACTOR,
    mensilizzato: entry.mensilizzato === true,
    contributiExtra: Array.isArray(entry.contributiExtra) ? entry.contributiExtra : [],
    enteBilaterale: entry.enteBilaterale || null,
    ammortizzatori: entry.ammortizzatori || null,
    // Serve che ci siano ENTRAMBI gli estremi: mezza fascia non è una fascia.
    fasciaNotturna: (entry.fasciaNotturna?.inizio && entry.fasciaNotturna?.fine)
      ? { inizio: entry.fasciaNotturna.inizio, fine: entry.fasciaNotturna.fine }
      : null,
  };
}

/** Le regole del contratto `codice`; un codice sconosciuto vale la legge. */
export function getCcnl(codice) {
  return toPreset(CONTRATTI[codice] || { codice: codice || '' });
}

// Fattore ore mensili del contratto scelto (settimane retribuite al mese).
export function monthlyHoursFactor(settings = {}) {
  return getCcnl(settings.ccnl).monthlyHoursFactor || DEFAULT_MONTHLY_HOURS_FACTOR;
}

// Contratto MENSILIZZATO: la retribuzione è un importo fisso al mese, uguale in
// ogni mese dell'anno, e le ore contrattuali sono un numero fisso (24 × 4,3 =
// 103,20 per il Turismo part-time 60%) indipendente dai giorni di calendario.
// Le ore ordinarie pagate sono quel monte ore, comunque distribuite; il
// supplementare si conta a settimana (pay.js, check-supplementare-settimanale).
export function isMensilizzato(settings = {}) {
  return getCcnl(settings.ccnl).mensilizzato === true;
}

// Ore contrattuali di un mese: quelle che in busta stanno alla voce
// "Retribuzione" e che restano identiche mese dopo mese.
export function monthlyContractHours(settings = {}) {
  const weeklyHours = Math.max(0, Number(settings.expectedWeeklyHours) || 0);
  return weeklyHours * monthlyHoursFactor(settings);
}

// Ore FULL-TIME di un mese, stesso fattore di conversione delle ore
// contrattuali: è il divisore orario (172 nel Turismo, check-tabellare-turismo).
// NON è la soglia dello straordinario, che è settimanale (vedi pay.js).
export function monthlyFullTimeHours(settings = {}) {
  const weeklyHours = Math.max(0, Number(settings.fullTimeWeeklyHours) || 0);
  return weeklyHours * monthlyHoursFactor(settings);
}
