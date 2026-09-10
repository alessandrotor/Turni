// Riscontro della busta di agosto 2026 (CCNL Turismo, livello 5, part-time 60%):
//
//   node scripts/check-busta-agosto-2026.mjs
//
// È la prima busta confrontata con i TURNI VERI dell'app, e serve a separare
// due cose che finora stavano insieme: se il motore sbaglia, o se gli si dà
// l'ingresso sbagliato.
//
// LA RISPOSTA È LA SECONDA, ed è il fatto che questo file esiste per fissare.
// Dato il lordo del mese, il motore riproduce la busta AL CENTESIMO: contributi,
// imponibile fiscale, IRPEF lorda. Dove l'app diverge da quello che l'utente
// vede in busta è a valle, e dipende da un solo numero: la PROIEZIONE DEL
// REDDITO ANNUO, che decide detrazioni, trattamento integrativo e indennità.
//
// COSA DICE QUESTA BUSTA, e non era mai stato osservato prima:
// il trattamento integrativo NON è erogato. Non manca per errore — il datore
// lo esclude perché proietta un reddito annuo appena SOPRA i 15.000 € di
// reddito complessivo. E lo si dimostra senza doverlo chiedere a nessuno,
// perché la busta lo dice due volte, in due punti indipendenti:
//
//   1. l'INDENNITÀ L. 207/2024 è calcolata con la percentuale della fascia
//      15.000-20.000, non con quella della fascia sotto i 15.000;
//   2. la DETRAZIONE da lavoro dipendente è quella della fascia 15.000-28.000
//      (art. 13 c. 1 TUIR), che nel punto di salto è più ALTA di quella sotto
//      soglia — ed è il motivo per cui la ritenuta IRPEF del mese è di pochi
//      euro invece che di un centinaio.
//
// Due indizi che vengono da parti diverse del cedolino e portano allo stesso
// reddito: è la ragione per cui qui si può ricavare la proiezione del datore
// per differenza, invece di indovinarla.
//
// L'app, alla stessa data, ne proietta uno molto più basso e quindi promette
// un trattamento integrativo che in busta non c'è. Il perché sta nel riscontro
// in fondo, ed è materiale per una correzione a sé.
//
// Le cifre vivono qui sotto come costanti: non vengono ripetute nei commenti,
// e nel repository non entra nient'altro della busta.

import { calcNetMonthly, tiDecision, cuneoPercent, redditoComplessivo } from '../src/utils/net.js';

// ── I dati della busta ─────────────────────────────────────────────────────
const RATE = 9.21802;

const BUSTA = {
  // Competenze
  lordo: 1298.15,          // somma delle voci in competenza
  oreRetribuzione: 99.20,  // parte mensilizzata, al netto delle ferie godute
  oreFerie: 4.00,
  oreSupplementari: 17.50,
  oreDomenicali: 7.75,
  // Trattenute e imponibili
  ivs: 119.28,
  fis: 3.46,
  cigs: 3.89,
  enteBilaterale: 1.90,
  imponibileFiscale: 1173.41,
  irpefLorda: 269.88,
  detrazioni: 261.50,
  irpefNetta: 8.38,
  indennita207: 56.32,
  trattamentoIntegrativo: 0,   // ASSENTE dalla busta: è il fatto centrale
  giorniDetrazione: 31,
};

// Il monte ore mensile del part-time: ferie comprese, è la parte "fissa" che
// la busta retribuisce sempre uguale. Tutto ciò che eccede è supplementare.
const MONTE_ORE = BUSTA.oreRetribuzione + BUSTA.oreFerie;

const SETTINGS = {
  hourlyRate: RATE,
  expectedWeeklyHours: 24,
  fullTimeWeeklyHours: 40,
  ccnl: 'turismo',
  aziendaDipendenti: 'oltre15',
  addizionaliAltrove: true,   // in busta le addizionali non sono trattenute qui
};

let falliti = 0;
let totale = 0;

