// Riscontro: l'app aperta in due schede.
//
//   node scripts/check-due-schede.mjs
//
// IL DIFETTO, segnalato nella revisione del 10/11/2026 (F4 in COSE-NUOVE).
// Ogni scheda teneva in memoria la sua copia dei turni e la riscriveva intera
// a ogni modifica. Turno segnato nella scheda A, poi un tocco nella scheda B,
// che non lo sapeva: il turno spariva dal disco.
//
// Ora `useLocalStorage` ascolta l'evento `storage`, che il browser manda alle
// ALTRE schede quando una scrive. Qui si verifica la parte pura: cosa prende
// la scheda da quell'evento.

import { valoreDaAltraScheda, NESSUN_CAMBIO } from '../src/hooks/useLocalStorage.js';

let falliti = 0;
function verifica(titolo, avuto, atteso) {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso) && typeof avuto === typeof atteso;
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${titolo}`);
}

const K = 'turni_shifts';
const turni = { a: { id: 'a', date: '2026-11-12', startTime: '08:00', endTime: '16:00' } };

console.log('\nCosa prende una scheda quando l\'altra scrive\n');
verifica('il turno segnato nell\'altra scheda arriva',
  valoreDaAltraScheda({ key: K, newValue: JSON.stringify(turni) }, K, {}), turni);
verifica('un\'altra chiave non tocca questa',
  valoreDaAltraScheda({ key: 'turni_settings', newValue: '{"x":1}' }, K, {}) === NESSUN_CAMBIO, true);
verifica('chiave cancellata nell\'altra scheda → valore iniziale',
  valoreDaAltraScheda({ key: K, newValue: null }, K, {}), {});
verifica('tutto cancellato (clear) → valore iniziale',
  valoreDaAltraScheda({ key: null, newValue: null }, K, {}), {});
// Un testo che non si legge non deve sostituire dati buoni con niente.
verifica('JSON rotto: si tiene quello che si ha',
  valoreDaAltraScheda({ key: K, newValue: '{rotto' }, K, {}) === NESSUN_CAMBIO, true);

console.log(falliti ? `\n${falliti} casi non tornano.` : '\n✓ tutti i casi tornano.');
process.exit(falliti ? 1 : 0);
