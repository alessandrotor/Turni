// L'anteprima del link condiviso in chat, riscontrata sul PACCHETTO:
//
//   npm run build && node scripts/check-anteprima-link.mjs
//
// PERCHÉ ESISTE
// L'immagine e i meta tag sono stati fatti il 17 agosto 2026. Sono comparsi in
// produzione il 31, cioè due settimane dopo, e nel frattempo ogni link
// condiviso su WhatsApp è uscito come una riga blu anonima — il modo più veloce
// per farlo scambiare per spam, che è esattamente ciò che quel lavoro doveva
// impedire.
//
// Non era rotto niente: vivevano su `experimental` e la produzione si
// distribuisce a mano. Nessuno se n'è accorto perché non c'era niente che
// guardasse, ed è lo stesso difetto dell'incidente del 18 agosto sul worker
// (vedi RILASCIO.md): si legge il repository e si dà per online.
//
// Questo controlla il pacchetto costruito — cioè quello che verrà distribuito —
// e in più i valori che si possono sbagliare in silenzio: un URL relativo (i
// crawler non lo risolvono), dimensioni dichiarate diverse da quelle vere,
// un'immagine troppo pesante per essere scaricata dai client.
//
// COSA NON PUÒ FARE: dire se il sito ONLINE ha già questi tag. Quella è la
// domanda 6 di RILASCIO.md, e si risponde con curl sul sito vero:
//   curl -s https://turni-9vr.pages.dev/ | grep -c 'og:image'

import { readFileSync, existsSync } from 'node:fs';

const HTML = 'dist/index.html';
const IMMAGINE = 'dist/og-image.png';

// Limite prudente: i client di chat scaricano l'anteprima su rete mobile e
// sopra qualche centinaio di kB molti rinunciano e mostrano il link nudo.
const PESO_MASSIMO = 300 * 1024;

if (!existsSync(HTML)) {
  console.log('· salto: manca `dist/` — lancia prima `npm run build`');
  process.exit(0);
}

const html = readFileSync(HTML, 'utf8');
const meta = (prop) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i');
  return (html.match(re) || [])[1] || null;
};

let problemi = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) problemi += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

console.log('\nAnteprima del link nel pacchetto\n');

for (const prop of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
  esito(!!meta(prop), prop, meta(prop) ? '' : 'assente');
}

// L'URL ASSOLUTO è la trappola principale: un percorso relativo funziona nel
// browser e non funziona in nessun crawler, quindi si sbaglia senza accorgersene.
const src = meta('og:image');
esito(!!src && /^https:\/\//.test(src), 'og:image è un URL assoluto https', src || '');
esito(!/__SITE_URL__/.test(html), 'il segnaposto dell\'origine è stato sostituito',
  /__SITE_URL__/.test(html) ? 'build fatta senza il plugin: i crawler vedranno un URL finto' : '');

// IL CONTROLLO CHE MANCAVA, ed è quello che ha lasciato passare il difetto:
// l'immagine deve stare sullo STESSO sito della pagina. Con un indirizzo scritto
// a mano, il sito di prova dichiarava l'immagine ospitata in produzione — dove
// per due settimane rispondeva 404, perché la produzione non era aggiornata.
// Nessun controllo se ne accorgeva, perché entrambe le cose erano «giuste» prese
// da sole: l'URL era assoluto, e l'immagine esisteva nel pacchetto.
const pagina = meta('og:url');
const host = (u) => { try { return new URL(u).origin; } catch { return null; } };
esito(!!pagina && !!src && host(pagina) === host(src),
  'og:image è ospitata sullo stesso sito della pagina',
  `pagina ${host(pagina) || '?'} · immagine ${host(src) || '?'}`);

// Le dimensioni dichiarate devono essere quelle vere: se non combaciano, i
// client ritagliano o rifiutano l'anteprima grande.
if (existsSync(IMMAGINE)) {
  const b = readFileSync(IMMAGINE);
  const larghezza = b.readUInt32BE(16);
  const altezza = b.readUInt32BE(20);
  esito(true, 'og-image.png è nel pacchetto', `${larghezza}×${altezza}, ${Math.round(b.length / 1024)} kB`);
  esito(String(larghezza) === meta('og:image:width'), 'og:image:width combacia col file',
    `dichiarata ${meta('og:image:width')}, vera ${larghezza}`);
  esito(String(altezza) === meta('og:image:height'), 'og:image:height combacia col file',
    `dichiarata ${meta('og:image:height')}, vera ${altezza}`);
  esito(b.length <= PESO_MASSIMO, 'peso sotto il limite dei client di chat',
    `${Math.round(b.length / 1024)} kB su ${PESO_MASSIMO / 1024} kB`);
  // 1,91:1 è il rapporto che i client usano per l'anteprima GRANDE. Fuori da
  // lì l'immagine viene ritagliata o degradata a miniatura quadrata.
  const rapporto = larghezza / altezza;
  esito(rapporto > 1.7 && rapporto < 2.1, 'rapporto adatto all\'anteprima grande',
    `${rapporto.toFixed(2)}:1 (ideale 1,91:1)`);
} else {
  esito(false, 'og-image.png è nel pacchetto', 'assente da dist/');
}

console.log(`\n${problemi === 0 ? '✓ l\'anteprima è completa nel pacchetto' : problemi + ' problema/i'}\n`);
process.exit(problemi > 0 ? 1 : 0);
