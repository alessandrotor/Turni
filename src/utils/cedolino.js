// Lettura dei cedolini PDF, senza dipendenze e senza rete.
//
// PERCHE' UN LETTORE FATTO IN CASA
// I cedolini sono documenti personali: nome, codice fiscale, indirizzo di casa,
// datore di lavoro e retribuzione, tutto sulla stessa pagina. Non passano da
// nessun servizio esterno — niente OCR in rete, niente AI. Restano sul
// dispositivo di chi li possiede.
//
// UN LETTORE SOLO PER NODE E PER IL BROWSER
// Fino al 26/09/2026 viveva in `scripts/lib/cedolino.mjs` e leggeva con `fs` e
// `zlib`. Ora serve anche alla pagina «Confronta con la busta», dove il tester
// sceglie il PDF sul telefono: la logica è questa, e l'unica cosa che cambia è
// come si decomprime un flusso — `inflateSync` in Node, `DecompressionStream`
// nel browser. Chi chiama passa i BYTE e la funzione di decompressione; così la
// convalida con ancoraggio di `leggi-cedolini.mjs` prova anche il browser.
//
// COME SONO FATTI
// Li produce tutti lo stesso software di paghe (Zucchetti), per entrambi i
// datori e anche per la Certificazione Unica. Tre cose da sapere:
//
//  1. Il testo sta in flussi compressi con deflate.
//  2. I caratteri NON sono ASCII: il font e' CID a due byte, e l'indice del
//     glifo vale il codice ASCII meno 0x1D. Da qui `SCARTO_GLIFO`.
//  3. La posizione arriva dagli operatori Tm/Td/TD/T*, e senza di essa il
//     cedolino e' una collana di cifre senza etichette. Con essa si ricostruisce
//     la riga, che e' l'unita' che conta: «codice, voce, tariffa, quantita',
//     importo».
//
// Vanno letti SOLO i flussi di contenuto. I programmi dei font contengono byte
// che sembrano stringhe e numeri: senza il filtro finiscono nel testo estratto
// come rumore, ed e' esattamente cio' che e' successo al primo tentativo.

const SCARTO_GLIFO = 0x1d;

const ascii = (s) => Array.from(s, (c) => c.charCodeAt(0));
const STREAM = ascii('stream');
const ENDSTREAM = ascii('endstream');

function indiceDi(byte, cercato, da) {
  const primo = cercato[0];
  for (let i = da; i <= byte.length - cercato.length; i++) {
    if (byte[i] !== primo) continue;
    let k = 1;
    while (k < cercato.length && byte[i + k] === cercato[k]) k++;
    if (k === cercato.length) return i;
  }
  return -1;
}

/** I flussi del PDF, ancora compressi, come viste sui byte originali. */
export function flussiCompressi(byte) {
  const out = [];
  let i = 0;
  for (;;) {
    const s = indiceDi(byte, STREAM, i);
    if (s < 0) break;
    let p = s + 6;
    if (byte[p] === 0x0d) p++;
    if (byte[p] === 0x0a) p++;
    const e = indiceDi(byte, ENDSTREAM, p);
    if (e < 0) break;
    out.push(byte.subarray(p, e));
    i = e + 9;
  }
  return out;
}

/**
 * Da byte a stringa un carattere per byte (latin1 VERO). Non `TextDecoder`:
 * la sua «latin1» è in realtà windows-1252, che rimappa 0x80–0x9F, e i glifi
 * CID in quell'intervallo diventerebbero altri caratteri.
 */
export function comeLatin1(byte) {
  let s = '';
  for (let i = 0; i < byte.length; i += 8192) {
    s += String.fromCharCode.apply(null, byte.subarray(i, i + 8192));
  }
  return s;
}

/** Tiene i soli flussi che disegnano testo. */
export function soloContenuto(testi) {
  return testi.filter((f) => f && f.includes('BT') && (f.includes('Tj') || f.includes('TJ')));
}

/** Da byte CID a testo leggibile. Fuori intervallo si scarta: sono glifi non testuali. */
function daCid(bytes) {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const cid = (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1);
    if (cid >= 0x03 && cid <= 0x61) s += String.fromCharCode(cid + SCARTO_GLIFO);
  }
  return s;
}

/** Numeri, stringhe e operatori di un flusso di contenuto. */
function* token(t) {
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') { i++; continue; }
    if (c === '(') {
      let liv = 1, j = i + 1, out = '';
      while (j < t.length) {
        const d = t[j];
        if (d === '\\') { out += t[j + 1]; j += 2; continue; }
        if (d === '(') liv++;
        if (d === ')') { liv--; if (!liv) { j++; break; } }
        out += d; j++;
      }
      yield { tipo: 'str', v: out }; i = j; continue;
    }
    if (c === '<' && t[i + 1] !== '<') {
      const e = t.indexOf('>', i);
      const hex = t.slice(i + 1, e).replace(/\s/g, '');
      let out = '';
      for (let k = 0; k + 1 < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.substr(k, 2), 16));
      yield { tipo: 'str', v: out }; i = e + 1; continue;
    }
    if (/[\d.-]/.test(c)) {
      const m = /^-?\d*\.?\d+/.exec(t.slice(i, i + 24));
      if (m) { yield { tipo: 'num', v: parseFloat(m[0]) }; i += m[0].length; continue; }
    }
    const o = /^[A-Za-z'"*]+/.exec(t.slice(i, i + 12));
    if (o) { yield { tipo: 'op', v: o[0] }; i += o[0].length; continue; }
    i++;
  }
}

