// La pagina «Confronta con la busta» mantiene quello che promette:
//
//   node scripts/check-verifica-busta.mjs
//
// PERCHÉ ESISTE
// La pagina dice in grande: «La tua busta paga NON viene inviata a nessun
// servizio esterno», e al tester chiede di mandare un testo «senza importi».
// Sono due promesse fatte a persone che ci affidano un documento con nome,
// codice fiscale e retribuzione. Nessuno le riverificherà a mano a ogni
// modifica: questo file sì.
//
//  1. NIENTE RETE nella pagina e in TUTTI i moduli che importa, fino in fondo:
//     se qualcuno aggiungesse una `fetch` a `net.js`, la frase in cima
//     diventerebbe falsa senza che nessuno toccasse la pagina.
//  2. NIENTE IMPORTI nel testo da condividere: solo scarti.
//  3. LO STESSO LETTORE in Node e nel browser. Il browser decomprime con
//     `DecompressionStream`, che rifiuta i byte in coda al deflate — il primo
//     giro leggeva ZERO flussi su undici e dava un cedolino vuoto, mentre gli
//     script Node leggevano benissimo.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { inflateBrowser, righeDaByte } from '../src/utils/cedolino.js';
import { righeDi } from './lib/cedolino.mjs';
import { leggiCedolinoDaRighe } from '../src/utils/leggi-cedolino.js';
import { confronta, testoDaCondividere, riga } from '../src/utils/verifica-busta.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

// ── 1. Niente rete, fino in fondo agli import ──────────────────────────────
console.log('\nLa busta non esce dal telefono\n');

