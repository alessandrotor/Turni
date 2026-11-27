// Assenze a periodo: da «dal … al …» alle singole giornate da creare.
//
// Non si creano N giorni uguali: il riposo settimanale e le festività non si consumano
// come ferie, e segnarli gonfia le ore del mese. Il NUMERO dei riposi lo dice il
// contratto, QUALE giorno lo storico (la domenica se non c'è storico). Il giorno tolto
// resta nell'elenco con scritto «riposo» e si rispunta. Le festività nazionali si
// propongono da sole dove non c'è un turno (festivita-non-lavorate.js). Una giornata
// vale le ore da contratto (`minutiGiornoAssenza`), non quelle di un turno.
//
// Riscontro: `node src/motore/riscontri/check-periodo-assenza.mjs`.

// Estensioni esplicite: senza, Node puro non importa il modulo.
import { isIsoDate, parseDate, formatDate, dayNumber } from './date.js';
import { isHoliday } from './holidays.js';
import { minutiGiornoAssenza, isAssenza, GIORNI_LAVORATIVI_DEFAULT } from './assenze.js';

// Turni sotto cui lo storico non dice niente: meno di quattro settimane da sei
// giorni, e un giorno vuoto può essere un caso.
const STORICO_MINIMO = 24;
// A parità di turni, prima la domenica e poi il sabato: è il riposo più comune.
const PREFERENZA = [0, 6, 1, 2, 3, 4, 5];

/**
 * I giorni della settimana (0 = domenica) di riposo: quanti sono lo dice il
 * contratto (7 meno i giorni lavorativi), quali lo storico. → check-periodo-assenza.mjs
 */
export function giorniDiRiposo(turni = [], settings = {}) {
  const lavorativi = Math.min(7, Math.max(1, Number(settings.workingDaysPerWeek) || GIORNI_LAVORATIVI_DEFAULT));
  const quanti = 7 - lavorativi;
  if (quanti === 0) return [];
  const date = new Set((turni || []).filter((t) => t?.date && !isAssenza(t)).map((t) => t.date));
  const conta = [0, 0, 0, 0, 0, 0, 0];
  for (const d of date) conta[parseDate(d).getDay()] += 1;
  if (date.size < STORICO_MINIMO) return PREFERENZA.slice(0, quanti);
  return [...PREFERENZA].sort((a, b) => conta[a] - conta[b] || PREFERENZA.indexOf(a) - PREFERENZA.indexOf(b)).slice(0, quanti);
}

// Tetto sulle giornate generabili in un colpo: una rete contro il refuso nell'anno
// (2026 scritto 2036), non una regola di contratto.
export const MAX_GIORNI_PERIODO = 366;

/**
 * Le date ISO comprese fra due estremi, estremi inclusi.
 *
 * Avanza con `setDate`, che ragiona sul CALENDARIO: sommare 24 ore sbaglierebbe
 * nei giorni di cambio d'ora legale.
 *
 * @returns {string[]} vuoto se le date non sono valide o se `al` precede `dal`
 */
export function giorniPeriodo(dal, al) {
  if (!isIsoDate(dal) || !isIsoDate(al)) return [];
  const quanti = dayNumber(al) - dayNumber(dal) + 1;
  if (quanti < 1) return [];

  const out = [];
  const cursore = parseDate(dal);
  for (let i = 0; i < Math.min(quanti, MAX_GIORNI_PERIODO); i++) {
    out.push(formatDate(cursore));
    cursore.setDate(cursore.getDate() + 1);
  }
  return out;
}

/**
 * Le giornate proposte per un periodo di assenza, da mostrare e correggere
 * prima di salvare.
 *
 * NON prende il tipo di assenza: ferie, permesso e malattia producono la stessa
 * proposta, e un parametro `tipo` inutilizzato lascerebbe credere a una differenza.
 *
 * @param {{dal?: string, al?: string, turni?: Array<any>, settings?: import('./impostazioni.js').Impostazioni}} [p]
 * @returns {Array<{data:string, minuti:number, turnoEsistente:object|null, selezionato:boolean}>}
 */
export function proponiPeriodo({ dal, al, turni = [], settings = {} } = {}) {
  const minuti = minutiGiornoAssenza(settings);

  // Primo turno per data: se un giorno ne ha più d'uno, quello sostituito è il
  // primo — ed è comunque un caso che l'elenco mostra, non nasconde.
  const perData = new Map();
  for (const t of turni || []) {
    if (t?.date && !perData.has(t.date)) perData.set(t.date, t);
  }

  const riposi = giorniDiRiposo(turni, settings);
  return giorniPeriodo(dal, al).map(data => {
    const festivita = isHoliday(data, settings);
    const riposo = !festivita && riposi.includes(parseDate(data).getDay());
    return { data, minuti, turnoEsistente: perData.get(data) || null, selezionato: !riposo && !festivita, riposo, festivita };
  });
}

/** Quante giornate e quanti minuti valgono le righe spuntate. */
export function totalePeriodo(righe) {
  const scelte = (righe || []).filter(r => r?.selezionato);
  return {
    giorni: scelte.length,
    minuti: scelte.reduce((somma, r) => somma + (Number(r.minuti) || 0), 0),
  };
}
