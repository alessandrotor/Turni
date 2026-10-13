// Le impostazioni del motore sono TUTTE scritte in impostazioni.js:
//
//   node src/motore/riscontri/check-impostazioni-motore.mjs
//
// impostazioni.js è il contratto fra il motore e chi lo usa: ogni chiave che
// il motore legge, col suo gruppo e il suo significato. Un contratto che
// invecchia in silenzio è peggio di nessun contratto, quindi qui lo si
// confronta col codice: ogni `impostazioni.X` (o `settings.X`) letto in
// src/motore deve stare nella tabella, e ogni riga della tabella deve essere
// letta da qualcuno.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPOSTAZIONI, GRUPPI } from '../impostazioni.js';
import { impostazioniDa } from '../index.js';

const MOTORE = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = [];
const visita = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'riscontri') visita(p); } else if (n.endsWith('.js') && n !== 'impostazioni.js') file.push(p);
  }
};
visita(MOTORE);

const lette = new Map();
for (const f of file) {
  const codice = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  for (const m of codice.matchAll(/(?<![\w/.'"])(?:settings|impostazioni)\??\.(?!js\b)([a-zA-Z_]\w*)/g)) {
    if (!lette.has(m[1])) lette.set(m[1], relative(MOTORE, f));
  }
}

let falliti = 0;
const esito = (ok, etichetta) => { if (!ok) falliti += 1; console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}`); };

console.log(`\nLe impostazioni del motore: ${Object.keys(IMPOSTAZIONI).length} scritte, ${lette.size} lette dal codice\n`);
const senzaRiga = [...lette].filter(([k]) => !IMPOSTAZIONI[k]);
for (const [k, f] of senzaRiga) esito(false, `${k} è letta in ${f} ma non sta in impostazioni.js`);
const morte = Object.keys(IMPOSTAZIONI).filter((k) => !lette.has(k));
for (const k of morte) esito(false, `${k} sta in impostazioni.js ma il motore non la legge`);
const fuoriGruppo = Object.entries(IMPOSTAZIONI).filter(([, [g, d]]) => !GRUPPI.includes(g) || !d);
for (const [k] of fuoriGruppo) esito(false, `${k}: gruppo sconosciuto o descrizione vuota`);
if (!senzaRiga.length && !morte.length && !fuoriGruppo.length) esito(true, 'ogni chiave letta è scritta, ogni chiave scritta è letta');
// La porta (`calcolaMese`) scrive solo chiavi del contratto.
const dallaPorta = Object.keys(impostazioniDa({ lavoratore: { addizionali: {}, montante: {}, maggiorazioni: {} } }));
const ignote = dallaPorta.filter((k) => !IMPOSTAZIONI[k]);
esito(!ignote.length, `impostazioniDa scrive solo chiavi di impostazioni.js${ignote.length ? `: non ${ignote.join(', ')}` : ''}`);

console.log(falliti ? `\n${falliti} problemi.\n` : '');
process.exit(falliti ? 1 : 0);
