// Preset per Contratto Collettivo Nazionale di Lavoro.
//
// Servono al motore del netto per due cose che il solo dato "paga oraria" non
// può dire: le trattenute contributive minori (che variano da contratto a
// contratto) e il divisore orario mensile con cui si calcola la mensilità.
//
// I DATI vivono in `src/data/ccnl.json` — file human-readable, aggiornabile a
// mano o rigenerato con `npm run ccnl:aggiorna` (script `scripts/scarica-ccnl.mjs`,
// scarica l'elenco dei CCNL vigenti dall'archivio open data CNEL). Qui c'è solo la logica di
// lettura: ogni voce viene fusa sui DEFAULT, così una voce di solo catalogo
// (senza parametri di calcolo) non rompe il motore e ripiega su valori generici.
//
// ATTENZIONE alla fedeltà dei dati: solo le voci con `verificato: true` sono
// state riscontrate voce per voce su una busta paga reale. Le altre riportano
// aliquote di uso comune (o nulla): la UI deve dirlo, e chi ha la busta sotto
// mano deve poter correggere a mano.

// L'attributo `with { type: 'json' }` non serve al bundler ma sì a Node puro:
// senza, `scripts/check-busta-giugno-2026.mjs` non riesce più a importare il
// motore (ERR_IMPORT_ATTRIBUTE_MISSING).
import ccnlData from '../data/ccnl.json' with { type: 'json' };

// Divisore orario generico, quando il contratto non ne indica uno: 52 settimane
// spalmate su 12 mesi.
export const DEFAULT_MONTHLY_HOURS_FACTOR = 52 / 12;

// Valori di ripiego per i campi che il motore del netto legge sempre.
const DEFAULTS = {
  label: '',
  verificato: false,
  monthlyHoursFactor: DEFAULT_MONTHLY_HOURS_FACTOR,
  mensilizzato: false,
  contributiExtra: [],
  enteBilaterale: null,
  // A quale fondo per gli ammortizzatori sociali è iscritto il settore ('fis',
  // oppure null se non lo sappiamo). Le ALIQUOTE non stanno qui: dipendono
  // dalla dimensione dell'azienda, non dal contratto — vedi contributi-legge.js.
  ammortizzatori: null,
  // Estremi della fascia notturna, quando il contratto se ne discosta dalla
  // definizione di legge (22:00–06:00 del D.Lgs. 66/2003). `null` = vale la
  // legge. La PERCENTUALE non sta qui: dipende dalla classificazione del
  // lavoratore, non dal contratto, ed è un'impostazione dell'utente.
  fasciaNotturna: null,
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
    mensilizzato: entry.mensilizzato === true,
    contributiExtra: Array.isArray(entry.contributiExtra) ? entry.contributiExtra : [],
    enteBilaterale: entry.enteBilaterale || null,
    ammortizzatori: entry.ammortizzatori || null,
    // Serve che ci siano ENTRAMBI gli estremi: mezza fascia non è una fascia,
    // e ripiegare in silenzio su un estremo di legge e uno di contratto darebbe
    // una finestra che non esiste in nessun contratto.
    fasciaNotturna: (entry.fasciaNotturna?.inizio && entry.fasciaNotturna?.fine)
      ? { inizio: entry.fasciaNotturna.inizio, fine: entry.fasciaNotturna.fine }
      : null,
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

// Contratto MENSILIZZATO: la retribuzione è un importo fisso al mese, uguale in
// ogni mese dell'anno, e le ore contrattuali sono un numero fisso (24 × 4,3 =
// 103,20 per il Turismo part-time 60%) indipendente dai giorni di calendario.
// Due conseguenze, entrambe riscontrate sulle buste reali di giugno e luglio
// 2026 (`scripts/check-mese-paga-2026.mjs`):
//  - il supplementare si conta sull'eccedenza MENSILE, non su quella settimanale;
//  - il mese di paga è fatto di settimane intere (vedi payrollMonthKey).
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
// contrattuali: soglia oltre la quale le ore eccedenti diventano
// straordinarie invece che supplementari (vedi computePayByShift in pay.js).
export function monthlyFullTimeHours(settings = {}) {
  const weeklyHours = Math.max(0, Number(settings.fullTimeWeeklyHours) || 0);
  return weeklyHours * monthlyHoursFactor(settings);
}
