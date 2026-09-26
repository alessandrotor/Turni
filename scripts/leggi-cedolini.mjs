// Da cedolini PDF a fixture per i riscontri:
//
//   node scripts/leggi-cedolini.mjs "<cartella dei PDF>"
//   BUSTE_DIR="<cartella>" node scripts/leggi-cedolini.mjs
//
// COSA PRODUCE
// Un file JSON per cedolino in `dati-buste/`, che e' IGNORATA DA GIT. Il
// repository e' pubblico: gli importi di una busta dicono quanto guadagna una
// persona, e tre anni di cedolini sono la sua storia retributiva. Le fixture
// sono derivate — si rigenerano da questo comando in qualunque momento — quindi
// non c'e' niente da conservare e niente da pubblicare.
//
// COSA NON FINISCE NELLE FIXTURE
// Non si toglie: si sceglie. Il documento contiene nome, codice fiscale, data
// di nascita, indirizzo di casa, IBAN e datore di lavoro; qui sotto c'e' un
// ELENCO di campi da prendere, e tutto cio' che non e' in elenco viene
// scartato. Una lista di cose da rimuovere si dimentica sempre qualcosa; una
// lista di cose da prendere no.
//
// LA CONVALIDA CHE RENDE AFFIDABILE IL RESTO
// Gira per prima e, se fallisce, non si scrive nessuna fixture: numeri letti
// male non devono propagarsi in silenzio dentro i riscontri.
//
// Sono due controlli di natura diversa, e servono entrambi.
//
//  1. ANCORAGGIO. Il cedolino di giugno 2026 e' gia' stato trascritto a mano in
//     `check-busta-giugno-2026.mjs`: quattordici valori presi dal cedolino
//     stampato. Il lettore deve riprodurli tutti. E' l'unico ancoraggio
//     disponibile — luglio 2026 e' una scansione, e le due buste «fiduciari»
//     sono di un'altra persona e non stanno in questa cartella.
//
//  2. COERENZA INTERNA, su OGNI cedolino. Un ancoraggio solo dice che il
//     lettore funziona su un documento; questi dicono che funziona su tutti:
//       - la somma delle competenze, arrotondata all'euro, deve dare la base
//         imponibile INPS stampata. Se il lettore salta una voce o ne conta una
//         due volte, questa non torna piu';
//       - base × aliquota IVS deve dare il contributo stampato.
//     Non sono controlli di comodo: sono le due identita' che un cedolino
//     rispetta sempre, e passarle per caso avendo letto male e' improbabile.

import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { righeDi } from './lib/cedolino.mjs';
import {
  leggiCedolinoDaRighe, voce, vociCome, somma, totaleCompetenze, totaleTrattenute, incoerenze,
} from '../src/utils/leggi-cedolino.js';

const USCITA = 'dati-buste';

// La lettura vera sta in `src/utils/leggi-cedolino.js`, condivisa con la pagina
// «Confronta con la busta» dell'app. Qui si aggiunge solo il nome del file, che
// serve all'indice delle fixture e che nel browser non entra mai.
export function leggiCedolino(percorso) {
  return { file: basename(percorso), ...leggiCedolinoDaRighe(righeDi(percorso)) };
}

export { voce, vociCome, somma, totaleCompetenze, totaleTrattenute, incoerenze };

// ── La convalida contro le trascrizioni a mano ─────────────────────────────

const ATTESI = {
  'Cedolino Giugno 26.pdf': {
    // Da check-busta-giugno-2026.mjs, che li ha presi dal cedolino stampato.
    'paga oraria': (f) => voce(f, 'Z00001')?.numeri[0],
    'retribuzione (103,20 h)': (f) => voce(f, 'Z00001')?.importo,
    'supplementare 30%': (f) => voce(f, 'Z30030')?.importo,
    '14ª mensilità': (f) => voce(f, 'Z50022')?.importo,
    'magg. festivo': (f) => voce(f, '000347')?.importo,
    'lavoro festivo ordinario': (f) => voce(f, '300021')?.importo,
    'imponibile IRPEF': (f) => voce(f, 'F02000')?.importo,
    'imponibile tass. autonoma': (f) => voce(f, 'F06000')?.importo,
    'detrazioni lav. dip.': (f) => voce(f, 'F02500')?.importo,
    'indennità L.207/24': (f) => voce(f, 'F02703')?.importo,
    'contributo IVS': (f) => voce(f, 'Z00000')?.importo,
    'netto del mese': (f) => f.netto,
    'part time %': (f) => f.contratto.partTimePct,
    'assunzione': (f) => f.contratto.assunzione,
  },
};

const VALORI = {
  'Cedolino Giugno 26.pdf': {
    'paga oraria': 9.21802,
    'retribuzione (103,20 h)': 951.30,
    'supplementare 30%': 338.53,
    '14ª mensilità': 475.65,
    'magg. festivo': 25.35,
    'lavoro festivo ordinario': 126.75,
    'imponibile IRPEF': 1420.55,
    'imponibile tass. autonoma': 429.10,
    'detrazioni lav. dip.': 239.19,
    'indennità L.207/24': 88.78,
    'contributo IVS': 188.21,
    'netto del mese': 2221.41,
    'part time %': 60,
    'assunzione': '2025-12-29',
  },
};


