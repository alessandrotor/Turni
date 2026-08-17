// Riscontro della regola «il turno tocca la fascia notturna», da eseguire con:
//
//   node scripts/check-fascia-notturna.mjs
//
// La regola precedente guardava solo le ore di inizio e fine separatamente, e
// sbagliava in entrambi i versi: marcava notturno un 06:00–07:00 (perché
// l'ora di fine era ≤ 7) e non aveva modo di ragionare su un turno a cavallo
// della mezzanotte se non per caso. I casi qui sotto sono quelli che devono
// restare veri: se un giorno la fascia cambia, si cambiano prima questi.

import { toccaFasciaNotturna } from '../src/utils/dates.js';

const casi = [
  // [inizio, fine, atteso, perché]
  ['22:00', '06:00', true,  'turno notturno pieno, valica la mezzanotte'],
  ['23:30', '07:30', true,  'entra in fascia e ne esce dopo le 6'],
  ['21:00', '23:00', true,  'gli ultimi 60 minuti cadono dopo le 22'],
  ['05:00', '13:00', true,  'la prima ora sta dentro la fascia'],
  ['00:00', '08:00', true,  'inizia a mezzanotte'],
  ['06:00', '07:00', false, 'mattina presto, NON notte — era il falso positivo'],
  ['06:00', '14:00', false, 'turno del mattino'],
  ['09:00', '17:00', false, 'giornaliero'],
  ['14:00', '22:00', false, 'finisce esattamente alle 22, la fascia è aperta a destra'],
  ['13:00', '21:59', false, 'pomeriggio lungo, si ferma un minuto prima'],
  ['',      '17:00', false, 'orario mancante'],
  ['09:00', '',      false, 'orario mancante'],
  ['09:00', '09:00', false, 'durata nulla'],
  ['25:00', '30:00', false, 'orario non valido'],
];

let falliti = 0;
for (const [inizio, fine, atteso, perche] of casi) {
  const avuto = toccaFasciaNotturna(inizio, fine);
  const ok = avuto === atteso;
  if (!ok) falliti++;
  const etichetta = `${inizio || '—'}–${fine || '—'}`.padEnd(14);
  console.log(`${ok ? '  ok' : 'FAIL'}  ${etichetta} atteso ${String(atteso).padEnd(5)} → ${String(avuto).padEnd(5)} ${perche}`);
}

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${casi.length} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${casi.length} casi tornano.`);
