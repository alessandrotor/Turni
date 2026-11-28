// Verifica DAL VIVO un sito pubblicato su un hosting Apache:
//
//   node scripts/verifica-sito.mjs https://indirizzo
//
// check-htaccess.mjs controlla il TESTO del .htaccess; questo controlla cosa
// risponde davvero il server, che è un'altra cosa: un hosting può ignorare
// `mod_headers`, aggiungere i suoi Cache-Control, non comprimere. Gira dopo il
// caricamento in pubblica-produzione.yml, da un server di GitHub, perché le
// sessioni di lavoro non sempre raggiungono i siti esterni.
//
// Non è nell'elenco dei riscontri (non si chiama check-*): ha bisogno della
// rete e di un sito già pubblicato.

import { readFileSync } from 'node:fs';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Uso: node scripts/verifica-sito.mjs https://indirizzo');
  process.exit(2);
}

let falliti = 0;
const check = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${etichetta}${dettaglio ? '  → ' + dettaglio : ''}`);
};
const prendi = async (percorso, opz = {}) => {
  const t0 = performance.now();
  const r = await fetch(percorso.startsWith('http') ? percorso : base + percorso,
    { redirect: 'manual', headers: { 'accept-encoding': 'gzip, br' }, ...opz });
  const ms = Math.round(performance.now() - t0);
  return { r, ms };
};

console.log(`\nVerifica dal vivo di ${base}\n`);

// 1. La pagina, le regole di sicurezza, la compressione, il tempo.
const { r: home, ms: msHome } = await prendi('/');
check(home.status === 200, 'la pagina principale risponde', `${home.status}`);
const cspAttesa = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy:\s*(.+)/)?.[1]?.trim();
check(home.headers.get('content-security-policy') === cspAttesa, 'CSP identica a _headers',
  home.headers.get('content-security-policy') ?? 'assente');
for (const h of ['strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy']) {
  check(!!home.headers.get(h), `header ${h}`, home.headers.get(h) ?? 'assente');
}
check(!home.headers.get('access-control-allow-origin'), 'nessun Access-Control-Allow-Origin');
check(/gzip|br/.test(home.headers.get('content-encoding') ?? ''), 'HTML compresso', home.headers.get('content-encoding') ?? 'no');
console.log(`        tempo della pagina principale: ${msHome} ms`);
const html = await home.text();

// 2. sw.js: senza no-cache gli aggiornamenti non arrivano su alcuni browser.
const { r: sw } = await prendi('/sw.js');
const ccSw = sw.headers.get('cache-control') ?? '';
check(sw.status === 200 && /no-cache/.test(ccSw) && !/max-age=[1-9]/.test(ccSw), 'sw.js: Cache-Control no-cache', ccSw || 'assente');

// 3. Gli asset: immutabili e compressi.
const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
if (asset) {
  const { r: a } = await prendi(asset);
  const cc = a.headers.get('cache-control') ?? '';
  check(/max-age=31536000/.test(cc) && /immutable/.test(cc), 'asset immutabili per un anno', cc || 'assente');
  check(/gzip|br/.test(a.headers.get('content-encoding') ?? ''), 'JavaScript compresso', a.headers.get('content-encoding') ?? 'no');
  check(/javascript/.test(a.headers.get('content-type') ?? ''), 'JavaScript col tipo giusto', a.headers.get('content-type') ?? '');
} else check(false, 'trovato un asset nella pagina');

// 3b. Le immagini fuori da /assets/ hanno una durata (senza, si riscaricano a ogni visita).
const { r: img } = await prendi('/apple-touch-icon.png');
check(/max-age=[1-9]/.test(img.headers.get('cache-control') ?? ''), 'immagini fuori da /assets/ con una durata in cache',
  img.headers.get('cache-control') ?? 'assente');

// 4. Il manifest col suo tipo (senza, l'app non si installa bene).
const { r: man } = await prendi('/manifest.webmanifest');
check(man.status === 200 && /manifest\+json|json/.test(man.headers.get('content-type') ?? ''), 'manifest servito come JSON',
  `${man.status} ${man.headers.get('content-type')}`);

// 5. Le rotte dell'app ripiegano su index.html; le pagine vere no.
const { r: rotta } = await prendi('/una-rotta-che-non-esiste');
check(rotta.status === 200, 'una rotta dell\'app ripiega su index.html', `${rotta.status}`);
for (const p of ['/privacy/', '/termini/', '/benvenuto/']) {
  const { r } = await prendi(p);
  const t = await r.text();
  check(r.status === 200 && !t.includes('id="root"'), `${p} è la pagina vera, non l'app`, `${r.status}`);
}
const { r: senzaBarra } = await prendi('/privacy');
check([200, 301, 302].includes(senzaBarra.status), '/privacy senza barra finale arriva alla pagina', `${senzaBarra.status} ${senzaBarra.headers.get('location') ?? ''}`);

// 6. HTTP porta a HTTPS.
const { r: http } = await prendi(base.replace('https://', 'http://') + '/');
check([301, 308].includes(http.status) && (http.headers.get('location') ?? '').startsWith('https://'),
  'http:// rimanda a https://', `${http.status} ${http.headers.get('location') ?? ''}`);

// 7. Il .htaccess non è leggibile da fuori.
const { r: ht } = await prendi('/.htaccess');
check(ht.status === 403 || ht.status === 404, '.htaccess non scaricabile', `${ht.status}`);

if (falliti) {
  console.log(`\n${falliti} controlli falliti.\n`);
  process.exit(1);
}
console.log('\nTutto torna.\n');
