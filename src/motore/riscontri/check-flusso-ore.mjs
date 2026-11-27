// Il diagramma «dove vanno le ore», riscontrato con:
//
//   node src/motore/riscontri/check-flusso-ore.mjs
//
// PERCHÉ ESISTE
// `flussoOre` (flusso-ore.js) riaffetta i campi di `computePayByShift` per
// disegnare da che giornate vengono le ore e in quale voce della busta
// finiscono. Non aggiunge regole, quindi non ha una busta da cui venire: il
// suo riscontro è che non perda e non inventi niente.
//
//  1. voci + maggiorazioni = `calcTotalPay(...).total`, al centesimo: il
//     diagramma e la barra del mese dicono la stessa cifra;
//  2. ogni ora segnata parte da un'origine sola, e ogni voce riceve quanto le
//     arriva dai flussi;
//  3. i due flussi che la busta non scrive tornano coi numeri del monte ore:
//     a mese chiuso la retribuzione è il monte intero (103,20 h, luglio 2026)
//     anche se parte delle ore è supplementare; un mese che ha già il monte
//     pieno mette le ore in più in «già nel monte», a zero euro.

import { computePayByShift, calcTotalPay, calcShiftMinutes } from '../pay.js';
import { flussoOre } from '../flusso-ore.js';

let falliti = 0;
let totale = 0;
function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(52)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// CCNL Turismo, livello 5, part-time 60%: la busta di riferimento.
const S = {
  hourlyRate: 9.21802, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, workingDaysPerWeek: 6,
  sundaySurchargePct: 10, holidaySurchargePct: 20, nightSurchargePct: 25,
  overtimeSurchargePct: 30, straordinarioSurchargePct: 50,
  holidaySundayMode: 'max', nightCumuloMode: 'max',
  ccnl: 'turismo', aziendaDipendenti: 'oltre15', absenceHoursPerDay: 4,
  periodoConteggio: 'calendario',
};
const T = (data, startTime, endTime, extra = {}) => ({
  id: `${data}-${startTime}`, date: data, startTime, endTime, breakMinutes: 0, ...extra,
});
const g = (n) => String(n).padStart(2, '0');
const cent = (n) => Math.round(n * 100);
const somma = (xs) => xs.reduce((t, x) => t + x.minuti, 0);

function controllaInvarianti(nome, turni, opzioni = {}) {
  const per = computePayByShift(turni, S, opzioni);
  const mese = calcTotalPay(turni, S, turni, per);
  const f = flussoOre(turni, per, S);
  verifica(`${nome}: voci + maggiorazioni = totale`, cent(f.totale), cent(mese.total), `${mese.total.toFixed(2)} €`);
  const segnate = turni.reduce((t, s) => t + calcShiftMinutes(s), 0);
  const daiTurni = somma(f.origini.filter((o) => o.id !== 'monte'));
  verifica(`${nome}: ogni ora segnata parte una volta`, Math.round(daiTurni), segnate, '');
  const entrano = Object.fromEntries(f.voci.map((v) => [v.id, Math.round(v.minuti)]));
  const arrivano = {};
  for (const x of f.flussi) arrivano[x.a] = Math.round((arrivano[x.a] || 0) + x.minuti);
  verifica(`${nome}: ogni voce riceve i suoi flussi`, arrivano, entrano, '');
  return f;
}

// ── 1. Un mese che tocca tutte le strade ─────────────────────────────────
console.log('\nUn mese con tutto: domeniche, notti, festivo, assenze, supplementare\n');
const PIENO = [
  ...Array.from({ length: 12 }, (_, i) => T(`2026-06-${g(i + 3)}`, '16:00', '22:00')),
  T('2026-06-02', '09:00', '15:45'),                          // Festa della Repubblica
  T('2026-06-14', '18:00', '23:30'),                          // domenica + notte
  T('2026-06-16', '18:00', '01:00', { breakMinutes: 30 }),    // notte con pausa
  T('2026-06-17', '09:00', '17:00', { surchargePct: 15 }),    // a mano
  { id: 'f1', date: '2026-06-18', type: 'ferie', durationMinutes: 240 },
  { id: 'p1', date: '2026-06-19', type: 'permesso', durationMinutes: 120 },
  { id: 'm1', date: '2026-06-20', type: 'malattia', durationMinutes: 240 },
  ...Array.from({ length: 6 }, (_, i) => T(`2026-06-${22 + i}`, '15:00', '23:00')),
];
const f1 = controllaInvarianti('giugno', PIENO);
const ids = (xs) => xs.map((x) => x.id).sort();
verifica('le origini ci sono tutte', ids(f1.origini),
  ['domeniche', 'feriali', 'ferie', 'festivi', 'malattia', 'monte', 'permesso'].sort(), '');
verifica('il festivo lavorato ha la sua voce', f1.voci.some((v) => v.id === 'festivo' && v.minuti === 405), true, '6,75 h');
verifica('notturno e a mano stanno a parte', ids(f1.maggiorazioni), ['manuale', 'notturno'], 'la domenica è già supplementare');

