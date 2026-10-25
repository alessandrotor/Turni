// Lavoro notturno: quanti minuti di un turno cadono nella fascia notturna.
//
// Si contano i MINUTI in fascia, non il turno intero: un 20:00–02:00 ha quattro
// ore notturne e due diurne. Domenica e festivo valgono sul turno intero perché
// dipendono dal giorno, per questo il notturno non sta in `getShiftSurchargeParts`.
//
// La fascia è configurabile, non una costante: 22:00–06:00 è la definizione di
// legge (D.Lgs 66/2003), ma il Turismo parte dalle 23:00 e le fonti discordano.
// Vale quella scritta dall'utente, poi quella del contratto (`fasciaNotturna` in
// ccnl.json), poi quella di legge: la busta batte il contratto, il contratto la
// regola generale. Un default sbagliato è peggio di un campo vuoto: gonfia la stima.
//
// La percentuale (10–65% secondo classificazione e contratto) non sta qui: è
// un'impostazione dell'utente, come per festivo e domenicale.
// → docs/note-motore-notturno.md
//
// La regola si riscontra con `node src/motore/riscontri/check-notturno.mjs`.

// Estensione esplicita: senza, Node puro non importa questo modulo.
import { parseTime, minutesDiff } from './date.js';
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

/**
 * La fascia da usare per CHIEDERE, che non è sempre quella con cui si PAGA.
 *
 * Il motore paga sulla fascia risolta, ma «di legge» vuol dire anche «non lo
 * sappiamo» (contratto non scelto). Per l'AVVISO la supposizione non basta:
 * chiedere per un turno non notturno costa un tocco, non chiedere per uno
 * notturno costa soldi ogni mese. Finché la fascia non è nota si guarda la più
 * LARGA fra quelle che esistono (22:00–06:30) e l'avviso dice «potrebbe». Appena
 * il contratto c'è, si torna alla fascia vera.
 *
 */
export const FASCIA_NOTTURNA_POSSIBILE = { inizio: '22:00', fine: '06:30' };

export function fasciaNotturnaPossibile(settings = {}) {
  const risolta = fasciaNotturnaRisolta(settings);
  // 'legge' = nessuno ce l'ha detto. Le altre due fonti sono dichiarazioni.
  if (risolta.fonte !== 'legge') return { ...risolta, certa: true };
  return { ...FASCIA_NOTTURNA_POSSIBILE, fonte: 'possibile', daCcnl: null, certa: false };
}

/**
 * Questo turno tocca la fascia in cui la notte POTREBBE cadere.
 *
 * Come `toccaFasciaNotturna`, ma con la fascia larga quando non è nota.
 */
export function toccaFasciaNotturnaPossibile(shift, settings = {}) {
  const f = fasciaNotturnaPossibile(settings);
  if (f.certa) return toccaFasciaNotturna(shift, settings);
  return minutiInFasciaNotturna(shift?.startTime, shift?.endTime, {
    nightStart: f.inizio, nightEnd: f.fine,
  }) > 0;
}

// Le maggiorazioni non sono cumulabili (Commercio e Vigilanza: «la maggiore
// assorbe la minore»); 'somma' resta per gli accordi aziendali che cumulano.
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
 * Lavora in minuti assoluti dall'inizio del turno: uno che valica la mezzanotte
 * va confrontato con la finestra del giorno dopo, e le finestre si ripetono su
 * tre giorni (la precedente serve a chi comincia prima delle 06:00).
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
 * turno. La pausa si sottrae al totale ma non si sa dove cada, quindi non alla
 * sola fascia: senza tetto un 22:00–06:00 con mezz'ora di pausa darebbe 8 ore
 * notturne su 7 e mezza pagate. Il tetto sta qui perché motore e interfaccia
 * abbiano una regola sola. I minuti pagati arrivano da fuori (`calcShiftMinutes`)
 * per evitare una dipendenza circolare con `pay.js`.
 */
export function minutiNotturniPagati(shift, settings = {}, minutiPagati = 0) {
  return Math.min(minutiNotturni(shift, settings), Math.max(0, minutiPagati));
}

/**
 * Il turno tocca la fascia? Per l'etichetta «notturno»: deriva dal conteggio,
 * così la regola resta in un posto solo.
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
 * turno prende già per domenica/festivo/manuale. Restituire il solo supplemento
 * lascia intatte le voci esistenti: il notturno si aggiunge come una riga in più,
 * e con la maggiorazione a zero vale zero.
 */
export function pctNotturnoAggiuntiva(settings = {}, pctGiorno = 0) {
  const notte = pctNotturno(settings);
  if (notte <= 0) return 0;
  if (modoCumuloNotturno(settings) === 'somma') return notte;
  // 'max': se il turno prende già una maggiorazione più alta, quella assorbe
  // la notturna e non si aggiunge nulla.
  return Math.max(0, notte - pctGiorno);
}

/**
 * Lo STRAORDINARIO NOTTURNO del contratto: ore straordinarie in una fascia sua,
 * con una percentuale sua che assorbe le altre (Turismo: 60% fra le 24 e le 6,
 * contro il 30% di giorno). Dal contratto, NON riscontrato su una busta. Un
 * contratto che non lo dichiara non ha la regola. → check-straordinario-notturno.mjs
 *
 * Le ore straordinarie sono le ULTIME del turno (la settimana si conta in
 * ordine), quindi si guarda la coda: gli ultimi `minutiStraordinari` minuti.
 *
 * @returns {{minuti:number, pct:number}} minuti della coda in fascia e la
 *   percentuale; zero minuti se il contratto non ha la regola.
 */
export function straordinarioNotturno(shift, minutiStraordinari, settings = {}) {
  const regola = getCcnl(settings.ccnl).straordinarioNotturno;
  const partenza = parseTime(shift?.startTime);
  const lunghezza = minutesDiff(shift?.startTime, shift?.endTime);
  const inizio = parseTime(regola?.inizio);
  const fine = parseTime(regola?.fine);
  if (!regola || !(minutiStraordinari > 0) || partenza === null || lunghezza <= 0 || inizio === null || fine === null) {
    return { minuti: 0, pct: 0 };
  }
  const durata = ((fine - inizio) % GIORNO + GIORNO) % GIORNO;
  const arrivo = partenza + lunghezza;
  const da = arrivo - Math.min(minutiStraordinari, lunghezza);
  let minuti = 0;
  for (const giorno of [-GIORNO, 0, GIORNO]) minuti += sovrapposizione(da, arrivo, giorno + inizio, giorno + inizio + durata);
  return { minuti: Math.min(minuti, minutiStraordinari), pct: Number(regola.pct) || 0 };
}
