// Riscontro del modulo cosa-cambia.js
// Verifica che il calcolo del delta ore, lordo, netto e soglie sia esatto.

import { calcolaCosaCambia, formatDeltaCurrency, formatDeltaMinutes } from '../src/utils/cosa-cambia.js';
import { computePayByShift } from '../src/utils/pay.js';
import { computeAnnualGrossFromShifts, projectAnnualIncome } from '../src/utils/net.js';
import { calcBonusMargin } from '../src/utils/bonus.js';

let falliti = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    falliti += 1;
  }
}

const settingsBase = {
  hourlyRate: 10,
  expectedWeeklyHours: 40,
  sundaySurchargePct: 20,
  nightSurchargePct: 20,
  nightStart: '22:00',
  nightEnd: '06:00',
};

// Scenario 1: Nessun turno precedente, aggiunta di un turno di 8 ore
{
  const candidato = { date: '2026-09-15', startTime: '08:00', endTime: '16:00', breakMinutes: 0 };
  const res = calcolaCosaCambia({ candidateShift: candidato, originalShift: null, allShifts: [], settings: settingsBase });

  assert(res !== null, 'Risultato non nullo per nuovo turno');
  assert(res.deltaMinuti === 480, `Delta minuti deve essere 480, trovato ${res.deltaMinuti}`);
  assert(res.deltaLordo === 80, `Delta lordo deve essere 80 €, trovato ${res.deltaLordo}`);
  assert(res.deltaNetto > 0, `Delta netto deve essere positivo, trovato ${res.deltaNetto}`);
  assert(res.testoDeltaOre === '+8h', `Testo ore deve essere +8h, trovato ${res.testoDeltaOre}`);
}

// Scenario 2: Modifica di un turno (da 8h a 10h, +2 ore)
{
  const originale = { id: 's1', date: '2026-09-16', startTime: '08:00', endTime: '16:00', breakMinutes: 0 };
  const allShifts = [originale];
  const candidato = { id: 's1', date: '2026-09-16', startTime: '08:00', endTime: '18:00', breakMinutes: 0 };

  const res = calcolaCosaCambia({ candidateShift: candidato, originalShift: originale, allShifts, settings: settingsBase });
  assert(res.deltaMinuti === 120, `Delta minuti deve essere +120 (+2h), trovato ${res.deltaMinuti}`);
  assert(res.deltaLordo === 20, `Delta lordo deve essere +20 €, trovato ${res.deltaLordo}`);
  assert(res.deltaNetto > 0, `Delta netto deve essere positivo, trovato ${res.deltaNetto}`);
  assert(res.testoDeltaOre === '+2h', `Testo ore deve essere +2h, trovato ${res.testoDeltaOre}`);
}

// Scenario 3: Modifica di un turno accorciandolo (da 8h a 4h, -4 ore)
{
  const originale = { id: 's2', date: '2026-09-17', startTime: '08:00', endTime: '16:00', breakMinutes: 0 };
  const allShifts = [originale];
  const candidato = { id: 's2', date: '2026-09-17', startTime: '08:00', endTime: '12:00', breakMinutes: 0 };

  const res = calcolaCosaCambia({ candidateShift: candidato, originalShift: originale, allShifts, settings: settingsBase });
  assert(res.deltaMinuti === -240, `Delta minuti deve essere -240 (-4h), trovato ${res.deltaMinuti}`);
  assert(res.deltaLordo === -40, `Delta lordo deve essere -40 €, trovato ${res.deltaLordo}`);
  assert(res.deltaNetto < 0, `Delta netto deve essere negativo, trovato ${res.deltaNetto}`);
  assert(res.testoDeltaOre === '−4h', `Testo ore deve essere −4h, trovato ${res.testoDeltaOre}`);
}

// Scenario 4: Cancellazione turno (candidato null)
{
  const originale = { id: 's3', date: '2026-09-18', startTime: '08:00', endTime: '16:00', breakMinutes: 0 };
  const allShifts = [originale];

  const res = calcolaCosaCambia({ candidateShift: null, originalShift: originale, allShifts, settings: settingsBase });
  assert(res.deltaMinuti === -480, `Delta minuti per cancellazione deve essere -480, trovato ${res.deltaMinuti}`);
  assert(res.deltaLordo === -80, `Delta lordo per cancellazione deve essere -80, trovato ${res.deltaLordo}`);
  assert(res.deltaNetto < 0, `Delta netto per cancellazione deve essere negativo, trovato ${res.deltaNetto}`);
}

