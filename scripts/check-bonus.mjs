// Riscontro delle soglie del trattamento integrativo (ex bonus Renzi):
//
//   node scripts/check-bonus.mjs
//
// PERCHE' A VIDEO NON COMPARE 15.000
// Le soglie di legge — 15.000 e 28.000 — sono definite sul REDDITO
// COMPLESSIVO, che per un dipendente e' il lordo MENO i contributi
// previdenziali. L'utente pero' ragiona sul lordo, perche' e' quello che somma
// dai turni. Mostrare 15.000 accanto a un lordo sarebbe un confronto fra due
// grandezze diverse, e farebbe credere di essere sotto soglia quando non lo si
// e' piu'.
//
// Quindi le soglie vengono riportate in lordo: circa 16.518 € senza contributi
// minori, circa 16.622 € con un CCNL che ne prevede. Il numero SI SPOSTA con il
// contratto, ed e' giusto cosi' — non e' un valore di legge, e' la traduzione
// di quello di legge nella grandezza che l'utente ha sotto gli occhi.
//
// Questo file non poteva esistere finche' `bonus.js` importava `./net` senza
// estensione: Node non riusciva a caricarlo.

import { calcBonusMargin, BONUS_CONST, BONUS_STATUS } from '../src/utils/bonus.js';
import { grossToTaxable } from '../src/utils/net.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(44)} atteso ${String(atteso).padStart(7)} → ${String(avuto).padStart(7)}  ${perche}`);
}

const arrotonda = (n) => Math.round(n);

// ── 1. La traduzione delle soglie ──────────────────────────────────────────
console.log('\nSoglie di legge riportate in lordo\n');

for (const [nome, s] of [['senza CCNL', {}], ['turismo', { ccnl: 'turismo' }], ['vigilanza', { ccnl: 'vigilanza' }]]) {
  const b = calcBonusMargin(20000, s);
  // Il giro completo deve tornare: tradotta in lordo e ritradotta in
  // imponibile, la soglia e' di nuovo quella di legge.
  verifica(`${nome}: 15.000 imponibili in lordo`, arrotonda(grossToTaxable(b.thresholdFullGross, s)), BONUS_CONST.SOGLIA_BONUS_PIENO,
    `lordo ${arrotonda(b.thresholdFullGross)}`);
  verifica(`${nome}: 28.000 imponibili in lordo`, arrotonda(grossToTaxable(b.thresholdMaxGross, s)), BONUS_CONST.SOGLIA_BONUS_MAX,
    `lordo ${arrotonda(b.thresholdMaxGross)}`);
  verifica(`${nome}: il lordo e' MAGGIORE dell imponibile`, b.thresholdFullGross > BONUS_CONST.SOGLIA_BONUS_PIENO, true,
    'i contributi stanno in mezzo');
}

// ── 2. Gli stati, ai confini ───────────────────────────────────────────────
console.log('\nStati alle soglie\n');

const s = {};
const pieno = calcBonusMargin(20000, s).thresholdFullGross;
const massimo = calcBonusMargin(20000, s).thresholdMaxGross;

verifica('nessun reddito', calcBonusMargin(0, s).status, BONUS_STATUS.ATTESA, '');
verifica('un euro sotto la prima soglia', calcBonusMargin(pieno - 1, s).status, BONUS_STATUS.PIENO, '');
verifica('esattamente sulla prima soglia', calcBonusMargin(pieno, s).status, BONUS_STATUS.PARZIALE, 'la soglia e gia fuori dal pieno');
verifica('un euro sotto la seconda', calcBonusMargin(massimo - 1, s).status, BONUS_STATUS.PARZIALE, '');
verifica('esattamente sulla seconda', calcBonusMargin(massimo, s).status, BONUS_STATUS.OLTRE, 'niente bonus');

// ── 3. I margini ───────────────────────────────────────────────────────────
console.log('\nQuanto manca\n');

const sotto = calcBonusMargin(pieno - 2000, s);
verifica('margine alla prima soglia', arrotonda(sotto.marginToFull), 2000, 'quello che manca, in lordo');
verifica('  e alla seconda', arrotonda(sotto.marginToMax), arrotonda(massimo - (pieno - 2000)), '');
verifica('  non e vicino', sotto.nearThreshold, false, 'oltre 1.000 € di margine');

const vicino = calcBonusMargin(pieno - 500, s);
verifica('a 500 € dalla soglia: avviso', vicino.nearThreshold, true, 'entro i 1.000 € di guardia');

const oltre = calcBonusMargin(massimo + 5000, s);
verifica('oltre tutto: nessun margine', oltre.marginToFull, null, 'non c e piu niente da preservare');

// ── 4. Robustezza ──────────────────────────────────────────────────────────
console.log('\nIngressi strani\n');

verifica('reddito negativo', calcBonusMargin(-100, s).status, BONUS_STATUS.ATTESA, 'trattato come zero');
verifica('reddito non numerico', calcBonusMargin('molti soldi', s).status, BONUS_STATUS.ATTESA, 'non NaN a video');
verifica('impostazioni assenti', calcBonusMargin(10000).status, BONUS_STATUS.PIENO, 'i default reggono');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
