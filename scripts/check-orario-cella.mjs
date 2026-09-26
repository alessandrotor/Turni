// Riscontro del formato corto degli orari nella griglia del mese:
//
//   node scripts/check-orario-cella.mjs
//
// La cella scrive «18–23³⁰» invece di «18:00–23:30» perché su un telefono una
// colonna è larga una quarantina di pixel. Accorciare è lecito, arrotondare no:
// un minuto sparito in una cella non lo nota nessuno, e il turno sembra giusto.
// Quindi la proprietà verificata è una sola, su tutti gli orari possibili: dal
// formato corto si torna SEMPRE all'orario di partenza.

import { partiOrario, intervalloCella, ricomponi } from '../src/utils/orario-cella.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

console.log('\nNessun orario si perde accorciandolo\n');
let persi = [];
for (let h = 0; h < 24; h += 1) {
  for (let m = 0; m < 60; m += 1) {
    const orario = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (ricomponi(partiOrario(orario)) !== orario) persi.push(orario);
  }
}
esito(persi.length === 0, 'tutti i 1.440 minuti del giorno tornano uguali',
  persi.length ? `persi: ${persi.slice(0, 5).join(', ')}` : '');

console.log('\nCome si scrive\n');
const vedi = (o) => { const p = partiOrario(o); return p.minuti ? `${p.ore}^${p.minuti}` : p.ore; };
esito(vedi('10:00') === '10', 'ora tonda: solo l\'ora', vedi('10:00'));
esito(vedi('23:30') === '23^30', 'minuti presenti: in apice', vedi('23:30'));
esito(vedi('8:15') === '08^15', 'ora a una cifra: si completa', vedi('8:15'));
esito(vedi('00:30') === '00^30', 'mezzanotte e mezza non diventa mezzanotte', vedi('00:30'));

console.log('\nDati strani: si mostrano, non si inventano\n');
esito(partiOrario('25h').ore === '25h', 'un valore che non è un orario resta intero', partiOrario('25h').ore);
esito(partiOrario(undefined).ore === '', 'un orario mancante resta vuoto', '');
esito(intervalloCella('09:00', '').fine === null, 'senza fine: niente trattino sospeso', '');
const doppio = [intervalloCella('10:00', '15:00'), intervalloCella('18:00', '23:30')];
esito(doppio.map(i => `${vedi(ricomponi(i.inizio))}–${vedi(ricomponi(i.fine))}`).join(' + ') === '10–15 + 18–23^30',
  'il doppio turno si legge per intero', '10–15 + 18–23^30');

console.log();
if (falliti) {
  console.error(`${falliti} caso/i non tornano.`);
  process.exit(1);
}
console.log('Tutti i casi tornano.');
