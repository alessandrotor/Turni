// Tutti i riscontri, in un comando solo: `npm run riscontri`.
//
// È il cancello della CI (deploy-test.yml): se un riscontro fallisce, il sito
// di prova non si aggiorna. Prima i riscontri esistevano ma nessuno li faceva
// girare per forza — li lanciava chi se ne ricordava, prima del push.
//
// Ogni riscontro gira due volte:
//  1. con l'orologio vero;
//  2. con l'orologio spostato in tre giorni scelti dove i conti cambiano
//     (inizio anno, dicembre con la 13ª, l'anno dopo). Un riscontro che legge
//     la data senza dirlo passa oggi e fallisce fra un mese.
//
// `check-dati-in-uscita` ispeziona `dist/`, quindi gira solo dopo la build e
// solo con l'orologio vero: il pacchetto non dipende dalla data.
// Con `--senza-dist` lo si salta (in locale `.env.local` lo rende un falso
// allarme, vedi CLAUDE.md).

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const OROLOGIO = join(QUI, 'lib', 'orologio-finto.mjs');
const DATE = ['2026-01-15T10:00', '2026-12-31T10:00', '2027-03-10T10:00'];
const senzaDist = process.argv.includes('--senza-dist');

// I riscontri delle buste e dell'app stanno qui; quelli delle regole viaggiano
// col motore, in src/motore/riscontri.
const DEL_MOTORE = join(QUI, '..', 'src', 'motore', 'riscontri');
const elenca = (dir) => readdirSync(dir).filter((f) => /^check-.*\.mjs$/.test(f)).map((f) => join(dir, f));
const riscontri = [...elenca(QUI), ...elenca(DEL_MOTORE)].sort((a, b) => basename(a).localeCompare(basename(b)));
const falliti = [];

const gira = (file, data) => {
  const args = data ? ['--import', OROLOGIO, file] : [file];
  const r = spawnSync(process.execPath, args, {
    env: { ...process.env, ...(data ? { OGGI_FINTO: data } : {}) },
    encoding: 'utf8',
    timeout: 120000,
  });
  if (r.status !== 0) falliti.push({ file, data, uscita: (r.stdout + r.stderr).trim().split('\n').slice(-15).join('\n') });
};

for (const file of riscontri) {
  const dist = basename(file) === 'check-dati-in-uscita.mjs';
  if (dist && senzaDist) continue;
  gira(file, null);
  if (!dist) for (const d of DATE) gira(file, d);
}

for (const f of falliti) {
  console.error(`\n✗ ${basename(f.file)}${f.data ? `  (orologio al ${f.data})` : ''}\n${f.uscita}`);
}
console.log(`\n${riscontri.length} riscontri, ${falliti.length ? `${falliti.length} esecuzioni fallite` : 'tutti tornano'}${senzaDist ? ' (senza dist/)' : ''}.`);
process.exit(falliti.length ? 1 : 0);
