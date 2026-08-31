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
// LA FASCIA — e perché è configurabile e non una costante
//
// 22:00–06:00 è la definizione del D.Lgs 66/2003, e la usano vigilanza e
// servizi fiduciari, commercio/terziario e metalmeccanici industria.
//
// Il TURISMO fa storia a sé, e non di poco: l'art. 13 del CCNL distingue più
// casi e NESSUNO comincia alle 22. Il testo consultato ad agosto 2026 riporta
// 24:00–06:00 per il lavoro notturno ordinario, 23:00–06:00 per i «lavoratori
// notturni» di pubblici esercizi e ristorazione, 23:30–06:30 per alberghiero e
// agenzie di viaggio.
//
// MA QUEI NUMERI NON VANNO PRESI COME ORO COLATO, e il codice non li impone
// per questo. Sotto l'etichetta «turismo / pubblici esercizi» esistono contratti
// firmati da associazioni diverse (Confcommercio, Conflavoro, ANPIT…) con
// clausole che non coincidono, e i rinnovi hanno spostato anche la percentuale
// fra il 20% e il 25%. L'utente di riferimento di quest'app ricorda dalle
// proprie buste una fascia 23:30–06:00 in ristorazione, che non corrisponde a
// nessuna delle tre: può essere una versione diversa del contratto o un
// accordo aziendale, e in ogni caso la busta batte la ricerca.
//
// Da qui tre conseguenze di disegno:
//  - la fascia è CONFIGURABILE agli estremi, e `fasciaNotturna` non assume
//    nulla sulla durata (23:30–06:30 dura sette ore, non otto);
//  - il suggerimento in Impostazioni non spaccia una tabella per verità: dice
//    che le fasce variano e che il numero giusto sta sul cedolino;
//  - la fascia di partenza NON è più una costante uguale per tutti: sta nel
//    preset del contratto (`fasciaNotturna` in ccnl.json), accanto agli altri
//    dati che dipendono dal CCNL. Il turismo parte dalle 23:00.
//
// Le 22:00–06:00 restano il ripiego per i contratti che non dichiarano nulla,
// perché sono la definizione di legge. Ma per il turismo erano semplicemente
// SBAGLIATE, e un default sbagliato è peggio di un campo vuoto: conta come
// notturne ore che in busta non lo sono, e gonfia la stima verso l'alto — cioè
// nella direzione che fa male, perché ci si fa un conto che poi non arriva.
//
// L'ordine con cui si decide la fascia: quello che ha scritto l'utente, poi il
// contratto, poi la legge. La busta batte il contratto, il contratto batte la
// regola generale.
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
import { getCcnl } from './ccnl.js';

// Ripiego di LEGGE (D.Lgs. 66/2003), per i contratti che non dichiarano una
// fascia propria. Non è «il default del turismo»: quello sta in ccnl.json.
export const FASCIA_NOTTURNA_DEFAULT = { inizio: '22:00', fine: '06:00' };

/**
 * Fascia che vale per queste impostazioni, come testo: prima quella scritta
 * dall'utente, poi quella del contratto, infine quella di legge.
 *
 * Serve anche alla UI, che deve poter mostrare da dove arriva il valore
 * proposto invece di far comparire due orari senza spiegazione.
 */
export function fasciaNotturnaRisolta(settings = {}) {
  const daCcnl = getCcnl(settings.ccnl).fasciaNotturna;
  const inizio = settings.nightStart || daCcnl?.inizio || FASCIA_NOTTURNA_DEFAULT.inizio;
  const fine = settings.nightEnd || daCcnl?.fine || FASCIA_NOTTURNA_DEFAULT.fine;
  const fonte = settings.nightStart || settings.nightEnd
    ? 'impostata'
    : (daCcnl ? 'contratto' : 'legge');
  return { inizio, fine, fonte, daCcnl: daCcnl || null };
}

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
  const testo = fasciaNotturnaRisolta(settings);
  const inizio = parseTime(testo.inizio);
  const fine = parseTime(testo.fine);
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

/** Come sopra, ma a partire da un turno. Minuti di ORARIO, pausa esclusa. */
export function minutiNotturni(shift, settings = {}) {
  return minutiInFasciaNotturna(shift?.startTime, shift?.endTime, settings);
}

/**
 * Minuti notturni che si possono davvero PAGARE: mai più dei minuti pagati del
 * turno.
 *
 * Serve perché la pausa si sottrae al totale del turno ma non si sa in che
 * punto cada, quindi non la si può sottrarre alla sola fascia. Senza il tetto
 * un 22:00–06:00 con mezz'ora di pausa risulterebbe di 8 ore notturne su 7 e
 * mezza pagate — e il riepilogo del mese direbbe un numero diverso da quello
 * mostrato sul turno.
 *
 * Il tetto sta qui e non nei due chiamanti proprio per questo: la regola deve
 * essere una sola, altrimenti motore e interfaccia divergono in silenzio.
 * Il numero dei minuti pagati arriva da fuori (`calcShiftMinutes`) per non
 * creare una dipendenza circolare con `pay.js`, che importa questo modulo.
 */
export function minutiNotturniPagati(shift, settings = {}, minutiPagati = 0) {
  return Math.min(minutiNotturni(shift, settings), Math.max(0, minutiPagati));
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
