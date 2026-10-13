// Il fisco dell'ANNO arriva davvero ai calcoli:
//
//   node src/motore/riscontri/check-fisco-anno.mjs
//
// Il fisco sta in `fisco/`, un file per anno. Che il file esista non basta:
// serve che chi conosce l'anno lo passi (`conFisco`) e che ogni funzione lo
// legga (`fiscoDi`) invece di una tabella scritta dentro. Qui si prova con una
// tabella finta — l'IRPEF al 30% e la soglia dei 15.000 a 10.000 — che non
// esiste in nessuna legge: se un conto non cambia, quel conto legge ancora la
// tabella fissa.

import { nettoDelMese, calcNetAnnual, irpefLorda } from '../net.js';
import { fiscoDellAnno, fiscoDi, conFisco, FISCO_ULTIMO, TAX_2026 } from '../fisco/index.js';
import { capienzaProgressiva } from '../capienza.js';
import { lordoMeseMinimoTi } from '../soglia-lorda.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const S = { hourlyRate: 9.21802, expectedWeeklyHours: 24, ccnl: 'turismo', addizionaliAltrove: true };
const FINTA = {
  ...TAX_2026,
  anno: 2099,
  IRPEF_SCAGLIONI: [{ fino: Infinity, aliquota: 0.30 }],
  TI_SOGLIA_PIENO: 10000,
};

console.log('\nScegliere la tabella\n');
esito(fiscoDellAnno(2026) === TAX_2026, 'il 2026 ha la sua tabella');
esito(fiscoDellAnno(2030) === FISCO_ULTIMO, 'un anno dopo l\'ultimo noto usa l\'ultimo noto');
esito(fiscoDellAnno(2020) === TAX_2026, 'un anno prima del primo noto usa il primo');
esito(fiscoDi({}) === FISCO_ULTIMO, 'chi non dice l\'anno ha l\'ultimo noto');
esito(conFisco(S, 2026).fisco === TAX_2026 && conFisco(S, undefined) === S, 'conFisco mette la tabella solo con un anno');

console.log('\nLa tabella arriva ai calcoli\n');
const vero = nettoDelMese(1100, S, 30, 0);
const finto = nettoDelMese(1100, { ...S, fisco: FINTA }, 30, 0);
esito(finto.irpefLorda > vero.irpefLorda, 'IRPEF lorda del mese: 30% invece di 23%', `${vero.irpefLorda} → ${finto.irpefLorda}`);
esito(vero.esitoTi.spetta && !finto.esitoTi.spetta, 'soglia del trattamento integrativo: 1.100 × 12 oltre i 10.000 finti');
esito(calcNetAnnual(14000, { ...S, fisco: FINTA }).irpefLorda > calcNetAnnual(14000, S).irpefLorda, 'IRPEF dell\'anno');
esito(irpefLorda(14000, FINTA) === 4200, 'irpefLorda riceve la tabella', `${irpefLorda(14000, FINTA)} €`);
const capVero = capienzaProgressiva(300, S, { lordo: 3000, mesi: 4, mese: 4 });
const capFinta = capienzaProgressiva(300, { ...S, fisco: FINTA }, { lordo: 3000, mesi: 4, mese: 4 });
esito(capVero.capiente === false && capFinta.capiente === true, 'capienza: col 30% l\'imposta supera la detrazione');
esito(lordoMeseMinimoTi({ ...S, fisco: FINTA }) !== lordoMeseMinimoTi(S), 'la soglia minima del trattamento integrativo');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
