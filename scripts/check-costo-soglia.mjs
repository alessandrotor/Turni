// Quanto costa DAVVERO superare i 15.000 € — il numero su cui si decide se
// vale la pena accettare un turno in più.
//
//   node scripts/check-costo-soglia.mjs
//
// PERCHÉ ESISTE
// L'avviso del bonus diceva «di questo passo devi restituire ~805 €», e lo
// diceva anche a chi la soglia l'aveva passata da un pezzo. Quel numero è vero
// come colpo di cassa e falso come perdita: il trattamento integrativo che
// sparisce (−1.200) se lo riprende quasi tutto la detrazione da lavoro, che
// all'art. 13 TUIR salta da 1.955 a 3.100 esattamente per non punire chi supera
// la soglia. Lo scalino è scritto apposta.
//
// Quello che resta scoperto non è il bonus: è l'indennità L. 207/2024, che
// attraversando la fascia scende di ~70 €. Da lì i ~130 € di buca.
//
// L'AFFERMAZIONE FORTE che questo riscontro deve reggere è l'invarianza: i
// 129 € non dipendono dai contributi, quindi devono venire identici su CCNL,
// orari e aliquote diverse. Se un giorno cambiano le aliquote statali questo
// script fallisce, ed è il punto: è lì che l'avviso andrebbe riscritto.

import { calcNetAnnual, redditoComplessivo, TAX_2026 } from '../src/utils/net.js';
import {
  costoSoglia, posizioneRispettoSoglia, mancaAlPareggio, POSIZIONE,
} from '../src/utils/restituzione.js';
import { margineInOre } from '../src/utils/bonus.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const PROFILI = [
  ['Turismo PT 60%', { ccnl: 'turismo', expectedWeeklyHours: 24, hourlyRate: 9.21802, overtimeSurchargePct: 30, aziendaDipendenti: 'oltre15', addizionaliAltrove: true, addRegionalePct: 0, addComunalePct: 0 }],
  ['Commercio FT', { ccnl: 'commercio', expectedWeeklyHours: 40, hourlyRate: 9.5, overtimeSurchargePct: 30, aziendaDipendenti: 'oltre15', addRegionalePct: 1.73, addComunalePct: 0.8 }],
  ['senza CCNL', { expectedWeeklyHours: 40, hourlyRate: 9.5, overtimeSurchargePct: 30, addRegionalePct: 1.73, addComunalePct: 0.8 }],
];

// ── 1. La forma della buca ───────────────────────────────────────────────────
console.log('');
console.log('La buca attorno ai 15.000, su profili diversi');
console.log('');

const perdite = [];
for (const [nome, S] of PROFILI) {
  const c = costoSoglia(S);
  perdite.push(c.perditaMax);
  esito(redditoComplessivo(c.tetto, S) <= TAX_2026.TI_SOGLIA_PIENO
    && redditoComplessivo(c.tetto + 1, S) > TAX_2026.TI_SOGLIA_PIENO,
    `${nome}: il tetto è l'ultimo lordo sotto soglia`, `${c.tetto} €`);
  esito(c.perditaMax > 100 && c.perditaMax < 160,
    `${nome}: perdita massima`, `${c.perditaMax} € l'anno`);
  esito(c.larghezzaBuca > 150 && c.larghezzaBuca < 260,
    `${nome}: larghezza della buca`, `${c.larghezzaBuca} € di lordo`);
  // La buca si RICHIUDE: è ciò che permette di dire «oltre, guadagnare conviene».
  esito(calcNetAnnual(c.pareggio, S).net >= c.nettoTetto,
    `${nome}: al pareggio si sta di nuovo come prima`);
  // E un euro prima no, altrimenti il pareggio non sarebbe il primo.
  esito(calcNetAnnual(c.pareggio - 1, S).net < c.nettoTetto,
    `${nome}: il pareggio è il PRIMO punto utile`);
}

console.log('');
esito(new Set(perdite).size === 1,
  'la perdita è la STESSA su tutti i profili',
  `${perdite.join(' / ')} € — dipende dalle aliquote statali, non dai contributi`);

// ── 2. Non è 1.200, ed è il punto ────────────────────────────────────────────
console.log('');
console.log('Il bonus perso è quasi tutto compensato');
console.log('');

