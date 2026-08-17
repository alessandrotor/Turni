// Lavoro notturno: quanti minuti di un turno cadono nella fascia notturna.
//
// PERCHÉ I MINUTI E NON IL TURNO INTERO
// I CCNL pagano «le ore prestate dalle 22 alle 6», non i turni che le toccano:
// un turno 20:00–02:00 ha quattro ore notturne e due diurne, e solo le quattro
// vanno maggiorate. È la differenza con domenica e festivo, che invece si
// applicano al turno per intero perché dipendono dal GIORNO, non dall'orario.
// Per questo il notturno non poteva entrare in `getShiftSurchargeParts`: quella
// funzione restituisce percentuali sul turno intero.
//
// LA FASCIA
// Riscontrata su quattro contratti (agosto 2026):
//   Vigilanza e servizi fiduciari  22:00–06:00
//   Commercio / Terziario          22:00–06:00
//   Metalmeccanici industria       22:00–06:00
//   Turismo / Pubblici esercizi    22:00–06:00, MA 23:00–06:00 per i
//                                  «lavoratori notturni» di pubblici esercizi,
//                                  ristorazione e alberghi diurni
// Default 22:00–06:00, ma configurabile: l'eccezione del Turismo riguarda
// proprio il settore da cui viene la busta di riscontro dell'app.
//
// LA PERCENTUALE NON STA QUI
// Va dal 10% al 65% secondo classificazione (turnista o no, notturno abituale
// o occasionale) e contratto. Non è un dato del contratto utilizzabile in
// automatico, è un'impostazione dell'utente — la stessa scelta già presa per
// festivo e domenicale, scritta nella nota del CCNL vigilanza in ccnl.json.
//
// La regola si riscontra con `node scripts/check-notturno.mjs`.

// Estensione esplicita: senza, i riscontri in `scripts/` (che girano fuori da
// Vite, su Node puro) non riescono a importare questo modulo.
import { parseTime, minutesDiff } from './dates.js';

export const FASCIA_NOTTURNA_DEFAULT = { inizio: '22:00', fine: '06:00' };

// Non cumulabile è la regola, non l'eccezione: Commercio e Vigilanza lo
// scrivono a chiare lettere («le maggiorazioni non sono cumulabili fra loro, la
// maggiore assorbe la minore»). Il default segue i contratti; 'somma' resta per
// chi ha un accordo aziendale che cumula davvero.
export const CUMULO_DEFAULT = 'max';

const GIORNO = 24 * 60;

const sovrapposizione = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/**
 * Estremi della fascia in minuti dalla mezzanotte, più la sua durata.
 * Una fascia che scavalca la mezzanotte (22:00 → 06:00) ha `durata` 480.
 * Estremi non validi o coincidenti = nessuna fascia (durata 0).
 */
export function fasciaNotturna(settings = {}) {
  const inizio = parseTime(settings.nightStart ?? FASCIA_NOTTURNA_DEFAULT.inizio);
  const fine = parseTime(settings.nightEnd ?? FASCIA_NOTTURNA_DEFAULT.fine);
  if (inizio === null || fine === null) return { inizio: 0, durata: 0 };
  // (fine − inizio) modulo 24h: copre sia 22→06 (480) sia 00→06 (360).
  const durata = ((fine - inizio) % GIORNO + GIORNO) % GIORNO;
  return { inizio, durata };
}

/**
 * Minuti del turno che cadono nella fascia notturna.
 *
 * Lavora in minuti assoluti dall'inizio del turno, non in ore di orologio: un
 * turno che valica la mezzanotte va confrontato con la finestra notturna del
 * giorno dopo, non solo con quella del giorno in cui comincia. Per lo stesso
 * motivo le finestre si ripetono su tre giorni — quella precedente serve a un
 * turno che comincia prima delle 06:00.
 */
export function minutiInFasciaNotturna(startTime, endTime, settings = {}) {
  const { inizio, durata } = fasciaNotturna(settings);
  if (durata <= 0) return 0;

  const partenza = parseTime(startTime);
  const lunghezza = minutesDiff(startTime, endTime);
  if (partenza === null || lunghezza <= 0) return 0;
  const arrivo = partenza + lunghezza;

  let minuti = 0;
  for (const giorno of [-GIORNO, 0, GIORNO]) {
    const da = giorno + inizio;
    minuti += sovrapposizione(partenza, arrivo, da, da + durata);
  }
  return minuti;
}

/** Come sopra, ma a partire da un turno. */
export function minutiNotturni(shift, settings = {}) {
  return minutiInFasciaNotturna(shift?.startTime, shift?.endTime, settings);
}

/**
 * Il turno tocca la fascia? Serve alla UI per l'etichetta «notturno», e deriva
 * dal conteggio invece di duplicarne la regola: se un giorno la fascia cambia,
 * cambia in un posto solo.
 */
export function toccaFasciaNotturna(shift, settings = {}) {
  return minutiNotturni(shift, settings) > 0;
}

/** Percentuale di maggiorazione notturna impostata dall'utente (0 = spenta). */
export function pctNotturno(settings = {}) {
  const pct = Number(settings.nightSurchargePct) || 0;
  return pct > 0 ? pct : 0;
}

/** 'max' (la maggiore assorbe la minore) oppure 'somma'. */
export function modoCumuloNotturno(settings = {}) {
  return settings.nightCumuloMode === 'somma' ? 'somma' : CUMULO_DEFAULT;
}

/**
 * Percentuale AGGIUNTIVA che spetta ai minuti notturni, oltre a quella che il
 * turno prende già per domenica/festivo/manuale.
 *
 * Restituire il solo supplemento — invece della percentuale piena — è ciò che
 * tiene intatto il resto del calcolo: le voci esistenti continuano a valere sul
 * turno intero come prima, e il notturno si aggiunge come una riga in più.
 * Con la maggiorazione a zero questa vale zero, quindi il motore si comporta
 * esattamente come prima di questa funzione.
 */
export function pctNotturnoAggiuntiva(settings = {}, pctGiorno = 0) {
  const notte = pctNotturno(settings);
  if (notte <= 0) return 0;
  if (modoCumuloNotturno(settings) === 'somma') return notte;
  // 'max': se il turno prende già una maggiorazione più alta, quella assorbe
  // la notturna e non si aggiunge nulla.
  return Math.max(0, notte - pctGiorno);
}
