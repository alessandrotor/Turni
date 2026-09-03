// Riscontro del motore netto contro una busta paga REALE.
//
//   node scripts/check-busta-giugno-2026.mjs
//
// Busta di riferimento: LUL Zucchetti, giugno 2026, CCNL Turismo, livello 5,
// part-time 60%. Non è un test unitario di comodo: i valori attesi sono le
// cifre stampate sul cedolino — vivono come costanti qui sotto, non ripetute
// in questo commento.
//
// ATTENZIONE alla lettura del caso A. Il reddito annuo di riferimento è un
// INPUT dello scenario, non un risultato del motore: il consulente lavora su
// una previsione (verosimilmente il maturato dei primi mesi annualizzato) e su
// lavoro a turni quella previsione può benissimo non avverarsi. Detrazioni,
// cuneo e trattamento integrativo dipendono dalla fascia, quindi cambierebbero
// se l'anno chiudesse diversamente. Il caso B serve proprio a questo: stessa
// busta, proiezione sotto i 15.000 €, e si verifica che il motore segua la
// fascia invece di inseguire un numero.

import { calcNetMonthly, extraMonthAccrual, monthlyBaseGross, round2 } from '../src/utils/net.js';

const BASE_SETTINGS = {
  hourlyRate: 9.21802,
  expectedWeeklyHours: 24,
  ccnl: 'turismo',
  hireDate: '2025-12-29',
  hasQuattordicesima: true,
  hasTredicesima: true,
  // In busta non compaiono addizionali a giugno (vanno a rate sul conguaglio).
  addRegionalePct: 0,
  addComunalePct: 0,
};

// Lordo di giugno: somma delle voci del cedolino (retribuzione, supplementare,
// 14ª, maggiorazioni, indennità) — costante qui sotto, non elencata voce per
// voce in questo commento.
const LORDO_GIUGNO = 2047.58;
const QUATTORDICESIMA = 475.65;
const GIORNI = 30;

let failures = 0;

function check(label, actual, expected, tol) {
  const delta = Math.abs(actual - expected);
  const ok = delta <= tol;
  if (!ok) failures += 1;
  const fmt = (n) => n.toFixed(2).padStart(9);
  console.log(
    `${ok ? '  ok  ' : '  XX  '} ${label.padEnd(34)} ${fmt(actual)}  atteso ${fmt(expected)}  Δ ${delta.toFixed(2)}`,
  );
}

// ---------------------------------------------------------------- caso A
// Proiezione annua implicita nella busta. Non è un tondo scelto a mano: è il
// reddito che riproduce la detrazione stampata sul cedolino, invertendo la
// formula dell'art. 13 TUIR (dettaglio del calcolo non ripetuto qui, il
// risultato è la costante usata sotto). Cade nella fascia 15.000–20.000, il
// che quadra con il cuneo liquidato in busta a quella fascia.
// Resta una PREVISIONE del consulente: se il secondo semestre porta meno ore,
// l'anno chiude più in basso e il conguaglio di dicembre rimette tutto a posto.
console.log('\nCaso A — proiezione 18.895 € lordi (fascia 15.000–20.000)\n');

const annuo = 18895;
const r = calcNetMonthly(LORDO_GIUGNO, annuo, BASE_SETTINGS, GIORNI, QUATTORDICESIMA);

check('Contributi totali', r.contributi, 201.72, 0.1);
check('Imponibile fiscale', r.imponibile, 1849.65, 0.5);
check('  di cui 14ª (tass. autonoma)', r.imponibileExtra, 429.10, 0.5);
check('  di cui ordinario', r.imponibileOrdinario, 1420.55, 0.5);
check('IRPEF lorda', r.irpefLorda, 425.42, 0.5);
check('Ritenute IRPEF', r.irpefNetta, 186.23, 0.5);
check('Indennità L.207/24', r.bonusCuneo, 88.78, 0.2);
check('Trattamento integrativo', r.trattamentoIntegrativo, 0, 0.001);
// Netto di busta 2.221,41 meno il rimborso 730 (+473,00), che l'app non modella.
check('Netto (senza rimborso 730)', r.net, 1748.41, 0.5);

console.log('');
check('14ª: rateo maturato (6/12)', extraMonthAccrual('quattordicesima', 2026, BASE_SETTINGS), 0.5, 0.001);
check('14ª: mensilità piena', monthlyBaseGross(BASE_SETTINGS), 951.30, 0.1);
check('14ª: importo erogato', monthlyBaseGross(BASE_SETTINGS) * extraMonthAccrual('quattordicesima', 2026, BASE_SETTINGS), QUATTORDICESIMA, 0.1);
check('13ª: rateo 2026 (anno intero)', extraMonthAccrual('tredicesima', 2026, BASE_SETTINGS), 1, 0.001);

// ---------------------------------------------------------------- caso B
// Stesso mese, ma se l'anno chiudesse più basso il trattamento fiscale cambia:
// scatta il trattamento integrativo e il cuneo passa al 5,3%.
console.log('\nCaso B — stessa busta, proiezione 14.000 € lordi (fascia ≤ 15.000)\n');

const b = calcNetMonthly(LORDO_GIUGNO, 14000, BASE_SETTINGS, GIORNI, QUATTORDICESIMA);

check('Contributi totali', b.contributi, 201.72, 0.1);
check('Cuneo: aliquota di fascia', b.cuneoPct, 0.053, 0.0001);
check('Indennità L.207/24', b.bonusCuneo, 1849.65 * 0.053, 0.5);
check('Trattamento integrativo', b.trattamentoIntegrativo, 1200 * (GIORNI / 365), 0.5);
check('Detrazioni (1.955 × 30/365)', b.detrazioni, 1955 * (GIORNI / 365), 0.5);

// ---------------------------------------------------------------- caso C
// Senza CCNL e senza data di assunzione il motore deve comportarsi come prima:
// solo IVS 9,19% e mensilità piena.
console.log('\nCaso C — nessun CCNL, nessuna data di assunzione (comportamento storico)\n');

const legacy = { ...BASE_SETTINGS, ccnl: '', hireDate: '' };
const c = calcNetMonthly(LORDO_GIUGNO, annuo, legacy, GIORNI, 0);

// L'aliquota si applica all'imponibile previdenziale arrotondato all'EURO, non
// al lordo esatto: 2.048 × 9,19% = 188,21 e non 2.047,58 × 9,19% = 188,17.
// Queste due attese prima usavano il lordo pieno e fotografavano il vecchio
// comportamento; la regola dell'euro è riscontrata su due buste diverse
// (Turismo luglio: IVS 107,80 su 1.173; fiduciari giugno: 69,57 su 757).
const baseInps = Math.round(LORDO_GIUGNO);
check('Contributi = solo IVS 9,19%', c.contributi, round2(baseInps * 0.0919), 0.005);
check('Imponibile = lordo − IVS', c.imponibile, round2(LORDO_GIUGNO - round2(baseInps * 0.0919)), 0.005);
check('14ª: rateo pieno', extraMonthAccrual('quattordicesima', 2026, legacy), 1, 0.001);

console.log(failures === 0 ? '\n✓ tutti i riscontri superati\n' : `\n✗ ${failures} riscontri falliti\n`);
process.exit(failures === 0 ? 0 : 1);
