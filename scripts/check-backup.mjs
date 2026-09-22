// «Un ripristino non lascia i dati a metà», riscontrato invece che sperato:
//
//   node scripts/check-backup.mjs
//
// PERCHÉ ESISTE
// Il guasto peggiore del ripristino non si prova a mano: bisognerebbe avere lo
// storage pieno esattamente al secondo `setItem` su quattro, cioè con i turni
// già sostituiti e le impostazioni ancora vecchie. Nessuno ci arriva per caso,
// e chi ci arriva ha i dati di due backup diversi mescolati e nessun modo di
// accorgersene.
//
// Qui lo storage è un argomento, quindi si può romperlo al colpo che si vuole e
// guardare cosa resta. Le due domande sono: si torna indietro DAVVERO (stesse
// stringhe, non una versione riscritta da noi), e lo si DICE quando nemmeno il
// ritorno riesce.
//
// L'altra metà del file riguarda cosa entra: prima bastava che il file dicesse
// `app: 'turni'` perché qualunque spazzatura finisse in localStorage, con gli
// originali già cancellati.

import {
  controllaBusta, vagliaTurni, pianoRipristino, scriviConRitorno, perche,
  KEY_SHIFTS, KEY_SETTINGS, KEY_TELEMETRY_OFF, KEY_CAL_LAYOUT, FORMATO,
} from '../src/utils/backup-contenuto.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(52)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// Uno storage finto, in due modi di rompersi che NON sono lo stesso guasto e
// non si comportano allo stesso modo:
//
//  · `capienza` — la quota, cioè il caso tipico: lo spazio è finito, e una
//    scrittura passa o no a seconda di quanto occupa. Qui rimettere il valore
//    di prima (più piccolo di quello appena scritto) LIBERA spazio, quindi il
//    ritorno deve riuscire. È la proprietà che conta.
//  · `bloccatoDopo` — lo storage che smette e basta: Safari in navigazione
//    privata, permessi cambiati, WebView ristretta. Lì il ritorno non può
//    riuscire, e l'unica cosa onesta è dirlo.
function finto(iniziale = {}, { capienza = Infinity, bloccatoDopo = Infinity } = {}) {
  const dentro = new Map(Object.entries(iniziale));
  let scritture = 0;
  const occupato = () => [...dentro].reduce((n, [k, v]) => n + k.length + String(v).length, 0);

  return {
    getItem: (k) => (dentro.has(k) ? dentro.get(k) : null),
    setItem(k, v) {
      scritture++;
      const quota = () => {
        const e = new Error('QuotaExceeded');
        e.name = 'QuotaExceededError';
        return e;
      };
      if (scritture > bloccatoDopo) throw quota();
      const giaLi = dentro.has(k) ? k.length + String(dentro.get(k)).length : 0;
      if (occupato() - giaLi + k.length + String(v).length > capienza) throw quota();
      dentro.set(k, v);
    },
    // Togliere si può anche quando non si può più scrivere: è così che i
    // browser si comportano, ed è il motivo per cui fa spazio.
    removeItem: (k) => dentro.delete(k),
    contenuto: () => Object.fromEntries(dentro),
  };
}

const TURNO = { id: 'a1', date: '2026-09-21', startTime: '08:00', endTime: '16:00', breakMinutes: 30 };

const BACKUP = {
  app: 'turni',
  formato: 1,
  turni: { a1: TURNO },
  impostazioni: { hourlyRate: 9.5 },
  telemetriaDisattivata: false,
  vistaCalendario: 'timeline',
};

// ── 1. La busta ────────────────────────────────────────────────────────────
console.log('\nIl file è davvero un backup di Turni\n');

verifica('un backup buono passa', controllaBusta(BACKUP), null);
verifica('un JSON qualunque no', controllaBusta({ ciao: 1 }), 'Questo file non è un backup di Turni.');
verifica('un array no', controllaBusta([BACKUP]), 'Il file non contiene un backup valido.');
verifica('null no', controllaBusta(null), 'Il file non contiene un backup valido.');
verifica('senza elenco turni',
  controllaBusta({ ...BACKUP, turni: null }), 'Il backup è danneggiato: manca l\'elenco dei turni.');

