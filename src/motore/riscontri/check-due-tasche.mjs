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
// Da dove viene 251,79: il reddito presunto del programma paghe (capienza.js)
// è il progressivo «Imp. IRPEF» prima di ottobre (11.994,27 − 1.494,95 =
// 10.499,32) più l'imponibile del mese per i tre mesi che restano e per la 13ª:
// 10.499,32 + 1.494,95 × 4 = 16.479. La detrazione annua a quel reddito, per i
// 31 giorni di ottobre su 365, fa 251,79 al centesimo.
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
const PRESUNTO_OTTOBRE = 10499.32 + 1494.95 * 4;
const t = dueTasche(PRESUNTO_OTTOBRE, 14677, S);
esito(t.soglia === 15000, 'la soglia è 15.000 di reddito');
esito(t.sotto.detrazione === 1955 && t.sotto.ti === 1200, 'sotto: 1.955 di detrazione + 1.200 di tratt. integrativo',
  `${t.sotto.detrazione} + ${t.sotto.ti}`);
esito(t.mese === 'sopra' && t.anno === 'sotto', 'ottobre sopra, l\'anno sotto: a dicembre si inverte');
esito(t.sopra.reddito === PRESUNTO_OTTOBRE, 'la tasca di sopra al reddito del mese');
const ottobre = Math.round(t.sopra.detrazione * 31 / 365 * 100) / 100;
esito(ottobre === 251.79, 'ottobre: 31 giorni su 365 fanno i 251,79 € della busta', ottobre.toFixed(2));

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
