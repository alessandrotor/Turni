// La tabella retributiva del CCNL e la voce «Retribuzione» del cedolino:
//
//   node scripts/check-tabellare-turismo.mjs
//
// LA DOMANDA
// Se il CCNL ha le tabelle per livello e ho fatto quelle ore, le ordinarie
// devono valere quegli euro. È vero, e qui si dimostra che il conto chiude —
// ma si dimostra anche COSA verifica: la PAGA ORARIA, non il periodo su cui si
// contano i turni.
//
// I valori (minimo tabellare, contingenza, terzo elemento, divisore, base Ente
// Bilaterale) sono presi da un cedolino reale — CCNL Turismo, part-time 60%,
// luglio 2026 — e vivono come costanti qui sotto, non ripetuti in prosa: sono
// usati per il riscontro, non pubblicati come spiegazione a sé.
//
// LA CATENA
//   tabellare + contingenza + terzo elemento = mensile a tempo pieno
//   mensile a tempo pieno ÷ divisore orario  = paga oraria
//   mensile a tempo pieno × part-time %      = la voce «Retribuzione» del cedolino
//
// Il TERZO ELEMENTO nasceva come residuo del conto; il cedolino lo CONFERMA:
// è stampato come voce a sé accanto a tabellare e contingenza, quindi non è un
// numero dedotto, è una voce letta.
//
// È un importo fisso mensile della contrattazione territoriale: entra nella
// retribuzione, e quindi nella paga oraria, ma non in tutte le basi che il
// cedolino calcola. Non sta nella base dell'Ente Bilaterale — ed è esattamente
// da lì che nasce lo scarto fra le due basi annotato in
// check-busta-luglio-2026.mjs — e sul datore 2024-2025 non stava nemmeno nella
// base della maggiorazione domenicale (vedi check-busta-maggiorazioni-reali.mjs).
//
// COSA NON DIMOSTRA
// L'ultimo blocco: le ore ordinarie del mese restano quelle da contratto —
// e quindi la «Retribuzione» pure — qualunque sia il periodo su cui si contano
// i turni. È un numero fissato dal contratto, non una misura: non può dire se
// il mese va tagliato a settimane intere o dal 1 al 31. Quello che cambia col
// periodo è solo la parte OLTRE la soglia (vedi check-mese-paga-2026.mjs).

import { calcTotalPay } from '../src/utils/pay.js';
import { monthlyHoursFactor, monthlyContractHours, monthlyFullTimeHours } from '../src/utils/ccnl.js';

const round2 = (n) => Math.round(n * 100) / 100;

const TABELLARE = 1057.72;
const CONTINGENZA = 522.37;
const TERZO_BUSTA = 5.41;      // voce «terzo elemento», letta sul cedolino
const RATE = 9.21802;
const PART_TIME = 0.60;
const DIVISORE = 172;          // ore mensili convenzionali a tempo pieno
const ORE_MESE = 103.20;       // quelle del part-time 60%
const RETRIBUZIONE = 951.30;   // la voce stampata
const BASE_EBT = 948.05;       // base Ente Bilaterale stampata

const SETTINGS = {
  hourlyRate: RATE,
  expectedWeeklyHours: 24,
  fullTimeWeeklyHours: 40,
  overtimeSurchargePct: 30,
  sundaySurchargePct: 0,
  holidaySurchargePct: 0,
  ccnl: 'turismo',
};

