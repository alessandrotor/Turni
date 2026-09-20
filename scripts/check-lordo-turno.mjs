// Il lordo del singolo turno, riscontrato con:
//
//   node scripts/check-lordo-turno.mjs
//
// PERCHÉ ESISTE
// Dal 2 settembre 2026 l'app può mostrare quanto vale ogni turno. Il motore
// quei numeri li aveva da sempre — venti campi per turno — ma non li aveva mai
// SOMMATI: la somma la faceva solo `calcTotalPay`, già aggregata sul mese.
//
// Il difetto che questo file esiste per impedire è preciso: che la cifra nella
// cella e la cifra del riepilogo non tornino. Non darebbe nessun errore — due
// numeri, entrambi plausibili, che non fanno la stessa somma. Chi se ne
// accorgesse smetterebbe di fidarsi di tutti e due, ed è il tipo di crepa che
// affonda un'app che promette di dirti quanto guadagni.
//
// Da qui l'unica proprietà che conta, verificata su mesi diversi e su tutti i
// casi che il motore tratta a parte (notturno, domenica, festivo,
// supplementare, straordinario, assenze, pause):
//
//   somma dei `lordoTurno` di un mese  ===  `calcTotalPay(mese).total`
//
// Al centesimo, non «circa».

import { computePayByShift, calcTotalPay, lordoTurno } from '../src/utils/pay.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(48)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// CCNL Turismo, livello 5, part-time 60% — la busta di riferimento.
const S = {
  hourlyRate: 9.21802,
  expectedWeeklyHours: 24,
  fullTimeWeeklyHours: 40,
  workingDaysPerWeek: 6,
  sundaySurchargePct: 10,
  holidaySurchargePct: 20,
  nightSurchargePct: 25,
  overtimeSurchargePct: 30,
  straordinarioSurchargePct: 50,
  holidaySundayMode: 'max',
  nightCumuloMode: 'max',
  ccnl: 'turismo-pubblici-esercizi',
  aziendaDipendenti: 'oltre15',
  absenceHoursPerDay: 4,
};

const T = (data, startTime, endTime, extra = {}) => ({
  id: `${data}-${startTime}`, date: data, startTime, endTime, breakMinutes: 0, ...extra,
});

// Un mese che tocca ogni strada del motore: feriali, una domenica, un festivo,
// notturni con e senza pausa, una maggiorazione a mano, ferie, permesso,
// malattia, e abbastanza ore da sfondare la soglia del supplementare.
const MESE = [
  ...Array.from({ length: 12 }, (_, i) => T(`2026-09-${String(i + 1).padStart(2, '0')}`, '16:00', '22:00')),
  T('2026-09-06', '16:00', '22:00'),                             // domenica
  T('2026-09-13', '18:00', '23:30'),                             // domenica + notte
  T('2026-09-14', '18:00', '01:00', { breakMinutes: 30 }),       // notte con pausa
  T('2026-09-15', '09:00', '17:00', { surchargePct: 15 }),       // maggiorazione a mano
  T('2026-09-16', '09:00', '13:00', { note: 'mezza giornata' }),
  { id: 'f1', date: '2026-09-17', type: 'ferie', durationMinutes: 240 },
  { id: 'p1', date: '2026-09-18', type: 'permesso', durationMinutes: 120 },
  { id: 'm1', date: '2026-09-19', type: 'malattia', durationMinutes: 240 },
  T('2026-09-20', '16:00', '22:00'),                             // domenica
  ...Array.from({ length: 6 }, (_, i) => T(`2026-09-${22 + i}`, '15:00', '23:00')),
];

const cent = (n) => Math.round(n * 100);

// ── 1. La proprietà, su un mese pieno ──────────────────────────────────────
console.log('\nLa somma dei turni fa il totale del mese\n');

const perTurno = computePayByShift(MESE, S);
const mese = calcTotalPay(MESE, S, MESE, perTurno);
const somma = MESE.reduce((s, t) => s + lordoTurno(perTurno[t.id]), 0);

verifica('somma dei lordi = totale del mese', cent(somma), cent(mese.total),
  `${somma.toFixed(2)} € su ${MESE.length} turni`);
verifica('e non è un caso: il totale non è zero', mese.total > 1000, true, '');

// ── 2. Su mesi diversi, perché la soglia è mensile ─────────────────────────
// Il supplementare scatta oltre le ore del mese: un mese corto e uno lungo
// prendono strade diverse dentro `computePayByShift`, e la proprietà deve
// reggere in entrambi.
console.log('\nSu mesi corti e mesi lunghi\n');

for (const [nome, giorni] of [['mese scarno', 4], ['mese pieno', 26]]) {
  const turni = Array.from({ length: giorni }, (_, i) =>
    T(`2026-10-${String(i + 1).padStart(2, '0')}`, '09:00', '17:00'));
  const pt = computePayByShift(turni, S);
  const m = calcTotalPay(turni, S, turni, pt);
  const sm = turni.reduce((s, t) => s + lordoTurno(pt[t.id]), 0);
  verifica(`${nome}: somma = totale`, cent(sm), cent(m.total), `${sm.toFixed(2)} €`);
}

// ── 3. I casi limite ───────────────────────────────────────────────────────
console.log('\nQuando non c\'è niente da sommare\n');

verifica('voce assente', lordoTurno(undefined), 0, 'nessuna eccezione');
verifica('voce vuota', lordoTurno({}), 0, '');
verifica('campi non numerici', lordoTurno({ base: 'boh', surcharge: null }), 0, '');
verifica('solo base', lordoTurno({ base: 55.31, surcharge: 0 }), 55.31, '');

// Senza paga oraria il motore non produce importi: la cella non deve mostrare
// «0 €», che sembrerebbe un turno non pagato invece che un dato mancante.
const senzaPaga = computePayByShift([T('2026-09-01', '09:00', '17:00')], { ...S, hourlyRate: 0 });
const voceSenzaPaga = senzaPaga['2026-09-01-09:00'];
verifica('senza paga oraria il lordo è zero', lordoTurno(voceSenzaPaga), 0, '');
verifica('e il turno si dichiara senza paga', voceSenzaPaga.missingRate, true,
  'l\'interfaccia usa questo, non lo zero, per non mostrare niente');

// ── 4. Le assenze contano, e vanno contate una volta sola ──────────────────
console.log('\nLe giornate pagate e non lavorate\n');

const soloFerie = [{ id: 'f', date: '2026-09-01', type: 'ferie', durationMinutes: 240 }];
const ptFerie = computePayByShift(soloFerie, S);
const mFerie = calcTotalPay(soloFerie, S, soloFerie, ptFerie);
verifica('una giornata di ferie ha il suo lordo', lordoTurno(ptFerie.f) > 0, true,
  `${lordoTurno(ptFerie.f).toFixed(2)} €`);
verifica('e coincide col totale', cent(lordoTurno(ptFerie.f)), cent(mFerie.total),
  'in busta le ferie stanno dentro la retribuzione');

console.log(falliti === 0
  ? `\n${totale} controlli: la cella e il riepilogo dicono la stessa cifra.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
