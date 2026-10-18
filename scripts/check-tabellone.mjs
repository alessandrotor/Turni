// RISCONTRO: il tabellone letto da un'immagine diventa turni veri o niente, e
// l'immagine non esce dal telefono.
//
//   node scripts/check-tabellone.mjs
//
// DA DOVE VIENE. Due settimane vere di un tabellone Excel (ottobre 2026), lette
// cella per cella con Tesseract: 183 turni giusti su 184. Le celle qui sotto
// sono quello che il lettore ha restituito DAVVERO su quelle immagini, rumore
// compreso («. .», «4», «1»), con i nomi delle persone sostituiti: è la parte
// del percorso che si può verificare senza browser e senza lettore
// (utils/tabellone.js). Il lettore stesso (services/lettore-immagine.js) si
// verifica qui solo per dove va a prendere i suoi file.
//
// Le regole che tiene:
//  - un orario letto male non diventa un turno inventato («1» «1» non è
//    01:00–01:00);
//  - la settimana non si sposta per un giorno letto male (il lettore ha
//    scritto «15-ott» sopra il 19);
//  - il nome noto ritrova la sua riga, e GIULIA non è GIULIA SALERNO;
//  - Tesseract e il suo modello vengono dal sito (/ocr), mai da un CDN, e non
//    finiscono nel precache di chi non li usa.
import { readFileSync, existsSync } from 'node:fs';
import {
  trovaGriglia, fasce, colonne, ritaglio, orarioDaCella, persone, trovaPersona, dateDaIntestazione, testoDaRighe,
} from '../src/utils/tabellone.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio && !ok ? '  — ' + dettaglio : ''}`);
};
const oggi = new Date(2026, 9, 17);

console.log('\nCelle\n');
const casi = { '9,50': '09:30', '16,5': '16:30', '6': '06:00', '22.50': '22:30', '15': '15:00', 'X': null, 'xX': null, '': null, '. .': null, '24,50': null, 'cassa': null };
const sbagliate = Object.entries(casi).filter(([t, v]) => orarioDaCella(t) !== v).map(([t]) => `«${t}» → ${orarioDaCella(t)}`);
esito(!sbagliate.length, 'orari decimali, riposo e rumore', sbagliate.join(', '));

console.log('\nUna persona, due settimane vere\n');
// 12–18 ottobre: tre righe (turni, secondi turni, riga vuota della persona dopo).
const date12 = dateDaIntestazione(['LUNEDI\n12-0tt', 'MARTEDI\n13-0tt', 'MERCOLEDI\n14-0tt', 'GIOVEDI\n15-ott', 'VENERDI\n16-0tt', 'SABATO\n17-ott', 'DOMENICA\n18-ott'], oggi);
const sett12 = testoDaRighe([
  ['X', 'X', '16,50', '22,50', '12,00', '16,50', 'X', 'X', '6,00', '11,00', '12,00', '18,00', '10,50', '16,50'],
  ['.', '. .', '4', '.', '17,00', '22.50', '1', '', '', '', '18,50', '22,50', '.', 'X'],
  ['', '', '', '', '.', '', '.', '', '.', '', '.', '', '', ''],
], date12);
esito(sett12 === ['13/10 16:30-22:30', '14/10 12:00-16:30', '14/10 17:00-22:30', '16/10 06:00-11:00', '17/10 12:00-18:00', '17/10 18:30-22:30', '18/10 10:30-16:30'].join('\n'),
  'turni spezzati nello stesso giorno, rumore scartato', sett12.replace(/\n/g, ' | '));
// 19–25 ottobre: il lunedì letto «15-ott», un giorno «22-01», e «1» «1» sotto il venerdì.
const date19 = dateDaIntestazione(['LUNED!\n15-ott', 'MARTED]\n20-0tt', 'MERCOLEDI\n21-ott', 'GIOVEDI\n22-01', 'VENERDI\n23-ott', 'SABATO\n24-ott', 'DOMENICA\n25-ott'], oggi);
const sett19 = testoDaRighe([
  ['16,50', '22,50', 'X', 'X', '16,50', '22,50', '16,50', '22,50', '16,50', '22,50', 'X', 'xX', '16,50', '22,50'],
  ['', '', '.', '.', '', '7', '', '.', '', '', '1', '1', '', ''],
], date19);
esito(sett19 === ['19/10 16:30-22:30', '21/10 16:30-22:30', '22/10 16:30-22:30', '23/10 16:30-22:30', '25/10 16:30-22:30'].join('\n'),
  'la settimana la decide la maggioranza dei giorni, «1»–«1» non è un turno', sett19.replace(/\n/g, ' | '));
const capodanno = dateDaIntestazione(['', '', '29-dic', '', '', '', ''], new Date(2027, 0, 2));
esito(capodanno && capodanno[0].getFullYear() === 2026 && capodanno[0].getDate() === 27,
  'a gennaio, «29-dic» è dell\'anno prima', String(capodanno?.[0]));
esito(dateDaIntestazione(['LUNEDI', '', '', '', '', '', ''], oggi) === null && testoDaRighe([['8', '14', ...new Array(12).fill('')]], null) === 'Lun 08:00-14:00',
  'senza date leggibili, i nomi dei giorni (le date le chiede l\'anteprima)');

