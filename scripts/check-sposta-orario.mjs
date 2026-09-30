// «Mezz'ora avanti, mezz'ora indietro», riscontrato:
//
//   node scripts/check-sposta-orario.mjs
//
// PERCHÉ ESISTE
// Lo stepper ±30 del modulo turno evita il selettore a rulli del telefono. Due
// modi di sbagliare che non si vedono provando con un turno 08:00–16:00: il
// turno di notte che passa la mezzanotte (23:45 + 30 deve fare 00:15, non
// 24:15), e il campo vuoto, dove lo stepper non deve inventarsi un orario.

import { spostaOrario } from '../src/utils/dates.js';

let falliti = 0;
let totale = 0;
function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(40)} ${atteso} → ${avuto}  ${perche}`);
}

verifica('07:00 + 30', spostaOrario('07:00', 30), '07:30');
verifica('07:00 − 30', spostaOrario('07:00', -30), '06:30');
verifica('14:15 + 30 (quarti d\'ora restano)', spostaOrario('14:15', 30), '14:45', 'non arrotonda alla mezz\'ora');
verifica('23:45 + 30', spostaOrario('23:45', 30), '00:15', 'passa la mezzanotte');
verifica('00:10 − 30', spostaOrario('00:10', -30), '23:40', 'torna indietro oltre la mezzanotte');
verifica('campo vuoto', spostaOrario('', 30), '', 'non si inventa un orario');
verifica('valore strano', spostaOrario('25:00', 30), '25:00', '');

console.log(`\n${totale - falliti}/${totale} ok\n`);
process.exit(falliti ? 1 : 0);
