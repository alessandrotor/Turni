// «Ci perdo?» per un lordo qualunque: stessa risposta del riquadro, letta
// dalla parte di chi fa la domanda.
//
//   node src/motore/riscontri/check-ci-perdo.mjs
//
// DA DOVE VIENE: nessuna regola nuova. `ciPerdo()` riusa `costoSoglia` e
// `confrontoConSoglia` (→ check-costo-soglia.mjs, dalla CU e dall'art. 13
// TUIR). Qui si verifica che la lettura sia coerente: le due barre fanno il
// saldo, i tre casi cadono dove devono, e chi non avrebbe comunque il
// trattamento non si sente dire «non te lo riprendono» come se ce l'avesse.

import { ciPerdo, costoSoglia, confrontoConSoglia, POSIZIONE } from '../restituzione.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const S = { ccnl: 'turismo' };
const c = costoSoglia(S);

const sotto = ciPerdo(14000, S, c);
esito(sotto.posizione === POSIZIONE.SOTTO && sotto.spetta && sotto.margine === c.tetto - 14000, '14.000 €: sotto, spetta, col margine fino al tetto', JSON.stringify(sotto));

const poco = ciPerdo(6000, S, c);
esito(poco.posizione === POSIZIONE.SOTTO && !poco.spetta, '6.000 €: sotto ma il trattamento non spetta comunque (niente IRPEF da compensare)');

const dentro = ciPerdo(16700, S, c);
esito(dentro.posizione === POSIZIONE.DENTRO && dentro.perso === 1200 && dentro.totale < 0, '16.700 €: dentro la buca, perdi 1.200 e ci perdi qualcosa', JSON.stringify(dentro));
esito(dentro.mancaPareggio > 0 && dentro.mancaPareggio < c.larghezzaBuca, 'e dice quanto manca per tornare in pari');

const oltre = ciPerdo(18000, S, c);
esito(oltre.posizione === POSIZIONE.OLTRE && oltre.totale > 0 && oltre.compensa > oltre.perso, '18.000 €: oltre, non ci perdi', JSON.stringify(oltre));

for (const g of [16650, 16700, 17500, 18000, 22000]) {
  const r = ciPerdo(g, S, c);
  esito(r.compensa - r.perso === r.totale, `${g} €: le due barre fanno il saldo`);
  esito(r.totale === confrontoConSoglia(g, S, c).totale, `${g} €: stesso saldo del riquadro (confrontoConSoglia)`);
}
const bordo = ciPerdo(c.tetto + 1, S, c);
esito(Math.abs(-bordo.totale - c.perditaMax) <= 1, 'un euro oltre il tetto: la perdita è il caso peggiore del riquadro', `${bordo.totale} vs ${c.perditaMax}`);

console.log(falliti ? `\n${falliti} problema/i.\n` : '\n«Ci perdo?» dice la stessa cosa del riquadro.\n');
process.exit(falliti ? 1 : 0);
