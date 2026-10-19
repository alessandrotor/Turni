// I file che non sono né JavaScript né CSS, e i contratti che li legano:
//
//   node scripts/check-configurazione.mjs
//
// PERCHÉ ESISTE
// Dopo il giro sul CSS e quello sul JavaScript (`check-codice-morto.mjs`),
// restava tutto il resto: JSON, HTML, `_headers`, `.env.esempio`. Sono pochi file, quasi mai toccati —
// ed è proprio per questo che quando si rompono nessuno se ne accorge: non c'è
// una schermata bianca, c'è una funzione che smette di funzionare in silenzio
// su un ambiente solo.
//
// I modi di sbagliare che questo script guarda sono tutti così:
//
//  1. UN VALORE DI `_headers` CHE VA A CAPO. Non dà errore: Cloudflare legge la
//     riga successiva come un header nuovo e la butta. La CSP resta monca e il
//     sito continua a funzionare — finché non serve la parte tagliata.
//  2. UNA VARIABILE `VITE_*` USATA E NON DOCUMENTATA. Il codice la legge come
//     stringa vuota, quindi la funzione che ne dipende semplicemente non c'è, e
//     chi compila da un altro computer non ha modo di sapere che gli manca.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let falliti = 0;
const check = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${etichetta}${dettaglio ? '  → ' + dettaglio : ''}`);
};

function elenca(dir, filtro, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'build') elenca(p, filtro, out); }
    else if (filtro.test(e.name)) out.push(p);
  }
  return out;
}

console.log('\nConfigurazione e contratti fra linguaggi\n');

// ── 1. Ogni JSON si legge ──────────────────────────────────────────────────
const json = ['package.json', 'worker/package.json', 'src/data/ccnl.json']
  .filter(existsSync);
const jsonRotti = json.filter((f) => {
  try { JSON.parse(readFileSync(f, 'utf8')); return false; } catch { return true; }
});
check(jsonRotti.length === 0, 'ogni JSON si legge', jsonRotti.join(' · ') || `${json.length} file`);

// ── 2. Ogni XML Android è bilanciato ───────────────────────────────────────
const VUOTI = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
function squilibrio(testo, { html = false } = {}) {
  const s = testo
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const pila = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z][\w.:-]*)([^>]*?)(\/?)>/g)) {
    const [, chiude, tag, , auto] = m;
    const t = html ? tag.toLowerCase() : tag;
    if (auto || (html && VUOTI.has(t))) continue;
    if (chiude) { const atteso = pila.pop(); if (atteso !== t) return `</${t}> chiude <${atteso ?? 'niente'}>`; }
    else if (t.toLowerCase() !== '!doctype') pila.push(t);
  }
  return pila.length ? `mai chiusi: <${pila.join('> <')}>` : null;
}
const xml = elenca('android', /\.xml$/);
const xmlRotti = xml.map((f) => [f, squilibrio(readFileSync(f, 'utf8'))]).filter(([, e]) => e);
check(xmlRotti.length === 0, 'ogni XML Android è bilanciato',
  xmlRotti.map(([f, e]) => `${f}: ${e}`).join(' · ') || `${xml.length} file`);

// ── 3. HTML bilanciato e senza id ripetuti ─────────────────────────────────
// Due elementi con lo stesso id non danno errore: `getElementById` ne trova uno
// solo, e `htmlFor`/`aria-*` puntano al primo che capita.
const htmlFile = ['index.html', 'public/privacy/index.html', 'public/termini/index.html'].filter(existsSync);
const htmlRotti = [];
for (const f of htmlFile) {
  const testo = readFileSync(f, 'utf8');
  const e = squilibrio(testo, { html: true });
  if (e) htmlRotti.push(`${f}: ${e}`);
  const ids = [...testo.matchAll(/\sid=["']([^"']+)/g)].map((m) => m[1]);
  const doppi = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (doppi.length) htmlRotti.push(`${f}: id ripetuto ${doppi.join(', ')}`);
}
check(htmlRotti.length === 0, 'HTML bilanciato e senza id ripetuti',
  htmlRotti.join(' · ') || `${htmlFile.length} pagine`);

// ── 4. Nel JSX, ogni riferimento a un id trova il suo id ───────────────────
// `htmlFor` che non aggancia niente è un'etichetta che non dà il fuoco al campo
// quando la si tocca — su un telefono è la differenza fra un campo comodo e uno
// da centrare col dito. `aria-describedby` rotto è una spiegazione che chi usa
// un lettore di schermo non sente mai. Nessuna delle due cose si vede a occhio.
const jsx = elenca('src', /\.jsx?$/);
const idDefiniti = new Set();
const riferimenti = [];
const idVisti = [];
for (const f of jsx) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\sid=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const v = m[1] ?? m[2];
    idDefiniti.add(v);
    if (!v.includes('${')) idVisti.push({ f, v });
  }
  for (const m of s.matchAll(/(htmlFor|aria-describedby|aria-labelledby|aria-controls)=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    riferimenti.push({ f, attr: m[1], v: m[2] ?? m[3] });
  }
}
// Un id costruito (`${base}-${i}`) si confronta sul modello, non sul valore.
const modello = (v) => v.replace(/\$\{[^}]*\}/g, '');
const modelli = new Set([...idDefiniti].map(modello));
const sospesi = riferimenti.filter((r) => !modelli.has(modello(r.v)));
const doppiJsx = [...new Set(idVisti.map((i) => i.v).filter((v, i, a) => a.indexOf(v) !== i))];
check(sospesi.length === 0 && doppiJsx.length === 0,
  'nel JSX ogni htmlFor e ogni aria-* trova il suo id',
  [...sospesi.map((r) => `${r.f}: ${r.attr}="${r.v}"`), ...doppiJsx.map((v) => `id ripetuto ${v}`)].join(' · ')
    || `${idDefiniti.size} id, ${riferimenti.length} riferimenti`);

// ── 5. `_headers`: nessun valore va a capo ─────────────────────────────────
const headers = readFileSync('public/_headers', 'utf8');
// Il colpo da parare è il valore che va a capo, e la parte spezzata è quasi
// sempre un indirizzo: `https://…` a inizio riga sembra un header di nome
// «https», ed è così che un primo giro di questo controllo si è fatto
// ingannare dal proprio caso di prova. A distinguerli basta lo SPAZIO dopo i
// due punti, che «Nome: valore» ha e `https://` no.
const continuazioni = [];
headers.split('\n').forEach((riga, i) => {
  if (!/^\s+\S/.test(riga)) return;                   // non è una riga di header
  if (/^\s+!?[A-Za-z][A-Za-z0-9-]*:\s/.test(riga)) return; // «Nome: valore», va bene
  if (/^\s+!\s*[A-Za-z][A-Za-z0-9-]*\s*$/.test(riga)) return; // «! Nome», stacca un header
  continuazioni.push(`riga ${i + 1}: «${riga.trim().slice(0, 40)}…»`);
});
check(continuazioni.length === 0, '_headers: nessun valore spezzato su più righe',
  continuazioni.join(' · ') || 'ogni valore sta su una riga sola');

