// Il service worker non deve ricaricare la pagina addosso a chi la sta usando:
//
//   node scripts/check-aggiornamento.mjs      (dopo `npm run build`)
//
// IL DIFETTO CHE QUESTO CONTROLLO IMPEDISCE DI RIFARE
// Con `registerType: 'autoUpdate'` la versione nuova chiama `skipWaiting()` da
// sé, prende il posto di quella vecchia e il client ricarica la pagina. Il
// ricaricamento non arriva subito — prima vanno scaricati oltre 2 MB di
// precache — quindi cade qualche secondo dopo l'apertura, cioè quasi sempre
// mentre si sta già facendo qualcosa: un modulo turno aperto a metà spariva
// senza che nessuno l'avesse chiesto.
//
// La correzione è `registerType: 'prompt'`: la versione nuova si scarica lo
// stesso, ma resta in attesa finché non la si chiama — dal pulsante «Aggiorna»
// o alla prossima apertura dell'app.
//
// È una riga di configurazione, quindi è facilissimo rimetterla com'era senza
// accorgersene. Qui si guarda il PACCHETTO COSTRUITO e non la configurazione:
// è quello che finisce sui telefoni, ed è l'unica prova che conta.

import { readFileSync, existsSync } from 'node:fs';
import {
  decidiAggiornamento, ATTESA_SECONDO_PIANO, INTERVALLO_CONTROLLO,
} from '../src/utils/aggiornamento.js';
import { segnaOccupato, eOccupato, chiOccupa } from '../src/utils/occupato.js';
import { DURATA_ANNULLA } from '../src/utils/avvisi.js';

const SW = 'dist/sw.js';
const CONFIG = 'vite.config.js';

let falliti = 0;
const check = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${etichetta}${dettaglio ? '  → ' + dettaglio : ''}`);
};

console.log('\nAggiornamento: la versione nuova aspetta, non si impone\n');

// Senza `dist/` non si è controllato niente, e va detto invece di passare in
// silenzio — è il difetto che check-dati-in-uscita.mjs si porta dietro.
if (!existsSync(SW)) {
  console.log(`  XX  ${SW} non esiste: lancia prima \`npm run build\`.\n`);
  process.exit(1);
}

const sw = readFileSync(SW, 'utf8');
const config = readFileSync(CONFIG, 'utf8');

// 1. `clientsClaim()` fa prendere il controllo delle pagine già aperte alla
//    versione appena attivata. In modalità 'prompt' non c'è, e non deve esserci.
check(!sw.includes('clientsClaim'), 'niente clientsClaim nel service worker',
  'con quello la versione nuova si prende le pagine già aperte');

