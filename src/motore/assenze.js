// Ferie, permessi e malattia: giorni che in busta contano ORE anche se non si è
// lavorato. Le «godute» del cedolino sono un montante progressivo dell'anno, non le
// assenze del periodo (serve la differenza fra due mesi). Vedi RILASCIO.md.
//
// Estensioni esplicite sugli import: il file resta importabile da Node puro.
import { dayNumber } from './date.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

export const TIPO = {
  LAVORO: 'lavoro',
  FERIE: 'ferie',
  PERMESSO: 'permesso',
  MALATTIA: 'malattia',
  // Festività non lavorata: giornata pagata e non lavorata, un giustificativo a sé
  // in busta. Il festivo LAVORATO resta di tipo LAVORO e prende la maggiorazione.
  FESTIVITA: 'festivita',
};

export const TIPI_ASSENZA = [TIPO.FERIE, TIPO.PERMESSO, TIPO.MALATTIA, TIPO.FESTIVITA];

export const ETICHETTA = {
  [TIPO.LAVORO]: 'Lavoro',
  [TIPO.FERIE]: 'Ferie',
  [TIPO.PERMESSO]: 'Permesso',
  [TIPO.MALATTIA]: 'Malattia',
  [TIPO.FESTIVITA]: 'Festività',
};

// Le icone dei tipi non stanno qui: sono interfaccia (ICONA_TIPO in components/Icona.jsx).

// I turni salvati senza `type` sono lavoro (nessuna migrazione). L'elenco arriva da
// TIPI_ASSENZA, così un tipo nuovo non torna «lavoro» in silenzio.
export function tipoTurno(shift) {
  const t = shift?.type;
  return TIPI_ASSENZA.includes(t) ? t : TIPO.LAVORO;
}

export function isAssenza(shift) {
  return tipoTurno(shift) !== TIPO.LAVORO;
}

// Giorni lavorativi a settimana su cui si spalma l'orario contrattuale (sei è il
// caso tipico del lavoro a turni); si cambia in Impostazioni.
export const GIORNI_LAVORATIVI_DEFAULT = 6;

/**
 * Ore che vale un giorno intero di assenza, in minuti.
 *
 * È il «tot di ore» del cedolino: ore settimanali / giorni lavorativi.
 * `absenceDailyHours` in Impostazioni lo sovrascrive (vuoto = calcolato).
 */
export function minutiGiornoAssenza(settings = {}) {
  const manuale = settings.absenceDailyHours;
  if (manuale !== '' && manuale != null && Number(manuale) > 0) {
    return Math.round(Number(manuale) * 60);
  }
  const settimanali = Math.max(0, Number(settings.expectedWeeklyHours) || 0);
  const giorni = Math.max(1, Number(settings.workingDaysPerWeek) || GIORNI_LAVORATIVI_DEFAULT);
  return Math.round((settimanali / giorni) * 60);
}

/**
 * Posizione (a partire da 1) di ogni giorno di malattia dentro il PROPRIO
 * evento. Un evento è una sequenza di giorni di malattia consecutivi: la
 * carenza si conta per evento, non per anno, quindi due influenze separate
 * hanno ciascuna i propri giorni iniziali.
 *
 * @returns {Map<string, number>} data ISO → giorno dell'evento
 */
export function giorniEventoMalattia(allShifts) {
  const date = [...new Set(
    (allShifts || []).filter(s => tipoTurno(s) === TIPO.MALATTIA).map(s => s.date),
  )].sort();

  const out = new Map();
  let pos = 0;
  let prevNum = null;
  for (const iso of date) {
    const n = dayNumber(iso);
    pos = (prevNum !== null && n - prevNum === 1) ? pos + 1 : 1;
    out.set(iso, pos);
    prevNum = n;
  }
  return out;
}

// Parametri della malattia, con i valori di ripiego. NON verificati su nessun
// cedolino: vanno corretti in Impostazioni con la busta sotto mano, e la UI lo dice.
export const MALATTIA_DEFAULT = {
  carenzaGiorni: 3,   // i primi giorni di ogni evento, a carico del CCNL o non pagati
  carenzaPct: 0,      // quanto si prende in quei giorni
  pct: 100,           // quanto si prende dal giorno successivo (INPS + integrazione)
};

/**
 * Percentuale della retribuzione oraria che spetta per un'assenza.
 *
 * Ferie e permessi valgono il 100%: in busta stanno dentro la retribuzione
 * ordinaria. Atteso, non ancora riscontrato su una busta: le assenze retribuite
 * riempiono il monte ore invece di aggiungersi.
 *
 * @param {object} shift
 * @param {Impostazioni} settings
 * @param {number} giornoEvento posizione del giorno nel suo evento di malattia
 *   (da `giorniEventoMalattia`); ignorato per ferie e permessi.
 */
export function percentualeAssenza(shift, settings = {}, giornoEvento = 0) {
  const t = tipoTurno(shift);
  if (t === TIPO.FERIE || t === TIPO.PERMESSO) return 100;
  if (t !== TIPO.MALATTIA) return 100;

  const num = (v, def) => (v === '' || v == null || !Number.isFinite(Number(v)) ? def : Number(v));
  const carenzaGiorni = num(settings.malattiaCarenzaGiorni, MALATTIA_DEFAULT.carenzaGiorni);
  const carenzaPct = num(settings.malattiaCarenzaPct, MALATTIA_DEFAULT.carenzaPct);
  const pct = num(settings.malattiaPct, MALATTIA_DEFAULT.pct);

  return giornoEvento > 0 && giornoEvento <= carenzaGiorni ? carenzaPct : pct;
}
