// Codice che non raggiunge più nessuno:
//
//   node scripts/check-codice-morto.mjs
//
// PERCHÉ ESISTE
// Il 1° settembre 2026 un controllo incrociato ha trovato 66 righe di CSS e 67
// di JavaScript che non usava più niente. Roba innocua per il 90%, ma dentro
// c'erano quattro funzioni nel motore paga — `calcPay`, `calcShiftPay`,
// `calcShiftHours`, `calcWeekTotals` — esportate, dal nome autorevole, e che
// calcolavano un numero DIVERSO da quello riscontrato sulle buste perché
// ignoravano la soglia mensile del supplementare. Non erano disordine: erano
// una trappola per chi le avesse chiamate credendole il motore.
//
// Pulire a mano funziona una volta. Questo script fa sì che non serva rifarlo:
// se qualcosa smette di essere raggiungibile, si scopre subito invece che fra
// sei mesi.
//
// COSA CONTA COME «VIVO»
// Un export è vivo se qualcuno lo importa, OPPURE se viene usato dentro il suo
// stesso file. La seconda parte non è una concessione: metà dei moduli qui
// esporta più del necessario perché i riscontri possano entrarci, e ridurre
// quella superficie sarebbe rumore. Quello che si vuole scoprire è il codice
// che non gira MAI, in nessun percorso.
//
// I DUE FALSI POSITIVI CHE HANNO GIÀ INGANNATO IL CONTROLLO A MANO, e che qui
// sono gestiti apposta:
//  1. `import()` DINAMICO. `parseShiftsFromImage` risultava morta ed è il cuore
//     dell'import da foto: CalendarView la carica con
//     `await import('../services/gemini')`. Si guardano quindi anche gli import
//     dinamici, non solo quelli statici.
//  2. NOMI CITATI NEI COMMENTI. Una classe CSS nominata in un commento sembra
//     usata. È esattamente così che `timeline-icon` era sopravvissuta a ogni
//     controllo: i commenti si tolgono prima di contare.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let falliti = 0;
const check = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${etichetta}${dettaglio ? '  → ' + dettaglio : ''}`);
};

function elenca(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') elenca(p, out); }
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Togliere i commenti con due `replace` sembra ovvio e non funziona: in
// CalendarView c'è `accept="image/*"`, e quel `/*` dentro una stringa apre un
// commento che non finisce più, mangiandosi venticinque righe di marcatura e
// facendo risultare morte cinque classi vive (.btn-import, .import-asname, le
// tre .debug-usage*). Il primo giro di questo script ci è cascato.
//
// Serve quindi un piccolo scanner che sappia dove si trova: dentro una stringa
// un `/*` è testo, non un commento. Il contenuto delle stringhe viene TENUTO —
// un nome dentro `classList.add('x')` è un uso a tutti gli effetti — mentre i
// commenti spariscono, che è tutto il punto: un nome citato in un commento non
// è un uso, ed è così che `timeline-icon` era sopravvissuta a ogni controllo.
function senzaCommenti(s) {
  let out = '';
  let stato = null; // null | "'" | '"' | '`' | 'blocco' | 'riga'
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const d = s[i + 1];
    if (stato === 'blocco') {
      if (c === '*' && d === '/') { stato = null; i++; out += ' '; }
      continue;
    }
    if (stato === 'riga') {
      if (c === '\n') { stato = null; out += '\n'; }
      continue;
    }
    if (stato) { // dentro una stringa: si copia tutto, virgolette comprese
      if (c === '\\') { out += c + (d ?? ''); i++; continue; }
      if (c === stato) stato = null;
      out += c;
      continue;
    }
    if (c === '/' && d === '*') { stato = 'blocco'; i++; continue; }
    if (c === '/' && d === '/') { stato = 'riga'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') stato = c;
    out += c;
  }
  return out;
}

const FILE = [...elenca('src'), ...elenca('scripts'), ...elenca('worker/src')];
const testo = Object.fromEntries(FILE.map(f => [f, senzaCommenti(readFileSync(f, 'utf8'))]));
const tutto = Object.values(testo).join('\n');

console.log('\nCodice morto\n');

// ── 1. Export JavaScript che non raggiunge nessuno ─────────────────────────
const esporta = {};
for (const [f, s] of Object.entries(testo)) {
  const nomi = new Set();
  for (const m of s.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    nomi.add(m[1]);
  }
  for (const m of s.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const pezzo of m[1].split(',')) {
      const n = pezzo.split(' as ').pop().trim();
      if (n) nomi.add(n);
    }
  }
  esporta[f] = nomi;
}

const morti = [];
for (const [f, nomi] of Object.entries(esporta)) {
  for (const n of nomi) {
    // Quante volte il nome compare in TUTTO il progetto? Una sola volta vuol
    // dire che c'è solo la riga che lo definisce: non lo importa nessuno e non
    // lo usa nemmeno il file in cui vive. Il conteggio globale copre in un
    // colpo solo gli import statici, quelli dinamici e gli usi interni.
    const quante = (tutto.match(new RegExp(`(?<![\\w$])${n}(?![\\w$])`, 'g')) || []).length;
    if (quante <= 1) morti.push(`${f}: ${n}`);
  }
}
check(morti.length === 0, 'nessun export che non gira mai',
  morti.length ? morti.join(' · ') : `${Object.values(esporta).flatMap(s => [...s]).length} export, tutti raggiunti`);

// ── 2. Classi CSS che non raggiunge nessuno ────────────────────────────────
const cssGrezzo = readFileSync('src/index.css', 'utf8');
const css = senzaCommenti(cssGrezzo.replace(/\/\*[\s\S]*?\*\//g, ''));
const classi = new Set();
for (const blocco of css.split('}')) {
  for (const m of blocco.split('{')[0].matchAll(/\.([a-zA-Z][\w-]*)/g)) classi.add(m[1]);
}
const html = readFileSync('index.html', 'utf8');
const marcatura = [...Object.values(testo), html].join('\n');
const classiMorte = [...classi].filter((c) => {
  if (new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(marcatura)) return false;
  // `pill--ferie` è viva se qualcuno costruisce `pill--${tipo}`
  const radice = c.replace(/--[\w-]+$/, '');
  return !(radice !== c && new RegExp(`${radice}--\\$\\{`).test(marcatura));
});
check(classiMorte.length === 0, 'nessuna classe CSS senza qualcuno che la usi',
  classiMorte.length ? classiMorte.map(c => '.' + c).join(' · ') : `${classi.size} classi, tutte raggiunte`);

// ── 3. Classi usate nella marcatura senza una regola che le vesta ──────────
const inUso = new Set();
for (const m of marcatura.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
  for (const c of (m[1] || m[2] || m[3] || '').split(/\s+/)) {
    if (/^[a-zA-Z][\w-]*$/.test(c)) inUso.add(c);
  }
}
const senzaRegola = [...inUso].filter(c => !classi.has(c) && c.includes('-'));
check(senzaRegola.length === 0, 'nessun aggancio CSS che non aggancia niente',
  senzaRegola.length ? senzaRegola.map(c => '.' + c).join(' · ') : 'ogni classe scritta nella marcatura ha la sua regola');

// ── 4. Import che il file di origine non esporta ───────────────────────────
const rotti = [];
for (const [f, s] of Object.entries(testo)) {
  for (const m of s.matchAll(/import\s+([^;]*?)\s+from\s+['"](\.[^'"]+)['"]/gs)) {
    const dentro = m[1].match(/\{([^}]*)\}/);
    if (!dentro) continue;
    const dir = f.slice(0, f.lastIndexOf('/'));
    const base = join(dir, m[2]);
    const target = [base, base + '.js', base + '.jsx', base + '.mjs'].find(c => c in esporta);
    if (!target) continue;
    for (const pezzo of dentro[1].split(',')) {
      const n = pezzo.split(' as ')[0].trim();
      if (n && !esporta[target].has(n)) rotti.push(`${f} importa «${n}» da ${target}`);
    }
  }
}
check(rotti.length === 0, 'nessun import di un nome che non esiste', rotti.join(' · '));

console.log(falliti === 0
  ? '\nTutto quello che c\'è, serve a qualcuno.\n'
  : `\n${falliti} problema/i.\n`);
process.exit(falliti === 0 ? 0 : 1);