let fail = 0;
const check = (label, ok, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label}${extra ? '  → ' + extra : ''}`);
};
const eq = (label, actual, expected, tol = 0.005) =>
  check(label, Math.abs(actual - expected) <= tol, `${round2(actual)} (atteso ${expected})`);

console.log('\nDalla tabella del CCNL alla voce del cedolino\n');

// 1. Il divisore orario del Turismo è quello che l'app tiene come fattore
//    mensile: 40 ore × 4,3 = 172. Sono la stessa cosa scritta in due modi.
eq('divisore orario = ore full-time × fattore mensile',
  40 * monthlyHoursFactor(SETTINGS), DIVISORE);
eq('ore mensili full-time dal CCNL', monthlyFullTimeHours(SETTINGS), DIVISORE);
eq('ore mensili del part-time 60%', monthlyContractHours(SETTINGS), ORE_MESE);
eq('172 × 60% = le ore del contratto', DIVISORE * PART_TIME, ORE_MESE);

// 2. La retribuzione mensile a tempo pieno ricavata dalla paga oraria, e la sua
//    scomposizione nelle voci della tabella.
const MENSILE_FT = RATE * DIVISORE;
eq('mensile full-time (paga oraria × 172)', MENSILE_FT, 1585.50);
const TERZO = round2(MENSILE_FT - TABELLARE - CONTINGENZA);
// 5,41 è il valore STAMPATO in busta alla voce «terzo elemento»: che il conto
// lo ritrovi come residuo è la verifica, non la definizione.
eq('terzo elemento = mensile − tabellare − contingenza', TERZO, TERZO_BUSTA);

// 3. La voce «Retribuzione» del cedolino, presa dalla TABELLA e non dalle ore.
eq('tabella → busta: mensile × part-time', MENSILE_FT * PART_TIME, RETRIBUZIONE);
//    E dalle ORE: le due strade devono dare lo stesso numero, altrimenti la
//    paga oraria non è quella del proprio livello.
eq('ore → busta: 103,20 × paga oraria', ORE_MESE * RATE, RETRIBUZIONE);

// 4. La base dell'Ente Bilaterale è la stessa tabella SENZA il terzo elemento:
//    è da qui che nasce la differenza con la retribuzione.
eq('base Ente Bilaterale = (tabellare + contingenza) × part-time',
  (TABELLARE + CONTINGENZA) * PART_TIME, BASE_EBT);
eq('scarto retribuzione − base EBT = terzo elemento riproporzionato',
  RETRIBUZIONE - BASE_EBT, round2(TERZO * PART_TIME));

// 5. Quello che questa verifica NON può dire: le ordinarie sono 103,20 ore
//    QUALUNQUE sia il periodo. Due mesi con monte ore diverso — è la differenza
//    che passa fra tagliare a settimane intere e tagliare dal 1 al 31 — danno
//    la stessa voce «Retribuzione» e cambiano solo il supplementare.
console.log('\nLa tabella verifica la paga oraria, non il periodo\n');
// Dal 6 luglio: le giornate devono stare tutte DENTRO lo stesso mese di paga
// (6 lug – 2 ago 2026), altrimenti la soglia mensile si applica due volte e il
// confronto non è più fra due monte ore, ma fra due mesi diversi.
const turni = (giorni, minutiAlGiorno) => Array.from({ length: giorni }, (_, i) => ({
  id: `t${i}`,
  date: `2026-07-${String(i + 6).padStart(2, '0')}`,
  startTime: '09:00',
  endTime: `${String(9 + Math.floor(minutiAlGiorno / 60)).padStart(2, '0')}:${String(minutiAlGiorno % 60).padStart(2, '0')}`,
  breakMinutes: 0,
}));
for (const [nome, giorni, minuti] of [['periodo lungo', 26, 300], ['periodo corto', 22, 300]]) {
  const t = turni(giorni, minuti);
  const p = calcTotalPay(t, SETTINGS);
  const oreTotali = (giorni * minuti) / 60;
  const ordinarie = (giorni * minuti - p.overtimeMinutes) / 60;
  eq(`${nome}: ${oreTotali} h totali → ordinarie sempre 103,20`, ordinarie, ORE_MESE);
  eq(`${nome}: e valgono sempre ${RETRIBUZIONE} €`, ordinarie * RATE, RETRIBUZIONE);
  eq(`${nome}: a cambiare è il supplementare`, p.overtimeMinutes / 60, oreTotali - ORE_MESE);
}

console.log(fail === 0
  ? '\nLa tabella del CCNL e la busta dicono lo stesso numero.\n'
  : `\n${fail} problema/i.\n`);
process.exit(fail === 0 ? 0 : 1);
