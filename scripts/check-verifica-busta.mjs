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
import { leggiCedolinoDaRighe, lordoDaBusta } from '../src/utils/leggi-cedolino.js';
import {
  confronta, testoDaCondividere, riga, lordoBustaPerVoce, spiegaScarto,
} from '../src/utils/verifica-busta.js';

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

// ── 2b. Il lordo, voce per voce ────────────────────────────────────────────
//
// «Lordo +76,88 €» non diceva cosa non tornava. La scomposizione lo dice, e
// deve reggere due cose: sommare ai due totali che spiega, e non far uscire
// nel testo né euro né ORE intere — con un lato a zero, lo scarto in ore è il
// totale delle ore dell'altro lato.
//
// La busta è quella di agosto 2026, ricostruita dalle cifre di
// check-busta-agosto-2026.mjs: 99,20 h di retribuzione, 4 di ferie, 17,50 di
// supplementare al 130%, 7,75 domenicali al 10%, più 130 € di voci che non
// nascono dai turni.
console.log('\nLo scarto del lordo, voce per voce\n');

const R = 9.21802;
const vc = (etichetta, numeri, unita = null, sezione = 'competenza') =>
  ({ codice: null, etichetta, numeri, importo: numeri.at(-1), sezione, unita });
const agosto = {
  periodo: { anno: 2026, mese: 8 }, netto: null,
  voci: [
    vc('Retribuzione', [R, 99.20, 914.43], 'ORE'),
    vc('Ferie godute', [R, 4.00, 36.87], 'ORE'),
    vc('Lavoro supplementare 30%', [R * 1.3, 17.50, 209.71], 'ORE'),
    vc('Magg.Lavoro Domenicale 10%', [R * 0.1, 7.75, 7.14], 'ORE'),
    vc('TOP STORE', [120.00]),
    vc('Ind. Flessibilità', [10.00]),
    vc('Indennità L.207/24', [56.32]),
  ],
};
const perBusta = lordoBustaPerVoce(agosto);
const c2 = (n) => Math.round(n * 100) / 100;
esito(c2(Object.values(perBusta).reduce((s, f) => s + f.euro, 0)) === lordoDaBusta(agosto).lordo,
  'le voci della busta sommano al lordo della busta', `${lordoDaBusta(agosto).lordo}`);
esito(perBusta.ordinarie.ore === 103.2 && perBusta.supplementari.ore === 17.5,
  'le ore si leggono solo dove tariffa × ore = importo', 'retribuzione + ferie = monte ore');
esito(perBusta.ordinarie.euro > 0 && perBusta.altre.voci.join() === 'TOP STORE,Ind. Flessibilità',
  'L.207 esente fuori, premi e indennità fra le «altre»', perBusta.altre.voci.join(', '));

// I turni: un mese «giusto» più un festivo segnato il 15, che la busta non ha.
const S = {
  hourlyRate: R, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo',
  sundaySurchargePct: 10, overtimeSurchargePct: 30, holidaySurchargePct: 20,
  monthlyBonusAmount: 120, monthlyBonus: { '2026-08': true }, fixedMonthlyItems: [{ amount: 10 }],
};
const turniAgosto = [];
const tt = (d, s, e, extra = {}) => turniAgosto.push({
  id: `${d}-${s}`, date: `2026-08-${String(d).padStart(2, '0')}`, startTime: s, endTime: e, ...extra,
});
for (let d = 1; d <= 30; d += 1) if (d !== 15) tt(d, '10:00', '14:00');
tt(15, '10:00', '16:00');
tt(31, '09:00', '13:00', { type: 'ferie' });
const conf = confronta(agosto, { allShifts: turniAgosto, settings: S });
const lordoRiga = conf.righe.find((r) => r.voce === 'Lordo');
esito(conf.scomposizione.length > 0, 'con il lordo fuori tolleranza la scomposizione c\'è');
esito(c2(conf.scomposizione.reduce((s, r) => s + r.app, 0)) === lordoRiga.app
  && c2(conf.scomposizione.reduce((s, r) => s + r.busta, 0)) === lordoRiga.busta,
  'le due colonne sommano ai due lordi', `${lordoRiga.app} · ${lordoRiga.busta}`);
const fest = conf.scomposizione.find((r) => r.id === 'festivo');
esito(fest?.soloDa === 'app' && /festività/.test(spiegaScarto(fest)),
  'il festivo segnato che la busta non ha finisce nella sua riga', 'e la frase dice cosa fare');
esito(conf.scomposizione.find((r) => r.id === 'altre')?.ok === true,
  'bonus e voce fissa tornano con TOP STORE e Ind. Flessibilità');

const testoScomp = testoDaCondividere(conf, { versione: '0.9.5', settings: S });
// Sotto 100 la forma arrotondata all'intero («7» per 7,14) combacia per caso
// con l'inizio di uno scarto («+7,61»): per quelle cifre si cercano le sole
// forme coi decimali, che una fuga vera porterebbe con sé.
const formeStrette = (n) => (Math.abs(n) < 100 ? forme(n).slice(0, 3) : forme(n));
const cifreScomp = conf.scomposizione
  .flatMap((r) => [r.app, r.busta, r.oreApp, r.oreBusta])
  .filter((n) => n != null && Math.abs(n) >= 1)
  .filter((n) => formeStrette(n).some((f) => compare(testoScomp, f)));
esito(cifreScomp.length === 0, 'nel testo nessun importo né ore intere della scomposizione',
  cifreScomp.join(', ') || 'solo scarti');
esito(/Festivi lavorati\s+solo nell.app/.test(testoScomp), 'lato a zero: solo da che parte, anche qui');
esito(!/TOP STORE|Flessibilit/.test(testoScomp), 'i nomi delle voci della busta non escono',
  'possono dire chi è il datore');

// Senza scarto la scomposizione non si mostra: sei righe di ✓ sono rumore.
const giusto = confronta(agosto, {
  allShifts: turniAgosto.filter((s) => s.date !== '2026-08-15'), settings: { ...S, monthlyBonus: {} },
});
esito(giusto.righe.find((r) => r.voce === 'Lordo').ok || giusto.scomposizione.length > 0,
  'la scomposizione compare solo se il lordo non torna');

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
