// Le ore lavorate in un giorno festivo NON sono ore supplementari:
//
//   node scripts/check-festivo-supplementare.mjs
//
// DA DOVE VIENE LA REGOLA
// Dalla busta di giugno 2026, confrontata coi turni veri. Il cedolino stampa
// tre righe di ore lavorate:
//
//   Retribuzione                103,20 h    (la soglia contrattuale)
//   Supplementare 30%            28,25 h    (al 130%)
//   Lavoro festivo ordinario     13,75 h    (al 100%, piu' «Magg. festivo 20»)
//                              ─────────
//                               145,20 h
//
// e il conto che le lega e' esatto al centesimo:
//
//   145,20 − 13,75 (festive) = 131,45  →  131,45 − 103,20 = 28,25
//
// Cioe': le ore festive si mettono da parte PRIMA di tutto. Non riempiono la
// soglia e non diventano supplementari. Sono pagate a parte, al 120% totale.
//
// PERCHE' IL FESTIVO IN TESTA AL MESE E' IL CUORE DEL RISCONTRO
// C'e' un'ipotesi alternativa che sembra equivalente: «le ore festive restano
// nel monte ore, ma non possono essere supplementari». Con i festivi tutti a
// fine mese le due regole danno lo stesso numero e il riscontro non
// distinguerebbe niente.
//
// Giugno 2026 le distingue perche' ha un festivo il 2 — quasi all'inizio — e uno
// il 29. Con l'ipotesi alternativa le 6,75 ore del 2 giugno riempirebbero parte
// della soglia, lasciando piu' ore a sforare: verrebbero 35,00 supplementari
// invece di 28,25. La busta dice 28,25.
//
// Per questo i turni qui sotto tengono un festivo in testa: senza, il riscontro
// passerebbe anche col motore sbagliato.
//
// Il mese di paga di giugno 2026 va dal 1 giugno al 5 luglio (giugno comincia di
// lunedi', quindi vale cinque settimane — vedi utils/dates.js).

import { computePayByShift, calcTotalPay } from '../src/utils/pay.js';
import { monthlyContractHours } from '../src/utils/ccnl.js';
import { payrollMonthKey } from '../src/utils/dates.js';
import { isHoliday } from '../src/utils/holidays.js';

const S = {
  hourlyRate: 9.21802,
  expectedWeeklyHours: 24,
  ccnl: 'turismo',
  overtimeSurchargePct: 30,
  holidaySurchargePct: 20,
  sundaySurchargePct: 10,
  holidaySundayMode: 'max',
  patronSaintDate: '06-29',   // San Pietro e Paolo, patrono di Roma
};

let falliti = 0;
let totale = 0;
const check = (label, avuto, atteso, tol = 0.005) => {
  totale += 1;
  const ok = typeof atteso === 'number'
    ? Math.abs(avuto - atteso) <= tol
    : avuto === atteso;
  if (!ok) falliti += 1;
  const f = (n) => (typeof n === 'number' ? n.toFixed(2).padStart(9) : String(n).padStart(9));
  console.log(`  ${ok ? 'ok  ' : 'DIFF'} ${label.padEnd(40)} atteso ${f(atteso)} → ${f(avuto)}`);
};

// ── I turni, costruiti sui totali della busta ──────────────────────────────
const FESTIVI = [['2026-06-02', 405], ['2026-06-29', 420]];   // 6,75 + 7,00 = 13,75 h
const MIN_ORDINARI = 7887;                                     // 131,45 h

function turniGiugno() {
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const shifts = [];
  const push = (date, minuti) => shifts.push({
    id: `t${shifts.length + 1}`, date, startTime: '09:00', endTime: hhmm(9 * 60 + minuti),
  });

  for (const [d, m] of FESTIVI) push(d, m);

  // I giorni feriali del mese di paga, domeniche e festivi esclusi: le domeniche
  // prenderebbero il domenicale e sposterebbero l'attenzione dalla cosa in esame.
  const giorni = [];
  for (const d = new Date(2026, 5, 1); d <= new Date(2026, 6, 5); d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (d.getDay() !== 0 && !isHoliday(iso, S)) giorni.push(iso);
  }

  const n = 26;
  const base = Math.floor(MIN_ORDINARI / n);
  for (let i = 0; i < n; i += 1) push(giorni[i], i === n - 1 ? MIN_ORDINARI - base * (n - 1) : base);
  return shifts;
}

const TURNI = turniGiugno();

console.log('\nLe ore festive non entrano nel conteggio delle supplementari\n');

// ── Il banco di prova e' quello che si crede ───────────────────────────────
console.log('Premesse: i turni costruiti hanno davvero la forma di giugno 2026\n');

const oreDi = (ts) => ts.reduce((s, t) => {
  const [h1, m1] = t.startTime.split(':').map(Number);
  const [h2, m2] = t.endTime.split(':').map(Number);
  return s + (h2 * 60 + m2 - (h1 * 60 + m1));
}, 0) / 60;

const festivi = TURNI.filter((t) => isHoliday(t.date, S));
const feriali = TURNI.filter((t) => !isHoliday(t.date, S));

check('soglia contrattuale (h)', monthlyContractHours(S), 103.20, 0.01);
check('ore festive', oreDi(festivi), 13.75);
check('ore non festive', oreDi(feriali), 131.45);
check('ore totali', oreDi(TURNI), 145.20);
check('tutti nel mese di paga 2026-06',
  TURNI.every((t) => payrollMonthKey(t.date) === '2026-06'), true);
check('un festivo sta in TESTA al mese', festivi[0].date, '2026-06-02');

// ── La regola ──────────────────────────────────────────────────────────────
console.log('\nQuello che il motore deve calcolare\n');

const p = calcTotalPay(TURNI, S, TURNI);

check('supplementari (131,45 − 103,20)', p.overtimeMinutes / 60, 28.25);
check('  in euro, al 130%', p.overtimeBase + p.surchargeOvertime,
  28.25 * S.hourlyRate * 1.30, 0.02);

const perTurno = computePayByShift(TURNI, S);
const suppFestive = festivi.reduce((s, t) => s + perTurno[t.id].overtimeMinutes, 0);
check('nessuna ora festiva fra le supplementari', suppFestive / 60, 0);

check('maggiorazione festiva sulle 13,75 h', p.surchargeHoliday,
  13.75 * S.hourlyRate * 0.20, 0.02);
check('  e le festive restano al 120% in tutto',
  festivi.reduce((s, t) => s + perTurno[t.id].base + perTurno[t.id].surcharge, 0),
  13.75 * S.hourlyRate * 1.20, 0.02);

// ── Il totale, come lo compone la busta ────────────────────────────────────
console.log('\nRicomposto come le righe del cedolino\n');

const ordinarie = (oreDi(feriali) * 60 - p.overtimeMinutes) / 60;
check('Retribuzione (ore ordinarie)', ordinarie, 103.20);
check('Supplementare 30%', p.overtimeMinutes / 60, 28.25);
check('Lavoro festivo ordinario', oreDi(festivi), 13.75);
check('le tre righe fanno il totale', ordinarie + p.overtimeMinutes / 60 + oreDi(festivi), 145.20);

console.log('');
if (falliti) {
  console.error(`${falliti} valori su ${totale} non tornano.\n`);
  process.exit(1);
}
console.log(`Tutti i ${totale} valori tornano.\n`);