/** Frammenti di testo con la loro posizione sulla pagina. */
export function pezziDaFlussi(flussi) {
  const pezzi = [];
  for (const flusso of soloContenuto(flussi)) {
    let x = 0, y = 0, rigaX = 0, rigaY = 0, interlinea = 0;
    let pila = [];
    for (const tk of token(flusso)) {
      if (tk.tipo !== 'op') { pila.push(tk); continue; }
      const n = pila.filter((p) => p.tipo === 'num').map((p) => p.v);
      const s = pila.filter((p) => p.tipo === 'str').map((p) => p.v);
      switch (tk.v) {
        case 'BT': x = y = rigaX = rigaY = 0; break;
        case 'Tm': if (n.length >= 6) { x = rigaX = n[4]; y = rigaY = n[5]; } break;
        case 'Td': if (n.length >= 2) { x = rigaX = rigaX + n[0]; y = rigaY = rigaY + n[1]; } break;
        case 'TD': if (n.length >= 2) { interlinea = -n[1]; x = rigaX = rigaX + n[0]; y = rigaY = rigaY + n[1]; } break;
        case 'TL': if (n.length >= 1) interlinea = n[0]; break;
        case 'T*': y = rigaY = rigaY - interlinea; x = rigaX; break;
        case "'": case '"': {
          y = rigaY = rigaY - interlinea; x = rigaX;
          const d = daCid(s.join(''));
          if (d.trim()) pezzi.push({ x, y, t: d });
          break;
        }
        case 'Tj': case 'TJ': {
          const d = daCid(s.join(''));
          if (d.trim()) pezzi.push({ x, y, t: d });
          break;
        }
        default: break;
      }
      pila = [];
    }
  }
  return pezzi;
}

/**
 * Le righe del documento, dall'alto in basso, ognuna coi suoi frammenti da
 * sinistra a destra. La tolleranza assorbe il fatto che frammenti della stessa
 * riga possono avere y leggermente diverse.
 */
export function righeDaFlussi(flussi, tolleranza = 2.5) {
  const pezzi = pezziDaFlussi(flussi).sort((a, b) => b.y - a.y || a.x - b.x);
  const gruppi = [];
  for (const p of pezzi) {
    const u = gruppi[gruppi.length - 1];
    if (u && Math.abs(u.y - p.y) <= tolleranza) u.pezzi.push(p);
    else gruppi.push({ y: p.y, pezzi: [p] });
  }
  return gruppi.map((g) => {
    const ord = g.pezzi.sort((a, b) => a.x - b.x);
    return {
      y: Math.round(g.y * 10) / 10,
      pezzi: ord,
      testo: ord.map((p) => p.t).join('  ').replace(/\s+/g, ' ').trim(),
    };
  });
}

/**
 * Le righe di un PDF, dai suoi byte. `inflate(byte)` restituisce i byte
 * decompressi (anche come Promise) oppure lancia se il flusso non è deflate:
 * quei flussi non servono e si saltano.
 */
export async function righeDaByte(byte, inflate) {
  const testi = await Promise.all(flussiCompressi(byte).map(async (f) => {
    try { return comeLatin1(await inflate(f)); } catch { return null; }
  }));
  return righeDaFlussi(testi.filter(Boolean));
}

/**
 * Decompressione deflate nel browser, senza librerie.
 *
 * TOLLERANTE COME ZLIB, ed è la differenza che conta. Fra la fine del deflate e
 * `endstream` il PDF lascia un ritorno a capo: `inflateSync` lo ignora,
 * `DecompressionStream` rifiuta TUTTO il flusso («Trailing junk found after the
 * end of the compressed stream»). Il primo giro leggeva zero flussi su undici e
 * restituiva un cedolino vuoto. Quindi: via gli a capo in coda, e se l'errore
 * arriva dopo che il testo è già uscito, si tiene il testo.
 * → check-verifica-busta.mjs, che confronta questa strada con quella di Node.
 */
export async function inflateBrowser(byte) {
  let fine = byte.length;
  while (fine > 0 && (byte[fine - 1] === 0x0a || byte[fine - 1] === 0x0d || byte[fine - 1] === 0x20)) fine--;
  const ds = new DecompressionStream('deflate');
  const scrittore = ds.writable.getWriter();
  scrittore.write(byte.subarray(0, fine)).catch(() => {});
  scrittore.close().catch(() => {});
  const lettore = ds.readable.getReader();
  const parti = [];
  try {
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      parti.push(value);
    }
  } catch (e) {
    if (!parti.length) throw e;
  }
  const out = new Uint8Array(parti.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of parti) { out.set(p, k); k += p.length; }
  return out;
}

/** «1.057,72» → 1057.72. Restituisce null se non e' un numero italiano. */
export function numeroIt(s) {
  if (typeof s !== 'string') return null;
  const m = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.exec(s.trim());
  if (!m) return null;
  return parseFloat(s.trim().replace(/\./g, '').replace(',', '.'));
}

/** Tutti i numeri di una riga, nell'ordine in cui compaiono. */
export function numeriDi(testo) {
  return (testo.match(/-?\d{1,3}(?:\.\d{3})*,\d+|(?<![\d.,])\d+,\d+/g) || []).map(numeroIt).filter((n) => n !== null);
}
