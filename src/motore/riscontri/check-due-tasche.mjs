// Le due tasche ai 15.000: il disegno del popup «Perché ogni mese è diverso».
//
//   node src/motore/riscontri/check-due-tasche.mjs
//
// DA DOVE VIENE
// Busta Zucchetti di ottobre 2026, CCNL Turismo, part-time 60%: «Detrazioni
// lav.dip. 251,79», nessuna riga di trattamento integrativo. Chi la leggeva
// era convinto che sopra i 15.000 la detrazione fosse più bassa: nella fascia
// 15.000–28.000 scende col reddito, ed è quello che si trova in rete. Ma il
// punto di partenza è ~3.100, contro i 1.955 di sotto: il gradino va in su,
// perché sopra la detrazione prende il posto del trattamento integrativo.
// 251,79 è la detrazione annua a ~15.858 € di reddito presunto, divisa sul mese.
//
// COSA DEVE REGGERE
// - il gradino: appena sopra la soglia la detrazione è PIÙ ALTA di sotto;
// - le due tasche si equivalgono quasi: sopra ≈ sotto + tratt. integrativo,
//   entro 100 € (il resto della buca è l'indennità L. 207/24, check-costo-soglia);
// - il mese e l'anno si leggono ognuno dal suo reddito, e possono stare in
//   tasche diverse: è il caso che a dicembre «si inverte».

import { dueTasche } from '../due-tasche.js';
import { detrazioneLavoro } from '../net.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const S = { ccnl: 'turismo', expectedWeeklyHours: 24, hourlyRate: 9.21802 };

// La busta di ottobre: reddito presunto oltre la soglia, anno sotto.
const t = dueTasche(15858, 14677, S);
esito(t.soglia === 15000, 'la soglia è 15.000 di reddito');
esito(t.sotto.detrazione === 1955 && t.sotto.ti === 1200, 'sotto: 1.955 di detrazione + 1.200 di tratt. integrativo',
  `${t.sotto.detrazione} + ${t.sotto.ti}`);
esito(t.mese === 'sopra' && t.anno === 'sotto', 'ottobre sopra, l\'anno sotto: a dicembre si inverte');
esito(t.sopra.reddito === 15858, 'la tasca di sopra al reddito del mese');
esito(Math.abs(t.sopra.detrazione / 12 - 251.79) < 0.01, 'ottobre: un dodicesimo fa i 251,79 € della busta',
  (t.sopra.detrazione / 12).toFixed(2));

// Il gradino va in su.
const appena = dueTasche(14000, 14500, S);
esito(appena.sopra.reddito === 15001, 'nessuno dei due sopra: la tasca di sopra appena oltre la soglia');
esito(appena.sopra.detrazione > appena.sotto.detrazione + 1000, 'appena sopra la detrazione è più alta di oltre 1.000 €',
  `${Math.round(appena.sopra.detrazione)} contro ${appena.sotto.detrazione}`);
esito(Math.abs(appena.sopra.detrazione - (appena.sotto.detrazione + appena.sotto.ti)) < 100,
  'le due tasche quasi si equivalgono', `${Math.round(appena.sopra.detrazione)} contro ${appena.sotto.detrazione + appena.sotto.ti}`);
esito(detrazioneLavoro(20000) < appena.sopra.detrazione, 'dentro la fascia la detrazione scende col reddito');

// Senza un reddito, nessun segno.
const vuoto = dueTasche(null, undefined, S);
esito(vuoto.mese === null && vuoto.anno === null, 'senza reddito, nessun segno nel disegno');

console.log();
if (falliti) { console.error(`${falliti} casi non tornano.`); process.exit(1); }
console.log('Le due tasche tornano.');