console.log('\nNomi\n');
// La seconda riga di ogni persona ha solo le ore del contratto: non è una persona.
const elenco = persone(['ROSSI', '40', 'BIANCHI', '24', '', 'GIULIA SALERNO', '24', 'VERDI', '24', 'GIULIA', '24', '24,00']);
esito(elenco.map((p) => `${p.nome}:${p.fasce.join(',')}`).join(' ') === 'ROSSI:0,1 BIANCHI:2,3,4 GIULIA SALERNO:5,6 VERDI:7,8 GIULIA:9,10,11',
  'una riga col nome apre una persona, le altre la continuano', JSON.stringify(elenco));
esito(trovaPersona(elenco, 'Giulia')?.nome === 'GIULIA' && trovaPersona(elenco, 'giulia salerno')?.nome === 'GIULIA SALERNO',
  'GIULIA non è GIULIA SALERNO');
esito(trovaPersona(persone(['CHARUE', 'JULIA']), 'Charlie')?.nome === 'CHARUE' && trovaPersona(persone(['JULIA']), 'Giulia') === null && trovaPersona(elenco, 'Bianchl')?.nome === 'BIANCHI' && trovaPersona(elenco, 'Neri') === null && trovaPersona(elenco, '') === null,
  'una lettera letta male si perdona, un nome che non c\'è no');

console.log('\nGriglia\n');
// Un tabellone disegnato: 17 linee verticali (nome, ore, 7 giorni × 2), linee
// orizzontali con una doppia fra le persone, e macchie di «testo» nelle celle.
const W = 900, H = 300, g = new Uint8Array(W * H).fill(235);
const vx = [5, 120, 170]; for (let c = 1; c <= 14; c++) vx.push(170 + c * 50);
const hy = [4, 40, 70, 100, 104, 134, 164, 168, 198, 228, 290];
for (const x of vx) for (let y = 0; y < H; y++) g[y * W + x] = 40;
for (const y of hy) for (let x = 0; x < W; x++) g[y * W + x] = 40;
for (let x = 190; x < 205; x++) for (let y = 50; y < 60; y++) g[y * W + x] = 30;
const gr = trovaGriglia(g, W, H);
esito(JSON.stringify(gr.hy) === JSON.stringify(hy) && JSON.stringify(gr.vx) === JSON.stringify([...vx, W - 1]),
  'linee trovate, testo ignorato, bordo destro aggiunto', JSON.stringify(gr));
const f = fasce(gr.hy);
esito(f.length === 8 && !f.some(([a, b]) => b - a < 8), 'le doppie linee fra le persone non sono righe', JSON.stringify(f));
const col = colonne(gr.vx);
esito(col && col.giorni.length === 14 && col.nome[0] === 5 && col.giorni[0][0] === 170, 'nome a sinistra, quattordici celle di giorni', JSON.stringify(col));
esito(colonne([0, 100, 200]) === null, 'una tabella con un\'altra forma non si legge a caso');
const cella = ritaglio(g, W, [170, 220], [40, 70]);
esito(!cella.vuota && cella.dati.every((v) => v === 0 || v === 255) && ritaglio(g, W, [270, 320], [134, 164]).vuota,
  'la cella esce in bianco e nero, e una cella bianca si salta');

console.log('\nIl lettore resta sul telefono\n');
const lettore = readFileSync('src/services/lettore-immagine.js', 'utf8');
const vite = readFileSync('vite.config.js', 'utf8');
esito(!/https?:\/\//.test(lettore.replace(/^\s*\/\/.*$/gm, '')) && /workerBlobURL:\s*false/.test(lettore)
  && /workerPath: `\$\{OCR\}\//.test(lettore) && /corePath: OCR/.test(lettore) && /langPath: OCR/.test(lettore) && /const OCR = '\/ocr'/.test(lettore),
  'worker, motore e modello dal sito (/ocr), nessun indirizzo esterno');
const copiati = [...vite.matchAll(/'([\w.-]+)': 'node_modules\//g)].map((m) => m[1]);
esito(['worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js', 'eng.traineddata.gz'].every((n) => copiati.includes(n)),
  'la build copia in /ocr tutto quello che il lettore chiede', copiati.join(', '));
esito(/globIgnores:\s*\['ocr\/\*\*'\]/.test(vite), 'il lettore non entra nel precache: lo scarica solo chi lo usa');
const csp = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: (.*)/)?.[1] || '';
esito(/script-src 'self' 'wasm-unsafe-eval'/.test(csp) && !/script-src[^;]*'unsafe-eval'/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp),
  'la CSP apre il WebAssembly e nient\'altro');
if (existsSync('dist/sw.js')) {
  esito(!readFileSync('dist/sw.js', 'utf8').includes('ocr/') && existsSync('dist/ocr/eng.traineddata.gz'),
    'nel pacchetto: /ocr c\'è, il precache non lo contiene');
}

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nIl tabellone si legge sul telefono, e non inventa turni.\n');
process.exit(falliti ? 1 : 0);
