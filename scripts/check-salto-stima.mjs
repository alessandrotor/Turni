// La stima di dicembre che salta senza turni nuovi si dice:
//
//   node scripts/check-salto-stima.mjs
//
// DA DOVE VIENE: novembre 2026, coi dati di chi mantiene il progetto. Un
// aggiornamento ha cambiato il conto del mese in corso nella stima «dal
// maturato»: 15.929 → 16.842 € senza un turno in più, e il riquadro è passato
// da «ancora ~55 ore» a «oltre la soglia» senza spiegazioni. Qui non si misura
// il motore, si misura la regola dell'avviso (utils/salto-stima.js).

import { confrontaStima, SALTO_MINIMO, GIORNI_AVVISO } from '../src/utils/salto-stima.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const g = (s) => new Date(`${s}T12:00:00`);

const prima = confrontaStima({ valore: 15929, turni: 'A', impostazioni: 'S', oggi: g('2026-11-09') });
esito(prima.salto === null, 'la prima volta non c\'è niente da confrontare');

const dopo = confrontaStima({ precedente: prima.fotografia, valore: 16842, turni: 'A', impostazioni: 'S', oggi: g('2026-11-11') });
esito(dopo.salto?.da === 15929 && dopo.salto?.a === 16842 && dopo.salto.causa === 'calcolo',
  'stessi turni e impostazioni, +913 € → avviso, causa il calcolo', JSON.stringify(dopo.salto));

const resta = confrontaStima({ precedente: dopo.fotografia, salto: dopo.salto, valore: 16850, turni: 'A', impostazioni: 'S', oggi: g('2026-11-14') });
esito(resta.salto?.da === 15929, 'nei giorni dopo l\'avviso resta, col punto di partenza');

const scade = confrontaStima({ precedente: resta.fotografia, salto: resta.salto, valore: 16850, turni: 'A', impostazioni: 'S', oggi: g('2026-11-20') });
esito(scade.salto === null, `dopo ${GIORNI_AVVISO} giorni sparisce da solo`);

const turniNuovi = confrontaStima({ precedente: dopo.fotografia, salto: dopo.salto, valore: 17500, turni: 'B', impostazioni: 'S', oggi: g('2026-11-12') });
esito(turniNuovi.salto === null, 'turni nuovi spiegano lo spostamento: niente avviso');

const piccolo = confrontaStima({ precedente: prima.fotografia, valore: 15929 + SALTO_MINIMO - 1, turni: 'A', impostazioni: 'S', oggi: g('2026-11-10') });
esito(piccolo.salto === null, `sotto i ${SALTO_MINIMO} € è rumore`);

const imp = confrontaStima({ precedente: prima.fotografia, valore: 16400, turni: 'A', impostazioni: 'T', oggi: g('2026-11-10') });
esito(imp.salto?.causa === 'impostazioni', 'impostazioni cambiate → lo si dice come causa');

const torna = confrontaStima({ precedente: dopo.fotografia, salto: dopo.salto, valore: 15950, turni: 'A', impostazioni: 'S', oggi: g('2026-11-12') });
esito(torna.salto === null, 'se la stima torna dov\'era, l\'avviso sparisce', JSON.stringify(torna.salto));

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nLa stima che salta da sola si dice.\n');
process.exit(falliti ? 1 : 0);
