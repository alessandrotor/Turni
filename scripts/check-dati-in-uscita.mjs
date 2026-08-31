// Che cosa lascia il dispositivo:
//
//   npm run build && node scripts/check-dati-in-uscita.mjs
//
// PERCHE' ESISTE
// «Privacy by design» non e' una dichiarazione, e' una proprieta' che qualcuno
// deve poter controllare. Senza un controllo automatico dipende dal fatto che
// ci si ricordi di guardare — e una volta e' gia' quasi saltata: il pacchetto
// di produzione va costruito SENZA l'endpoint della telemetria, e finora quel
// controllo si faceva a mano prima di ogni pubblicazione.
//
// DUE DOMANDE DIVERSE, DUE CONTROLLI DIVERSI
//
//  1. sui SORGENTI: il codice che scriviamo noi contatta solo indirizzi
//     dichiarati? Qui si guarda `src/` e `index.html`, non le dipendenze:
//     dentro xlsx e jspdf ci sono decine di URL che NON sono chiamate —
//     namespace XML, siti di progetto nelle licenze — e un controllo che li
//     segnala tutti diventa un fastidio da mettere a tacere. Cioe' muore.
//
//  2. sul PACCHETTO costruito: non c'e' finito dentro un endpoint che in
//     produzione deve restare spento? Questa domanda e' precisa e va fatta sul
//     `dist`, perche' e' li' che una variabile d'ambiente sbagliata si vede.
//
// Aggiungere una chiamata a un servizio nuovo rompe il primo controllo finche'
// non la si dichiara — e dichiararla significa scrivere a cosa serve, quindi
// accorgersi che va anche nell'informativa.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── L'elenco dichiarato ────────────────────────────────────────────────────
// Ogni voce dice A COSA SERVE: se non si riesce a scriverlo, probabilmente non
// dovrebbe esserci.
const AMMESSI = {
  'turni-ai-proxy.magnaopa.workers.dev':
    'proxy AI di produzione: riceve la foto del foglio turni e il nome del lavoratore',
  'turni-ai-proxy-test.magnaopa.workers.dev':
    'lo stesso per il sito di prova, con chiave Gemini e quota separate',
  'challenges.cloudflare.com':
    'Turnstile: prova che dall altra parte c e un browser vero, prima di spendere quota',
  'static.cloudflareinsights.com':
    'Cloudflare Web Analytics: conteggio delle visite, senza cookie',
  'turni-9vr.pages.dev':
    'il sito stesso: anteprima del link (og:image) e indirizzo canonico',
  'www.w3.org':
    'namespace SVG negli attributi: non e un indirizzo da contattare',
};

// Endpoint che NON devono comparire nel pacchetto di produzione.
const VIETATI = {
  'script.google.com': 'telemetria: in produzione deve restare spenta',
  'script.googleusercontent.com': 'idem, e Apps Script rimanda qui',
};

let falliti = 0;

function fileDi(dir, filtro) {
  const out = [];
  for (const v of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, v.name);
    if (v.isDirectory()) out.push(...fileDi(p, filtro));
    else if (filtro.test(v.name)) out.push(p);
  }
  return out;
}

// Toglie i commenti: gli URL citati in una spiegazione non sono chiamate.
// Grezzo ma sufficiente — un falso positivo si dichiara, un falso negativo
// verrebbe comunque preso dal controllo sul pacchetto.
const senzaCommenti = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const hostDi = (testo) => [...new Set(
  (testo.match(/https?:\/\/[a-zA-Z0-9.-]+/g) || [])
    .map(u => { try { return new URL(u).hostname; } catch { return null; } })
    .filter(h => h && !/^(localhost|127\.0\.0\.1)$/.test(h)),
)].sort();

// ── 1. I sorgenti ──────────────────────────────────────────────────────────
console.log('\nIndirizzi nel codice che scriviamo noi\n');

const sorgenti = [...fileDi('src', /\.(js|jsx|css)$/), 'index.html'];
const testoSorgenti = sorgenti.map(f => senzaCommenti(readFileSync(f, 'utf8'))).join('\n');

for (const host of hostDi(testoSorgenti)) {
  const perche = AMMESSI[host];
  if (perche) {
    console.log(`  ok  ${host.padEnd(42)} ${perche}`);
  } else {
    falliti++;
    console.log(`FAIL  ${host.padEnd(42)} NON DICHIARATO`);
    console.log(`      Se e una chiamata: dichiarala qui, e mettila nell informativa e nella CSP.`);
  }
}

// Un elenco che invecchia e resta pieno di voci morte smette di dire il vero.
const presenti = hostDi(testoSorgenti);
const mai = Object.keys(AMMESSI).filter(h => !presenti.includes(h));
if (mai.length) {
  console.log('\n  Dichiarati ma non usati nei sorgenti (normale per gli indirizzi che');
  console.log('  arrivano da variabili d ambiente):');
  for (const h of mai) console.log(`  --  ${h}`);
}

// ── 2. Il pacchetto ────────────────────────────────────────────────────────
console.log('\nEndpoint che NON devono finire in produzione\n');

if (!existsSync('dist')) {
  console.log('  --  cartella «dist» assente: lancia prima `npm run build`');
} else {
  const pacchetto = fileDi('dist', /\.(js|html|css|webmanifest|json)$/)
    .map(f => readFileSync(f, 'utf8')).join('\n');
  for (const [frammento, perche] of Object.entries(VIETATI)) {
    const c = pacchetto.includes(frammento);
    if (c) falliti++;
    console.log(`${c ? 'FAIL' : '  ok'}  ${frammento.padEnd(42)} ${perche}`);
  }
  // Il proxy invece DEVE esserci: un pacchetto senza proxy ha l'import spento,
  // ed e' un guasto che si nota solo provando a importare una foto.
  const proxy = /turni-ai-proxy(-test)?\.magnaopa\.workers\.dev/.test(pacchetto);
  if (!proxy) falliti++;
  console.log(`${proxy ? '  ok' : 'FAIL'}  ${'proxy AI presente'.padEnd(42)} senza, l import da foto e spento`);
}

console.log();
if (falliti) {
  console.error(`${falliti} problema/i.\n`);
  process.exit(1);
}
console.log('Il codice parla solo con chi e stato dichiarato.\n');
