// «Un avviso alla volta», riscontrato invece che sperato:
//
//   node scripts/check-avvisi.mjs
//
// PERCHÉ ESISTE
// Finché gli avvisi erano due, la precedenza stava scritta a mano nel JSX di
// App — `aggiornamentoPronto && !avviso && !modal` — e si leggeva a occhio.
// Col terzo le condizioni incrociate diventano sei, e il difetto che nasce non
// somiglia a un guasto: un avviso finisce in fondo alla catena e NON COMPARE
// MAI PIÙ. Nessuna schermata sbagliata, nessun errore in console, nessuno che
// se ne accorga — esattamente come la chiave di `occupato` rimasta accesa.
//
// Da qui il controllo che nessun occhio umano farebbe: che per OGNI avviso
// esista almeno una combinazione in cui tocca a lui. È la difesa contro il
// quarto avviso che un giorno verrà aggiunto sopra gli altri.

import { avvisoDaMostrare, ORDINE, DURATA_ANNULLA } from '../src/utils/avvisi.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(46)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// Le sedici combinazioni dei quattro interruttori.
const BOOL = [false, true];
const CASI = [];
for (const modaleAperto of BOOL) {
  for (const annulla of BOOL) {
    for (const maggiorazione of BOOL) {
      for (const aggiornamento of BOOL) {
        CASI.push({ modaleAperto, annulla, maggiorazione, aggiornamento });
      }
    }
  }
}

// ── 1. Mai due insieme ─────────────────────────────────────────────────────
console.log('\nMai due strisce insieme\n');

verifica('le combinazioni sono sedici', CASI.length, 16, 'quattro interruttori');
verifica('la risposta è sempre una sola o nessuna',
  CASI.every((c) => {
    const r = avvisoDaMostrare(c);
    return r === null || ORDINE.includes(r);
  }), true, 'mai una lista, mai un nome inventato');
verifica('senza niente acceso, nessuno parla',
  avvisoDaMostrare({}), null, 'anche senza argomenti');

// ── 2. Il modale batte tutti ───────────────────────────────────────────────
console.log('\nMentre si compila qualcosa non compare niente\n');

verifica('col modale aperto tace sempre',
  CASI.filter((c) => c.modaleAperto).every((c) => avvisoDaMostrare(c) === null),
  true, 'otto casi su otto: è «mai durante»');
verifica('e appena si chiude qualcuno riprende',
  avvisoDaMostrare({ modaleAperto: false, maggiorazione: true }), 'maggiorazione',
  'l\'avviso non si perde, aspetta');

// ── 3. L'ordine dichiarato, caso per caso ──────────────────────────────────
console.log('\nVince chi non può tornare\n');

verifica('annulla batte maggiorazione',
  avvisoDaMostrare({ annulla: true, maggiorazione: true }), 'annulla',
  'la maggiorazione torna al turno dopo, il turno cancellato no');
verifica('annulla batte aggiornamento',
  avvisoDaMostrare({ annulla: true, aggiornamento: true }), 'annulla',
  'l\'aggiornamento entra alla prossima apertura');
verifica('annulla batte entrambi',
  avvisoDaMostrare({ annulla: true, maggiorazione: true, aggiornamento: true }), 'annulla', '');
verifica('maggiorazione batte aggiornamento',
  avvisoDaMostrare({ maggiorazione: true, aggiornamento: true }), 'maggiorazione',
  'soldi contati male prima di una versione nuova');
verifica('da solo, ognuno parla',
  ORDINE.map((n) => avvisoDaMostrare({ [n]: true })), ORDINE,
  'nessuno è muto quando è solo');

// ── 4. Nessun avviso irraggiungibile ───────────────────────────────────────
// La proprietà che vale il file. Se un giorno qualcuno infila un quarto avviso
// in cima all'ordine e ne seppellisce un altro, qui si vede subito.
console.log('\nOgnuno ha almeno una schermata in cui compare\n');

const visti = new Set(CASI.map((c) => avvisoDaMostrare(c)).filter(Boolean));
verifica('tutti raggiungibili', [...visti].sort(), [...ORDINE].sort(),
  `${visti.size} su ${ORDINE.length}: nessuno sepolto in fondo alla catena`);
for (const nome of ORDINE) {
  const quante = CASI.filter((c) => avvisoDaMostrare(c) === nome).length;
  verifica(`«${nome}» compare in ${quante} casi`, quante > 0, true,
    quante === 0 ? 'MAI: è sepolto' : '');
}

// ── 5. La durata della finestra ────────────────────────────────────────────
console.log('\nLa finestra per annullare\n');

verifica('è un numero finito', Number.isFinite(DURATA_ANNULLA), true,
  'una striscia che non scade è un residuo, non una via d\'uscita');
verifica('sta fra 3 e 30 secondi',
  DURATA_ANNULLA >= 3000 && DURATA_ANNULLA <= 30_000, true,
  `${DURATA_ANNULLA} ms: il tempo di accorgersene, non di dimenticarsene`);

console.log(falliti === 0
  ? `\n${totale} controlli: parla uno alla volta, e nessuno resta zitto per sempre.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