// ── 6. La CSP c'è tutta ────────────────────────────────────────────────────
// Non si riscontra il contenuto — quello è una scelta, spiegata nel file — ma
// che le direttive dichiarate lì non spariscano in un ritocco frettoloso.
const csp = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? '';
const attese = ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
  'worker-src', 'frame-ancestors', 'base-uri', 'form-action', 'object-src'];
const mancanti = attese.filter((d) => !new RegExp(`(^|;)\\s*${d}\\s`).test(csp));
const scriptSrc = csp.match(/script-src([^;]*)/)?.[1] ?? '';
const allentata = scriptSrc.includes('unsafe-inline');
check(mancanti.length === 0 && !allentata,
  'la CSP ha tutte le sue direttive e nessun unsafe-inline negli script',
  [mancanti.length ? `manca ${mancanti.join(', ')}` : '',
    allentata ? "script-src ha 'unsafe-inline'" : ''].filter(Boolean).join(' · ')
    || `${attese.length} direttive`);

// ── 7. `.env.esempio` documenta ogni VITE_* che il codice legge ────────────
const codice = [...jsx, ...elenca('scripts', /\.mjs$/), 'vite.config.js']
  .filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
const lette = new Set([...codice.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)].map((m) => m[1]));
const documentate = new Set([...readFileSync('.env.esempio', 'utf8')
  .matchAll(/^(VITE_[A-Z0-9_]+)=/gm)].map((m) => m[1]));
// `VITE_SITE_URL` non passa da `import.meta.env`: la legge vite.config.js con
// `loadEnv` per sostituire `__SITE_URL__` dentro index.html.
const soloBuild = new Set(['VITE_SITE_URL']);
const nonDocumentate = [...lette].filter((v) => !documentate.has(v));
const nonUsate = [...documentate].filter((v) => !lette.has(v) && !soloBuild.has(v));
check(nonDocumentate.length === 0 && nonUsate.length === 0,
  '.env.esempio elenca esattamente le variabili che il codice legge',
  [...nonDocumentate.map((v) => `${v} non documentata`), ...nonUsate.map((v) => `${v} documentata e mai letta`)]
    .join(' · ') || `${lette.size} variabili`);