// Il buco vero: `undefined > 1` è `false`, quindi un file senza `formato`
// passava il controllo e veniva letto come formato 1 — cioè esattamente quello
// che quel controllo doveva impedire.
verifica('SENZA `formato` viene fermato',
  controllaBusta({ ...BACKUP, formato: undefined }), 'Il backup è danneggiato: manca il numero di formato.',
  'undefined > 1 è false: prima passava');
verifica('`formato` come stringa viene fermato',
  controllaBusta({ ...BACKUP, formato: '1' }), 'Il backup è danneggiato: manca il numero di formato.',
  '«1» > 1 è false: passava anche questo');
verifica('un formato futuro viene fermato',
  typeof controllaBusta({ ...BACKUP, formato: FORMATO + 1 }), 'string');

// ── 2. Il contenuto, voce per voce ─────────────────────────────────────────
console.log('\nCosa entra in localStorage\n');

verifica('un turno buono entra', perche(TURNO), null);
verifica('senza data', perche({ id: 'x' }), 'data assente o inesistente');
verifica('data che non esiste', perche({ ...TURNO, date: '2026-02-31' }), 'data assente o inesistente',
  'supera la regex ma non è un giorno');
verifica('data non stringa', perche({ ...TURNO, date: 20260921 }), 'data assente o inesistente');
verifica('orario assurdo', perche({ ...TURNO, startTime: '99:99' }), 'orario di inizio illeggibile');
verifica('pausa negativa', perche({ ...TURNO, breakMinutes: -30 }), 'pausa non valida');
verifica('durata NaN', perche({ ...TURNO, durationMinutes: 'tanto' }), 'durata non valida');
verifica('una stringa al posto del turno', perche('turno'), 'non è una voce');
verifica('campi assenti vanno bene', perche({ date: '2026-09-21' }), null,
  'i backup vecchi non hanno tutto: il motore ha i suoi ripieghi');

const misto = vagliaTurni({ a1: TURNO, rotto: { id: 'rotto' }, a2: { ...TURNO, id: 'a2' } });
verifica('i buoni si salvano', Object.keys(misto.buoni).sort(), ['a1', 'a2'],
  'due voci storte su duecento non buttano via il backup');
verifica('gli scartati si contano', misto.scartati, [{ chiave: 'rotto', perche: 'data assente o inesistente' }],
  'e si dicono: scartare in silenzio è il difetto di prima');

// Tre buchi trovati il 23/09/2026, tutti su file scritti a mano o da altro:
// passavano il vaglio e rompevano DOPO, a ripristino fatto.
const strani = vagliaTurni(JSON.parse(
  '{"x1":{"id":"altro","date":"2026-09-21","note":{"a":1}},"x2":{"date":"2026-09-22","note":7},'
  + '"__proto__":{"id":"p","date":"2026-09-23"}}',
));
verifica('id diverso dalla chiave: vince la chiave', strani.buoni.x1?.id, 'x1',
  'modificare scrive in shifts[id]: con un id diverso creava un doppione');
verifica('id assente: preso dalla chiave', strani.buoni.x2?.id, 'x2', 'cancellare non trovava niente');
verifica('nota oggetto: vuota', strani.buoni.x1?.note, '', 'il render saltava');
verifica('nota numero: testo', strani.buoni.x2?.note, '7', 'note.trim() lanciava');
verifica('«__proto__» si scarta e si dice', strani.scartati, [{ chiave: '__proto__', perche: 'chiave non valida' }],
  'assegnato cambiava il prototipo, e il turno spariva senza traccia');
verifica('  e il prototipo resta quello di sempre', Object.getPrototypeOf(strani.buoni) === Object.prototype, true, '');
verifica('una voce già a posto resta la stessa', vagliaTurni({ a1: TURNO }).buoni.a1 === TURNO, true,
  'niente copie inutili sul caso di tutti i giorni');

// ── 3. Il ripristino che riesce ────────────────────────────────────────────
console.log('\nQuando va tutto bene\n');

const pieno = finto({ [KEY_SHIFTS]: '{"vecchio":1}', [KEY_TELEMETRY_OFF]: '1' });
const piano = pianoRipristino(BACKUP, vagliaTurni(BACKUP.turni).buoni);
const esito = scriviConRitorno(piano, pieno);

