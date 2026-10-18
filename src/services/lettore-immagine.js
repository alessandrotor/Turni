// Il tabellone da un'immagine, letto SUL TELEFONO (prova).
//
// Il lettore di caratteri è Tesseract, compilato in WebAssembly. Si scarica la
// prima volta che serve, ~4,5 MB, e DAL SITO DI TURNI (`/ocr`, copiato lì dalla
// build: vite.config.js), mai da un CDN: l'immagine e i nomi non escono dal
// telefono, e nemmeno la richiesta di sapere che li si sta leggendo. Per lo
// stesso motivo `workerBlobURL: false`: il worker è un file del sito, e la CSP
// non deve aprire `blob:` agli script.
//
// La parte che si può verificare senza browser sta in utils/tabellone.js.

import {
  trovaGriglia, fasce, colonne, ritaglio, persone, dateDaIntestazione, testoDaRighe,
} from '../utils/tabellone';

const OCR = '/ocr';
const LARGHEZZA_MAX = 2000; // una foto da 16 MP intera occupa 64 MB solo per stare in memoria

let lettore = null;

async function avviaLettore() {
  if (!lettore) {
    lettore = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        workerPath: `${OCR}/worker.min.js`, corePath: OCR, langPath: OCR, workerBlobURL: false, gzip: true,
      }, { load_system_dawg: '0', load_freq_dawg: '0' });
    })();
    lettore.catch(() => { lettore = null; });
  }
  return lettore;
}

async function grigiDa(file) {
  const bmp = await createImageBitmap(file);
  const scala = Math.min(1, LARGHEZZA_MAX / bmp.width);
  const W = Math.round(bmp.width * scala), H = Math.round(bmp.height * scala);
  const tela = document.createElement('canvas');
  tela.width = W; tela.height = H;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close?.();
  const rgba = ctx.getImageData(0, 0, W, H).data;
  const grigi = new Uint8Array(W * H);
  for (let i = 0; i < grigi.length; i++) grigi[i] = (rgba[4 * i] * 299 + rgba[4 * i + 1] * 587 + rgba[4 * i + 2] * 114) / 1000;
  return { grigi, W, H };
}

// La cella (già alta 60 px e in bianco e nero: utils/tabellone.js) con un
// bordo bianco attorno, come il lettore la vuole.
function tela(r) {
  const out = document.createElement('canvas');
  out.width = r.w + 40; out.height = r.h + 40;
  const c = out.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height);
  const img = c.createImageData(r.w, r.h);
  for (let i = 0; i < r.dati.length; i++) { const v = r.dati[i]; img.data.set([v, v, v, 255], 4 * i); }
  c.putImageData(img, 20, 20);
  return out;
}

async function leggi(w, r, psm, lista) {
  if (r.vuota) return '';
  await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: lista });
  return (await w.recognize(tela(r))).data.text.trim();
}

// Primo passo: griglia, date e nomi. `avanza(fase)` dice a che punto si è.
export async function apriTabellone(file, { oggi, avanza = () => {} }) {
  avanza('scarico');
  const w = await avviaLettore();
  avanza('nomi');
  const { grigi, W, H } = await grigiDa(file);
  const { hy, vx } = trovaGriglia(grigi, W, H);
  const col = colonne(vx);
  const [testa, ...righe] = fasce(hy);
  if (!col || !righe.length) return { errore: 'formato' };
  const intestazione = [];
  for (let g = 0; g < 7; g++) {
    intestazione.push(await leggi(w, ritaglio(grigi, W, [col.giorni[2 * g][0], col.giorni[2 * g + 1][1]], testa), '6', ''));
  }
  const nomi = [];
  for (const f of righe) nomi.push(await leggi(w, ritaglio(grigi, W, col.nome, f), '7', ''));
  return { grigi, W, col, righe, date: dateDaIntestazione(intestazione, oggi), persone: persone(nomi) };
}

// Secondo passo: le righe di UNA persona, solo quelle. I turni dei colleghi
// non vengono nemmeno letti.
export async function turniDi(tabellone, persona, { avanza = () => {} } = {}) {
  avanza('turni');
  const w = await avviaLettore();
  const { grigi, W, col, righe, date } = tabellone;
  const celle = [];
  for (const i of persona.fasce) {
    const riga = [];
    for (const c of col.giorni) {
      const r = ritaglio(grigi, W, c, righe[i]);
      let t = await leggi(w, r, '7', '0123456789,.Xx');
      // Una lettera sola («X») con l'elenco largo spesso non esce: seconda prova.
      if (!t) t = await leggi(w, r, '10', '0123456789Xx');
      riga.push(t);
    }
    celle.push(riga);
  }
  return testoDaRighe(celle, date);
}