// Scenario 5: Formattatori
assert(formatDeltaCurrency(74.5) === '+74,50 €', 'formatDeltaCurrency positivo');
assert(formatDeltaCurrency(-32) === '−32,00 €', 'formatDeltaCurrency negativo');
assert(formatDeltaCurrency(0) === '0,00 €', 'formatDeltaCurrency zero');
assert(formatDeltaMinutes(90) === '+1h 30m', 'formatDeltaMinutes positivo misto');
assert(formatDeltaMinutes(-45) === '−45m', 'formatDeltaMinutes negativo solo minuti');

// Scenario 6: la soglia dei 15.000 è sul REDDITO COMPLESSIVO, non sul lordo.
// Difetto trovato il 23/09/2026: la proiezione (lordo) veniva confrontata con
// 15.000 (imponibile), e «Supera la soglia» compariva con ~1.500 € d'anticipo
// mentre la striscia del bonus diceva ancora che c'era margine. Anno passato e
// modalità «ytd»: la proiezione è esattamente il lordo dei turni, niente altro.
{
  const S6 = { hourlyRate: 10, expectedWeeklyHours: 40, fullTimeWeeklyHours: 40, tiProjectionMode: 'ytd' };
  const feriali = [];
  for (let d = new Date(2025, 0, 1); d.getFullYear() === 2025; d.setDate(d.getDate() + 1)) {
    const g = d.getDay();
    if (g !== 0 && g !== 6) feriali.push(`2025-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const annoCon = (n) => feriali.slice(0, n).map((date, i) => ({ id: `a${i}`, date, startTime: '09:00', endTime: '16:00', breakMinutes: 0 }));
  const proiezione = (turni) => projectAnnualIncome(
    computeAnnualGrossFromShifts(2025, turni, S6, computePayByShift(turni, S6)).total, 0, S6, 2025).value;
  const sogliaLorda = calcBonusMargin(1, S6).thresholdFullGross;
  const candidato = { date: feriali[feriali.length - 1], startTime: '09:00', endTime: '18:00', breakMinutes: 0 };

  // Da ~14.980 a ~15.070 di lordo: il lordo passa i 15.000, il reddito no.
  const n1 = Math.round(14960 / 70);
  const base1 = annoCon(n1);
  const r1 = calcolaCosaCambia({ candidateShift: candidato, originalShift: null, allShifts: base1, settings: S6 });
  assert(proiezione(base1) < 15000 && proiezione([...base1, candidato]) > 15000,
    `scenario 6: il lordo deve scavalcare 15.000 (${proiezione(base1)} → ${proiezione([...base1, candidato])})`);
  assert(!r1.superaSoglia, 'passare 15.000 di LORDO non è superare la soglia del bonus');
  assert(Math.abs(r1.margineBonus - (sogliaLorda - proiezione([...base1, candidato]))) < 0.01,
    `il margine si misura sulla soglia in lordo (${sogliaLorda}), trovato ${r1.margineBonus}`);

  // A cavallo della soglia vera, tradotta in lordo: qui sì.
  const n2 = Math.floor((sogliaLorda - 30) / 70);
  const base2 = annoCon(n2);
  const r2 = calcolaCosaCambia({ candidateShift: candidato, originalShift: null, allShifts: base2, settings: S6 });
  assert(r2.superaSoglia, `scavalcare ${sogliaLorda.toFixed(0)} € di lordo supera la soglia`);
  assert(calcBonusMargin(proiezione([...base2, candidato]), S6).status !== 'pieno',
    'e la striscia del bonus dice la stessa cosa');
}

if (falliti === 0) {
  console.log('OK: tutti i controlli di cosa-cambia.js sono superati.');
  process.exit(0);
} else {
  console.error(`ERRORE: ${falliti} controlli falliti.`);
  process.exit(1);
}
