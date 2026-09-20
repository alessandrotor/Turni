// «Un tocco fuori non butta via il lavoro», riscontrato invece che sperato:
//
//   node scripts/check-bozza.mjs
//
// PERCHÉ ESISTE
// La protezione del modulo del turno si rompe in tre modi, e nessuno dei tre si
// vede guardando l'app:
//
//  1. dice sempre «sì» → la finestra non si chiude più col tocco fuori, e
//     sembra bloccata;
//  2. dice sempre «no» → la protezione non c'è più, ma tutto funziona come
//     prima finché qualcuno non perde venti giornate di ferie;
//  3. IL PEGGIORE: qualcuno aggiunge un campo al modulo e si dimentica di
//     elencarlo in `CAMPI_BOZZA`. Quel campo resta scoperto, da solo, e il
//     resto continua a funzionare — quindi nessuno lo scopre.
//
// Il terzo è il motivo vero di questo file. L'elenco dei campi non si dà per
// buono: si legge `ShiftForm.jsx` e si guarda quali campi il modulo modifica
// DAVVERO, cioè `set('campo')` e `setForm(f => ({ ...f, campo: ... }))`. Se il
// modulo ne tocca uno che l'elenco non ha, qui diventa rosso.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bozzaDaSalvare, CAMPI_BOZZA } from '../src/utils/bozza.js';

const QUI = dirname(fileURLToPath(import.meta.url));
const FORM = join(QUI, '..', 'src', 'components', 'ShiftForm.jsx');

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(50)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// Lo stato con cui si apre una finestra «nuovo turno», com'è in
// `getInitialState`: `fonteOrari` compreso, che è proprio il campo che NON
// deve contare.
const INIZIALE = {
  kind: 'lavoro',
  date: '2026-09-21',
  startTime: '08:00',
  endTime: '16:00',
  breakMinutes: 30,
  fonteOrari: 'storico',
  surchargePct: 0,
  absenceHours: '6.67',
  dateTo: '',
  note: '',
};

const apertaOra = () => ({ ...INIZIALE });

// ── 1. Una finestra appena aperta non trattiene nessuno ────────────────────
console.log('\nAppena aperta non c\'è niente da perdere\n');

verifica('modulo intatto', bozzaDaSalvare({ iniziale: INIZIALE, form: apertaOra(), modifiche: {} }), false,
  'chi apre e cambia idea esce con un tocco, come sempre');
verifica('senza `modifiche`', bozzaDaSalvare({ iniziale: INIZIALE, form: apertaOra() }), false,
  'il periodo non è nemmeno attivo');
verifica('`fonteOrari` diverso non conta',
  bozzaDaSalvare({ iniziale: INIZIALE, form: { ...apertaOra(), fonteOrari: 'default' }, modifiche: {} }), false,
  'è l\'etichetta della proposta, non un dato inserito');
verifica('argomenti mancanti', bozzaDaSalvare({}), false,
  'nel dubbio non si trattiene: bloccare una finestra è peggio');

// ── 2. Ogni campo, da solo, basta a proteggere ─────────────────────────────
// Uno per uno: se un domani qualcuno toglie un campo dall'elenco, il suo caso
// qui diventa rosso da solo, senza trascinare gli altri.
console.log('\nOgni singolo campo, da solo, trattiene la finestra\n');

const TOCCATO = {
  kind: 'ferie',
  date: '2026-09-22',
  startTime: '09:00',
  endTime: '17:30',
  breakMinutes: 45,
  surchargePct: 30,
  absenceHours: '4',
  dateTo: '2026-10-05',
  note: 'sostituzione',
};

for (const campo of CAMPI_BOZZA) {
  verifica(`cambiato solo «${campo}»`,
    bozzaDaSalvare({ iniziale: INIZIALE, form: { ...apertaOra(), [campo]: TOCCATO[campo] }, modifiche: {} }),
    true, `${JSON.stringify(INIZIALE[campo])} → ${JSON.stringify(TOCCATO[campo])}`);
}

// ── 3. Le righe del periodo, il lavoro più caro da rifare ──────────────────
console.log('\nLe correzioni riga per riga del periodo\n');

verifica('una riga sola corretta',
  bozzaDaSalvare({ iniziale: INIZIALE, form: apertaOra(), modifiche: { '2026-09-23': { selezionato: false } } }),
  true, 'venti giornate si correggono una alla volta: la prima già conta');
verifica('`modifiche` vuoto non conta',
  bozzaDaSalvare({ iniziale: INIZIALE, form: apertaOra(), modifiche: {} }), false,
  'si azzera da sé quando cambiano le date');

// ── 4. Chi torna sui suoi passi esce ───────────────────────────────────────
// Confrontare i VALORI e non «qualcuno ha digitato» è quello che evita la
// finestra che non si chiude più per un numero rimesso com'era.
console.log('\nTornare com\'era riapre la porta\n');

verifica('pausa cambiata e rimessa',
  bozzaDaSalvare({ iniziale: INIZIALE, form: { ...apertaOra(), breakMinutes: 30 }, modifiche: {} }), false);
verifica('la stringa «30» vale il numero 30',
  bozzaDaSalvare({ iniziale: INIZIALE, form: { ...apertaOra(), breakMinutes: '30' }, modifiche: {} }), false,
  'gli <input> restituiscono stringhe: 30 e «30» sono lo stesso valore a schermo');
verifica('spazi in coda alla nota',
  bozzaDaSalvare({ iniziale: INIZIALE, form: { ...apertaOra(), note: '  ' }, modifiche: {} }), false,
  'due spazi non sono lavoro da proteggere');

// ── 5. Il controllo che nessun occhio umano fa ─────────────────────────────
// L'elenco contro il modulo vero. È la difesa contro il campo aggiunto domani
// e dimenticato qui.
console.log('\nL\'elenco copre tutti i campi che il modulo tocca\n');

const sorgente = readFileSync(FORM, 'utf8');
const daSet = [...sorgente.matchAll(/\bset\('([a-zA-Z]+)'\)/g)].map((m) => m[1]);
const daSpread = [...sorgente.matchAll(/\.\.\.f,\s*([a-zA-Z]+):/g)].map((m) => m[1]);
const toccati = [...new Set([...daSet, ...daSpread])].sort();

verifica('il modulo tocca dei campi', toccati.length > 0, true,
  'se qui esce zero, la regex non trova più niente e il controllo non controlla');

const scoperti = toccati.filter((c) => !CAMPI_BOZZA.includes(c));
verifica('nessun campo scoperto', scoperti, [],
  scoperti.length ? `${scoperti.join(', ')} — il modulo li cambia e la protezione non li vede` : `${toccati.length} campi`);

const inutili = CAMPI_BOZZA.filter((c) => !toccati.includes(c));
verifica('nessun campo di troppo', inutili, [],
  inutili.length ? `${inutili.join(', ')} — nell'elenco ma il modulo non li tocca` : '');

console.log(falliti === 0
  ? `\n${totale} controlli: un tocco fuori bersaglio non porta via niente.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
