// Il programma paghe è DAVVERO un file a sé:
//
//   node src/motore/riscontri/check-programma-paghe.mjs
//
// Le regole che non sono legge ma del programma paghe del datore — il
// reddito presunto, l'anno quando manca il progressivo, come si chiude al
// centesimo, il trattamento integrativo del primo mese — stanno in
// `programmi-paghe/`. Qui un programma finto con regole diverse le cambia
// tutte: se un conto non si muove, quel conto ha ancora la regola Zucchetti
// scritta dentro.

import { nettoDelMese } from '../net.js';
import { capienzaProgressiva, simulaTi } from '../capienza.js';
import { PROGRAMMI, programmaPaghe } from '../programmi-paghe/index.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const S = { hourlyRate: 9.21802, expectedWeeklyHours: 24, ccnl: 'turismo', addizionaliAltrove: true, hasTredicesima: true };

console.log('\nQuale programma\n');
esito(programmaPaghe({}).codice === 'zucchetti', 'senza scelta: Zucchetti, il verificato');
esito(programmaPaghe({ programmaPaghe: 'sconosciuto' }).codice === 'zucchetti', 'un codice che non c\'è: Zucchetti');

// Un programma che arrotonda invece di troncare, proietta l'anno a 30.000,
// non concede il primo mese e senza progressivo moltiplica per tredici.
PROGRAMMI.prova = {
  ...PROGRAMMI.zucchetti,
  codice: 'prova',
  quota: (x) => Math.round(x * 100) / 100,
  lordoPresuntoAnno: () => 30000,
  annoSenzaProgressivo: (l) => ({ baseMese: Math.round(l), proiezione: Math.round(l) * 13 }),
  primoMeseConcesso: false,
};
const P = { ...S, programmaPaghe: 'prova' };

console.log('\nLe sue regole arrivano ai calcoli\n');
const cap = (s) => capienzaProgressiva(1100, s, { lordo: 6000, mesi: 6, mese: 6 });
esito(!nettoDelMese(1100, P, 31, 0, cap(P)).esitoTi.spetta && nettoDelMese(1100, S, 31, 0, cap(S)).esitoTi.spetta,
  'il reddito presunto del programma decide il trattamento integrativo');
esito(nettoDelMese(1200, S, 31, 0).esitoTi.spetta && !nettoDelMese(1200, P, 31, 0).esitoTi.spetta,
  'senza progressivo: 1.200 × 12 sotto i 15.000, × 13 sopra');
const vero = nettoDelMese(1000, S, 31, 0);
const conProva = nettoDelMese(1000, P, 31, 0);
esito(vero.trattamentoIntegrativo === 101.91 && conProva.trattamentoIntegrativo === 101.92,
  'chiudere al centesimo: 101,9178 troncato o arrotondato', `${vero.trattamentoIntegrativo} / ${conProva.trattamentoIntegrativo}`);
esito(simulaTi(vero, 31, true, P).trattamentoIntegrativo === 101.92, 'anche la simulazione del riquadro');
const primo = (s) => capienzaProgressiva(300, s, { lordo: 0, mesi: 0, mese: 0 }).capiente;
esito(primo(S) === true && primo(P) === false, 'il primo mese: concesso o misurato sul mese');

delete PROGRAMMI.prova;
console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
