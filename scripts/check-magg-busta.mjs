// Riscontro delle percentuali di maggiorazione:
//
//   node scripts/check-magg-busta.mjs
//
// Due parti. La prima prova la regola di conversione; la seconda i NUMERI VERI
// di una busta, che sono la ragione per cui quella regola esiste.
//
// I dati vengono da un cedolino CCNL turismo, pubblici esercizi, part-time 60%
// livello 6S, gennaio 2025, paga base 8,44942 €/h. Nel repository non entra
// nessuna busta: solo le cifre necessarie, senza dati personali.
//
// Il caso che conta: la voce «Magg. fest. 120%» significa che ogni ora di quel
// giorno vale il 120% del normale, cioe' +20%. Chi copia 120 nel campo dell'app
// — che chiede «quanto in piu'» — si ritrova quel giorno gonfiato dell'83%.

import { normalizzaMaggiorazione, messaggioMaggiorazione, MAGGIORAZIONE_MASSIMA_NOTA } from '../src/utils/maggiorazioni.js';
import { computePayByShift } from '../src/utils/pay.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(42)} atteso ${String(atteso).padStart(8)} → ${String(avuto).padStart(8)}  ${perche}`);
}

// ── 1. La regola di conversione ────────────────────────────────────────────
console.log('\nValori che sono un TOTALE: si convertono\n');

for (const [scritto, atteso] of [[120, 20], [150, 50], [220, 120], [101, 1]]) {
  const e = normalizzaMaggiorazione(scritto);
  verifica(`${scritto} → maggiorazione`, e.valore, atteso, 'la base era dentro');
  verifica(`  ${scritto}: segnalato come convertito`, e.convertito, true, '');
}

console.log('\nValori plausibili: non si toccano\n');

for (const v of [10, 20, 25, 30, 50, MAGGIORAZIONE_MASSIMA_NOTA]) {
  const e = normalizzaMaggiorazione(v);
  verifica(`${v} resta ${v}`, e.valore, v, '');
  verifica(`  ${v}: nessun avviso`, e.convertito || e.sospetto, false, '');
}

console.log('\nZona grigia: si avvisa, non si tocca\n');

for (const v of [80, 99, 100]) {
  const e = normalizzaMaggiorazione(v);
  verifica(`${v} resta ${v}`, e.valore, v, v === 100 ? 'sottrarre darebbe zero' : 'piu alta di ogni CCNL noto');
  verifica(`  ${v}: avvisa`, e.sospetto, true, '');
  verifica(`  ${v}: NON converte`, e.convertito, false, '');
}

console.log('\nIngressi vuoti o strani: silenzio\n');

for (const v of ['', null, undefined, 0, 'abc']) {
  const e = normalizzaMaggiorazione(v);
  verifica(`${JSON.stringify(v)} invariato`, e.valore, v, 'un campo vuoto deve restare vuoto');
  verifica(`  ${JSON.stringify(v)}: nessun avviso`, e.convertito || e.sospetto, false, '');
}

console.log('\nIl messaggio\n');
verifica('convertito: cita entrambi i numeri',
  /120.*20|20.*120/.test(messaggioMaggiorazione(normalizzaMaggiorazione(120))), true, '');
verifica('sospetto: cita il massimo noto',
  messaggioMaggiorazione(normalizzaMaggiorazione(80)).includes(String(MAGGIORAZIONE_MASSIMA_NOTA)), true, '');
verifica('valore normale: nessun messaggio',
  messaggioMaggiorazione(normalizzaMaggiorazione(20)), null, '');

// ── 2. I numeri della busta ────────────────────────────────────────────────
console.log('\nBusta gennaio 2025 — festivo di 6,75 h, paga 8,44942 €/h\n');

const BASE = 8.44942;
const s = { hourlyRate: BASE, expectedWeeklyHours: 0, fullTimeWeeklyHours: 0 };
// 1 gennaio 2026: festivo, 6 ore e 45 minuti come sulla busta.
const turno = { id: 'f', date: '2026-01-01', startTime: '09:00', endTime: '15:45', breakMinutes: 0 };
const euro = (pct) => {
  const p = computePayByShift([turno], { ...s, holidaySurchargePct: pct }).f;
  return Math.round((p.base + p.surcharge) * 100) / 100;
};

verifica('con 20 (giusto)', euro(20), 68.44, 'esattamente quanto stampa la busta');
verifica('con 120 (copiato dal cedolino)', euro(120), 125.47, 'un giorno gonfiato dell 83%');
verifica('  e la conversione porta a 20', normalizzaMaggiorazione(120).valore, 20, 'che e il valore giusto');

console.log('\nCome sono pagate le altre voci\n');

// Domenicale e notturno: la busta paga la SOLA maggiorazione (base × 0,10 e
// × 0,25). Il motore fa lo stesso: sono un'aggiunta alla base, non un
// sostituto.
const dom = computePayByShift([{ id: 'd', date: '2026-01-04', startTime: '09:00', endTime: '10:00', breakMinutes: 0 }],
  { ...s, sundaySurchargePct: 10 }).d;
verifica('domenicale 10%: solo la maggiorazione',
  Math.round(dom.surchargeSunday * 10000) / 10000, Math.round(BASE * 0.10 * 10000) / 10000, 'base × 0,10');

const notte = computePayByShift([{ id: 'n', date: '2026-01-07', startTime: '00:00', endTime: '01:00', breakMinutes: 0 }],
  { ...s, nightSurchargePct: 25, nightStart: '22:00', nightEnd: '06:00' }).n;
verifica('notturno 25%: solo la maggiorazione',
  Math.round(notte.surchargeNight * 10000) / 10000, Math.round(BASE * 0.25 * 10000) / 10000, 'base × 0,25');

// Supplementare: la busta lo paga come ORA INTERA al 130% (base × 1,30), ed e'
// la proprieta' che il riepilogo del mese usa per affiancare le due colonne.
// Serve una soglia settimanale da superare, altrimenti il supplementare non
// scatta affatto: soglia di 1 ora, due turni da un'ora nella stessa settimana,
// e il secondo e' tutto supplementare. (12 e 13 gennaio 2026 sono lunedi e
// martedi, nessun festivo di mezzo.)
const supMap = computePayByShift([
  { id: 's0', date: '2026-01-12', startTime: '09:00', endTime: '10:00', breakMinutes: 0 },
  { id: 's1', date: '2026-01-13', startTime: '09:00', endTime: '10:00', breakMinutes: 0 },
], { ...s, expectedWeeklyHours: 1, fullTimeWeeklyHours: 0, overtimeSurchargePct: 30 });
const sup = supMap.s1;
verifica('supplementare 30%: ora intera al 130%',
  Math.round((sup.overtimeBase + sup.surchargeOvertime) * 10000) / 10000,
  Math.round(BASE * 1.30 * 10000) / 10000, 'base × 1,30');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
