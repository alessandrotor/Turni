// Il netto dello stesso mese, uguale in Calendario e in Statistiche:
//
//   node scripts/check-netto-coerente.mjs
//
// PERCHÉ ESISTE
// Dal 14 settembre 2026 Calendario calcola il netto del mese come il software
// paghe: riferimento = lordo del mese × 12 (`riferimentoAnnuoDelMese`, vedi
// check-ti-mensile.mjs). Statistiche no: passava a `monthlyBreakdown` la
// proiezione ANNUA, e nessuno se n'è accorto per nove giorni. Con una
// proiezione di 17.000 € e un mese da 1.100 € lordi, Calendario mostrava il
// trattamento integrativo e Statistiche no — lo stesso mese, due netti.
//
// Nessun errore, nessuna eccezione: due cifre plausibili che non coincidono.
// Ora tutte e due passano da `nettoDelMese` (net.js), e questo file controlla
// che Statistiche lo faccia davvero, riga per riga.

import { monthlyBreakdown } from '../src/utils/stats.js';
import { computePayByShift } from '../src/utils/pay.js';
import { nettoDelMese, calcNetMonthly } from '../src/utils/net.js';
import { getDaysInMonth } from '../src/utils/dates.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

// La busta di riferimento: Turismo, livello 5, part-time 60%.
const S = {
  hourlyRate: 9.21802,
  expectedWeeklyHours: 24,
  fullTimeWeeklyHours: 40,
  workingDaysPerWeek: 6,
  overtimeSurchargePct: 30,
  straordinarioSurchargePct: 50,
  ccnl: 'turismo-pubblici-esercizi',
  aziendaDipendenti: 'oltre15',
  addRegionalePct: 1.23,
  addComunalePct: 0,
  tiModo: 'auto',
  noTrattamentoIntegrativo: false,
};

const T = (data, startTime, endTime) => ({ id: `${data}-${startTime}`, date: data, startTime, endTime, breakMinutes: 0 });
const giorni = (anno, mese, n, da, a) => Array.from({ length: n }, (_, i) =>
  T(`${anno}-${String(mese).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, da, a));

// Tre mesi a tre livelli: sotto soglia, appena sopra (1.250 € × 12 = 15.000),
// e ben sopra, con il supplementare.
const TURNI = [
  ...giorni(2026, 3, 20, '09:00', '14:00'),   // ~100 h
  ...giorni(2026, 4, 26, '09:00', '14:30'),   // ~143 h
  ...giorni(2026, 5, 28, '09:00', '16:00'),   // ~196 h
];

const pay = computePayByShift(TURNI, S);
const righe = monthlyBreakdown(2026, TURNI, S, pay, true);

console.log('\nStatistiche usa il netto del mese, non quello dell\'anno\n');

esito(righe.length === 3, 'tre mesi con turni, tre righe', `${righe.length}`);
for (const r of righe) {
  const atteso = nettoDelMese(r.gross, S, getDaysInMonth(2026, r.monthIndex), 0).net;
  esito(Math.abs(r.net - atteso) < 0.005, `mese ${r.monthIndex + 1}: stesso netto di Calendario`,
    `${r.net.toFixed(2)} contro ${atteso.toFixed(2)} (lordo ${r.gross.toFixed(2)})`);
}

// Il caso che ha fatto trovare il difetto: sotto soglia nel mese, sopra
// nell'anno. Con la proiezione annua il bonus spariva.
const marzo = righe.find(r => r.monthIndex === 2);
const conAnnua = calcNetMonthly(marzo.gross, 17000, S, 31, 0);
const conMese = nettoDelMese(marzo.gross, S, 31, 0);
esito(marzo.gross * 12 < 15000, 'marzo è sotto soglia nel mese', `${(marzo.gross * 12).toFixed(0)} €`);
esito(conMese.trattamentoIntegrativo > 0 && conAnnua.trattamentoIntegrativo === 0,
  'la proiezione annua toglieva il bonus, il mese no',
  `${conAnnua.trattamentoIntegrativo} → ${conMese.trattamentoIntegrativo}`);
esito(Math.abs(marzo.net - conMese.net) < 0.005, 'Statistiche mostra quello col bonus');

console.log(`\n${falliti === 0 ? '✓ stesso mese, stesso netto' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
