// Riscontro della previsione di reddito annuo:
//
//   node scripts/check-proiezione.mjs
//
// LA PROPRIETA' CHE CONTA
// Un euro guadagnato in piu' deve spostare la previsione di ESATTAMENTE un
// euro. Sembra ovvio, e invece e' proprio cio' che non succedeva: la previsione
// annualizzava il maturato (× 12/mesi-trascorsi) e prendeva il massimo con la
// proiezione da contratto. Risultato misurato il 21 agosto, su un part-time con
// contratto da 1.032 €/mese e soglia bonus a 16.622 €:
//
//   +200 € di straordinari  →  margine fermo a 4.238 €   (il contratto faceva da pavimento)
//   +400 € di straordinari  →  margine 4.022 €           (-216)
//   +600 € di straordinari  →  margine 3.722 €           (-300 ogni 200 guadagnati)
//
// Il riquadro del bonus esiste per decidere se accettare uno straordinario:
// un numero che prima non si muove e poi si muove di una volta e mezza non
// serve a decidere niente.
//
// Questi riscontri NON sono coperti dagli script sulle buste reali: quelli
// passano il reddito annuo esplicitamente a `calcNetMonthly` e non toccano la
// previsione. Confermano che il netto non e' cambiato, non che la previsione
// sia giusta.

import { projectAnnualIncome, monthlyBaseGross } from '../src/utils/net.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(46)} atteso ${String(atteso).padStart(7)} → ${String(avuto).padStart(7)}  ${perche}`);
}

const arr = (n) => Math.round(n);
// Part-time 60% CCNL Turismo: 24 ore su sei giorni, 10 €/h.
const S = { hourlyRate: 10, expectedWeeklyHours: 24, workingDaysPerWeek: 6, ccnl: 'turismo' };
const MENSILE = monthlyBaseGross(S);
const prev = (maturato, extra = 0, s = S, anno = ANNO) =>
  projectAnnualIncome(maturato, extra, s, anno).value;

// L'anno CORRENTE, altrimenti `monthsElapsed` vale 12 e non si prova nulla.
const ANNO = new Date().getFullYear();
const MESE = new Date().getMonth() + 1;          // 1-12
const RESTANTI = Math.max(0, 12 - MESE);

console.log(`\nContratto: ${arr(MENSILE)} €/mese · siamo al mese ${MESE}, ne restano ${RESTANTI}\n`);

// ── 1. La proprieta' del marginale ─────────────────────────────────────────
console.log('Un euro in piu\' sposta la previsione di un euro\n');

const base = prev(8000);
for (const aggiunta of [1, 100, 200, 500, 1000, 2500]) {
  verifica(`+${aggiunta} € di straordinari`, arr(prev(8000 + aggiunta) - base), aggiunta,
    'la previsione sale di quanto si e guadagnato');
}

// Il caso che prima falliva in modo silenzioso: piccoli importi sotto il
// pavimento del contratto, che non muovevano nulla.
verifica('nessun pavimento sotto il contratto', prev(8200) > prev(8000), true,
  'prima restava identico');

// ── 2. Composizione ────────────────────────────────────────────────────────
console.log('\nDa cosa e\' fatta\n');

// Maturato zero significa davvero «non ho guadagnato nulla finora»: chi ha
// lavorato senza inserire i turni dichiara il pregresso col MONTANTE
// (`priorTaxableIncome`), che `computeAnnualGrossFromShifts` somma al maturato.
// Quindi qui NON si deve inventare uno storico che l'utente non ha dichiarato.
verifica('maturato zero → solo i mesi che restano',
  arr(prev(0)), arr(RESTANTI * MENSILE), 'non si inventa il pregresso');
verifica('maturato + resto dell anno',
  arr(prev(9000)), arr(9000 + RESTANTI * MENSILE), '');

// Auto-consistenza: chi ha segnato tutti i mesi trascorsi al valore da
// contratto ritrova esattamente le 12 mensilita'. E' la prova che il modello
// non sottostima chi tiene il calendario aggiornato.
verifica('calendario completo → 12 mensilita esatte',
  arr(prev(MENSILE * MESE)), arr(MENSILE * 12), 'maturato dei mesi passati + quelli futuri');

// Anno passato: non c'e' futuro da prevedere, la previsione E' il maturato.
verifica('anno passato → solo il maturato',
  arr(prev(11000, 0, S, ANNO - 1)), 11000, 'nessun mese da aggiungere');

// ── 3. I rami che NON cambiano ─────────────────────────────────────────────
console.log('\nLe scelte esplicite dell utente restano intatte\n');

const manuale = { ...S, annualGrossManual: 20000 };
verifica('importo scritto a mano vince', arr(prev(5000, 0, manuale)), 20000, 'ignora tutto il resto');
verifica('  e non dipende dal maturato', prev(5000, 0, manuale) === prev(15000, 0, manuale), true, '');

const ytd = { ...S, tiProjectionMode: 'ytd' };
verifica('modalita ytd: annualizza ancora', prev(8000, 0, ytd) !== prev(8000), true,
  'e una scelta esplicita, si rispetta');

const chiamata = { ...S, onCall: true };
verifica('a chiamata: annualizza ancora', arr(prev(8000, 0, chiamata)), arr((8000 * 12) / MESE),
  'non c e un contratto da cui prevedere');

// ── 4. Mensilita' aggiuntive contate una volta sola ────────────────────────
console.log('\n13ª e 14ª\n');

const conExtra = { ...S, hasTredicesima: true, hasQuattordicesima: true, hireDate: `${ANNO - 3}-01-01` };
// Il maturato include gia' le extra incassate: passarle come `annualExtras`
// non deve farle sparire ne' raddoppiare.
verifica('extra gia incassate non cambiano il totale',
  arr(prev(9000, 0, conExtra)), arr(prev(9000, 1032, conExtra)),
  'sono gia dentro il maturato, non si sommano due volte');

// Le mensilita' NON ancora incassate vanno aggiunte: a questo punto dell'anno
// la 13ª deve ancora arrivare, quindi il totale supera quello senza extra.
verifica('la 13ª che deve ancora arrivare si aggiunge',
  prev(9000, 0, conExtra) > prev(9000, 0, S), true, '');
verifica('  e vale una mensilita intera',
  arr(prev(9000, 0, conExtra) - prev(9000, 0, S)), arr(MENSILE), 'la 14ª di giugno e gia nel maturato');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
