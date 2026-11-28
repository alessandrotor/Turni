// Il `.htaccess` degli hosting Apache dice le stesse cose di `public/_headers`:
//
//   node scripts/check-htaccess.mjs
//
// Il sito può stare su Cloudflare Pages (che legge `_headers`) o su un hosting
// Apache europeo come IONOS o Aruba (che legge `.htaccess`, generato da
// scripts/genera-htaccess.mjs in pubblica-produzione.yml). Se i due divergono
// il sito funziona lo stesso, ed è per questo che serve un controllo: su
// Apache sparirebbe in silenzio la CSP — la garanzia dell'informativa su dove
// la pagina può mandare dati — oppure il `no-cache` su sw.js, e gli
// aggiornamenti smetterebbero di arrivare su alcuni browser.
//
// Non c'è un Apache qui per provarlo dal vivo: si controlla il testo generato,
// header per header, e la prova vera è quella sul sito pubblicato
// (curl -I https://<dominio>/sw.js).

import { readFileSync } from 'node:fs';
import { leggiHeaders, generaHtaccess } from './genera-htaccess.mjs';

let falliti = 0;
const check = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${etichetta}${dettaglio ? '  → ' + dettaglio : ''}`);
};

console.log('\n.htaccess: le stesse regole di _headers\n');

const testo = readFileSync('public/_headers', 'utf8');
const blocchi = leggiHeaders(testo);
const ht = generaHtaccess(testo);
const righe = ht.split('\n');

// 1. Ogni header di `_headers` è in `.htaccess`, nello stesso ambito.
const bloccoDi = (percorso) => {
  if (percorso === '/*') return righe.filter((r) => /^ {2}Header /.test(r)).join('\n');
  const inizio = righe.findIndex((r) => r.trim() === `# ${percorso}`);
  const fine = righe.findIndex((r, i) => i > inizio && r.trim() === '</If>');
  return inizio < 0 || fine < 0 ? '' : righe.slice(inizio, fine).join('\n');
};
let contati = 0;
for (const b of blocchi) {
  const zona = bloccoDi(b.percorso);
  for (const [nome, valore] of b.imposta) {
    contati += 1;
    const atteso = `Header always set ${nome} "${valore.replace(/"/g, '\\"')}"`;
    if (!zona.includes(atteso)) check(false, `${b.percorso}: ${nome}`, 'manca o ha un valore diverso');
  }
  for (const nome of b.togli) {
    contati += 1;
    if (!zona.includes(`Header always unset ${nome}`)) check(false, `${b.percorso}: togli ${nome}`, 'manca');
  }
}
check(contati >= 10, `tutti gli header di _headers riportati (${contati})`);

// 2. I due che contano di più, guardati per nome: se un giorno il formato di
//    `_headers` cambiasse e il lettore non li vedesse più, il punto 1 passerebbe
//    a vuoto.
const csp = testo.match(/Content-Security-Policy:\s*(.+)/)?.[1]?.trim();
check(!!csp && ht.includes(`Content-Security-Policy "${csp}"`), 'la CSP è identica, connect-src compresa');
check(/<If "%\{REQUEST_URI\} == '\/sw\.js'">\n\s+Header always set Cache-Control "no-cache"/.test(ht),
  'sw.js: Cache-Control no-cache (senza, gli aggiornamenti non arrivano)');
check(/<If "%\{REQUEST_URI\} =~ m#\^\/assets\/#">\n\s+Header always set Cache-Control "public, max-age=31536000, immutable"/.test(ht),
  '/assets/: immutabili per un anno');

// 3. Ciò che Pages fa da solo e Apache no.
check(ht.includes('FallbackResource /index.html'), 'le rotte dell\'app ripiegano su index.html');
check(/RewriteCond %\{HTTPS\} off\n\s+RewriteCond %\{HTTP:X-Forwarded-Proto\} !https\n\s+RewriteRule \^ https:/.test(ht),
  'passaggio a HTTPS, senza giro infinito dietro un proxy');
check(/RewriteCond %\{HTTP_HOST\} \^\(www\\\.\)\?segnaturni\\\.app\$ \[NC,OR\]\n\s+RewriteCond %\{HTTP_HOST\} \^www\\\.segnaturni\\\.it\$ \[NC\]\n\s+RewriteRule \^ https:\/\/segnaturni\.it%\{REQUEST_URI\} \[L,R=301\]/.test(ht),
  'un indirizzo solo: .app e www portano a segnaturni.it (i dati sono legati all\'indirizzo)');
check(ht.includes('AddType application/manifest+json .webmanifest'), 'il manifest ha il suo tipo');
check(/<FilesMatch "\\\.\(jpe\?g\|png\|webp\|svg\|ico\)\$">\n\s+Header set Cache-Control "public, max-age=86400"/.test(ht),
  'immagini fuori da /assets/ in cache per un giorno');
check(ht.includes('Options -Indexes'), 'niente elenco dei file nelle cartelle');

// 4. Nessun valore va a capo: in `.htaccess` una riga spezzata è un errore 500
//    per tutto il sito, non un header ignorato.
check(righe.every((r) => !/^\s+[^\s<#]/.test(r) || /^\s+(Header|Rewrite|AddOutput|<\/?If)/.test(r)),
  'ogni riga rientrata è una direttiva intera');
check((ht.match(/<If /g) ?? []).length === (ht.match(/<\/If>/g) ?? []).length, '<If> aperti e chiusi');

// 5. Il lettore regge un valore con le virgolette.
const prova = generaHtaccess('/x\n  X-Prova: a "b" c\n');
check(prova.includes('Header always set X-Prova "a \\"b\\" c"'), 'virgolette nel valore protette');

if (falliti) {
  console.log(`\n${falliti} controlli falliti.\n`);
  process.exit(1);
}
console.log('\nTutto torna.\n');