const PAGINA = 'src/components/VerificaBusta.jsx';
const VIETATO = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|telemetry|import\s*\(/;
const visti = new Map();
function scorri(file) {
  const assoluto = resolve(file);
  if (visti.has(assoluto)) return;
  const testo = readFileSync(assoluto, 'utf8');
  visti.set(assoluto, testo);
  for (const m of testo.matchAll(/^\s*import[^'"]*from\s+['"](\.[^'"]+)['"]/gm)) {
    let dest = resolve(dirname(assoluto), m[1]);
    if (!existsSync(dest)) dest = [`${dest}.js`, `${dest}.jsx`].find(existsSync);
    if (dest && /\.(js|jsx|mjs)$/.test(dest)) scorri(dest);
  }
}
scorri(PAGINA);
// Senza le righe di commento: qui e nei moduli la parola «fetch» o «telemetry»
// può comparire per spiegare cosa NON si fa.
const colpevoli = [...visti].filter(([, t]) => VIETATO.test(
  t.split('\n').filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n'),
)).map(([f]) => f.replace(resolve('.') + '\\', '').replace(resolve('.') + '/', ''));
esito(colpevoli.length === 0, `nessuna chiamata di rete in ${visti.size} moduli`,
  colpevoli.length ? colpevoli.join(', ') : 'pagina, lettore, motore');
esito(visti.get(resolve(PAGINA)).includes('NON viene inviata a nessun servizio esterno'),
  'la promessa è scritta in cima alla pagina');

// ── 2. Niente importi nel testo ────────────────────────────────────────────
console.log('\nSi mandano gli scarti, non le cifre\n');

// Valori riconoscibili, per poterli cercare in ogni forma in cui potrebbero
// finire scritti.
// Le righe passano da `riga`, la stessa funzione del confronto vero: è lì che
// si decide cosa il testo può dire.
const finto = {
  periodo: { anno: 2026, mese: 7 },
  righe: [
    riga('calcolo', 'Netto', 1217.97, 1217.56, 1.01),
    riga('calcolo', 'IRPEF trattenuta', 14.35, 8.38, 1.01),
    // UN LATO A ZERO, la fuga trovata sulle buste vere: lo scarto sarebbe la
    // cifra intera dell'app — l'addizionale, da cui si risale al reddito.
    riga('calcolo', 'Addizionali', 12.37, 0, 0.05),
    riga('calcolo', 'Trattamento integrativo', 0, 98.63, 0.02),
    riga('turni', 'Lordo', 1301.35, 1298.15, 1),
  ],
  avvisi: [],
};
const testo = testoDaCondividere(finto, { versione: '0.9.4', settings: { ccnl: 'turismo' }, partTimePct: 60 });
const forme = (n) => [
  n.toFixed(2), n.toFixed(2).replace('.', ','),
  n.toLocaleString('it-IT', { minimumFractionDigits: 2 }), String(Math.round(n)),
];
// Un numero INTERO nel testo, non un pezzo di un altro: «202» non deve
// combaciare con il «2026» dell'intestazione.
const compare = (testo, f) => new RegExp(`(?<![\\d.,])${f.replace(/[.]/g, '\\.')}(?!\\d)`).test(testo);
// Lo zero non rivela niente, e combacerebbe con lo «0» di ogni «+0,41».
const trovati = finto.righe.flatMap((r) => [r.app, r.busta]).filter((n) => n !== 0)
  .filter((n) => forme(n).some((f) => compare(testo, f)));
esito(trovati.length === 0, 'nessun importo di app o busta nel testo', trovati.join(', ') || 'solo scarti');
esito(testo.includes('+0,41 €') && testo.includes('+5,97 €'), 'gli scarti ci sono');
esito(/Addizionali\s+solo nell.app/.test(testo) && /Trattamento integrativo\s+solo in busta/.test(testo),
  'un lato a zero dice solo da che parte, senza cifra');

// ── 3. Lo stesso lettore in Node e nel browser ─────────────────────────────
console.log('\nIl browser legge come Node\n');

// Il caso che ha rotto il primo giro, senza bisogno di un PDF: deflate più il
// ritorno a capo che il PDF mette prima di `endstream`.
const originale = 'BT (prova) Tj ET\n'.repeat(50);
const conCoda = new Uint8Array([...deflateSync(Buffer.from(originale, 'latin1')), 0x0d, 0x0a]);
const letto = Buffer.from(await inflateBrowser(conCoda)).toString('latin1');
esito(letto === originale, 'un flusso con l\'a capo in coda si decomprime lo stesso');

// Sui PDF veri, se ci sono. Stanno fuori dal repository (sono documenti
// personali): senza, lo si dice invece di passare in silenzio.
const cartella = process.env.BUSTE_DIR || 'tests';
const pdf = existsSync(cartella)
  ? readdirSync(cartella).filter((f) => /\.pdf$/i.test(f)).map((f) => join(cartella, f)) : [];
if (!pdf.length) {
  console.log(`  --   nessun PDF in «${cartella}»: confronto Node/browser NON verificato su buste vere`);
} else {
  let uguali = 0, conVoci = 0, testiPuliti = 0;
  for (const p of pdf) {
    const node = leggiCedolinoDaRighe(righeDi(p));
    const browser = leggiCedolinoDaRighe(await righeDaByte(new Uint8Array(readFileSync(p)), inflateBrowser));
    if (JSON.stringify(node) === JSON.stringify(browser)) uguali++;
    if (!browser.voci.length || !browser.periodo) continue;
    conVoci++;
    const e = confronta(browser, { settings: { ccnl: 'turismo', expectedWeeklyHours: 24 } });
    const t = testoDaCondividere(e, { settings: { ccnl: 'turismo' } });
    const fughe = e.righe.flatMap((r) => [r.app, r.busta]).filter((n) => Math.abs(n) >= 10)
      .filter((n) => forme(n).some((f) => compare(t, f)));
    if (!fughe.length) testiPuliti++;
  }
  esito(uguali === pdf.length, 'stessa lettura in Node e nel browser', `${uguali} su ${pdf.length} PDF`);
  esito(testiPuliti === conVoci, 'e da nessuna busta vera escono importi', `${testiPuliti} su ${conVoci}`);
}

console.log(`\n${falliti === 0 ? '✓ la busta resta sul telefono, esce solo lo scarto' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