const [, S0] = PROFILI[0];
const c0 = costoSoglia(S0);
const sotto = calcNetAnnual(c0.tetto, S0);
const sopra = calcNetAnnual(c0.tetto + 1, S0);

esito(sotto.trattamentoIntegrativo > 1000 && sopra.trattamentoIntegrativo === 0,
  'il trattamento integrativo sparisce di colpo',
  `${sotto.trattamentoIntegrativo.toFixed(0)} → 0`);
esito(sopra.detrazioneLavoro - sotto.detrazioneLavoro > 1000,
  'ma la detrazione da lavoro sale altrettanto',
  `${sotto.detrazioneLavoro.toFixed(0)} → ${sopra.detrazioneLavoro.toFixed(0)}`);
esito(c0.perditaMax < sotto.trattamentoIntegrativo / 5,
  'la perdita vera è una frazione del bonus perso',
  `${c0.perditaMax} € contro i ${sotto.trattamentoIntegrativo.toFixed(0)} che sembrano persi`);
// La causa NON è il bonus: è il cuneo. Se un giorno lo scalino del cuneo
// sparisse, la buca si chiuderebbe del tutto e l'avviso non servirebbe più.
esito(sotto.bonusCuneo - sopra.bonusCuneo > 50,
  'la buca la causa il cuneo, non il bonus',
  `indennità ${sotto.bonusCuneo.toFixed(0)} → ${sopra.bonusCuneo.toFixed(0)}`);

// ── 3. I tre casi dell'interfaccia ───────────────────────────────────────────
console.log('');
console.log('Dove ti trovi, e cosa deve dirti');
console.log('');

esito(posizioneRispettoSoglia(c0.tetto - 2000, S0, c0) === POSIZIONE.SOTTO, 'ben sotto → SOTTO');
esito(posizioneRispettoSoglia(c0.tetto, S0, c0) === POSIZIONE.SOTTO, 'al tetto esatto → ancora SOTTO');
esito(posizioneRispettoSoglia(c0.tetto + 1, S0, c0) === POSIZIONE.DENTRO, 'un euro oltre → DENTRO');
esito(posizioneRispettoSoglia(c0.pareggio - 1, S0, c0) === POSIZIONE.DENTRO, 'ultimo euro della buca → DENTRO');
esito(posizioneRispettoSoglia(c0.pareggio, S0, c0) === POSIZIONE.OLTRE, 'al pareggio → OLTRE');
esito(posizioneRispettoSoglia(c0.tetto + 5000, S0, c0) === POSIZIONE.OLTRE, 'molto oltre → OLTRE');

// Il difetto che tutto questo esiste per togliere: chi è ampiamente oltre non
// deve più vedere un allarme, perché non sta perdendo niente.
esito(mancaAlPareggio(c0.tetto + 5000, S0, c0) === 0,
  'chi è ampiamente oltre non ha più niente da recuperare');
esito(mancaAlPareggio(c0.tetto + 1, S0, c0) === c0.larghezzaBuca - 1,
  'dal fondo della buca manca quasi tutta la larghezza',
  `${mancaAlPareggio(c0.tetto + 1, S0, c0)} €`);

// ── 4. Il margine in ore ─────────────────────────────────────────────────────
console.log('');
console.log('Il margine, detto in ore');
console.log('');

const paga = S0.hourlyRate * 1.30;
esito(margineInOre(2596, S0) === Math.floor(2596 / paga),
  'ore = margine ÷ ora supplementare', `2.596 € → ${margineInOre(2596, S0)} ore a ${paga.toFixed(2)} €`);
esito(margineInOre(2596, { ...S0, hourlyRate: 0 }) === null,
  'senza paga oraria non si inventano le ore');
esito(margineInOre(0, S0) === null, 'margine zero: niente ore');
// Con la maggiorazione le ore sono MENO che alla paga base: dirle alla paga
// base prometterebbe più lavoro di quello che ci sta.
esito(margineInOre(2596, S0) < Math.floor(2596 / S0.hourlyRate),
  'le ore in più sono maggiorate, quindi ce ne stanno meno');

console.log(`\n${falliti === 0 ? '✓ il costo della soglia regge' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
