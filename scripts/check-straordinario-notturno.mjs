// Lo straordinario notturno del CCNL Turismo:
//
//   node scripts/check-straordinario-notturno.mjs
//
// DA DOVE VIENE: dal contratto, non da una busta — nessuna busta del progetto
// ha uno straordinario. CCNL Turismo Confcommercio, lavoro straordinario: 30%
// di giorno, 60% di notte fra le 24 e le 6, e le maggiorazioni non si
// cumulano (la maggiore assorbe la minore). Schede dei pubblici esercizi e
// delle aziende alberghiere su ilccnl.it, ottobre 2026.
//
// COSA SI VERIFICA: una settimana arriva a 40 ore, poi un turno 20:00–02:00
// sfora di 2 ore, e sono proprio quelle fra mezzanotte e le due. Valgono il
// 60%, e la maggiorazione notturna ordinaria su quei minuti non si aggiunge.
// Senza CCNL la regola non c'è. E di giorno resta il 30%.

import { computePayByShift } from '../src/motore/pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const vicino = (a, b) => Math.abs(a - b) < 0.005;

const R = 10;
const S = {
  hourlyRate: R, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo', periodoConteggio: 'calendario',
  overtimeSurchargePct: 30, straordinarioSurchargePct: 30, nightSurchargePct: 25,
};
// Lunedì 9 – giovedì 12 novembre 2026, 9 h di giorno: 36 h. Venerdì 13
// 20:00–02:00: 6 h, le ultime 2 oltre le 40, fra mezzanotte e le 2.
const giorno = (g) => ({ id: `g${g}`, date: `2026-11-${String(g).padStart(2, '0')}`, startTime: '08:00', endTime: '17:00' });
const notte = { id: 'notte', date: '2026-11-13', startTime: '20:00', endTime: '02:00' };
const settimana = [giorno(9), giorno(10), giorno(11), giorno(12), notte];

console.log('\nCCNL Turismo: 60% fra le 24 e le 6\n');
const m = computePayByShift(settimana, S).notte;
esito(m.straordinarioMinutes === 120, '2 ore di straordinario', `${m.straordinarioMinutes} min`);
esito(vicino(m.surchargeStraordinario, 2 * R * 0.60), 'pagate al 60%, non al 30%', `${m.surchargeStraordinario.toFixed(2)} €`);
// Fascia notturna del Turismo 23–06: 3 ore notturne (23–02). Il 25% resta
// solo sull'ora 23–24, le due ore straordinarie lo hanno già dentro il 60%.
esito(m.nightMinutes === 180, '3 ore in fascia notturna (23–02)', `${m.nightMinutes} min`);
esito(vicino(m.surchargeNight, 1 * R * 0.25), 'il notturno ordinario resta solo sull\'ora 23–24', `${m.surchargeNight.toFixed(2)} €`);

console.log('\nDove la regola non vale\n');
const giornoLungo = { id: 'giorno', date: '2026-11-13', startTime: '08:00', endTime: '14:00' };
const d = computePayByShift([...settimana.slice(0, 4), giornoLungo], S).giorno;
esito(vicino(d.surchargeStraordinario, 2 * R * 0.30), 'di giorno lo straordinario resta al 30%');
const senza = computePayByShift(settimana, { ...S, ccnl: '' }).notte;
esito(vicino(senza.surchargeStraordinario, 2 * R * 0.30), 'senza CCNL nessun 60%: la regola è del contratto');
// Il turno di notte senza straordinario non cambia: la settimana resta a 30 h.
const solo = computePayByShift([giorno(9), giorno(10), notte, giorno(12)], S).notte;
esito(solo.straordinarioMinutes === 0 && vicino(solo.surchargeNight, 3 * R * 0.25), 'senza straordinario, il notturno di sempre');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
