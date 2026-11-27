// Il tabellone da un'immagine, letto SUL TELEFONO (prova). Il lettore è Tesseract in WebAssembly,
// scaricato la prima volta (~4,5 MB) DAL SITO DI TURNI (`/ocr`, copiato dalla build: vite.config.js),
// mai da un CDN, così immagine e nomi non escono dal telefono. `workerBlobURL: false`: il worker è
// un file del sito e la CSP non deve aprire `blob:`. La parte verificabile senza browser sta in
// utils/tabellone.js.

import {
  trovaGriglia, fasce, colonne, ritaglio, persone, trovaPersona, dateDaIntestazione, lunediVotato, testoDaRighe,
  coppieDaParole, colonneDaCoppie, celleDellaFascia, contrasto, testoDaFascia,
} from '../utils/tabellone';

const OCR = '/ocr';
const LARGHEZZA_MAX = 2000; // una foto da 16 MP intera occupa 64 MB solo per stare in memoria

// DUE lettori: le celle si leggono in parallelo (un telefono ha 8 core), e il
// tempo che conta è quello di chi aspetta. Si avviano appena si tocca «📷»
// (`preparaLettore`), mentre si sceglie l'immagine nella galleria: è il pezzo
// più lento sul telefono, e così non lo vede nessuno.
const QUANTI = 2;
let lettori = null;

function avviaLettori() {
  if (!lettori) {
    lettori = (async () => {
      const { createWorker } = await import('tesseract.js');
      const uno = () => createWorker('eng', 1, {
        workerPath: `${OCR}/worker.min.js`, corePath: OCR, langPath: OCR, workerBlobURL: false, gzip: true,
      }, { load_system_dawg: '0', load_freq_dawg: '0' });
      return Promise.all(Array.from({ length: QUANTI }, uno));
    })();
    lettori.catch(() => { lettori = null; });
  }
  return lettori;
}
const avviaLettore = async () => (await avviaLettori())[0];

export function preparaLettore() {
  avviaLettori().catch(() => {});
}

// Legge tanti ritagli insieme, con gli stessi parametri, dividendoli fra i lettori.
async function leggiTutti(ritagli, psm, lista) {
  const ws = await avviaLettori();
  await Promise.all(ws.map((w) => w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: lista })));
  const testi = new Array(ritagli.length).fill('');
  let prossimo = 0;
  await Promise.all(ws.map(async (w) => {
    while (prossimo < ritagli.length) {
      const i = prossimo++;
      if (!ritagli[i].vuota) testi[i] = (await w.recognize(tela(ritagli[i]))).data.text.trim();
    }
  }));
  return testi;
}