// ── 2. Mese chiuso: la retribuzione è il monte ore intero ────────────────
// Quattro settimane da 32 ore: 8 supplementari a settimana, 96 ordinarie
// lavorate. La busta paga comunque le 103,20 del monte: le 7,20 in più non
// vengono da un turno, le garantisce il contratto.
console.log('\nMese chiuso con molto supplementare\n');
const LUGLIO = [];
for (const lun of [6, 13, 20, 27]) for (let d = 0; d < 4; d++) LUGLIO.push(T(`2026-07-${g(lun + d)}`, '10:00', '18:00'));
const f2 = controllaInvarianti('luglio', LUGLIO);
const voce = (f, id) => f.voci.find((v) => v.id === id);
verifica('retribuzione = monte ore', Math.round(voce(f2, 'retribuzione').minuti), 6192, '103,20 h');
verifica('il monte ore ne mette 7,20', Math.round(f2.origini.find((o) => o.id === 'monte').minuti), 432, '');
verifica('supplementare', Math.round(voce(f2, 'supplementare').minuti), 1920, '32 h');

// ── 3. Monte già pieno: le ore in più si vedono, a zero euro ─────────────
// Ottobre 2026 in corso, 18 turni da 6 ore senza superare le 24 a settimana:
// 108 h contro un monte di 103,20.
console.log('\nMonte ore già pieno\n');
const OTTOBRE = ['01', '02', '03', '05', '06', '07', '08', '12', '13', '14', '15', '19', '20', '21', '22', '26', '27', '28']
  .map((d) => T(`2026-10-${d}`, '08:00', '14:00'));
const f3 = controllaInvarianti('ottobre in corso', OTTOBRE, { oggi: new Date(2026, 9, 20) });
verifica('già nel monte: 4,80 h', Math.round(voce(f3, 'giaNelMonte').minuti), 288, '');
verifica('a zero euro', voce(f3, 'giaNelMonte').euro, 0, '');
verifica('nessun supplementare', voce(f3, 'supplementare'), undefined, 'entro le 24 a settimana');

// ── 4. Le settimane: il supplementare comincia alla linea delle 24 ore ────
// La vista «settimane» rimette le stesse ore nelle settimane lun-dom. Deve
// sommare alle voci, e in una settimana tutta nel mese il supplementare deve
// cominciare esattamente dopo le 24 ore del contratto.
console.log('\nSettimana per settimana\n');
const tot = (f, campo) => Math.round(f.settimane.reduce((t, w) => t + w[campo], 0));
verifica('luglio: quattro settimane', f2.settimane.map((w) => w.inizio), ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'], '');
verifica('ogni settimana: 24 h ordinarie, 8 supplementari', f2.settimane.map((w) => [w.ordinarie, w.supplementare]),
  Array(4).fill([1440, 480]), 'la linea è il contratto');
verifica('le settimane sommano al supplementare', tot(f2, 'supplementare'), Math.round(voce(f2, 'supplementare').minuti), '');
verifica('e ai suoi euro', cent(f2.settimane.reduce((t, w) => t + w.euroSupplementare, 0)), cent(voce(f2, 'supplementare').euro), '');
const ore = (w) => w.ferie + w.permesso + w.malattia + w.ordinarie + w.supplementare + w.straordinario + w.festivo + w.festivita;
verifica('giugno: le settimane contengono ogni ora segnata', Math.round(f1.settimane.reduce((t, w) => t + ore(w), 0)),
  PIENO.reduce((t, s) => t + calcShiftMinutes(s), 0), '');
verifica('il monte ore del mensilizzato', f2.monte && [Math.round(f2.monte.pagate), Math.round(f2.monte.monte)], [6192, 6192], '');
// Una settimana a cavallo: le ore di fine settembre riempiono la soglia della
// settimana che finisce in ottobre, e si dichiarano.
const CAVALLO = [T('2026-09-29', '08:00', '16:00'), T('2026-09-30', '08:00', '16:00'), T('2026-10-01', '08:00', '16:00'), T('2026-10-02', '08:00', '16:00')];
const ottobre = CAVALLO.slice(2);
const perC = computePayByShift(CAVALLO, S);
const fc = flussoOre(ottobre, perC, S, CAVALLO);
verifica('settimana a cavallo: 16 h dall\'altro mese', fc.settimane[0].altroMese, 960, '');
verifica('e il supplementare comincia prima della linea', fc.settimane[0].supplementare, 480, '8 h su 16 di ottobre');

// ── 5. Niente da mostrare ────────────────────────────────────────────────
const vuoto = flussoOre([], {}, S);
verifica('mese vuoto', [vuoto.origini.length, vuoto.voci.length, vuoto.totale], [0, 0, 0], '');

console.log(falliti === 0
  ? `\n${totale} controlli: il diagramma non perde e non inventa ore.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