// ── 9. La scorciatoia dell'icona: manifest ↔ App ───────────────────────────
// «Segna il turno di oggi» vive in due file che non si parlano: l'indirizzo sta
// nel manifest (`vite.config.js`), chi lo legge sta in `src/App.jsx`.
// Rinominare il parametro da una parte sola non dà nessun errore — la
// scorciatoia aprirebbe il calendario nudo, e chi la usa penserebbe di aver
// sbagliato a premere.
//
// Si guarda il SORGENTE e non `dist/`, così questo controllo continua a girare
// senza pretendere una build: è un compromesso, e il prezzo è non accorgersi di
// un manifest che il plugin non ha generato. Lo copre `check-anteprima-link`,
// che il pacchetto lo guarda davvero.
const vite = readFileSync('vite.config.js', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');
const scorciatoie = [...vite.matchAll(/url:\s*'\/\?([a-zA-Z0-9_]+)=([a-zA-Z0-9_]+)'/g)]
  .map((m) => ({ chiave: m[1], valore: m[2] }));
const orfane = scorciatoie.filter((s) => !(
  app.includes(`get('${s.chiave}')`) && app.includes(`'${s.valore}'`)
));
check(scorciatoie.length > 0 && orfane.length === 0,
  'ogni scorciatoia del manifest ha chi la legge in App',
  orfane.length
    ? orfane.map((s) => `?${s.chiave}=${s.valore} non letto`).join(' · ')
    : scorciatoie.map((s) => `?${s.chiave}=${s.valore}`).join(', '));

// ── 10. La condivisione verso l'app: manifest ↔ service worker ↔ ImportTesto ─
// «Condividi → Turni» passa per tre file che non si parlano. Il manifest
// sceglie i nomi dei campi, `public/condividi-sw.js` li riceve (è una POST) e
// rimanda alla pagina con dei parametri, «Incolla turni» legge quei parametri.
// Rinominato uno da una parte sola, la condivisione aprirebbe il calendario
// vuoto senza un errore. E Workbox deve caricare il gestore, o la POST va a vuoto.
const importTesto = readFileSync('src/components/ImportTesto.jsx', 'utf8');
const swCondividi = readFileSync('public/condividi-sw.js', 'utf8');
const blocco = vite.match(/share_target:\s*\{([\s\S]*?)\n\s*\},/);
const campi = blocco ? [...blocco[1].matchAll(/(?:name|title|text|url):\s*'([a-z_]+)'/g)].map((m) => m[1]) : [];
const azione = blocco?.[1].match(/action:\s*'([^']+)'/)?.[1];
const parametri = [...swCondividi.matchAll(/'([a-z]+_condivis[oa])'/g)].map((m) => m[1]);
const nonRicevuti = campi.filter((c) => !swCondividi.includes(`'${c}'`));
const nonLetti = parametri.filter((p) => !importTesto.includes(`'${p}'`));
check(campi.length >= 4 && nonRicevuti.length === 0 && azione && swCondividi.includes(`'${azione}'`)
  && /importScripts:\s*\['condividi-sw\.js'\]/.test(vite) && parametri.length >= 4 && nonLetti.length === 0,
  'la condivisione arriva fino a «Incolla turni»',
  [...nonRicevuti.map((c) => `${c} non ricevuto dal service worker`), ...nonLetti.map((p) => `${p} non letto da ImportTesto`)].join(' · ')
    || `${azione}: ${campi.join(', ')} → ${parametri.join(', ')}`);

// ── 11. Le pagine statiche non le ingoia il ripiego della PWA ────────────────
// Dentro l'app installata ogni indirizzo che il service worker non conosce
// finisce sul calendario (`navigateFallback`). Informativa e termini sono
// pagine vere in `public/`: senza la loro voce in `navigateFallbackDenylist`
// il link si apre sul calendario, e la pagina risulta pubblicata ma non si
// legge. La prossima pagina aggiunta deve avere la sua voce.
const statiche = readdirSync('public', { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`public/${d.name}/index.html`)).map((d) => d.name);
const escluse = vite.match(/navigateFallbackDenylist:\s*\[([^\]]*)\]/)?.[1] || '';
const ingoiate = statiche.filter((n) => !escluse.includes(`\\/${n}`));
check(statiche.length > 0 && ingoiate.length === 0, 'ogni pagina statica è esclusa dal ripiego della PWA',
  ingoiate.map((n) => `/${n}/ aprirebbe il calendario`).join(' · ') || statiche.map((n) => `/${n}/`).join(', '));

console.log(falliti === 0
  ? '\nI file che nessuno guarda mai sono a posto.\n'
  : `\n${falliti} problema/i.\n`);
process.exit(falliti === 0 ? 0 : 1);
