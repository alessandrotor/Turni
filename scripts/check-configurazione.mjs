// I file che non sono né JavaScript né CSS, e i contratti che li legano:
//
//   node scripts/check-configurazione.mjs
//
// PERCHÉ ESISTE
// Dopo il giro sul CSS e quello sul JavaScript (`check-codice-morto.mjs`),
// restava tutto il resto: JSON, XML Android, HTML, `_headers`, `.env.esempio`,
// lo script Apps Script della telemetria. Sono pochi file, quasi mai toccati —
// ed è proprio per questo che quando si rompono nessuno se ne accorge: non c'è
// una schermata bianca, c'è una funzione che smette di funzionare in silenzio
// su un ambiente solo.
//
// I tre modi di sbagliare che questo script guarda sono tutti così:
//
//  1. UN VALORE DI `_headers` CHE VA A CAPO. Non dà errore: Cloudflare legge la
//     riga successiva come un header nuovo e la butta. La CSP resta monca e il
//     sito continua a funzionare — finché non serve la parte tagliata.
//  2. UNA VARIABILE `VITE_*` USATA E NON DOCUMENTATA. Il codice la legge come
//     stringa vuota, quindi la funzione che ne dipende semplicemente non c'è, e
//     chi compila da un altro computer non ha modo di sapere che gli manca.
//  3. UNA COLONNA DELLA TELEMETRIA CHE NON COMBACIA. Il Foglio Google scrive le
//     colonne di `HEADERS` e ignora tutto il resto: un campo aggiunto da una
//     parte e non dall'altra si perde senza che nessuna delle due si lamenti.
//
// Non entra qui il rapporto fra la CSP e la telemetria — che oggi la CSP
// blocca, di proposito: sta scritto in `public/_headers`, perché è una
// decisione, non un fatto da riscontrare.

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
const json = ['capacitor.config.json', 'package.json', 'worker/package.json', 'src/data/ccnl.json']
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
const htmlFile = ['index.html', 'public/privacy/index.html'].filter(existsSync);
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

// ── 8. Il contratto della telemetria: JavaScript → Apps Script → Foglio ────
// Il Foglio scrive le colonne di `HEADERS` e basta. Un campo aggiunto da questa
// parte e non da quella non arriva, e non se ne lamenta nessuno: si scopre
// guardando una colonna vuota fra sei mesi.
const gs = readFileSync('docs/telemetry-appsscript.gs', 'utf8');
const colonne = new Set([...(gs.match(/const HEADERS = \[([\s\S]*?)\]/)?.[1] ?? '')
  .matchAll(/'([^']+)'/g)].map((m) => m[1]));
const inviate = new Set();
// I tre punti da cui nasce il messaggio, e non ce n'è un quarto:
const tel = readFileSync('src/services/telemetry.js', 'utf8');
for (const m of (tel.match(/JSON\.stringify\(\{([\s\S]*?)\}\)/)?.[1] ?? '').matchAll(/^\s*([a-zA-Z]\w*):/gm)) inviate.add(m[1]);
const cal = readFileSync('src/components/CalendarView.jsx', 'utf8');
for (const m of (cal.match(/const meta = \{([^}]*)\}/)?.[1] ?? '').matchAll(/([a-zA-Z]\w*):/g)) inviate.add(m[1]);
for (const m of cal.matchAll(/sendImportTelemetry\(\{([^}]*)\}/g)) {
  for (const k of m[1].matchAll(/([a-zA-Z]\w*):/g)) inviate.add(k[1]);
}
const wrk = readFileSync('worker/src/index.js', 'utf8');
for (const m of (wrk.match(/usage:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? '').matchAll(/^\s*([a-zA-Z]\w*):/gm)) inviate.add(m[1]);
const perse = [...inviate].filter((k) => !colonne.has(k));
check(perse.length === 0 && inviate.size >= 10,
  'ogni campo inviato dalla telemetria ha la sua colonna nel Foglio',
  perse.length ? `si perderebbe: ${perse.join(', ')}` : `${inviate.size} campi su ${colonne.size} colonne`);

console.log(falliti === 0
  ? '\nI file che nessuno guarda mai sono a posto.\n'
  : `\n${falliti} problema/i.\n`);
process.exit(falliti === 0 ? 0 : 1);
