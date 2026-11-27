// «Copia la settimana scorsa» copia quello che deve, e niente di più:
//
//   node scripts/check-copia-settimana.mjs
//
// Non viene da una busta: è una scorciatoia del calendario (utils/copia-settimana.js).
// Si verifica che copi solo il lavoro, sette giorni avanti, senza maggiorazioni
// e note, mai su una settimana passata o già iniziata a segnare, mai su un festivo.

import { settimanaDaCopiare } from '../src/utils/copia-settimana.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const g = (s) => new Date(`${s}T12:00:00`);
const nov = new Date(2026, 10, 1);

// Settimana 9–15 novembre segnata, 16–22 vuota, oggi è giovedì 12.
const turni = [
  { id: 1, date: '2026-11-09', startTime: '16:30', endTime: '22:30', breakMinutes: 0, surchargePct: 20, note: 'sostituzione' },
  { id: 2, date: '2026-11-10', startTime: '11:30', endTime: '16:30', breakMinutes: 30 },
  { id: 3, date: '2026-11-12', type: 'ferie', durationMinutes: 240 },
];
const r = settimanaDaCopiare(turni, nov, g('2026-11-12'));
esito(r?.lunedi === '2026-11-16' && r.fine === '2026-11-22', 'la prima settimana vuota da oggi in avanti', JSON.stringify(r && [r.lunedi, r.fine]));
esito(r?.turni.length === 2 && r.turni[0].date === '2026-11-16' && r.turni[1].date === '2026-11-17',
  'si copia solo il lavoro, sette giorni avanti', JSON.stringify(r?.turni));
esito(r && r.turni[0].surchargePct === undefined && r.turni[0].note === undefined && r.turni[1].breakMinutes === 30,
  'orari e pausa sì, maggiorazione e nota no');

esito(settimanaDaCopiare(turni, nov, g('2026-11-25')) === null, 'settimane passate non si riempiono da sole');
// Dopo la copia la settimana del 23 è vuota con la precedente piena: non si propone,
// è oltre la prossima. Altrimenti la riga tornerebbe a catena dopo ogni copia.
const copiata = [...turni, ...r.turni.map((t, i) => ({ ...t, id: 10 + i }))];
esito(settimanaDaCopiare(copiata, nov, g('2026-11-12')) === null, 'dopo una copia la riga non torna per la settimana dopo');
esito(settimanaDaCopiare([...turni, { id: 4, date: '2026-11-18', startTime: '9:00', endTime: '13:00' }], nov, g('2026-11-12')) === null,
  'una settimana già iniziata a segnare non è vuota, e oltre la prossima non si guarda');
esito(settimanaDaCopiare([turni[2]], nov, g('2026-11-12')) === null, 'senza lavoro nella settimana prima, niente da copiare');
const conFesta = settimanaDaCopiare(turni, nov, g('2026-11-12'), (iso) => iso === '2026-11-16');
esito(conFesta?.turni.length === 1 && conFesta.turni[0].date === '2026-11-17', 'un turno che cadrebbe su un festivo si salta');

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nLa settimana si copia senza inventare niente.\n');
process.exit(falliti ? 1 : 0);
