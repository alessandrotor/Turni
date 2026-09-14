// Il trattamento integrativo, deciso mese per mese come fa la busta:
//
//   node scripts/check-ti-mensile.mjs
//
// PERCHÉ ESISTE
// La legge guarda l'anno, il software paghe guarda il mese. L'app faceva come
// la legge e prometteva un TI che in busta spesso non c'era: il conto tornava a
// dicembre, ma intanto il netto di ogni mese era sbagliato — ed è l'unico
// numero su cui il lavoratore decide qualcosa.
//
// Cinque buste del 2026 dello stesso datore dicono quale regola usa davvero, e
// due mesi su cinque il TI non è stato erogato: giugno e agosto. Non per
// errore, e non a caso.
//
// LE DUE IPOTESI, MESSE UNA CONTRO L'ALTRA
// La busta stampa DUE imponibili progressivi, «Imp. INPS» e «Imp. IRPEF», e la
// domanda era su quale dei due il software proietti. Si prova, invece di
// sceglierne uno: col previdenziale tornano cinque mesi su cinque, col fiscale
// quattro — ad agosto il fiscale darebbe 14.081, sotto soglia, e un TI che in
// busta non c'è.
//
// Per legge il confronto andrebbe fatto sul reddito complessivo, cioè sul
// fiscale: è il motivo per cui questa regola è PRUDENTE. Toglie il TI in mesi
// in cui a rigore spetterebbe, e il conguaglio di fine anno lo restituisce.
// L'app riproduce la busta e lo dice; non pretende di avere ragione al posto
// del sostituto d'imposta.
//
// LIMITE, scritto perché non si perda: cinque buste, un datore solo, un solo
// software paghe. `tiModo: 'sempre'` esiste per chi si trovasse davanti a un
// datore che decide altrimenti.

import { tiSpettaQuestoMese, modoTrattamentoIntegrativo, riferimentoAnnuoDelMese, calcNetMonthly } from '../src/utils/net.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

// Lordo del mese e presenza del TI, letti dalle buste.
const BUSTE = [
  { mese: 'febbraio', lordo: 1099.42, ti: 92.05 },
  { mese: 'maggio', lordo: 1162.92, ti: 101.91 },
  { mese: 'giugno', lordo: 2047.58, ti: 0 },      // dentro c'è la quattordicesima
  { mese: 'luglio', lordo: 1173.48, ti: 101.91 },
  { mese: 'agosto', lordo: 1298.15, ti: 0 },      // 17,50 h supplementari
];

console.log('\nLa regola del datore, su cinque buste del 2026\n');

for (const b of BUSTE) {
  const r = tiSpettaQuestoMese(b.lordo, {});
  const atteso = b.ti > 0;
  esito(r.spetta === atteso, b.mese.padEnd(9) + (atteso ? 'il TI c\'è' : 'il TI non c\'è'), r.motivo);
}

console.log('\nLa soglia, e dove cade\n');

// 15.000 / 12 = 1.250 € di lordo al mese. È il numero che un lavoratore può
// tenere a mente, ed è quello che l'app deve saper spiegare.
esito(tiSpettaQuestoMese(1249, {}).spetta, 'a 1.249 € di lordo il TI spetta');
esito(!tiSpettaQuestoMese(1251, {}).spetta, 'a 1.251 € non spetta più', 'la soglia è 1.250 €/mese');
esito(tiSpettaQuestoMese(1250, {}).spetta, 'a 1.250 € esatti spetta ancora',
  'la norma dice «non superiore a 15.000», quindi il pari è dentro');

// Ad agosto sono bastate 17,50 ore supplementari per superare la soglia: è la
// cosa che l'app deve saper dire, perché altrimenti sembra un capriccio.
const senzaSuppl = 1298.15 - 209.71;
esito(tiSpettaQuestoMese(senzaSuppl, {}).spetta,
  'agosto senza le ore in più sarebbe rimasto sotto',
  `${senzaSuppl.toFixed(2)} € → il TI ci sarebbe stato`);

console.log('\nGli interruttori\n');

esito(modoTrattamentoIntegrativo({}) === 'auto', 'senza impostazioni: decide come il datore');
esito(!tiSpettaQuestoMese(1000, { tiModo: 'mai' }).spetta, '«mai» esclude anche sotto soglia');
esito(tiSpettaQuestoMese(5000, { tiModo: 'sempre' }).spetta, '«sempre» include anche sopra soglia');

// Chi aveva spuntato il vecchio interruttore deve ritrovare la sua scelta, non
// un'altra: il default è cambiato, la volontà espressa no.
esito(modoTrattamentoIntegrativo({ noTrattamentoIntegrativo: true }) === 'mai',
  'la vecchia casella «escludi» continua a valere');
esito(modoTrattamentoIntegrativo({ noTrattamentoIntegrativo: true, tiModo: 'sempre' }) === 'sempre',
  'ma la scelta nuova ha la precedenza');

console.log(`\n${falliti === 0 ? '✓ la regola del TI mensile regge' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
