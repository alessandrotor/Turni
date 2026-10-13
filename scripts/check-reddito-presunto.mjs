// Il reddito PRESUNTO dell'anno: su cosa il datore decide, ogni mese,
// trattamento integrativo e detrazioni.
//
//   node scripts/check-reddito-presunto.mjs
//
// DA DOVE VIENE: buste Zucchetti 2026, CCNL Turismo, part-time 24 h.
// La legge guarda l'anno vero, al conguaglio; mese per mese il datore usa un
// reddito presunto. Le detrazioni di agosto e settembre lo rivelano, perché
// sopra i 15.000 cambiano col reddito: invertendole viene 15.230 ad agosto e
// 15.046 a settembre, e l'una e l'altra sono
//
//   imponibile pagato finora + imponibile del mese × (mesi che restano + la 13ª)
//
// cioè lo schema dei programmi paghe («già pagato + mese proiettato fino a
// dicembre», documentato da NoiPA), con la 13ª stimata come il mese. Prima
// l'app usava 15.100 € fissi sopra soglia e lordo × 12 per il trattamento
// integrativo: 0,82 € di netto in più ad agosto, 0,56 in meno a settembre.
//
// Il progressivo è il lordo prima del mese, letto dall'imponibile INPS delle
// buste (10.358 € a fine agosto). Gennaio, marzo e aprile non sono noti uno per
// uno: gennaio è la loro media, e febbraio resta lontano dalla soglia.

import { nettoDelMese } from '../src/motore/net.js';
import { capienzaProgressiva, lordoPresuntoAnno } from '../src/motore/capienza.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const vicino = (a, b, tol) => Math.abs(a - b) <= tol;

const S = {
  hourlyRate: 9.21802, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo',
  aziendaDipendenti: 'oltre15', addizionaliAltrove: true, hasTredicesima: true, hasQuattordicesima: true,
};
const netto = (lordo, giorni, prima, mese) =>
  nettoDelMese(lordo, S, giorni, 0, capienzaProgressiva(lordo, S, { lordo: prima, mesi: mese, mese }));

console.log('\nLe detrazioni sopra soglia, al centesimo\n');
const agosto = netto(1298.15, 31, 10358 - 1298, 7);
const settembre = netto(1257.36, 30, 10358, 8);
esito(vicino(agosto.detrazioni, 261.50, 0.02), 'agosto: detrazioni 261,50 come in busta', `${agosto.detrazioni} €`);
esito(vicino(agosto.net, 1217.56, 0.02), 'agosto: netto 1.217,56', `${agosto.net} €, prima 1.218,38`);
esito(vicino(settembre.detrazioni, 254.44, 0.05), 'settembre: detrazioni 254,44 come in busta', `${settembre.detrazioni} €`);
esito(vicino(settembre.net, 1180.38, 0.05), 'settembre: netto 1.180,38', `${settembre.net} €, prima 1.179,82`);
esito(vicino(agosto.esitoTi.proiezione, 15230, 5) && vicino(settembre.esitoTi.proiezione, 15046, 5),
  'il reddito presunto è quello che le detrazioni rivelano', `${agosto.esitoTi.proiezione} e ${settembre.esitoTi.proiezione}`);

console.log('\nIl trattamento integrativo, sei buste su sei\n');
// Lordo del mese e lordo dei mesi prima, a ritroso dal progressivo di agosto.
const lordi = { 1: 1099.42, 4: 1162.92, 5: 2047.58, 6: 1173.48, 7: 1298.15, 8: 1257.36 };
const prima = { 8: 10358, 7: 9060 };
prima[6] = prima[7] - lordi[6];
prima[5] = prima[6] - lordi[5];
prima[4] = prima[5] - lordi[4];
prima[1] = (prima[4] - lordi[1]) / 3;   // gennaio: media di gennaio, marzo e aprile
const inBusta = { 1: true, 4: true, 5: false, 6: true, 7: false, 8: false };
const nomi = { 1: 'febbraio', 4: 'maggio', 5: 'giugno (con la 14ª)', 6: 'luglio', 7: 'agosto', 8: 'settembre' };
for (const m of [1, 4, 5, 6, 7, 8]) {
  const n = netto(lordi[m], 30, prima[m], m);
  const c = n.trattamentoIntegrativo > 0;
  esito(c === inBusta[m], `${nomi[m]}: ${inBusta[m] ? 'c\'è' : 'non c\'è'}, come in busta`, n.esitoTi.motivo);
}

console.log('\nLa regola\n');
esito(lordoPresuntoAnno(1000, S, { lordo: 8000, mesi: 8, mese: 8 }) === 8000 + 1000 * 5,
  'settembre: finora + il mese per settembre-dicembre e per la 13ª');
esito(lordoPresuntoAnno(1000, { ...S, hasTredicesima: false }, { lordo: 0, mesi: 0, mese: 0 }) === 12000,
  'senza 13ª, gennaio: il mese per dodici');
esito(lordoPresuntoAnno(1000, S, { lordo: 11000, mesi: 11, mese: 11 }) === 12000,
  'dicembre: la 13ª è già nel mese, non si conta due volte');
esito(lordoPresuntoAnno(1000, S, null) === null, 'senza indice del mese: nessuna stima, si torna a lordo × 12');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