async function grigiDa(file) {
  const bmp = await createImageBitmap(file);
  const scala = Math.min(1, LARGHEZZA_MAX / bmp.width);
  const W = Math.round(bmp.width * scala), H = Math.round(bmp.height * scala);
  const tela = document.createElement('canvas');
  tela.width = W; tela.height = H;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  // Rimpicciolire bene conta: con la qualità di default i «:» e le cifre
  // sottili di una foto da 16 MP si perdevano (martedì letto «0»).
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close?.();
  const rgba = ctx.getImageData(0, 0, W, H).data;
  const grigi = new Uint8Array(W * H);
  for (let i = 0; i < grigi.length; i++) grigi[i] = (rgba[4 * i] * 299 + rgba[4 * i + 1] * 587 + rgba[4 * i + 2] * 114) / 1000;
  return { grigi, W, H, quadro: tela };
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

// Primo passo: griglia, date e nomi. `avanza(fase)` dice a che punto si è.
// Col nome già noto ci si ferma alla sua riga: i nomi sotto si leggono solo se
// si tocca «cambia» (`tuttiINomi`). Delle date bastano due giorni d'accordo.
/** @typedef {(fase: string) => void} Avanza */

/**
 * @param {File | Blob} file
 * @param {{ oggi: Date, nome?: string, avanza?: Avanza }} opzioni
 */
export async function apriTabellone(file, { oggi, nome, avanza = () => {} }) {
  avanza('scarico');
  await avviaLettori();
  avanza('nomi');
  const { grigi, W, H, quadro } = await grigiDa(file);
  const { hy, vx } = trovaGriglia(grigi, W, H);
  const col = colonne(vx);
  const [testa, ...righe] = fasce(hy);
  if (!col || !righe.length) return apriFoto(await avviaLettore(), grigi, W, H, avanza, quadro);

  const intestazione = [];
  for (let g = 0; g < 7 && (lunediVotato(intestazione, oggi)?.voti || 0) < 2; g += QUANTI) {
    const giorni = [g, g + 1].filter((d) => d < 7);
    intestazione.push(...await leggiTutti(giorni.map((d) => ritaglio(grigi, W, [col.giorni[2 * d][0], col.giorni[2 * d + 1][1]], testa)), '6', ''));
  }

  const tab = { grigi, W, col, righe, oggi, date: dateDaIntestazione(intestazione, oggi), nomi: [] };
  while (tab.nomi.length < righe.length) {
    const prossime = righe.slice(tab.nomi.length, tab.nomi.length + QUANTI);
    tab.nomi.push(...await leggiTutti(prossime.map((f) => ritaglio(grigi, W, col.nome, f)), '7', ''));
    const elenco = persone(tab.nomi);
    const io = trovaPersona(elenco, nome, 0.85);
    // Trovato, e già cominciata la persona dopo: le sue righe sono tutte qui.
    if (io && elenco.indexOf(io) < elenco.length - 1) return { ...tab, persone: elenco, io, completo: false };
  }
  return { ...tab, persone: persone(tab.nomi), completo: true };
}

// I nomi che mancano, per scegliere un'altra persona.
export async function tuttiINomi(tab) {
  if (tab.completo) return tab;
  const resto = await leggiTutti(tab.righe.slice(tab.nomi.length).map((f) => ritaglio(tab.grigi, tab.W, tab.col.nome, f)), '7', '');
  const nomi = [...tab.nomi, ...resto];
  return { ...tab, nomi, persone: persone(nomi), completo: true };
}

// Secondo passo: le righe di UNA persona, solo quelle. I turni dei colleghi
// non vengono nemmeno letti.
/**
 * @param {any} tabellone
 * @param {any} persona
 * @param {{ avanza?: Avanza }} [opzioni]
 */
export async function turniDi(tabellone, persona, { avanza = () => {} } = {}) {
  avanza('turni');
  const { grigi, W, col, righe, date } = tabellone;
  const ritagli = persona.fasce.flatMap((i) => col.giorni.map((c) => ritaglio(grigi, W, c, righe[i])));
  const testi = await leggiTutti(ritagli, '7', '0123456789,.Xx');
  // Una lettera sola («X») con l'elenco largo spesso non esce: seconda prova,
  // solo sulle celle scritte e non lette.
  const rilettura = testi.map((t, i) => (!t && !ritagli[i].vuota ? i : -1)).filter((i) => i >= 0);
  if (rilettura.length) {
    const seconde = await leggiTutti(rilettura.map((i) => ritagli[i]), '10', '0123456789Xx');
    rilettura.forEach((i, k) => { testi[i] = seconde[k]; });
  }
  const celle = persona.fasce.map((_, r) => testi.slice(r * 14, r * 14 + 14));
  return testoDaRighe(celle, date);
}

// Una FOTO, senza griglia da trovare: si leggono gli orari di tutta
// l'immagine solo per capire dove stanno le colonne. La riga la sceglie chi
// usa l'app, col righello (components/Righello.jsx).
// L'anteprima del righello è la STESSA immagine che il lettore ha letto, già
// rimpicciolita, come data URL. Mostrare il file originale con un blob URL su
// un Pixel 8a dava l'immagine rotta (ottobre 2026) — una foto da 12-50 MP da
// decodificare una seconda volta, coi due lettori ancora in memoria. Così la
// fascia sta anche sulle stesse coordinate dei conti.
async function apriFoto(w, grigi, W, H, avanza, quadro) {
  avanza('colonne');
  await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '0123456789: ' });
  const { data } = await w.recognize(tela({ ...contrasto(grigi), w: W, h: H }), {}, { blocks: true });
  const parole = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
    .map((p) => ({ testo: p.text, x0: p.bbox.x0 - 20, x1: p.bbox.x1 - 20, y0: p.bbox.y0 - 20, y1: p.bbox.y1 - 20 }));
  const colonneX = colonneDaCoppie(coppieDaParole(parole), W);
  if (colonneX.length < 2) return { errore: 'formato' };
  return { foto: true, grigi, W, H, colonneX, anteprima: quadro.toDataURL('image/jpeg', 0.8) };
}

// La fascia del righello, `{ y0, y1, gradi }` in pixel dell'immagine letta.
// `primo` è il giorno della prima colonna (0 = lunedì).
/**
 * @param {any} foto
 * @param {any} fascia
 * @param {number} primo
 * @param {{ avanza?: Avanza }} [opzioni]
 */
export async function turniDellaFascia(foto, fascia, primo, { avanza = () => {} } = {}) {
  avanza('turni');
  const w = await avviaLettore();
  await w.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '0123456789: ' });
  const testi = [];
  for (const c of celleDellaFascia(foto.grigi, foto.W, foto.H, fascia, foto.colonneX)) {
    testi.push(c.vuota ? '' : (await w.recognize(tela(c))).data.text);
  }
  return testoDaFascia(testi, primo);
}
