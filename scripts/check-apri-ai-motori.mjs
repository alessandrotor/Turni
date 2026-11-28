// Riscontro di apri-ai-motori.mjs: sulla build della produzione le pagine
// pubbliche perdono il noindex e prendono il canonical, «grazie» resta chiusa
// (è il contatore di «Mi interessa»), e la sitemap elenca solo le aperte.
// Lavora su una copia finta di dist, non tocca la build vera.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apriCartella, percorso } from './apri-ai-motori.mjs';

let falliti = 0;
const verifica = (nome, ok) => { console.log(`${ok ? '✓' : '✗'} ${nome}`); if (!ok) falliti++; };

const pagina = '<!doctype html><title>X</title>\n<meta name="robots" content="noindex">\n<body></body>';
const d = mkdtempSync(join(tmpdir(), 'apri-'));
const scrivi = (rel, testo) => { mkdirSync(join(d, rel, '..'), { recursive: true }); writeFileSync(join(d, rel), testo); };
scrivi('index.html', '<!doctype html><title>App</title>');
scrivi('benvenuto/index.html', pagina);
scrivi('benvenuto/grazie/index.html', pagina);
scrivi('guide/conguaglio-dicembre/index.html', pagina);

console.log('\nPagine aperte ai motori solo sulla produzione\n');
const aperte = apriCartella(d, 'https://segnaturni.it/');
const leggi = (rel) => readFileSync(join(d, rel), 'utf8');

verifica('percorso: guide/x/index.html → /guide/x/', percorso('guide/x/index.html') === '/guide/x/');
verifica('la guida perde il noindex', !leggi('guide/conguaglio-dicembre/index.html').includes('noindex'));
verifica('la guida ha il canonical sul dominio',
  leggi('guide/conguaglio-dicembre/index.html').includes('<link rel="canonical" href="https://segnaturni.it/guide/conguaglio-dicembre/">'));
verifica('«grazie» resta chiusa', leggi('benvenuto/grazie/index.html').includes('noindex'));
const mappa = leggi('sitemap.xml');
verifica('la sitemap ha la vetrina e la guida', mappa.includes('https://segnaturni.it/benvenuto/') && mappa.includes('/guide/conguaglio-dicembre/'));
verifica('la sitemap non ha «grazie»', !mappa.includes('grazie'));
verifica("due pagine aperte, l'app e «grazie» escluse", aperte.length === 2);

// Il repository resta chiuso: ogni pagina pubblica nasce con noindex.
for (const rel of ['public/benvenuto/index.html', 'public/guide/conguaglio-dicembre/index.html', 'public/guide/maggiorazioni-turismo/index.html', 'ci-perdo/index.html']) {
  verifica(`nel repository ${rel} ha ancora noindex`, readFileSync(rel, 'utf8').includes('<meta name="robots" content="noindex">'));
}

rmSync(d, { recursive: true, force: true });
console.log(falliti ? `\n${falliti} casi non tornano.` : '\n✓ tutti i casi tornano.');
process.exit(falliti ? 1 : 0);
