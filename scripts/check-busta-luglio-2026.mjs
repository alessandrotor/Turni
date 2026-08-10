// Riscontro del motore netto contro la busta paga REALE di luglio 2026.
//
//   node scripts/check-busta-luglio-2026.mjs
//
// Stessa busta (LUL Zucchetti, CCNL Turismo, livello 5, part-time 60%,
// assunzione 29/12/2025) del riscontro di giugno, un mese dopo. Nasce per
// rispondere a una domanda precisa: l'app segnava 122,5h per luglio contro le
// 109,70h realmente pagate in busta (103,20 ordinarie + 6,50 supplementari) —
// usando SOLO le ore che risultano in busta, il motore del netto riproduce i
// numeri stampati sul cedolino? Se sì, la discrepanza osservata in app è
// tutta nei dati dei turni (o nella busta stessa), non nelle formule fiscali.
//
// Lordo di luglio SOLO dalle voci in busta:
//   951,30 retribuzione (103,20h) + 77,89 supplementare 30% (6,50h)
//   + 120,00 Indennità TOP STORE + 10,00 Ind. Flessibilità
//   + 14,29 Magg. Domenicale 10% = 1.173,48
//
// La proiezione annua di reddito è un INPUT (come nel caso A/B di giugno):
// non è stampata in busta, ma dal fatto che la detrazione lavoro dipendente
// sia quella "piena" (1.955 × 31/365 = 166,04, ESATTO) e il cuneo sia al
// 5,3% si deduce che il consulente lavora con un imponibile annuo stimato fra
// 8.500 e 15.000 € — qualunque proiezione in questa fascia dà lo stesso
// risultato (soglie a scaglino, non lineari), quindi il valore preciso non è
// determinante.

import { calcNetMonthly } from '../src/utils/net.js';

const BASE_SETTINGS = {
  hourlyRate: 9.21802,
  expectedWeeklyHours: 24,
  ccnl: 'turismo',
  hireDate: '2025-12-29',
  hasQuattordicesima: true,
  hasTredicesima: true,
  // Come a giugno: nessuna addizionale trattenuta in busta (a conguaglio).
  addRegionalePct: 0,
  addComunalePct: 0,
};

const LORDO_LUGLIO = 951.30 + 77.89 + 120.00 + 10.00 + 14.29; // 1.173,48
const GIORNI = 31;
const ANNUO_STIMATO = 13298; // → imponibile annuo ≈ 12.000 €, fascia 8.500–15.000

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

console.log(`\nLordo luglio (solo voci in busta): ${LORDO_LUGLIO.toFixed(2)} €\n`);

const r = calcNetMonthly(LORDO_LUGLIO, ANNUO_STIMATO, BASE_SETTINGS, GIORNI, 0);

check('Contributo IVS', r.contributiRighe.find(x => x.label === 'Contributi IVS')?.importo, 107.80, 0.05);
check('Contributi totali (IVS+FIS+CIGS+Ente Bil.)', r.contributi, 107.80 + 3.13 + 3.52 + 1.90, 0.1);
check('Imponibile fiscale', r.imponibile, 1060.92, 1.5);
check('IRPEF lorda', r.irpefLorda, 244.01, 1);
check('Detrazioni lav.dip.', r.detrazioni, 166.04, 0.05);
check('Ritenute IRPEF (netta)', r.irpefNetta, 77.97, 1);
check('Trattamento integrativo', r.trattamentoIntegrativo, 101.91, 0.1);
check('Indennità L.207/24', r.bonusCuneo, 56.22, 1);
check('Totale trattenute', r.trattenute, 194.32, 0.2);
check('Netto del mese', r.net, 1137.29, 0.3);

console.log(failures === 0
  ? '\n✓ tutti i riscontri superati: con le ore REALI di busta il motore torna\n'
  : `\n✗ ${failures} riscontri falliti\n`);
process.exit(failures === 0 ? 0 : 1);
