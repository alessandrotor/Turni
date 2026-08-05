// Preset per Contratto Collettivo Nazionale di Lavoro.
//
// Servono al motore del netto per due cose che il solo dato "paga oraria" non
// può dire: le trattenute contributive minori (che variano da contratto a
// contratto) e il divisore orario mensile con cui si calcola la mensilità.
//
// I DATI vivono in `src/data/ccnl.json` — file human-readable, aggiornabile a
// mano o rigenerato con `node scripts/fetch-ccnl-catalog.mjs` (scarica l'elenco
// dei CCNL vigenti dall'archivio open data CNEL). Qui c'è solo la logica di
// lettura: ogni voce viene fusa sui DEFAULT, così una voce di solo catalogo
// (senza parametri di calcolo) non rompe il motore e ripiega su valori generici.
//
// ATTENZIONE alla fedeltà dei dati: solo le voci con `verificato: true` sono
// state riscontrate voce per voce su una busta paga reale. Le altre riportano
// aliquote di uso comune (o nulla): la UI deve dirlo, e chi ha la busta sotto
// mano deve poter correggere a mano.

import ccnlData from '../data/ccnl.json';

// Divisore orario generico, quando il contratto non ne indica uno: 52 settimane
// spalmate su 12 mesi.
export const DEFAULT_MONTHLY_HOURS_FACTOR = 52 / 12;

// Valori di ripiego per i campi che il motore del netto legge sempre.
const DEFAULTS = {
  label: '',
  verificato: false,
  monthlyHoursFactor: DEFAULT_MONTHLY_HOURS_FACTOR,
  contributiExtra: [],
  enteBilaterale: null,
};

// Normalizza una voce grezza del JSON in un preset completo e sicuro da usare.
function toPreset(entry) {
  return {
    ...DEFAULTS,
    ...entry,
    // Il JSON usa `nome`; il resto del codice si aspetta `label`.
    label: entry.label || entry.nome || DEFAULTS.label,
    // Un factor mancante o non valido non deve azzerare la mensilità.
    monthlyHoursFactor: Number(entry.monthlyHoursFactor) || DEFAULT_MONTHLY_HOURS_FACTOR,
    contributiExtra: Array.isArray(entry.contributiExtra) ? entry.contributiExtra : [],
    enteBilaterale: entry.enteBilaterale || null,
  };
}

// Lista completa (per il selettore) e mappa per codice (per il lookup).
export const CCNL_LIST = ccnlData.map(toPreset);

export const CCNL_PRESETS = CCNL_LIST.reduce((acc, c) => {
  acc[c.codice] = c;
  return acc;
}, {});

export function getCcnl(key) {
  return CCNL_PRESETS[key] || CCNL_PRESETS[''] || toPreset({ codice: '' });
}

// Fattore ore mensili del contratto scelto (settimane retribuite al mese).
export function monthlyHoursFactor(settings = {}) {
  return getCcnl(settings.ccnl).monthlyHoursFactor || DEFAULT_MONTHLY_HOURS_FACTOR;
}
