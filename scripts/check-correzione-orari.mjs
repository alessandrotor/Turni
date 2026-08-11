// Riscontro della correzione degli orari a :50, da eseguire con:
//
//   node scripts/check-correzione-orari.mjs
//
// Sul foglio turni «16,50» vuol dire 16:30. Gli import da foto più vecchi (prima
// della conversione in gemini.js) sono entrati con i minuti sbagliati, e ogni
// turno così vale venti minuti più del dovuto.
//
// I quattro casi qui sotto sono presi dai dati veri, e non si comportano allo
// stesso modo: c'è chi perde venti minuti, chi non cambia durata e chi — turno
// scritto a mano che comincia alle 12:50 — ne GUADAGNA venti. È il motivo per
// cui l'elenco va mostrato all'utente prima di applicare qualcosa.

import { trovaOrariDaCorreggere, correggiOrari } from '../src/utils/orari.js';
import { minutesDiff } from '../src/utils/dates.js';

let fail = 0;
const check = (label, ok, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label}${extra ? '  → ' + extra : ''}`);
};

const TURNI = {
  fine50: { id: 'fine50', date: '2026-07-27', startTime: '12:00', endTime: '16:50' },
  entrambi50: { id: 'entrambi50', date: '2026-08-02', startTime: '16:50', endTime: '22:50' },
  inizio50: { id: 'inizio50', date: '2026-08-07', startTime: '12:50', endTime: '16:30' },
  normale: { id: 'normale', date: '2026-07-20', startTime: '12:00', endTime: '22:30', breakMinutes: 30 },
};

const durata = (t) => minutesDiff(t.startTime, t.endTime) - (t.breakMinutes || 0);

console.log('\nQuali turni vengono presi\n');
const trovati = trovaOrariDaCorreggere(TURNI);
check('tre candidati su quattro', trovati.length === 3, trovati.map(t => t.id).join(', '));
check('  il turno con orari normali resta fuori', !trovati.some(t => t.id === 'normale'));
check('  ordinati per data', trovati[0].id === 'fine50' && trovati[2].id === 'inizio50');

console.log('\nCosa cambia\n');
const dopo = correggiOrari(TURNI, trovati.map(t => t.id));

check('fine 16:50 → 16:30', dopo.fine50.endTime === '16:30', dopo.fine50.endTime);
check('  venti minuti in meno', durata(dopo.fine50) === durata(TURNI.fine50) - 20,
      `${durata(TURNI.fine50)}′ → ${durata(dopo.fine50)}′`);

check('entrambi gli estremi corretti', dopo.entrambi50.startTime === '16:30' && dopo.entrambi50.endTime === '22:30',
      `${dopo.entrambi50.startTime}–${dopo.entrambi50.endTime}`);
check('  la durata NON cambia', durata(dopo.entrambi50) === durata(TURNI.entrambi50),
      `${durata(dopo.entrambi50)}′`);

// Il caso che vieta la scorciatoia "tutti i turni perdono venti minuti".
check('inizio 12:50 → 12:30', dopo.inizio50.startTime === '12:30', dopo.inizio50.startTime);
check('  venti minuti in PIÙ', durata(dopo.inizio50) === durata(TURNI.inizio50) + 20,
      `${durata(TURNI.inizio50)}′ → ${durata(dopo.inizio50)}′`);

check('il turno normale è intatto', dopo.normale.startTime === '12:00' && dopo.normale.endTime === '22:30');
check('  e la pausa non si perde per strada', dopo.normale.breakMinutes === 30);

console.log('\nEffetti collaterali\n');
check('la mappa di partenza non viene modificata', TURNI.fine50.endTime === '16:50');
check('nessun turno perso', Object.keys(dopo).length === Object.keys(TURNI).length);
check('applicare due volte non cambia più nulla',
      trovaOrariDaCorreggere(dopo).length === 0);
check('con la lista di id vuota non tocca niente',
      correggiOrari(TURNI, []).fine50.endTime === '16:50');

console.log(fail === 0 ? '\n✓ correzione degli orari a :50 ok\n' : `\n✗ ${fail} riscontri falliti\n`);
process.exit(fail === 0 ? 0 : 1);
