// Riscontro del modulo cosa-cambia.js
// Verifica che il calcolo del delta ore, lordo, netto e soglie sia esatto.

import { calcolaCosaCambia, formatDeltaCurrency, formatDeltaMinutes } from '../src/utils/cosa-cambia.js';

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

if (falliti === 0) {
  console.log('OK: tutti i controlli di cosa-cambia.js sono superati.');
  process.exit(0);
} else {
  console.error(`ERRORE: ${falliti} controlli falliti.`);
  process.exit(1);
}
