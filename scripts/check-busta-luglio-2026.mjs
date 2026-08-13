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
import { calcTotalPay } from '../src/utils/pay.js';
import { payrollMonthKey } from '../src/utils/dates.js';

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

// ---------------------------------------------------------------------------
// Dai TURNI alle competenze.
//
// Fin qui le competenze sono gli importi letti dal cedolino. Ma in app quegli
// importi nascono dai turni, ed è proprio lì che si era aperto lo scarto: il
// riepilogo segnava 1.113 € di lordo contro i 1.173,48 stampati, perché contava
// 104,65 h invece di 109,70. Le 5 ore mancanti valevano 60 € e non 46 perché,
// oltre la soglia di 103,20 h, ogni ora è supplementare al 130%.
//
// Con un totale unico di «maggiorazioni» quella voce non si vedeva. Qui si
// verifica che il percorso turni → maggiorazioni produca, diviso per tipo,
// esattamente quel che stampa la busta.
const PAY_SETTINGS = {
  ...BASE_SETTINGS,
  sundaySurchargePct: 10,
  holidaySurchargePct: 30, // nessuna festività fra il 6 lug e il 2 ago: resta a zero
  overtimeSurchargePct: 30,
  onCall: false,
};

// Turni ricostruiti: 109,70 h nel mese di paga (6 lug – 2 ago 2026), di cui
// 15,50 di domenica. NON sono i turni veri — il cedolino non li stampa — ma una
// distribuzione qualunque con quei due totali, che è tutto ciò che serve al
// calcolo: le maggiorazioni dipendono dalle ore e dai giorni, non dagli orari.
function turniLuglio() {
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const shifts = [];
  const push = (date, minuti) => {
    shifts.push({ id: `t${shifts.length + 1}`, date, startTime: '09:00', endTime: hhmm(9 * 60 + minuti) });
  };

  // 15,50 h sulle quattro domeniche del mese di paga.
  [['2026-07-12', 240], ['2026-07-19', 240], ['2026-07-26', 240], ['2026-08-02', 210]]
    .forEach(([d, m]) => push(d, m));

  // 94,20 h (5.652 min) sui feriali: 18 turni da 5 h più un resto da 4h 12m.
  const feriali = [];
  for (let d = new Date(2026, 6, 6); d <= new Date(2026, 7, 2); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) {
      feriali.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }
  feriali.slice(0, 18).forEach(d => push(d, 300));
  push(feriali[18], 252);

  return shifts;
}

const TURNI = turniLuglio();
const p = calcTotalPay(TURNI, PAY_SETTINGS, TURNI);
const oreTurni = TURNI.reduce((s, t) => {
  const [h1, m1] = t.startTime.split(':').map(Number);
  const [h2, m2] = t.endTime.split(':').map(Number);
  return s + (h2 * 60 + m2 - (h1 * 60 + m1));
}, 0) / 60;

console.log('\nDai turni alle competenze\n');
// Se un turno finisse in un altro mese di paga le ore non tornerebbero e tutto
// il resto del blocco scivolerebbe: meglio accorgersene qui.
check('Turni tutti nel mese di paga 2026-07',
  TURNI.every(t => payrollMonthKey(t.date) === '2026-07') ? 1 : 0, 1, CENT);
check('Ore contate', oreTurni, 109.70, CENT);
check('Ore supplementari (oltre 103,20)', p.overtimeMinutes / 60, 6.50, CENT);
check('Base (109,70 h × 9,21802)', p.base, 1011.22, CENT);
check('  di cui magg. domenicali 10%', p.surchargeSunday, 14.29, CENT);
check('  di cui magg. supplementari 30%', p.surchargeOvertime, 17.98, CENT);
check('  festive e manuali: nessuna', p.surchargeHoliday + p.surchargeManual, 0, CENT);
// 1.043,48 è il lordo di busta meno le due voci che non nascono dai turni
// (120,00 TOP STORE + 10,00 Ind. Flessibilità).
check('Totale dai turni', p.total, round2(LORDO_LUGLIO - 130), CENT);
// La somma delle quattro componenti deve restare il totale di prima: la
// divisione per tipo è solo di lettura, non cambia un centesimo.
check('Somma componenti = surcharge',
  p.surchargeSunday + p.surchargeHoliday + p.surchargeManual + p.surchargeOvertime,
  p.surcharge, CENT);

// Le righe come le STAMPA il cedolino. Il riepilogo dell'app le ricompone da
// questi totali, e la voce delicata è il supplementare: la busta scrive le ore
// oltre soglia INTERE al 130% (77,89), non il solo +30% (17,98) — che da solo
// non combacia con niente di quel che c'è sulla carta.
const RETRIBUZIONE_ORDINARIA = p.base - p.overtimeBase;
const SUPPLEMENTARE_INTERO = p.overtimeBase + p.surchargeOvertime;

console.log('\nLe righe stampate in busta, ricomposte dai turni\n');
check('Ore ordinarie (109,70 − 6,50)', (oreTurni * 60 - p.overtimeMinutes) / 60, 103.20, CENT);
check('Retribuzione', RETRIBUZIONE_ORDINARIA, 951.30, CENT);
check('Lavoro supplementare 30%', SUPPLEMENTARE_INTERO, 77.89, CENT);
check('Magg. domenicale 10%', p.surchargeSunday, 14.29, CENT);
// La riaffettatura è di sola lettura: le tre righe devono ridare il totale
// esatto di prima, altrimenti mostrarle sposterebbe il lordo.
check('Somma righe = totale dai turni',
  RETRIBUZIONE_ORDINARIA + SUPPLEMENTARE_INTERO + p.surchargeSunday + p.surchargeHoliday + p.surchargeManual,
  p.total, CENT);

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
