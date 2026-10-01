// La documentazione cita solo cose che esistono:
//
//   node scripts/check-documentazione.mjs
//
// PERCHÉ ESISTE
// CLAUDE.md è la memoria del progetto: chi lo legge — una persona o un'AI —
// ci trova scritto «il riscontro è `check-x.mjs`», «la regola sta in
// `costoSoglia()`», e ci si fida. Se il file è stato rinominato o la funzione
// tolta, il rimando porta nel vuoto, e peggio: la regola scritta accanto può
// non valere più senza che nessuno se ne accorga. La documentazione invecchia
// in silenzio; questo riscontro la fa invecchiare a voce alta.
//
// COSA CONTROLLA, nei testi fra `backtick`:
//  · un nome di file (`check-x.mjs`, `utils/pay.js`, `ShiftForm.jsx`) deve
//    esistere nel repository, col percorso se c'è o almeno col nome;
//  · una funzione scritta con le parentesi (`costoSoglia()`) deve essere
//    definita da qualche parte in `src/`, `worker/` o `scripts/`.
// Non controlla che la frase sia vera: controlla che il rimando porti da
// qualche parte. È il minimo, ed è quello che si rompe per primo.
//
// COSE-NUOVE.md è escluso dalle funzioni ma non dai file: tiene apposta il
// testo dei difetti chiusi, che può nominare codice che non c'è più. E una
// riga che dice che un file «non esiste» o è «assente» lo nomina apposta.
// I file che crea la build (`sw.js`) stanno in GENERATI.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCUMENTI = ['CLAUDE.md', 'COSE-NUOVE.md', 'README.md', 'worker/README.md',
  ...readdirSync(join(RADICE, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)]
  .filter((f) => existsSync(join(RADICE, f)));
const SALTA = new Set(['node_modules', 'dist', '.git', 'android', 'ios']);
const GENERATI = new Set(['sw.js']);

const tuttiIFile = [];
const visita = (d) => {
  for (const n of readdirSync(d)) {
    if (SALTA.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) visita(p);
    else tuttiIFile.push(relative(RADICE, p).replaceAll('\\', '/'));
  }
};
visita(RADICE);
const nomi = new Set(tuttiIFile.map((f) => basename(f)));
const codice = tuttiIFile
  .filter((f) => /^(src|worker|scripts)\//.test(f) && /\.(m?js|jsx)$/.test(f))
  .map((f) => readFileSync(join(RADICE, f), 'utf8')).join('\n');
const definita = (fn) => new RegExp(
  `(function\\s+${fn}\\b|(const|let|var)\\s+${fn}\\s*=|\\b${fn}\\s*\\([^)]*\\)\\s*\\{|\\b${fn}\\s*:\\s*(async\\s*)?\\(|export\\s*\\{[^}]*\\b${fn}\\b)`,
).test(codice);

// Un file citato si cerca col percorso, poi sotto src/ (si scrive
// `utils/pay.js` per `src/utils/pay.js`), poi col solo nome.
const esiste = (citato) => existsSync(join(RADICE, citato))
  || existsSync(join(RADICE, 'src', citato))
  || (!citato.includes('/') && nomi.has(citato));

let falliti = 0;
let visti = 0;
for (const doc of DOCUMENTI) {
  const testo = readFileSync(join(RADICE, doc), 'utf8');
  for (const m of testo.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim();
    const riga = testo.slice(testo.lastIndexOf('\n', m.index) + 1, testo.indexOf('\n', m.index));
    if (GENERATI.has(t) || /non esiste|assente/i.test(riga)) continue;
    const file = /^[\w.@/-]+\.(mjs|js|jsx|json|yml|yaml|md|css|toml|html|gs)$/.exec(t);
    if (file && !/[*{}]/.test(t)) {
      visti += 1;
      if (!esiste(t)) { falliti += 1; console.log(`FALLITO ${doc}: \`${t}\` non esiste`); }
      continue;
    }
    const fn = /^([a-zA-Z_$][\w$]*)\(\)$/.exec(t);
    if (fn && doc !== 'COSE-NUOVE.md') {
      visti += 1;
      if (!definita(fn[1])) { falliti += 1; console.log(`FALLITO ${doc}: \`${t}\` non è definita da nessuna parte`); }
    }
  }
}
console.log(falliti ? `\n${falliti} rimandi rotti su ${visti}.` : `\n${visti} rimandi in ${DOCUMENTI.length} documenti: portano tutti da qualche parte.`);
process.exit(falliti ? 1 : 0);
