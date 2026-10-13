// RISCONTRO: i commenti del motore descrivono il codice che c'è.
//
// Il motore è pensato per essere usato anche da fuori dell'app, e chi lo usa
// non ha le nostre buste: per sapere cosa passare e cosa torna ha solo le
// descrizioni `@param` / `@returns`. Questo riscontro lancia il controllo dei
// tipi (`checkJs`, vedi src/motore/jsconfig.json) e fallisce se anche una
// descrizione non corrisponde al codice — un campo letto e non dichiarato, un
// ritorno che dice meno di quello che dà, un `@param` con un nome che non c'è.
//
// Non verifica i NUMERI: quelli li verificano i riscontri sulle buste. Non
// cambia niente nel motore. Se fallisce, si corregge il commento (o il tipo
// `Impostazioni` si completa aggiungendo la chiave a `IMPOSTAZIONI`).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(RADICE, 'node_modules', 'typescript', 'bin', 'tsc');
const r = spawnSync(process.execPath, [tsc, '-p', join(RADICE, 'src', 'motore', 'jsconfig.json')], { encoding: 'utf8' });
const uscita = `${r.stdout || ''}${r.stderr || ''}`.trim();

if (r.error || r.status !== 0) {
  console.log(r.error ? `FALLITO non si riesce a lanciare tsc: ${r.error.message}` : uscita);
  console.log('\nFALLITO i tipi del motore non tornano');
  process.exit(1);
}
console.log('OK     i tipi del motore tornano (0 segnalazioni)');
