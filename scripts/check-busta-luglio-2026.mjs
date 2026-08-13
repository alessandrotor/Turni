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

import { calcNetMonthly, round2, trunc2 } from '../src/utils/net.js';

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
  // Base dell'Ente Bilaterale letta dalla busta: minimo tabellare 1.057,72 +
  // contingenza 522,37, riproporzionati al part-time 60% → 948,05. Non è
  // ricavabile dalla paga oraria, che contiene anche voci fuori da questa base
  // (9,21802 × 103,20 = 951,30, cioè 3,25 in più).
  ebtBase: round2((1057.72 + 522.37) * 0.60),
};

// Competenze del mese, ciascuna come la scrive il cedolino.
const ORE_ORDINARIE = 103.20;
const ORE_SUPPLEMENTARI = 6.50;
const ORE_DOMENICALI = 15.50;
const RETRIBUZIONE = round2(ORE_ORDINARIE * BASE_SETTINGS.hourlyRate);        // 951,30
const SUPPLEMENTARE = round2(ORE_SUPPLEMENTARI * BASE_SETTINGS.hourlyRate * 1.30); // 77,89
const MAGG_DOMENICALE = round2(ORE_DOMENICALI * BASE_SETTINGS.hourlyRate * 0.10);  // 14,29
const INDENNITA = [
  // `utileTfr` serve solo alla base del TFR, che resta una questione aperta
  // (vedi in fondo): il netto non ne dipende.
  { label: 'TOP STORE', importo: 120.00, utileTfr: false },
  { label: 'Ind. Flessibilità', importo: 10.00, utileTfr: true },
];
const LORDO_LUGLIO = round2(
  RETRIBUZIONE + SUPPLEMENTARE + MAGG_DOMENICALE + INDENNITA.reduce((s, i) => s + i.importo, 0),
); // 1.173,48
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

// Tolleranza di mezzo centesimo: qui non si verifica "più o meno", si verifica
// che ogni voce combaci con quella stampata.
const CENT = 0.005;

console.log('\nCompetenze\n');
check('Retribuzione (103,20 h)', RETRIBUZIONE, 951.30, CENT);
check('Lavoro supplementare 30% (6,50 h)', SUPPLEMENTARE, 77.89, CENT);
check('Magg. domenicale 10% (15,50 h)', MAGG_DOMENICALE, 14.29, CENT);
check('Lordo del mese', LORDO_LUGLIO, 1173.48, CENT);

const r = calcNetMonthly(LORDO_LUGLIO, ANNUO_STIMATO, BASE_SETTINGS, GIORNI, 0);
const riga = (label) => r.contributiRighe.find(x => x.label.startsWith(label));

console.log('\nBasi di calcolo e contributi\n');
// L'aliquota non si applica al lordo esatto ma all'imponibile previdenziale
// arrotondato all'EURO: 1.173, non 1.173,48. Sul lordo pieno l'IVS darebbe
// 107,84 invece dei 107,80 stampati.
check('Imponibile INPS (arrotondato all\'euro)', riga('Contributi IVS').base, 1173, CENT);
check('Base Ente Bilaterale', riga('Ente Bilaterale').base, 948.05, CENT);
check('IVS 9,19%', riga('Contributi IVS').importo, 107.80, CENT);
check('FIS 0,26667%', riga('FIS').importo, 3.13, CENT);
check('CIGS 0,30%', riga('Contributo CIGS').importo, 3.52, CENT);
check('Ente Bilaterale 0,20% (dipendente)', riga('Ente Bilaterale').importo, 1.90, CENT);
// Quota ditta: fringe benefit tassato ma non trattenuto, e TRONCATO in busta
// (948,05 × 0,20% = 1,8961 → 1,89).
check('  quota ditta (fringe, troncata)', trunc2(948.05 * 0.002), 1.89, CENT);

console.log('\nImposte\n');
// L'Ente Bilaterale a carico dipendente NON è deducibile: non si sottrae.
// La quota ditta invece si SOMMA. 1.173,48 − 107,80 − 3,13 − 3,52 + 1,89.
check('Imponibile fiscale', r.imponibile, 1060.92, CENT);
check('IRPEF lorda (23%)', r.irpefLorda, 244.01, CENT);
check('Detrazioni lav.dip. (1.955 × 31/365)', r.detrazioni, 166.04, CENT);
check('Ritenute IRPEF', r.irpefNetta, 77.97, CENT);

console.log('\nCompetenze a parte (esenti)\n');
// Entrambe TRONCATE: 1.200 × 31/365 = 101,9178 e 1.060,92 × 5,3% = 56,2288.
// Arrotondando uscirebbero 101,92 e 56,23, e il netto sbaglierebbe di 2 centesimi.
check('Trattamento integrativo', r.trattamentoIntegrativo, 101.91, CENT);
check('Indennità L.207/2024 (5,3%)', r.bonusCuneo, 56.22, CENT);

console.log('\nTotali\n');
check('Totale competenze', round2(LORDO_LUGLIO + r.trattamentoIntegrativo + r.bonusCuneo), 1331.61, CENT);
check('Totale trattenute', r.trattenute, 194.32, CENT);
check('NETTO DEL MESE', r.net, 1137.29, CENT);

// ---------------------------------------------------------------------------
// QUESTIONE APERTA: la base del TFR.
//
// Ricostruendola come fa questa busta — retribuzione + indennità «utili al TFR»
// + maggiorazione domenicale, quindi senza TOP STORE e senza il supplementare —
// viene 975,59, e la quota mensile risulta 67,39 contro i 66,39 stampati: un
// euro tondo di scarto, che nessuna delle due formule spiega.
//
// C'è di più: la busta dei servizi fiduciari (giugno 2026) usa una base ANCORA
// DIVERSA, la sola retribuzione ordinaria senza nessuna maggiorazione. Due
// cedolini che si contraddicono e uno che non torna non bastano a stabilire una
// regola, quindi il motore continua a usare il lordo e qui si registra soltanto
// il fatto. Non tocca il netto: il TFR in busta è un'opzione, e quando è attiva
// entra come voce separata.
const BASE_TFR = round2(
  RETRIBUZIONE + INDENNITA.filter(i => i.utileTfr).reduce((s, i) => s + i.importo, 0) + MAGG_DOMENICALE,
);
console.log('\nTFR — scarto noto, non corretto\n');
check('Base TFR ricostruita', BASE_TFR, 975.59, CENT);
check('Quota che ne uscirebbe', round2(BASE_TFR / 13.5 - BASE_TFR * 0.005), 67.39, CENT);
console.log(`  ··   in busta però è stampato 66,39: un euro di scarto inspiegato,
       da riprendere quando arriva una terza busta con il TFR in anticipo.`);

console.log(failures === 0
  ? '\n✓ tutti i riscontri superati, al centesimo\n'
  : `\n✗ ${failures} riscontri falliti\n`);
process.exit(failures === 0 ? 0 : 1);