function convalida(cartella) {
  let falliti = 0, provati = 0;
  console.log('\nConvalida del lettore sui cedolini gia’ trascritti a mano\n');
  for (const [file, campi] of Object.entries(ATTESI)) {
    const p = trova(cartella, file);
    if (!p) { console.log(`  --  ${file}: non trovato nella cartella, salto`); continue; }
    const fx = leggiCedolino(p);
    console.log(`  ${file}`);
    for (const [nome, prendi] of Object.entries(campi)) {
      const avuto = prendi(fx);
      const atteso = VALORI[file][nome];
      const ok = typeof atteso === 'number'
        ? typeof avuto === 'number' && Math.abs(avuto - atteso) < 0.005
        : avuto === atteso;
      provati++;
      if (!ok) falliti++;
      console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${nome.padEnd(26)} atteso ${String(atteso).padStart(10)} → ${String(avuto).padStart(10)}`);
    }
  }
  return { falliti, provati };
}

function trova(cartella, nome) {
  for (const sotto of ['', ...readdirSync(cartella, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)]) {
    const p = join(cartella, sotto, nome);
    if (existsSync(p)) return p;
  }
  return null;
}

function tuttiIPdf(cartella) {
  const out = [];
  for (const v of readdirSync(cartella, { withFileTypes: true })) {
    const p = join(cartella, v.name);
    if (v.isDirectory()) out.push(...tuttiIPdf(p));
    else if (/\.pdf$/i.test(v.name)) out.push(p);
  }
  return out;
}

const slug = (s) => s.replace(/\.pdf$/i, '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Esecuzione ─────────────────────────────────────────────────────────────

const cartella = process.argv[2] || process.env.BUSTE_DIR;
if (!cartella) {
  console.error('\nManca la cartella dei cedolini.\n');
  console.error('  node scripts/leggi-cedolini.mjs "<cartella>"');
  console.error('  BUSTE_DIR="<cartella>" node scripts/leggi-cedolini.mjs\n');
  console.error('Il percorso non sta nel repository di proposito: e’ una cartella personale.\n');
  process.exit(2);
}
if (!existsSync(cartella)) {
  console.error(`\nCartella inesistente: ${cartella}\n`);
  process.exit(2);
}

const esito = convalida(cartella);
if (esito.falliti) {
  console.error(`\n${esito.falliti} valori su ${esito.provati} non tornano: il lettore sbaglia.`);
  console.error('Nessuna fixture scritta — sarebbero tutte inaffidabili.\n');
  process.exit(1);
}
console.log(`\n  ${esito.provati} valori riprodotti dai cedolini stampati.\n`);

mkdirSync(USCITA, { recursive: true });
const pdf = tuttiIPdf(cartella);
console.log(`Lettura di ${pdf.length} documenti\n`);

const indice = [];
let conAvvisi = 0, scansioni = 0, scritte = 0;
for (const p of pdf) {
  const fx = leggiCedolino(p);

  // Una scansione non e' un guasto: e' un documento senza strato di testo, e va
  // detto com'e' invece di finire fra i «documenti con avvisi».
  if (!fx.voci.length) {
    scansioni++;
    console.log(`  ~  ${'  —  '}  scansione senza testo   ${fx.file}`);
    indice.push({ file: fx.file, scansione: true });
    continue;
  }

  fx.avvisi.push(...incoerenze(fx));
  writeFileSync(join(USCITA, `${slug(fx.file)}.json`), JSON.stringify(fx, null, 1), 'utf8');
  scritte++;
  if (fx.avvisi.length) conAvvisi++;
  indice.push({ file: fx.file, slug: slug(fx.file), voci: fx.voci.length, periodo: fx.periodo, avvisi: fx.avvisi });
  const p1 = fx.periodo ? `${String(fx.periodo.mese).padStart(2, '0')}/${fx.periodo.anno}` : '   —   ';
  console.log(`  ${fx.avvisi.length ? '!' : ' '}  ${p1}  ${String(fx.voci.length).padStart(3)} voci  ${fx.file}`
    + (fx.avvisi.length ? `\n         ${fx.avvisi.join('\n         ')}` : ''));
}
writeFileSync(join(USCITA, '_indice.json'), JSON.stringify(indice, null, 1), 'utf8');

console.log(`\n${scritte} fixture in ${USCITA}/ (ignorata da git).`);
if (scansioni) console.log(`${scansioni} scansioni senza testo: servirebbe un OCR, e non lo facciamo in rete.`);
if (conAvvisi) console.log(`${conAvvisi} documenti con avvisi: vanno guardati prima di usarli.\n`);
else console.log('Nessun avviso: tutti coerenti.\n');
