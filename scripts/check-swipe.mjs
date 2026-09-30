// «Scorrere di lato cambia mese, e nient'altro lo fa», riscontrato:
//
//   node scripts/check-swipe.mjs
//
// PERCHÉ ESISTE
// Un gesto che cambia mese a chi stava scorrendo la pagina è peggio delle
// frecce in alto: ci si ritrova in un altro mese senza sapere come. I casi
// sotto sono quelli che un pollice fa davvero — la pagina scorsa in verticale
// un po' storta, il tocco su una cella con due pixel di tremolio, il dito
// appoggiato che scivola mentre si legge.
//
// Accanto alle soglie c'è anche la regola della sorgente: il gesto parte solo
// dall'area del calendario, e una finestra aperta sopra (il modulo del turno)
// non lo deve mai ricevere. Questo non si vede da una funzione pura, quindi
// si legge il sorgente di CalendarView.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { direzioneSwipe } from '../src/utils/swipe.js';

let falliti = 0;
let totale = 0;
function verifica(titolo, avuto, atteso, perche = '') {
  const ok = avuto === atteso;
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(52)} ${atteso} → ${avuto}  ${perche}`);
}

console.log('\nCambia mese\n');
verifica('dito verso sinistra, deciso', direzioneSwipe({ dx: -120, dy: 10, ms: 250 }), 1, 'il mese dopo, come una pagina');
verifica('dito verso destra, deciso', direzioneSwipe({ dx: 120, dy: -8, ms: 250 }), -1, 'il mese prima');
verifica('un po\' storto ma orizzontale', direzioneSwipe({ dx: -90, dy: 40, ms: 300 }), 1, '');

console.log('\nNon cambia mese\n');
verifica('scorrimento verticale storto', direzioneSwipe({ dx: 70, dy: 200, ms: 300 }), 0, 'si stava scorrendo la pagina');
verifica('diagonale 45°', direzioneSwipe({ dx: 100, dy: 100, ms: 300 }), 0, 'nel dubbio si resta nel mese');
verifica('tocco su una cella con tremolio', direzioneSwipe({ dx: 6, dy: 3, ms: 120 }), 0, '');
verifica('scivolata corta', direzioneSwipe({ dx: -40, dy: 0, ms: 200 }), 0, 'sotto i 60 px');
verifica('dito appoggiato che scivola piano', direzioneSwipe({ dx: -150, dy: 5, ms: 1500 }), 0, 'sta leggendo, non sfogliando');
verifica('valori mancanti', direzioneSwipe({ dx: NaN, dy: 0, ms: 100 }), 0, '');

console.log('\nDa dove parte il gesto\n');
const QUI = dirname(fileURLToPath(import.meta.url));
const cal = readFileSync(join(QUI, '..', 'src', 'components', 'CalendarView.jsx'), 'utf8');
verifica('CalendarView usa direzioneSwipe', /direzioneSwipe\(/.test(cal), true);
verifica('il gesto sta sull\'area dei giorni, non su tutta la vista',
  /className="cal-sfoglia"[^>]*onTouchStart|onTouchStart[^>]*className="cal-sfoglia"/s.test(cal), true,
  'l\'intestazione e il netto non sfogliano');

console.log(`\n${totale - falliti}/${totale} ok\n`);
process.exit(falliti ? 1 : 0);
