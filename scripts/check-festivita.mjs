// Riscontro della festività non lavorata:
//
//   node scripts/check-festivita.mjs
//
// Una festività non lavorata VIENE PAGATA — in busta compare come giustificativo
// a sé («GO Festivita'») e vale le ore di una giornata di contratto. Il motore
// non la conosceva: chi non lavorava il 15 agosto vedeva quel giorno valere
// zero, e con undici o dodici festività l'anno sono centinaia di euro che il
// conto del mese non vedeva.
//
// Due domande, e la seconda è quella che potrebbe costare soldi veri:
//  1. l'app riconosce i giorni giusti, senza confondere le domeniche;
//  2. una giornata di festività vale il 100% delle ore da contratto e NON
//     prende maggiorazioni — altrimenti un giorno non lavorato verrebbe pagato
//     come uno lavorato in un giorno festivo.

import { festivitaSenzaTurno, giornateFestive } from '../src/utils/festivita-non-lavorate.js';
import { minutiGiornoAssenza, tipoTurno, isAssenza, TIPO } from '../src/utils/assenze.js';
import { computePayByShift } from '../src/utils/pay.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  const m = (v) => Array.isArray(v) ? `[${v.length}]` : String(v);
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(44)} atteso ${m(atteso).padStart(7)} → ${m(avuto).padStart(7)}  ${perche}`);
  if (!ok && Array.isArray(avuto)) console.log('        avuto: ', avuto.join(' '), '\n        atteso:', atteso.join(' '));
}

// Part-time 60% CCNL Turismo: 24 ore su sei giorni = quattro ore al giorno.
const S = { hourlyRate: 10, expectedWeeklyHours: 24, workingDaysPerWeek: 6 };
const ORE_GIORNO = minutiGiornoAssenza(S);

console.log(`\nUna giornata di contratto vale ${ORE_GIORNO} minuti (${ORE_GIORNO / 60} ore)\n`);

// ── 1. Quali giorni ────────────────────────────────────────────────────────
console.log('Riconoscimento dei giorni\n');

// Gennaio 2026: 1 (Capodanno) e 6 (Epifania).
verifica('gennaio: capodanno ed epifania',
  festivitaSenzaTurno(2026, 0, [], S), ['2026-01-01', '2026-01-06'], '');

verifica('un festivo con turno non e candidato',
  festivitaSenzaTurno(2026, 0, [{ date: '2026-01-06', startTime: '09:00', endTime: '13:00' }], S),
  ['2026-01-01'], 'chi ha lavorato ha gia detto la sua');

verifica('vale per QUALUNQUE tipo di giornata',
  festivitaSenzaTurno(2026, 0, [{ date: '2026-01-01', type: 'ferie', durationMinutes: 240 }], S),
  ['2026-01-06'], 'anche le ferie occupano il giorno');

// Marzo 2026 non ha festivita' nazionali.
verifica('un mese senza festivita', festivitaSenzaTurno(2026, 2, [], S), [], 'nessuna proposta');

// Le domeniche NON sono festivita': prendono il domenicale, che e' altra cosa.
const domeniche2026Feb = ['2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22'];
verifica('le domeniche non sono festivita',
  festivitaSenzaTurno(2026, 1, [], S).filter(d => domeniche2026Feb.includes(d)), [], '');

// Pasqua 2026: 5 aprile, quindi Pasquetta il 6. Piu' il 25 aprile.
const aprile = festivitaSenzaTurno(2026, 3, [], S);
verifica('aprile: pasquetta calcolata', aprile.includes('2026-04-06'), true, 'la Pasqua non e a data fissa');
verifica('  e il 25 aprile', aprile.includes('2026-04-25'), true, '');

// Santo patrono impostato dall'utente.
const conPatrono = { ...S, patronSaintDate: '06-29' };   // San Pietro e Paolo
verifica('il patrono impostato conta',
  festivitaSenzaTurno(2026, 5, [], conPatrono).includes('2026-06-29'), true, '');
verifica('  ma senza impostarlo no',
  festivitaSenzaTurno(2026, 5, [], S).includes('2026-06-29'), false, '');

// ── 2. Quanto vale ─────────────────────────────────────────────────────────
console.log('\nQuanto vale la giornata creata\n');

const giornate = giornateFestive(festivitaSenzaTurno(2026, 0, [], S), ORE_GIORNO);
verifica('due giornate create', giornate.length, 2, '');
verifica('  di tipo festivita', giornate[0].type, TIPO.FESTIVITA, '');
verifica('  con le ore da contratto', giornate[0].durationMinutes, ORE_GIORNO, '');
verifica('  riconosciuta come assenza', isAssenza(giornate[0]), true, 'non e un giorno lavorato');
verifica('  e tipoTurno la legge giusta', tipoTurno(giornate[0]), TIPO.FESTIVITA,
  'se tornasse «lavoro» prenderebbe le maggiorazioni');

// Il punto che conta: il 1 gennaio E' un festivo, quindi se il motore la
// trattasse come giornata lavorata le darebbe la maggiorazione festiva.
const conMagg = { ...S, holidaySurchargePct: 20, sundaySurchargePct: 10 };
const p = computePayByShift([{ id: 'f', ...giornate[0] }], conMagg).f;

verifica('paga = ore × tariffa, al 100%',
  Math.round(p.base * 100) / 100, Math.round((ORE_GIORNO / 60) * 10 * 100) / 100, '4 ore × 10 €');
verifica('  NESSUNA maggiorazione festiva', Math.round(p.surcharge * 100) / 100, 0,
  'non e stato lavorato: il festivo non si applica');
verifica('  contata come assenza, non come lavoro', p.tipo, TIPO.FESTIVITA, '');

// Confronto con lo stesso giorno LAVORATO: quello la maggiorazione la prende.
const lavorato = computePayByShift(
  [{ id: 'l', date: '2026-01-01', startTime: '09:00', endTime: '13:00', breakMinutes: 0 }], conMagg).l;
verifica('il festivo LAVORATO prende la maggiorazione',
  Math.round(lavorato.surchargeHoliday * 100) / 100, Math.round(4 * 10 * 0.20 * 100) / 100,
  '4 ore × 10 € × 20%');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