verifica('riesce', esito.ok, true);
verifica('i turni sono quelli nuovi', JSON.parse(pieno.contenuto()[KEY_SHIFTS]), { a1: TURNO });
verifica('le impostazioni pure', JSON.parse(pieno.contenuto()[KEY_SETTINGS]), { hourlyRate: 9.5 });
verifica('la vista segue i dati', pieno.contenuto()[KEY_CAL_LAYOUT], 'timeline');
verifica('la telemetria torna accesa', KEY_TELEMETRY_OFF in pieno.contenuto(), false,
  'il backup diceva «non disattivata»: la chiave va tolta, non lasciata');

const senzaVista = pianoRipristino({ ...BACKUP, vistaCalendario: undefined }, {});
verifica('un backup vecchio non tocca la vista',
  senzaVista.some((p) => p.chiave === KEY_CAL_LAYOUT), false,
  'chi non ce l\'ha resta com\'è, invece di tornare alla griglia');

// ── 4. Il ripristino che si rompe a metà — il motivo di questo file ────────
console.log('\nQuando la memoria finisce a metà strada\n');

const PRIMA = {
  [KEY_SHIFTS]: '{"mio":{"id":"mio","date":"2026-01-02"}}',
  [KEY_SETTINGS]: '{"hourlyRate":7.25}',
  [KEY_CAL_LAYOUT]: 'grid',
};

// Un backup grosso su uno storage quasi pieno: i turni nuovi ci stanno per un
// soffio, le impostazioni no. È il caso descritto nell'inventario.
const GROSSO = {
  ...BACKUP,
  turni: Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => [`t${i}`, { ...TURNO, id: `t${i}`, date: '2026-09-21' }]),
  ),
  impostazioni: { hourlyRate: 9.5, note: 'x'.repeat(400) },
};
const pianoGrosso = pianoRipristino(GROSSO, vagliaTurni(GROSSO.turni).buoni);

const aMeta = finto(PRIMA, { capienza: pianoGrosso[0].valore.length + 260 });
const rotto = scriviConRitorno(pianoGrosso, aMeta);

verifica('non dichiara successo', rotto.ok, false);
verifica('l\'errore risale a chi chiama', rotto.errore?.name, 'QuotaExceededError',
  'il messaggio in italiano lo sceglie chi sa cosa stava facendo');
verifica('dice di essere tornato indietro', rotto.tornatoIndietro, true);
verifica('TUTTO com\'era, byte per byte', aMeta.contenuto(), PRIMA,
  'è lo stato misto che prima restava: turni nuovi e impostazioni vecchie');

// Lo stesso a capienze diverse: qualunque sia il punto in cui lo spazio
// finisce, o passa tutto o non è cambiato niente. Provarlo su un punto solo
// vorrebbe dire non averlo provato.
for (const margine of [0, 80, 200, 400, 10_000]) {
  const s = finto(PRIMA, { capienza: pianoGrosso[0].valore.length + margine });
  const r = scriviConRitorno(pianoGrosso, s);
  const intatto = JSON.stringify(s.contenuto()) === JSON.stringify(PRIMA);
  verifica(`capienza +${margine}`, r.ok ? 'tutto scritto' : (intatto ? 'niente toccato' : 'STATO MISTO'),
    r.ok ? 'tutto scritto' : 'niente toccato');
}

// Se lo spazio non basta nemmeno per la prima scrittura non c'è niente da
// annullare: il ritorno non deve mettere le mani su dati che nessuno ha
// toccato. È il difetto che questo riscontro ha trovato nella prima stesura.
const troppoPiccolo = finto(PRIMA, { capienza: 10 });
const subito = scriviConRitorno(pianoGrosso, troppoPiccolo);
verifica('fallita la prima: niente da annullare', subito.tornatoIndietro, true);
verifica('e i dati sono intatti', troppoPiccolo.contenuto(), PRIMA);

// Il caso raro e grave: la scrittura fallisce E il ritorno pure, perché lo
// storage ha smesso del tutto. Non si può aggiustare, ma si deve DIRE — è
// l'unico momento in cui l'utente deve sapere di non fidarsi di quel che vede.
const senzaRitorno = finto(PRIMA, { bloccatoDopo: 1 });
const grave = scriviConRitorno(pianoGrosso, senzaRitorno);
verifica('nemmeno il ritorno riesce: lo dichiara', grave.tornatoIndietro, false,
  'tacere qui significherebbe lasciar credere che i dati siano sani');

console.log(falliti === 0
  ? `\n${totale} controlli: o tutto, o niente — e comunque lo si dice.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
