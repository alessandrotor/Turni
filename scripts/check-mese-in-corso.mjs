// RISCONTRO: nel mese in corso il lordo sale coi turni che si segnano; a mese
// chiuso vale la busta.
//
//   node scripts/check-mese-in-corso.mjs
//
// DA DOVE VIENE. Ottobre 2026, segnalato da chi usa l'app: 133 h segnate al 20
// del mese, di cui 39 supplementari. Con la regola dei mesi chiusi le ore
// supplementari riempivano anche il monte ore (103,20 h): il monte risultava
// pieno a metà mese, e i turni aggiunti dopo lasciavano il lordo fermo a
// 1.621,94 €. Il conto finale era giusto, ma sembrava un guasto.
//
// La regola: finché il mese è in corso le ore ordinarie sono le ore segnate
// MENO i supplementari, fino al monte ore. A mese chiuso resta la busta
// (luglio 2026: 109,5 h lavorate, 103,20 pagate; settembre: il monte pieno
// con le ferie dentro) — e quei numeri non devono muoversi di un centesimo.
// «Oggi» lo passa chi chiama: senza, ogni mese è chiuso.
import { computePayByShift, calcTotalPay } from '../src/motore/pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio && !ok ? '  — ' + dettaglio : ''}`);
};
const S = { hourlyRate: 10, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo', overtimeSurchargePct: 30, periodoConteggio: 'calendario' };
const turno = (data, inizio, fine) => ({ id: `${data}-${inizio}`, date: data, startTime: inizio, endTime: fine, breakMinutes: 0 });
// Novembre 2026: due settimane da 33 h (9 h supplementari ciascuna), poi da 24 h.
const settimana = (lun, ore) => {
  const giorni = [0, 1, 2, 3, 4, 5].map((k) => { const d = new Date(`${lun}T12:00`); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); });
  return ore === 33
    ? [turno(giorni[0], '08:00', '17:00'), turno(giorni[1], '08:00', '16:00'), turno(giorni[2], '08:00', '16:00'), turno(giorni[3], '08:00', '16:00')]
    : [turno(giorni[0], '08:00', '14:00'), turno(giorni[1], '08:00', '14:00'), turno(giorni[2], '08:00', '14:00'), turno(giorni[3], '08:00', '14:00')];
};
const prime = [...settimana('2026-11-02', 33), ...settimana('2026-11-09', 33)];
const lordo = (turni, oggi) => {
  const map = computePayByShift(turni, S, { oggi });
  return calcTotalPay(turni.filter((t) => t.date.startsWith('2026-11')), S, turni, map).total;
};
const inCorso = new Date(2026, 10, 15);
const chiuso = new Date(2026, 11, 5);

console.log('\nIl mese in corso sale coi turni\n');
const a = lordo(prime, inCorso);
esito(Math.abs(a - (48 * 10 + 18 * 13)) < 0.01, 'due settimane da 33 h: 48 h ordinarie + 18 h supplementari, non il monte pieno', a.toFixed(2));
const b = lordo([...prime, ...settimana('2026-11-16', 24)], inCorso);
esito(Math.abs(b - a - 240) < 0.01, 'una settimana da 24 h in più fa salire il lordo di 24 h', (b - a).toFixed(2));
const quattro = [...prime, ...settimana('2026-11-16', 24), ...settimana('2026-11-23', 24), turno('2026-11-30', '08:00', '14:00')];
const monte = 24 * 4.3;
const c = lordo(quattro, inCorso);
esito(Math.abs(c - (102 * 10 + 18 * 13)) < 0.01, 'ottobre: 120 h segnate, 18 supplementari → 102 h ordinarie, non il monte già pieno', c.toFixed(2));
// Luglio 2027 (nessuna festività): cinque settimane da 24 h sono 120 h ordinarie.
const luglio = ['2027-07-01', '2027-07-02', '2027-07-03', '2027-07-04', ...['2027-07-05', '2027-07-12', '2027-07-19', '2027-07-26']
  .flatMap((l) => settimana(l, 24).map((t) => t.date))].map((g) => turno(g, '08:00', '14:00'));
const d = calcTotalPay(luglio, S, luglio, computePayByShift(luglio, S, { oggi: new Date(2027, 6, 31) })).total;
esito(Math.abs(d - monte * 10) < 0.01, 'e si ferma al monte ore: 120 h ordinarie segnate, 103,20 pagate', d.toFixed(2));

console.log('\nIl mese chiuso resta quello della busta\n');
esito(Math.abs(lordo(quattro, chiuso) - lordo(quattro, null)) < 0.005, 'a mese chiuso, la stessa cifra di prima (senza «oggi»)');
esito(Math.abs(lordo(quattro, chiuso) - (monte * 10 + 18 * 13)) < 0.01, 'a mese chiuso il monte spetta comunque', lordo(quattro, chiuso).toFixed(2));
const ottobre = [...settimana('2026-10-05', 33), ...settimana('2026-10-12', 33)];
const tutti = [...ottobre, ...prime];
const mOggi = computePayByShift(tutti, S, { oggi: inCorso }), mSenza = computePayByShift(tutti, S);
esito(ottobre.every((t) => JSON.stringify(mOggi[t.id]) === JSON.stringify(mSenza[t.id])), 'i mesi prima di oggi non cambiano di un centesimo');

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nIl mese in corso sale coi turni, quelli chiusi restano della busta.\n');
process.exit(falliti ? 1 : 0);
