// «Il testo colorato si legge», riscontrato invece che sperato:
//
//   node scripts/check-leggibilita.mjs
//
// PERCHÉ ESISTE
// I colori semantici (`--c-success`, `--c-warning`, `--c-muted`) sono pensati
// per riempimenti, bordi e cifre grandi. Usati come testo piccolo su bianco
// stanno fra 2,6 e 3,8:1, sotto il 4,5:1 di WCAG 1.4.3 — e il caso peggiore
// erano proprio gli avvisi in arancio, cioè le righe che l'app vuole far
// leggere. Per il testo esistono le varianti `-text`.
//
// Il difetto non si vede su uno schermo buono al chiuso: si vede in pausa, col
// sole sul telefono. Per questo si legge il foglio di stile invece di guardarlo.
//
// Cosa verifica:
//  1. le varianti `-text` superano 4,5:1 su ogni fondo su cui compaiono;
//  2. nessuna regola usa un colore semantico «da riempimento» come `color:`,
//     tranne il testo grande (≥ 1,2rem e grassetto), per cui WCAG chiede 3:1 —
//     e allora quel 3:1 lo si verifica.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(QUI, '..', 'src', 'index.css'), 'utf8');

let falliti = 0;
let totale = 0;

function verifica(titolo, ok, dettaglio = '') {
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(58)} ${dettaglio}`);
}

// ── Contrasto WCAG ─────────────────────────────────────────────────────────
function luminanza(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrasto(a, b) {
  const [l1, l2] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ── I token di :root ───────────────────────────────────────────────────────
const root = css.match(/:root\s*\{([\s\S]*?)\}/)[1];
const token = {};
for (const [, nome, valore] of root.matchAll(/(--c-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  token[nome] = valore;
}

// ── 1. Le varianti per il testo ────────────────────────────────────────────
console.log('\nLe varianti -text sui fondi dove compaiono\n');

const fondi = ['--c-card', '--c-bg'];
const coppie = {
  '--c-success-text': [...fondi, '--c-success-light'],
  '--c-warning-text': [...fondi, '--c-warning-light'],
  '--c-muted-text':   fondi,
};
for (const [testo, suFondi] of Object.entries(coppie)) {
  verifica(`${testo} esiste`, Boolean(token[testo]));
  if (!token[testo]) continue;
  for (const fondo of suFondi) {
    const r = contrasto(token[testo], token[fondo]);
    verifica(`${testo} su ${fondo}`, r >= 4.5, `${r.toFixed(2)}:1 (serve 4,5)`);
  }
}

// ── 2. Nessun colore da riempimento come testo piccolo ─────────────────────
console.log('\nI colori da riempimento non fanno testo piccolo\n');

const DA_RIEMPIMENTO = ['--c-success', '--c-warning', '--c-muted'];

// Regole piatte: selettore { dichiarazioni }. Le @media si attraversano perché
// l'espressione prende solo il blocco più interno.
const regole = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, sel, corpo]) => ({ sel: sel.trim().replace(/\s+/g, ' '), corpo }));

function rem(corpo) {
  const m = corpo.match(/font-size\s*:\s*([\d.]+)rem/);
  return m ? Number(m[1]) : null;
}
function peso(corpo) {
  const m = corpo.match(/font-weight\s*:\s*(\d+)/);
  return m ? Number(m[1]) : 400;
}

let trovate = 0;
for (const { sel, corpo } of regole) {
  const m = corpo.match(/(?:^|;|\s)color\s*:\s*var\((--c-[\w-]+)\)/);
  if (!m || !DA_RIEMPIMENTO.includes(m[1])) continue;
  trovate++;
  const grande = (rem(corpo) ?? 0) >= 1.2 && peso(corpo) >= 700;
  if (grande) {
    const r = contrasto(token[m[1]], token['--c-card']);
    verifica(`${sel.slice(0, 40)} (testo grande)`, r >= 3, `${m[1]} ${r.toFixed(2)}:1 (serve 3)`);
  } else {
    verifica(`${sel.slice(0, 40)}`, false, `${m[1]} come testo piccolo: usare ${m[1]}-text`);
  }
}
if (trovate === 0) verifica('nessun colore da riempimento usato come testo', true);

console.log(`\n${totale - falliti}/${totale} ok\n`);
process.exit(falliti ? 1 : 0);
