// Il CONFINE del motore: `src/motore/` non importa niente da fuori.
//
//   node src/motore/riscontri/check-confine-motore.mjs
//
// PERCHÉ ESISTE: il motore deve poter uscire da qui, in un'altra app, senza
// portarsi dietro React, il browser, le impostazioni dello schermo o i dati di
// una persona (docs/motore-portabile.md). Basta UN import verso `../utils` o
// una lettura di `localStorage` per legarlo di nuovo all'app, e non se ne
// accorge nessuno finché qualcuno non prova a portarlo via.
//
// Si guarda il codice, non i commenti, e non i riscontri (che girano su
// Node e leggono file): tre regole.
//  1. Gli import sono relativi e restano dentro `src/motore/`. Niente pacchetti
//     npm: il motore non ne usa nessuno, e il primo andrebbe dichiarato.
//  2. Niente del browser: window, document, localStorage, navigator, fetch.
//  3. Niente data di oggi PREDEFINITA in una firma (`oggi = new Date()`): chi
//     chiama la passa. Un riscontro è già diventato rosso il primo ottobre
//     perché il motore la leggeva da solo.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOTORE = join(dirname(fileURLToPath(import.meta.url)), '..');
const RADICE = join(MOTORE, '..', '..');

const file = [];
const visita = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'riscontri') visita(p); }
    else if (/\.(m?js)$/.test(n)) file.push(p);
  }
};
visita(MOTORE);

const senzaCommenti = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const problemi = [];
for (const f of file) {
  const nome = relative(RADICE, f);
  const codice = senzaCommenti(readFileSync(f, 'utf8'));
  for (const m of codice.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) { problemi.push(`${nome}: importa il pacchetto «${spec}»`); continue; }
    const dove = resolve(dirname(f), spec);
    if (!dove.startsWith(MOTORE)) problemi.push(`${nome}: importa da fuori, «${spec}»`);
  }
  for (const g of ['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch']) {
    if (new RegExp(`\\b${g}\\b\\s*[.(]`).test(codice)) problemi.push(`${nome}: usa ${g}`);
  }
  if (/=\s*new Date\(\)\s*[,)}]/.test(codice) || /=\s*new Date\(\)\.getFullYear\(\)/.test(codice)) {
    problemi.push(`${nome}: una data di oggi predefinita in una firma`);
  }
}

console.log(`\nIl confine del motore: ${file.length} file in src/motore\n`);
for (const p of problemi) console.log(`  FALLITO ${p}`);
if (problemi.length) {
  console.log(`\n${problemi.length} problemi.\n`);
  process.exit(1);
}
console.log('  ok   nessun import da fuori, niente browser, nessuna data di oggi implicita\n');