function eq(titolo, avuto, atteso, tolleranza = 0.015, nota = '') {
  const ok = Math.abs(avuto - atteso) <= tolleranza;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(46)} busta ${atteso.toFixed(2).padStart(9)} → ${avuto.toFixed(2).padStart(9)}  ${nota}`);
}

function vero(titolo, condizione, nota = '') {
  totale++;
  if (!condizione) falliti++;
  console.log(`${condizione ? '  ok' : 'FAIL'}  ${titolo.padEnd(46)} ${nota}`);
}

// ── 1. Il motore contributivo, sul lordo vero ──────────────────────────────
// Nessuna proiezione in gioco: qui si verifica solo che, dato il lordo del
// mese, contributi e imponibile fiscale siano quelli stampati.
console.log('\nContributi e imponibile — dal lordo della busta\n');

const r = calcNetMonthly(BUSTA.lordo, 16000, SETTINGS, BUSTA.giorniDetrazione, 0);
const riga = (etichetta) => (r.contributiRighe || []).find(x => x.label.includes(etichetta));

eq('contributi IVS', riga('IVS').importo, BUSTA.ivs, 0.02, '9,19% del lordo');
eq('FIS', riga('FIS').importo, BUSTA.fis, 0.02, '');
eq('contributo CIGS', riga('CIGS').importo, BUSTA.cigs, 0.02, '');
eq('Ente Bilaterale', riga('Ente Bilaterale').importo, BUSTA.enteBilaterale, 0.02,
  'su una base PIU BASSA: il terzo elemento non ci entra');
vero('  e non e deducibile', riga('Ente Bilaterale').deducibile === false,
  'per questo l imponibile fiscale torna solo escludendolo');

eq('IMPONIBILE FISCALE', r.imponibile, BUSTA.imponibileFiscale, 0.015,
  'lordo - contributi deducibili + quota ditta');
eq('IRPEF lorda', r.irpefLorda, BUSTA.irpefLorda, 0.015, '23% dell imponibile');

// ── 2. La proiezione del datore, ricavata dalla busta ──────────────────────
// La detrazione da lavoro dipendente ha un SALTO alla soglia dei 15.000: sotto
// vale un importo fisso, appena sopra riparte da un valore più alto e poi
// scende. La detrazione stampata sta oltre il salto, quindi il reddito su cui
// il datore ragiona è sopra soglia — e si può cercare per bisezione QUALE.
console.log('\nLa proiezione annua su cui ragiona il datore\n');

function proiezioneCheSpiega(detrazioneVoluta) {
  let lo = 16650;    // appena oltre il salto: detrazione massima della fascia
  let hi = 20000;    // più su la detrazione e' gia' scesa sotto il bersaglio
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const d = calcNetMonthly(BUSTA.lordo, mid, SETTINGS, BUSTA.giorniDetrazione, 0).detrazioni;
    if (d > detrazioneVoluta) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const PROIEZIONE = proiezioneCheSpiega(BUSTA.detrazioni);
const imponibileAnnuo = redditoComplessivo(PROIEZIONE, SETTINGS);
const conProiezione = calcNetMonthly(BUSTA.lordo, PROIEZIONE, SETTINGS, BUSTA.giorniDetrazione, 0);

vero('la proiezione ricavata supera i 15.000 imponibili',
  imponibileAnnuo > 15000,
  `${imponibileAnnuo.toFixed(0)} € imponibili (${PROIEZIONE.toFixed(0)} € lordi)`);

// Con quel solo numero, TUTTO il resto della busta viene riprodotto.
eq('  detrazioni del mese', conProiezione.detrazioni, BUSTA.detrazioni, 0.05, 'fascia 15.000-28.000');
eq('  IRPEF netta trattenuta', conProiezione.irpefNetta, BUSTA.irpefNetta, 0.05, 'lorda - detrazioni');
eq('  indennita L. 207/2024', conProiezione.bonusCuneo, BUSTA.indennita207, 0.05, '');
eq('  trattamento integrativo', conProiezione.trattamentoIntegrativo, BUSTA.trattamentoIntegrativo, 0.01,
  'ASSENTE in busta, ed e il punto');

// ── 3. Le due prove indipendenti che il reddito sta sopra soglia ───────────
console.log('\nPerche il trattamento integrativo non spetta — due prove separate\n');

const PCT_SOTTO_15K = 0.053;
const PCT_15K_20K = 0.048;

eq('l indennita in busta vale la % della fascia 15-20k',
  BUSTA.indennita207 / BUSTA.imponibileFiscale, PCT_15K_20K, 0.0002,
  'e non quella della fascia sotto i 15.000');
vero('  con la % di sotto soglia il conto NON tornerebbe',
  Math.abs(BUSTA.imponibileFiscale * PCT_SOTTO_15K - BUSTA.indennita207) > 5,
  `sarebbero ${(BUSTA.imponibileFiscale * PCT_SOTTO_15K).toFixed(2)} €`);
eq('  ed e la percentuale che il motore assegna a quel reddito',
  cuneoPercent(imponibileAnnuo), PCT_15K_20K, 0.0001, '');

const decisione = tiDecision(PROIEZIONE, SETTINGS);
eq('sopra soglia il TI non spetta', decisione.importoAnnuo, 0, 0.01, decisione.motivo);
vero('  la detrazione stampata e quella della fascia superiore',
  BUSTA.detrazioni * 365 / BUSTA.giorniDetrazione > 1955,
  'sotto i 15.000 sarebbe l importo fisso, piu basso');

// ── 4. Le ore: il confronto fra le due regole, senza sceglierne una ────────
// Misurate sui turni veri di un backup reale (non incluso nel repository).
// Il mese di paga a settimane intere è la regola implementata oggi; il mese di
// calendario è l'alternativa. Su questa busta il calendario sta molto più
// vicino, ma su giugno succede il contrario, e lo scarto di giugno è dello
// stesso ordine delle ore che nell'app non risultano segnate. Finché il rumore
// è grande quanto la differenza, la regola non si può decidere: qui si
// registra la misura, non la conclusione.
console.log('\nOre attribuite al mese — le due regole a confronto\n');

const ORE = {
  busta: MONTE_ORE + BUSTA.oreSupplementari,
  calendario: 126.00,     // 1-31 agosto, ferie e festivita comprese
  mesePaga: 144.00,       // 3 agosto - 6 settembre
};

vero('il mese di calendario sta piu vicino alla busta',
  Math.abs(ORE.calendario - ORE.busta) < Math.abs(ORE.mesePaga - ORE.busta),
  `scarti: calendario ${(ORE.calendario - ORE.busta).toFixed(2)} h · mese di paga +${(ORE.mesePaga - ORE.busta).toFixed(2)} h`);

// La festivita del 15 agosto: l'app la conta nel monte ore, la busta non ha
// alcuna voce di festivita. Sono le 4 ore che portano lo scarto da 1,30 a 5,30.
const ORE_FESTIVITA = 4.00;
vero('  senza la festivita lo scarto scende sotto le due ore',
  Math.abs(ORE.calendario - ORE_FESTIVITA - ORE.busta) < 2,
  `${(ORE.calendario - ORE_FESTIVITA - ORE.busta).toFixed(2)} h`);

// La soglia del supplementare è il monte ore mensile, e su questo le due
// regole concordano: cambia solo QUALI ore ci finiscono dentro.
eq('la parte fissa e il monte ore del part-time',
  MONTE_ORE, 103.20, 0.01, 'ferie comprese');
eq('  e il supplementare e cio che eccede', ORE.busta - MONTE_ORE, BUSTA.oreSupplementari, 0.01, '');

// Il domenicale resta inspiegato: la busta lo paga su meno di un terzo delle
// ore di domenica che risultano dai turni. Nessuna combinazione delle domeniche
// del mese dà quel numero, quindi il criterio del datore non è "tutte le ore
// di domenica" e da una busta sola non si ricava.
const ORE_DOMENICA_DAI_TURNI = 22.25;
vero('domenicale: la busta ne paga meno dei turni segnati',
  BUSTA.oreDomenicali < ORE_DOMENICA_DAI_TURNI,
  `busta ${BUSTA.oreDomenicali} h · turni ${ORE_DOMENICA_DAI_TURNI} h — criterio ignoto, serve un altra busta`);

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