// 2. `skipWaiting()` può esistere, ma SOLO dentro il gestore del messaggio
//    SKIP_WAITING — cioè solo quando è la pagina a chiederlo. Se compare da
//    qualche altra parte, il service worker si impone da sé.
const chiamate = [...sw.matchAll(/skipWaiting\s*\(/g)];
check(chiamate.length > 0, 'il service worker sa mettersi in servizio a richiesta',
  'serve al pulsante «Aggiorna»');
const tutteSuRichiesta = chiamate.every((m) => {
  // Il contesto immediatamente prima della chiamata deve contenere il tipo di
  // messaggio: nel bundle minificato stanno sulla stessa riga, a pochi byte.
  const prima = sw.slice(Math.max(0, m.index - 200), m.index);
  return prima.includes('SKIP_WAITING');
});
check(tutteSuRichiesta, 'e lo fa SOLO quando glielo chiede la pagina',
  `${chiamate.length} chiamata/e a skipWaiting, tutte dentro il messaggio SKIP_WAITING`);

// 3. La configurazione, per dire subito dov'è la leva quando questo fallisce.
check(/registerType:\s*'prompt'/.test(config), "vite.config.js dichiara registerType: 'prompt'",
  "'autoUpdate' rimette il ricaricamento automatico");

// 4. La registrazione passa dal nostro modulo, che è il posto dove sta scritto
//    il perché. Se qualcuno tornasse a registrare a mano in main.jsx, il
//    callback onNeedRefresh — e quindi l'avviso — sparirebbe in silenzio.
const servizio = readFileSync('src/services/aggiornamento.js', 'utf8');
check(servizio.includes('onNeedRefresh'), "l'avviso è agganciato a onNeedRefresh",
  "senza, la versione nuova resterebbe in attesa senza che nessuno lo dica");

// 5. `sw.js` deve arrivare sempre fresco: contiene l'elenco dei file precache
//    CON I LORO HASH, ed è quello che il browser rilegge per accorgersi che è
//    uscita una versione nuova. Senza un header esplicito il file eredita il
//    default di Cloudflare — che DOVREBBE bastare, ma su questo esatto punto i
//    browser si sono storicamente comportati in modo diverso: Chrome ha
//    un'eccezione dedicata che scarta sempre la cache per lo script del
//    service worker, e non tutti gli altri fanno lo stesso passando per la
//    cache dell'edge. È la causa più comune, documentata ripetutamente, del
//    sintomo «funziona ovunque tranne che in un browser, resta bloccato sulla
//    versione vecchia» — osservato su Firefox il 1° settembre 2026, con
//    l'avviso che non compariva mai nemmeno ricaricando a mano.
//
//    `dist/_headers` è la copia di `public/_headers` fatta da Vite al build
//    (stesso meccanismo per cui `dist/sw.js` esiste): si guarda quella e non
//    la sorgente, per lo stesso motivo per cui gli altri controlli guardano il
//    pacchetto e non la configurazione.
const HEADERS = 'dist/_headers';
if (!existsSync(HEADERS)) {
  check(false, `${HEADERS} non esiste`, 'lancia prima `npm run build`');
} else {
  const headers = readFileSync(HEADERS, 'utf8');
  // Il blocco `/sw.js` seguito, entro poche righe, dalla direttiva giusta —
  // non basta cercare la stringa `no-cache` da sola, potrebbe stare altrove.
  const blocco = headers.split(/\n(?=\/)/).find((b) => b.trimStart().startsWith('/sw.js'));
  const ok = !!blocco && /Cache-Control:\s*no-cache\b/.test(blocco);
  check(ok, '/sw.js ha Cache-Control: no-cache in _headers',
    ok ? '' : (blocco ? 'il blocco c\'è ma non dichiara no-cache' : 'nessun blocco per /sw.js'));
}

// ── QUANDO entra in servizio ───────────────────────────────────────────────
//
// Togliere il ricaricamento automatico ha risolto un fastidio e ne ha creato uno
// peggiore: un'app tenuta aperta per giorni non si aggiornava più. La via
// d'uscita non è un compromesso, è che esiste un momento in cui ricaricare non
// dà fastidio a nessuno — quando l'app non è sotto gli occhi.
//
// Qui si riscontra la regola, non il cablaggio: `decidiAggiornamento` è pura
// apposta, perché provarla a mano in un browser vorrebbe dire aspettare un
// minuto per ogni caso e fidarsi di quello che si è visto.
console.log('\nQuando la versione nuova entra da sola\n');

const M = 60_000;
const caso = (etichetta, stato, atteso) => {
  const { azione, perche } = decidiAggiornamento(stato);
  check(azione === atteso, etichetta, `${azione}${azione === atteso ? '' : ` (atteso ${atteso})`} — ${perche}`);
};

// Il caso per cui esiste tutto questo: app messa via, niente in sospeso.
caso('nascosta da 61s, versione pronta, niente in sospeso',
  { pronto: true, visibile: false, msNascosta: 61_000 }, 'applica');

// E i due paletti, che valgono più della comodità.
caso('...ma con del lavoro in sospeso: non si tocca niente',
  { pronto: true, occupato: true, visibile: false, msNascosta: 10 * M }, 'niente');
caso('...e appena messa via (10s): si aspetta',
  { pronto: true, visibile: false, msNascosta: 10_000 }, 'niente');
caso('in primo piano con la versione pronta: non si ricarica sotto le mani',
  { pronto: true, visibile: true, msNascosta: 0 }, 'niente');

// Il telefono può congelare la pagina prima che scatti il timer: al rientro
// quel che conta è da quanto l'app è stata via, non chi se n'è accorto.
caso('rientro dopo 61s con la versione pronta: si applica adesso',
  { pronto: true, visibile: true, msNascosta: 61_000 }, 'applica');

// Il controllo: solo tornando in primo piano, e non a ogni passaggio.
caso('rientro, niente di pronto, ultimo controllo 20 minuti fa',
  { pronto: false, visibile: true, msDallUltimoControllo: 20 * M }, 'controlla');
caso('rientro, ultimo controllo 2 minuti fa: freno',
  { pronto: false, visibile: true, msDallUltimoControllo: 2 * M }, 'niente');
caso('in secondo piano non si controlla',
  { pronto: false, visibile: false, msNascosta: 5 * M, msDallUltimoControllo: 60 * M }, 'niente');
caso('primo giro: non si è mai controllato', { pronto: false, visibile: true }, 'controlla');

// Le due costanti devono restare quelle raccontate: un minuto è la soglia sotto
// la quale tornare e trovare la pagina ripartita dà fastidio, un quarto d'ora è
// il freno che evita dieci richieste passando fra due app.
check(ATTESA_SECONDO_PIANO === 60_000, 'attesa in secondo piano: un minuto', `${ATTESA_SECONDO_PIANO} ms`);
check(INTERVALLO_CONTROLLO === 15 * M, 'freno al controllo: un quarto d\'ora', `${INTERVALLO_CONTROLLO} ms`);

// ── Il registro di «c'è del lavoro in sospeso» ─────────────────────────────
// Il difetto silenzioso di un registro così è la chiave che resta accesa: da
// quel momento l'aggiornamento non arriva più, e non se ne accorge nessuno.
console.log('\nIl registro del lavoro in sospeso\n');
check(!eOccupato(), 'a riposo non è occupato');
segnaOccupato('modale', true);
segnaOccupato('import', true);
check(eOccupato() && chiOccupa().length === 2, 'due pezzi occupati insieme', chiOccupa().join(', '));
segnaOccupato('modale', false);
check(eOccupato(), 'ne resta uno: ancora occupato', chiOccupa().join(', '));
segnaOccupato('import', false);
check(!eOccupato(), 'liberati tutti: si torna liberi');
segnaOccupato('modale', false); // spegnere due volte non deve rompere niente
check(!eOccupato(), 'spegnere una chiave già spenta non lascia strascichi');

// La finestra per annullare una cancellazione è lavoro in sospeso a tutti gli
// effetti: se la pagina si ricarica dentro quegli otto secondi, il turno
// cancellato non torna più. È l'unica chiave del registro con una SCADENZA, e
// vale la pena dire qui che quella scadenza esiste ed è breve: una chiave
// legata a uno stato che non finisce mai è il modo in cui questo registro si
// rompe in silenzio.
check(DURATA_ANNULLA > 0 && DURATA_ANNULLA < INTERVALLO_CONTROLLO,
  'la finestra dell\'annulla dura meno di un giro di controllo',
  `${DURATA_ANNULLA} ms contro ${INTERVALLO_CONTROLLO}: al massimo rimanda un controllo, non lo spegne`);
segnaOccupato('annulla', true);
check(decidiAggiornamento({
  pronto: true, occupato: eOccupato(), visibile: false, msNascosta: 5 * M, msDallUltimoControllo: 0,
}).azione !== 'applica', 'con l\'annulla in ballo non si ricarica', chiOccupa().join(', '));
segnaOccupato('annulla', false);
check(decidiAggiornamento({
  pronto: true, occupato: eOccupato(), visibile: false, msNascosta: 5 * M, msDallUltimoControllo: 0,
}).azione === 'applica', 'scaduta la finestra, l\'aggiornamento riparte');

console.log(falliti === 0
  ? '\nLa versione nuova aspetta il suo turno.\n'
  : `\n${falliti} problema/i.\n`);
process.exit(falliti === 0 ? 0 : 1);
