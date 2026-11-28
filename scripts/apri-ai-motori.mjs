// Apre ai motori di ricerca le pagine pubbliche di UNA build: solo quella della
// produzione sul dominio definitivo (pubblica-produzione.yml), mai la prova né
// i siti pages.dev, che restano chiusi come sono nel repository.
//
//   node scripts/apri-ai-motori.mjs <cartella> <sito>
//   node scripts/apri-ai-motori.mjs dist https://segnaturni.it
//
// Nel repository ogni pagina pubblica nasce con `noindex`: chi la apre per
// sbaglio su un sito di prova non la fa finire su Google. Qui, sulla build della
// produzione, il `noindex` si toglie, si aggiunge il `canonical` sul dominio
// definitivo e si scrive `sitemap.xml`. Restano chiuse le pagine in CHIUSE:
// «grazie» della vetrina è il contatore di «Mi interessa», e una visita da
// Google lo falserebbe.
//
// Il canonical serve anche al vecchio indirizzo pages.dev, che non si può
// mandare altrove con un redirect: i dati di chi usa già l'app vivono in
// quell'origine (localStorage) e un redirect li renderebbe irraggiungibili.
// → check-apri-ai-motori.mjs

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHIUSE = ['/benvenuto/grazie/'];

const NOINDEX = /\s*<meta name="robots" content="noindex">/;

/** Percorso pubblico di un file html di dist: `guide/x/index.html` → `/guide/x/`. */
export function percorso(rel) {
  const p = '/' + rel.split(sep).join('/');
  return p.endsWith('index.html') ? p.slice(0, -'index.html'.length) : p;
}

/** La pagina aperta: senza noindex e col canonical. Null se resta com'è. */
export function apri(html, url) {
  if (!NOINDEX.test(html)) return null;
  let fuori = html.replace(NOINDEX, '');
  if (!/rel="canonical"/.test(fuori)) {
    fuori = fuori.replace('</title>', `</title>\n<link rel="canonical" href="${url}">`);
  }
  return fuori;
}

export function sitemap(urls) {
  const righe = urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${righe}\n</urlset>\n`;
}

function html(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'assets' || f === 'ocr' ? [] : html(p);
    return f.endsWith('.html') ? [p] : [];
  });
}

export function apriCartella(cartella, sito) {
  const base = sito.replace(/\/$/, '');
  const aperte = [];
  for (const file of html(cartella)) {
    const p = percorso(relative(cartella, file));
    if (CHIUSE.includes(p) || p === '/') continue; // `/` è l'app: non ha noindex, ma non è una pagina da cercare
    const nuovo = apri(readFileSync(file, 'utf8'), base + p);
    if (nuovo === null) continue;
    writeFileSync(file, nuovo);
    aperte.push(base + p);
  }
  aperte.sort();
  writeFileSync(join(cartella, 'sitemap.xml'), sitemap([base + '/', ...aperte]));
  return aperte;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cartella = 'dist', sito] = process.argv.slice(2);
  if (!sito || !existsSync(cartella)) {
    console.error('Uso: node scripts/apri-ai-motori.mjs <cartella> <sito>');
    process.exit(1);
  }
  const aperte = apriCartella(cartella, sito);
  console.log(`Aperte ai motori ${aperte.length} pagine:\n  ${aperte.join('\n  ')}`);
}
