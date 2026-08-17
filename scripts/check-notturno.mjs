// Riscontro del lavoro notturno, da eseguire con:
//
//   node scripts/check-notturno.mjs
//
// Due parti. La prima conta i MINUTI in fascia: è la domanda che decide tutto,
// perché i CCNL pagano «le ore prestate dalle 22 alle 6» e non i turni che le
// toccano. La seconda verifica il non-cumulo, che Commercio e Vigilanza
// scrivono a chiare lettere: la maggiorazione maggiore assorbe la minore.
//
// Il caso che tiene in piedi tutto il resto è il turno a cavallo: 20:00–02:00
// deve dare 240 minuti (dalle 22 alle 02), non 360 e non 0.

import {
  minutiInFasciaNotturna, pctNotturnoAggiuntiva, fasciaNotturna,
} from '../src/utils/notturno.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(34)} atteso ${String(atteso).padStart(4)} → ${String(avuto).padStart(4)}  ${perche}`);
}

// ── 1. Minuti in fascia, con la fascia di default 22:00–06:00 ──────────────
console.log('\nMinuti in fascia notturna (22:00–06:00, default)\n');

const minuti = [
  ['20:00', '02:00', 240, 'A CAVALLO: solo le 4 ore dopo le 22'],
  ['22:00', '06:00', 480, 'turno interamente notturno'],
  ['21:00', '23:00',  60, 'entra in fascia a metà turno'],
  ['05:00', '13:00',  60, "esce dalla fascia un'ora dopo l'inizio"],
  ['23:00', '07:00', 420, 'esce dalla fascia alle 06'],
  ['00:00', '06:00', 360, 'tutto dentro, dalla mezzanotte'],
  ['09:00', '17:00',   0, 'giornaliero'],
  ['06:00', '14:00',   0, 'comincia quando la fascia finisce'],
  ['14:00', '22:00',   0, 'finisce quando la fascia comincia'],
  ['06:00', '07:00',   0, 'mattina presto: era il falso positivo'],
  ['18:00', '02:00', 240, 'serale che sconfina'],
  ['02:00', '10:00', 240, 'comincia dentro la fascia della notte prima'],
  ['',      '06:00',   0, 'orario mancante'],
  ['22:00', '22:00',   0, 'durata nulla'],
];
for (const [da, a, atteso, perche] of minuti) {
  verifica(`${da || '—'}–${a || '—'}`, minutiInFasciaNotturna(da, a), atteso, perche);
}

// ── 2. Fascia diversa: il Turismo pubblici esercizi usa 23:00–06:00 ────────
console.log('\nFascia 23:00–06:00 (lavoratori notturni, pubblici esercizi)\n');

const turismo = { nightStart: '23:00', nightEnd: '06:00' };
verifica('20:00–02:00', minutiInFasciaNotturna('20:00', '02:00', turismo), 180, "un'ora in meno che con le 22");
verifica('22:00–23:00', minutiInFasciaNotturna('22:00', '23:00', turismo), 0, 'fuori fascia con questo contratto');
verifica('durata fascia', fasciaNotturna(turismo).durata, 420, '7 ore invece di 8');

// ── 3. Fascia non a cavallo della mezzanotte ───────────────────────────────
console.log('\nFascia 00:00–06:00 (non scavalca la mezzanotte)\n');

const mezzanotte = { nightStart: '00:00', nightEnd: '06:00' };
verifica('22:00–06:00', minutiInFasciaNotturna('22:00', '06:00', mezzanotte), 360, 'contano solo le ore dopo mezzanotte');
verifica('20:00–23:00', minutiInFasciaNotturna('20:00', '23:00', mezzanotte), 0, 'finisce prima della fascia');

// ── 4. Non cumulo: la maggiore assorbe la minore ───────────────────────────
console.log('\nSupplemento notturno secondo il cumulo\n');

const notte20 = { nightSurchargePct: 20 };
verifica('max, nessun altra magg.', pctNotturnoAggiuntiva(notte20, 0), 20, 'si applica tutta');
verifica('max, domenica 15%', pctNotturnoAggiuntiva(notte20, 15), 5, '20 assorbe 15: resta il supplemento');
verifica('max, festivo 40%', pctNotturnoAggiuntiva(notte20, 40), 0, '40 assorbe 20: nulla si aggiunge');
verifica('max, pari 20%', pctNotturnoAggiuntiva(notte20, 20), 0, 'nessun supplemento');
verifica('somma, domenica 15%', pctNotturnoAggiuntiva({ ...notte20, nightCumuloMode: 'somma' }, 15), 20, 'accordo che cumula');
verifica('maggiorazione spenta', pctNotturnoAggiuntiva({ nightSurchargePct: 0 }, 15), 0, 'motore identico a prima');

// ── 5. Il motore, in euro ──────────────────────────────────────────────────
// Le parti sopra provano la regola; questa prova che arriva in busta.
// Paga 10 €/h, turno 20:00–02:00 (6 h, di cui 4 in fascia), notturno 20%.

const { computePayByShift } = await import('../src/utils/pay.js');

function euro(settings, shift) {
  const map = computePayByShift([shift], settings);
  const p = map[shift.id];
  return {
    base: Math.round(p.base * 100) / 100,
    notte: Math.round(p.surchargeNight * 100) / 100,
    domenica: Math.round(p.surchargeSunday * 100) / 100,
    minutiNotte: p.nightMinutes,
    totale: Math.round((p.base + p.surcharge) * 100) / 100,
  };
}

// Un mercoledì qualunque, nessuna soglia settimanale che interferisca.
const turnoFeriale = { id: 't1', date: '2026-06-10', startTime: '20:00', endTime: '02:00' };
const base = { hourlyRate: 10, expectedWeeklyHours: 0, fullTimeWeeklyHours: 0 };

console.log('\nMotore — feriale 20:00–02:00, 10 €/h\n');
const spento = euro(base, turnoFeriale);
verifica('notturno spento: totale', spento.totale, 60, '6 h a 10 €, nessuna maggiorazione');

const acceso = euro({ ...base, nightSurchargePct: 20 }, turnoFeriale);
verifica('minuti in fascia', acceso.minutiNotte, 240, '4 ore su 6');
verifica('supplemento notturno', acceso.notte, 8, '40 € di base notturna al 20%');
verifica('totale', acceso.totale, 68, '60 + 8, NON 72 (che sarebbe il turno intero)');

// Domenica 7 giugno 2026: il non-cumulo deve mordere.
console.log('\nMotore — domenica 20:00–02:00, domenicale 15% e notturno 20%\n');
const turnoDomenica = { ...turnoFeriale, id: 't2', date: '2026-06-07' };
const dom = euro({ ...base, sundaySurchargePct: 15, nightSurchargePct: 20 }, turnoDomenica);
verifica('domenicale sul turno intero', dom.domenica, 9, '60 € al 15%');
verifica('supplemento notturno', dom.notte, 2, 'solo il 5% che eccede il domenicale');
verifica('totale', dom.totale, 71, '2 h diurne al 115% + 4 h notturne al 120%');

const domSomma = euro({ ...base, sundaySurchargePct: 15, nightSurchargePct: 20, nightCumuloMode: 'somma' }, turnoDomenica);
verifica('con cumulo a somma', domSomma.totale, 77, '60 + 9 + 8');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano, regola e motore.`);
