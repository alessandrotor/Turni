// Lo straordinario si conta a SETTIMANA, anche sui contratti mensilizzati:
//
//   node src/motore/riscontri/check-straordinario-settimanale.mjs
//
// DA DOVE VIENE
// D.Lgs. 66/2003: l'orario normale è di 40 ore settimanali (art. 3), e lo
// straordinario è il lavoro prestato oltre quell'orario (art. 1, c. 2, lett. c).
// Il supplementare del part-time è un'altra cosa: oltre l'orario del contratto
// e fino alle 40, anche lui a settimana (check-supplementare-settimanale.mjs).
//
// IL DIFETTO
// Sul mensilizzato anche lo straordinario si contava sul mese: oltre le
// 40 × 4,3 = 172 ore. Una settimana da 45 ore in un mese da 100 non ne dava
// nessuna, e le 5 ore finivano al più nel supplementare. Segnalato da chi
// mantiene il progetto. Nessuna busta del progetto ha una settimana oltre le
// 40 ore; tutte quelle che ci sono tornano come prima (gli altri riscontri).
//
// COSA SI VERIFICA
// Una settimana da 45 ore: 5 ore di straordinario, e 16 di supplementare (da
// 24 a 40). Settimane sotto le 40: solo supplementare. La settimana a cavallo
// di due mesi resta una. Le ferie non sono lavoro prestato. E le ore
// straordinarie non si contano due volte: non sono anche supplementari.

import { computePayByShift } from '../pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const S = {
  hourlyRate: 10, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo',
  overtimeSurchargePct: 30, straordinarioSurchargePct: 40, periodoConteggio: 'calendario',
};
const turno = (date, ore, extra = {}) => ({
  id: date, date, startTime: '06:00', endTime: `${String(6 + Math.floor(ore)).padStart(2, '0')}:${ore % 1 ? '30' : '00'}`, ...extra,
});
const somma = (mappa, campo) => Object.values(mappa).reduce((t, v) => t + (v[campo] || 0), 0) / 60;

console.log('\nUna settimana da 45 ore in un mese basso\n');
// lun 5 – sab 10 ottobre 2026: 9 × 5 = 45 ore. Il mese fa 45 ore, sotto 103,20.
const settimana = ['05', '06', '07', '08', '09'].map((g) => turno(`2026-10-${g}`, 9));
const a = computePayByShift(settimana, S);
esito(somma(a, 'straordinarioMinutes') === 5, '5 ore di straordinario', `${somma(a, 'straordinarioMinutes')} h`);
esito(somma(a, 'overtimeMinutes') === 16, 'e 16 di supplementare, da 24 a 40', `${somma(a, 'overtimeMinutes')} h`);
esito(a['2026-10-09'].straordinarioMinutes === 300, 'sono le ultime, quelle di venerdì');

console.log('\nUn mese oltre il monte ore, settimane sotto le 40\n');
const mese = [];
for (let g = 1; g <= 30; g += 1) {
  const d = new Date(2026, 9, g);
  if (d.getDay() !== 0 && d.getDay() !== 6) mese.push(turno(`2026-10-${String(g).padStart(2, '0')}`, 5.5));
}
const b = computePayByShift(mese, S);
const lavorate = mese.length * 5.5;
// Riconteggio indipendente: per ogni settimana lun-dom, le ore oltre le 24
// fino alle 40.
const oltre24 = (turni, oreDi) => {
  const sett = new Map();
  for (const t of turni) {
    const d = new Date(`${t.date}T12:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    sett.set(k, (sett.get(k) || 0) + oreDi(t));
  }
  return [...sett.values()].reduce((x, h) => x + Math.max(0, Math.min(h, 40) - 24), 0);
};
esito(somma(b, 'straordinarioMinutes') === 0, 'nessuno straordinario', `${lavorate} h su ${mese.length} giorni`);
esito(Math.abs(somma(b, 'overtimeMinutes') - oltre24(mese, () => 5.5)) < 0.01, 'supplementare = ore oltre le 24 di ogni settimana',
  `${somma(b, 'overtimeMinutes').toFixed(2)} h`);

console.log('\nLa settimana a cavallo di due mesi resta una\n');
// lun 28 settembre – ven 2 ottobre: tre giorni a settembre, due a ottobre, 9 h l'uno.
const cavallo = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((d) => turno(d, 9));
const c = computePayByShift(cavallo, S);
esito(c['2026-10-02'].straordinarioMinutes === 300, 'le 5 ore oltre le 40 cadono il 2 ottobre');

console.log('\nLe ferie non sono lavoro prestato\n');
const conFerie = [...settimana.slice(0, 4), turno('2026-10-09', 9, { type: 'ferie' })];
const f = computePayByShift(conFerie, S);
esito(somma(f, 'straordinarioMinutes') === 0, '36 h lavorate + 9 di ferie: nessuno straordinario');

console.log('\nLe ore si sommano al lavorato, una volta sola\n');
const lungo = [...mese.filter((s) => s.date < '2026-10-19' || s.date > '2026-10-23'),
  ...['19', '20', '21', '22', '23'].map((g) => turno(`2026-10-${g}`, 9))];
const d = computePayByShift(lungo, S);
const ore = lungo.reduce((t, s) => t + (s.date >= '2026-10-19' && s.date <= '2026-10-23' ? 9 : 5.5), 0);
const str = somma(d, 'straordinarioMinutes');
const sup = somma(d, 'overtimeMinutes');
esito(str === 5, 'la settimana da 45 dà 5 ore di straordinario', `${str} h`);
const oreDi = (s) => (s.date >= '2026-10-19' && s.date <= '2026-10-23' ? 9 : 5.5);
esito(Math.abs(sup - oltre24(lungo, oreDi)) < 0.01, 'il supplementare sta fra 24 e 40, lo straordinario oltre',
  `${sup.toFixed(2)} h su ${ore} lavorate`);

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
