// Preset per Contratto Collettivo Nazionale di Lavoro.
//
// Servono al motore del netto per due cose che il solo dato "paga oraria" non
// può dire: le trattenute contributive minori (che variano da contratto a
// contratto) e il divisore orario mensile con cui si calcola la mensilità.
//
// ATTENZIONE alla fedeltà dei dati: solo `turismo` è stato verificato voce per
// voce su una busta paga reale (LUL Zucchetti, giugno 2026). Gli altri preset
// riportano le aliquote di uso comune ma NON sono stati riscontrati: la UI deve
// dirlo, e chi ha la busta sotto mano deve poter correggere a mano.

// Divisore orario generico, quando il contratto non ne indica uno: 52 settimane
// spalmate su 12 mesi.
export const DEFAULT_MONTHLY_HOURS_FACTOR = 52 / 12;

export const CCNL_PRESETS = {
  '': {
    label: '— Nessuno / non lo so —',
    verificato: false,
    monthlyHoursFactor: DEFAULT_MONTHLY_HOURS_FACTOR,
    contributiExtra: [],
    enteBilaterale: null,
  },

  turismo: {
    label: 'Turismo / Pubblici esercizi',
    verificato: true,
    // Divisore 172 su 40 ore settimanali: 24 h/sett a part-time danno le 103,20
    // ore mensili che compaiono in busta.
    monthlyHoursFactor: 4.3,
    contributiExtra: [
      { label: 'FIS D.Lgs. 148/2015', pct: 0.26667 },
      { label: 'Contributo CIGS', pct: 0.3 },
    ],
    enteBilaterale: {
      label: 'Ente Bilaterale Turismo',
      pct: 0.2,
      quotaDitta: 0.2,
    },
  },

  commercio: {
    label: 'Commercio / Terziario (Confcommercio)',
    verificato: false,
    monthlyHoursFactor: 4.3,
    contributiExtra: [
      { label: 'FIS D.Lgs. 148/2015', pct: 0.26667 },
    ],
    enteBilaterale: {
      label: 'Ente Bilaterale Terziario',
      pct: 0.1,
      quotaDitta: 0.2,
    },
  },

  metalmeccanico: {
    label: 'Metalmeccanico industria',
    verificato: false,
    monthlyHoursFactor: DEFAULT_MONTHLY_HOURS_FACTOR,
    contributiExtra: [],
    enteBilaterale: null,
  },
};

export function getCcnl(key) {
  return CCNL_PRESETS[key] || CCNL_PRESETS[''];
}

// Fattore ore mensili del contratto scelto (settimane retribuite al mese).
export function monthlyHoursFactor(settings = {}) {
  return getCcnl(settings.ccnl).monthlyHoursFactor || DEFAULT_MONTHLY_HOURS_FACTOR;
}
