// Riscontro: lavoro e ferie nello stesso giorno.
//
//   node scripts/check-sostituzioni.mjs
//
// IL DIFETTO, trovato il 10/11/2026. Una giornata di ferie salvata su un
// giorno con un turno di lavoro lo lasciava lì, e viceversa: quel giorno si
// pagava due volte (8 h di lavoro più 4 h di ferie). Il periodo di assenza
// toglieva solo il primo turno del giorno.
//
// LA REGOLA, decisa da chi mantiene il progetto: ferie, malattia e festività
// non lavorata prendono il posto del lavoro dello stesso giorno, e il lavoro il
// loro. Il permesso è a ore e convive con tutto. Quello che esce torna con
// «Annulla» (`hooks/useAnnulla.js`), mai con una conferma prima.

import { siEscludono, turniSostituiti } from '../src/utils/sostituzioni.js';
import { TIPO } from '../src/motore/assenze.js';

let falliti = 0;
function verifica(titolo, avuto, atteso) {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${titolo.padEnd(56)} ${ok ? '' : `atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)}`}`);
}

const lavoro = (id, date) => ({ id, date, startTime: '08:00', endTime: '16:00' });
const assenza = (id, date, type) => ({ id, date, type, durationMinutes: 240 });
const ids = (lista) => lista.map(t => t.id).sort();

console.log('\nChi esclude chi\n');
verifica('lavoro e ferie', siEscludono(lavoro('a', 'x'), assenza('b', 'x', TIPO.FERIE)), true);
verifica('lavoro e malattia', siEscludono(lavoro('a', 'x'), assenza('b', 'x', TIPO.MALATTIA)), true);
verifica('lavoro e festività', siEscludono(assenza('b', 'x', TIPO.FESTIVITA), lavoro('a', 'x')), true);
verifica('lavoro e permesso convivono', siEscludono(lavoro('a', 'x'), assenza('b', 'x', TIPO.PERMESSO)), false);
verifica('due turni di lavoro convivono (doppio turno)', siEscludono(lavoro('a', 'x'), lavoro('b', 'x')), false);
verifica('ferie e malattia: non è questa regola', siEscludono(assenza('a', 'x', TIPO.FERIE), assenza('b', 'x', TIPO.MALATTIA)), false);
verifica('turno senza `type` vale lavoro', siEscludono({ id: 'v', date: 'x', startTime: '9:00', endTime: '13:00' }, assenza('b', 'x', TIPO.FERIE)), true);

console.log('\nCosa esce a un salvataggio\n');
const esistenti = [
  lavoro('L1', '2026-11-12'), lavoro('L2', '2026-11-12'),
  assenza('P1', '2026-11-12', TIPO.PERMESSO),
  lavoro('L3', '2026-11-13'),
  assenza('F1', '2026-11-14', TIPO.FERIE),
];
verifica('ferie sul giorno del doppio turno: escono tutti e due',
  ids(turniSostituiti(esistenti, [{ date: '2026-11-12', type: TIPO.FERIE }])), ['L1', 'L2']);
verifica('  il permesso resta', turniSostituiti(esistenti, [{ date: '2026-11-12', type: TIPO.FERIE }])
  .some(t => t.id === 'P1'), false);
verifica('lavoro su un giorno di ferie: escono le ferie',
  ids(turniSostituiti(esistenti, [{ date: '2026-11-14', startTime: '08:00', endTime: '12:00' }])), ['F1']);
verifica('permesso su un giorno di lavoro: non esce niente',
  ids(turniSostituiti(esistenti, [{ date: '2026-11-13', type: TIPO.PERMESSO }])), []);
verifica('un periodo prende tutti i suoi giorni',
  ids(turniSostituiti(esistenti, ['2026-11-12', '2026-11-13', '2026-11-14']
    .map(date => ({ date, type: TIPO.MALATTIA })))), ['L1', 'L2', 'L3']);
// Modificare un turno di lavoro in ferie non deve far uscire il turno stesso:
// è lo stesso record, cambia tipo.
verifica('la modifica non sostituisce sé stessa',
  ids(turniSostituiti(esistenti, [{ id: 'L1', date: '2026-11-12', type: TIPO.FERIE }])), ['L2']);
verifica('un altro giorno non si tocca',
  ids(turniSostituiti(esistenti, [{ date: '2026-11-20', type: TIPO.FERIE }])), []);

console.log(falliti ? `\n${falliti} casi non tornano.` : '\n✓ tutti i casi tornano.');
process.exit(falliti ? 1 : 0);
