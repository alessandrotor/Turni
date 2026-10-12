// Il supplementare si conta a SETTIMANA, le ore ordinarie sono il MONTE ORE:
//
//   node scripts/check-supplementare-settimanale.mjs
//
// DA DOVE VIENE: dalla busta di SETTEMBRE 2026 (Zucchetti, CCNL Turismo,
// livello 5, part-time 24 h), confrontata coi turni veri segnati nell'app.
// Qui sotto ci sono solo le DURATE per giorno: niente orari, niente note.
//
// La busta stampa:  Retribuzione 59,20 h · Ferie 44,00 h · Supplementare 30
// 14,25 h · Magg. domenicale 10% 5,75 h. Le due regole che la ricostruiscono,
// al centesimo:
//
//  1. IL SUPPLEMENTARE È DELLA SETTIMANA (lun-dom): le ore oltre le 24 del
//     contratto, nel giorno in cui si superano. Ferie e permessi riempiono la
//     settimana per primi; la festività NON lavorata no, e nemmeno il festivo
//     lavorato, che ha la sua riga. Una settimana a cavallo resta una, e ogni
//     ora va nel mese del suo giorno. Sul mese (le ore oltre 103,20) settembre
//     dava 11,55 h, la busta ne paga 14,25.
//  2. LE ORE ORDINARIE SONO IL MONTE ORE, comunque distribuite: 59,20 + 44 =
//     103,20, mentre le ordinarie lavorate erano 56,50. Luglio 2026 il
//     contrario: 109,50 lavorate, 103,20 pagate.
//  E la DOMENICALE NON SI CUMULA col supplementare: le ore di domenica oltre
//  le 24 della settimana prendono il 30%, non il 30% + 10%. Il 27 settembre
//  (9,5 h) chiude una settimana da 38: tutto supplementare, zero domenicale.
//
// Sugli altri mesi, coi turni veri: luglio 6,00 h contro 6,50 stampate,
// agosto 18,50 contro 17,50 (contando la festività del 15 sarebbero 22,50).
// Uno scarto da orari segnati, non da regola: con la regola mensile erano
// 12,3 e 22,8. Giugno non si può provare, il backup ha 28 ore in meno.

import { computePayByShift, calcTotalPay } from '../src/motore/pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const vicino = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;

const RATE = 9.21802;
const S = {
  hourlyRate: RATE, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, workingDaysPerWeek: 6,
  ccnl: 'turismo', periodoConteggio: 'calendario',
  overtimeSurchargePct: 30, sundaySurchargePct: 10, holidaySurchargePct: 20,
};

// Durate in ore, giorno per giorno. Più numeri sullo stesso giorno = più turni.
const LAVORO = {
  '2026-09-14': [2.5], '2026-09-15': [5], '2026-09-16': [2.5], '2026-09-17': [2.5],
  '2026-09-18': [5.75], '2026-09-20': [6],
  '2026-09-22': [4, 6], '2026-09-24': [3, 6], '2026-09-25': [6], '2026-09-26': [3.5],
  '2026-09-27': [9.5],
  '2026-09-28': [5.25, 3.25], '2026-10-01': [4, 3], '2026-10-02': [6], '2026-10-03': [5, 5],
  '2026-10-04': [6], // San Francesco, festivo lavorato
};
const FERIE = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
  '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const turni = [];
for (const [date, ore] of Object.entries(LAVORO)) {
  let inizio = 6 * 60;
  for (const h of ore) {
    turni.push({ id: `${date}-${turni.length}`, date, startTime: hhmm(inizio), endTime: hhmm(inizio + h * 60) });
    inizio += h * 60 + 30;
  }
}
for (const date of FERIE) turni.push({ id: `F${date}`, date, type: 'ferie', durationMinutes: 240 });

const mappa = computePayByShift(turni, S);
const settembre = turni.filter((t) => t.date.startsWith('2026-09'));
const p = calcTotalPay(settembre, S, turni, mappa);
const domenicali = settembre.reduce((s, t) => s + mappa[t.id].sundayMinutes, 0) / 60;

console.log('\nSettembre 2026, coi turni veri\n');
esito(vicino(p.ferieMinutes / 60, 44), 'ferie: 44 h (il 31 agosto sta ad agosto)', `${p.ferieMinutes / 60} h`);
esito(vicino(p.overtimeMinutes / 60, 14.25), 'supplementare: 14,25 h, come in busta', `${p.overtimeMinutes / 60} h`);
esito(vicino(domenicali, 5.75), 'domenicale: 5,75 h, come in busta', `${domenicali} h`);
esito(vicino(mappa['2026-09-27-12'].sundayMinutes, 0) && vicino(mappa['2026-09-27-12'].overtimeMinutes, 570),
  'il 27 settembre è tutto supplementare, niente domenicale');
const ordinarie = (p.base - p.overtimeBase) / RATE;
esito(vicino(ordinarie, 103.2, 0.01), 'ore ordinarie pagate: 103,20 (59,20 + 44 di ferie)', `${ordinarie.toFixed(2)} h`);
esito(vicino(p.total, 1257.36 - 130, 0.01), 'lordo dai turni: 1.127,36 (busta 1.257,36 meno 130 di voci fisse)',
  `${p.total.toFixed(2)} €`);
const ottobre = turni.filter((t) => t.date.startsWith('2026-10'));
const oreSettembreOltre = settembre.filter((t) => t.date === '2026-09-28')
  .reduce((s, t) => s + mappa[t.id].overtimeMinutes, 0);
esito(oreSettembreOltre === 0 && calcTotalPay(ottobre, S, turni, mappa).overtimeMinutes > 0,
  'la settimana a cavallo: le ore oltre le 24 cadono a ottobre, e restano lì');

console.log('\nLe regole, su casi costruiti\n');
const lun = (g) => `2026-11-${String(g).padStart(2, '0')}`;
// Settimana del 2 novembre 2026: 6 h da lunedì a sabato, 6 la domenica = 42 h.
const settimana = [2, 3, 4, 5, 6, 7, 8].map((g) => ({ id: `n${g}`, date: lun(g), startTime: '08:00', endTime: '14:00' }));
const m1 = computePayByShift(settimana, { ...S, fullTimeWeeklyHours: 0 });
esito(vicino(m1.n8.overtimeMinutes, 360) && m1.n8.surchargeSunday === 0,
  'domenica oltre le 24: supplementare al 30%, senza il 10% sopra');
// Una festività non lavorata in settimana non riempie le 24 ore.
const conFestivita = [...settimana.slice(0, 4), { id: 'fest', date: lun(6), type: 'festivita', durationMinutes: 240 }];
const m2 = computePayByShift(conFestivita, S);
esito(Object.values(m2).every((v) => v.overtimeMinutes === 0), 'la festività non lavorata non spinge oltre le 24 (24 h + 4)');
// Senza CCNL mensilizzato vale lo stesso non cumulo.
const m3 = computePayByShift(settimana, { ...S, ccnl: '', fullTimeWeeklyHours: 0 });
esito(vicino(m3.n8.overtimeMinutes, 360) && m3.n8.surchargeSunday === 0, 'anche senza CCNL: la domenicale non si somma');
// La domenicale MAGGIORE del supplementare: resta la differenza.
const m4 = computePayByShift(settimana, { ...S, ccnl: '', fullTimeWeeklyHours: 0, sundaySurchargePct: 50 });
esito(vicino(m4.n8.surchargeSunday, 6 * RATE * 0.20, 0.01), 'domenicale al 50%: sulle ore supplementari resta il 20% in più');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
