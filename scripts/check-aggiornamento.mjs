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

console.log(falliti === 0
  ? '\nLa versione nuova aspetta il suo turno.\n'
  : `\n${falliti} problema/i.\n`);
process.exit(falliti === 0 ? 0 : 1);
