// Ferie, permessi e malattia: giorni che in busta paga contano ORE anche se
// non si è lavorato. Senza di loro le ore dell'app restano sotto quelle del
// cedolino, ed è esattamente lo scarto che si vede confrontando le due colonne
// (la busta di luglio 2026 riporta 5,50 ore di ferie e 4,50 di permessi
// «godute», che nell'app non esistevano come turni).
//
// Estensioni esplicite sugli import: come negli altri moduli di `utils/`, così
// il file resta importabile da Node puro per i riscontri in `scripts/`.
import { dayNumber } from './dates.js';

export const TIPO = {
  LAVORO: 'lavoro',
  FERIE: 'ferie',
  PERMESSO: 'permesso',
  MALATTIA: 'malattia',
  // Festività non lavorata: una giornata che NON si lavora ma viene pagata.
  // In busta compare come giustificativo a sé («GO Festivita'», verificato su
  // un cedolino di agosto) e vale le ore di una giornata di contratto.
  // Da non confondere con il festivo LAVORATO, che è un turno normale e prende
  // la maggiorazione festiva: quello resta di tipo LAVORO.
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

export const ICONA = {
  [TIPO.LAVORO]: '',
  [TIPO.FERIE]: '🏖',
  [TIPO.PERMESSO]: '📄',
  [TIPO.MALATTIA]: '🌡',
  [TIPO.FESTIVITA]: '🎊',
};

// I turni salvati prima di questa funzione non hanno `type`: sono lavoro.
// Nessuna migrazione dei dati, il valore mancante ha già il significato giusto.
// L'elenco arriva da TIPI_ASSENZA invece di essere riscritto qui: quando si è
// aggiunta la festività, questa riga era l'unico punto in cui il tipo nuovo
// sarebbe stato ignorato in silenzio — il turno sarebbe tornato «lavoro» e
// avrebbe preso le maggiorazioni di un giorno lavorato.
export function tipoTurno(shift) {
  const t = shift?.type;
  return TIPI_ASSENZA.includes(t) ? t : TIPO.LAVORO;
}

export function isAssenza(shift) {
  return tipoTurno(shift) !== TIPO.LAVORO;
}

// Giorni lavorativi a settimana su cui si spalma l'orario contrattuale.
// Sei è il caso tipico del lavoro a turni (la busta di riferimento espone 26
// giorni INPS al mese, cioè sei a settimana); chi fa la settimana corta lo
// cambia in Impostazioni.
export const GIORNI_LAVORATIVI_DEFAULT = 6;

/**
 * Ore che vale un giorno intero di assenza, in minuti.
 *
 * È il «tot di ore segnate in automatico» del cedolino: ore settimanali diviso
 * giorni lavorativi. Per un part-time 60% del CCNL Turismo — 24 ore su sei
 * giorni — fa esattamente 4 ore al giorno.
 *
 * `absenceDailyHours` in Impostazioni sovrascrive il calcolo quando il
 * contratto conta le assenze diversamente (campo vuoto = calcolato, stesso
 * schema di `straordinarioSurchargePct` e `tfrTaxRate`).
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

// Parametri della malattia, con i valori di ripiego.
//
// ATTENZIONE: a differenza di contributi e aliquote fiscali — riscontrati voce
// per voce su buste reali — questi NON sono verificati su nessun cedolino:
// nessuna delle buste disponibili contiene malattia. La struttura (carenza a
// giorni, percentuale diversa prima e dopo) è quella dello schema INPS, ma
// quanto paga davvero dipende dal CCNL e va corretto in Impostazioni con la
// busta sotto mano. La UI deve dirlo.
export const MALATTIA_DEFAULT = {
  carenzaGiorni: 3,   // i primi giorni di ogni evento, a carico del CCNL o non pagati
  carenzaPct: 0,      // quanto si prende in quei giorni
  pct: 100,           // quanto si prende dal giorno successivo (INPS + integrazione)
};

/**
 * Percentuale della retribuzione oraria che spetta per un'assenza.
 *
 * Ferie e permessi valgono il 100%: in busta stanno dentro la retribuzione
 * ordinaria, non come voce a parte (verificato sulla busta di luglio 2026,
 * dove le ore «Retribuzione» sono 103,20 anche con ferie godute nel periodo).
 *
 * @param {object} shift
 * @param {object} settings
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
