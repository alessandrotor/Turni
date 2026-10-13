// Tutti i riscontri del motore, da soli: per chi ha copiato la cartella in
// un'altra app e vuole sapere che i conti tornano anche lì.
//
//   node riscontri/esegui.mjs        (dalla cartella del motore)
//   npm test                         (idem, col package.json del motore)
//
// In Turni li fa girare `npm run riscontri`, anche con l'orologio spostato.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const riscontri = readdirSync(QUI).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
const falliti = [];
for (const f of riscontri) {
  const r = spawnSync(process.execPath, [join(QUI, f)], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) falliti.push(`${f}\n${(r.stdout + r.stderr).trim().split('\n').slice(-10).join('\n')}`);
}
for (const f of falliti) console.error(`\n✗ ${f}`);
console.log(`\n${riscontri.length} riscontri del motore, ${falliti.length ? `${falliti.length} falliti` : 'tutti tornano'}.`);
process.exit(falliti.length ? 1 : 0);
