// Leggere il tabellone dei turni da un'immagine, SUL TELEFONO: la parte pura. Qui non
// c'è né il browser né il lettore di caratteri (Tesseract, in services/lettore-immagine.js):
// solo i conti su una matrice di grigi e sul testo restituito, così si verificano in
// Node (→ scripts/check-tabellone.mjs).
//
// Il FORMATO è uno solo, il tabellone Excel: una colonna coi nomi, una con le ore, poi
// sette giorni da due celle (inizio, fine). Ogni persona occupa una o due righe (la
// seconda porta il secondo turno). Gli orari sono decimali («9,50» = 9:30), «X» è il
// riposo. Si legge CELLA PER CELLA: sulla tabella intera il lettore mescola colonne e righe.

// Linee della griglia: righe e colonne in cui la maggior parte dei pixel è
// più scura del vicinato. La soglia è LOCALE (rispetto alla media attorno), non
// assoluta: un'ombra o lo sfondo colorato di una cella non diventano linee.
export function trovaGriglia(grigi, W, H) {
  const media = sfocatura(grigi, W, H, 12);
  const scuro = (i) => grigi[i] < media[i] - 12 || grigi[i] < 90;
  const perRiga = new Float32Array(H);
  const perColonna = new Float32Array(W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (scuro(y * W + x)) { perRiga[y] += 1 / W; perColonna[x] += 1 / H; }
    }
  }
  const sopra = (v, quota) => { const max = Math.max(...v); return [...v.keys()].filter((i) => v[i] > max * quota); };
  const hy = raggruppa(sopra(perRiga, 0.55));
  const vx = raggruppa(sopra(perColonna, 0.45));
  // Il bordo destro spesso coincide col bordo dell'immagine e non si vede.
  if (vx.length && vx[vx.length - 1] < W - 20) vx.push(W - 1);
  return { hy, vx };
}

// Media su un quadrato di lato 2r+1, con l'immagine integrale: un passaggio solo.
function sfocatura(g, W, H, r) {
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let riga = 0;
    for (let x = 0; x < W; x++) { riga += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + riga; }
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const s = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
      out[y * W + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

// Pixel vicini (≤ 2) sono la stessa linea: se ne tiene il centro.
function raggruppa(indici) {
  const gruppi = [];
  for (const i of indici) {
    const u = gruppi[gruppi.length - 1];
    if (u && i - u[u.length - 1] <= 2) u.push(i); else gruppi.push([i]);
  }
  return gruppi.map((g) => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
}

// Le fasce fra due linee orizzontali. Le doppie linee che separano le persone
// lasciano fasce di pochi pixel: si scartano quelle sotto il 40% della tipica.
export function fasce(hy) {
  const salti = [];
  for (let i = 0; i < hy.length - 1; i++) salti.push([hy[i], hy[i + 1]]);
  const alte = salti.map(([a, b]) => b - a).filter((d) => d > 5).sort((a, b) => a - b);
  const tipica = alte[Math.floor(alte.length / 2)] || 0;
  return salti.filter(([a, b]) => b - a >= Math.max(8, tipica * 0.4));
}

// Le colonne del formato: nome, ore, poi quattordici celle di giorni contate
// da SINISTRA. A destra il tabellone spesso continua, tagliato, o finisce sul
// bordo dell'immagine: lì non si conta. null se la griglia non ha quella
// forma: meglio dirlo che leggere a caso.
export function colonne(vx) {
  if (vx.length - 1 < 16) return null;
  const giorni = [];
  for (let c = 2; c < 16; c++) giorni.push([vx[c], vx[c + 1]]);
  return { nome: [vx[0], vx[1]], giorni };
}

// Il ritaglio di una cella, pronto per il lettore: ingrandito a 60 px di altezza,
// POI in bianco e nero. L'ordine conta: la soglia sui pixel già ingranditi dà bordi
// puliti, quella prima lettere a gradini (le «R» e le «F» sparivano).
export const ALTEZZA_CELLA = 60;
/**
 * @param {number[]} xs  [x0, x1]
 * @param {number[]} ys  [y0, y1]
 */
export function ritaglio(grigi, W, /** @type {any} */ xs, /** @type {any} */ ys, margine = 2) {
  const [x0, x1] = xs, [y0, y1] = ys;
  const l = x0 + margine, t = y0 + margine;
  const w0 = Math.max(1, x1 - x0 - 2 * margine), h0 = Math.max(1, y1 - y0 - 2 * margine);
  const h = ALTEZZA_CELLA, w = Math.max(1, Math.round(w0 * h / h0));
  const out = new Uint8Array(w * h);
  const istogramma = new Uint32Array(256);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(h0 - 1, Math.max(0, (y + 0.5) * h0 / h - 0.5)), y1i = Math.floor(sy), fy = sy - y1i, y2i = Math.min(h0 - 1, y1i + 1);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w0 - 1, Math.max(0, (x + 0.5) * w0 / w - 0.5)), x1i = Math.floor(sx), fx = sx - x1i, x2i = Math.min(w0 - 1, x1i + 1);
      const p = (xx, yy) => grigi[(t + yy) * W + l + xx];
      const v = Math.round((p(x1i, y1i) * (1 - fx) + p(x2i, y1i) * fx) * (1 - fy) + (p(x1i, y2i) * (1 - fx) + p(x2i, y2i) * fx) * fy);
      out[y * w + x] = v; istogramma[v] += 1;
    }
  }
  // Il contrasto si stende fra l'1% e il 99% dei pixel: un resto di linea o
  // un pixel di rumore non decidono la soglia per tutta la cella.
  const quantile = (q) => { let n = 0; for (let v = 0; v < 256; v++) { n += istogramma[v]; if (n >= q * out.length) return v; } return 255; };
  const min = quantile(0.01), max = quantile(0.99);
  // Senza contrasto non c'è scritto niente: tutta bianca, non tutta nera.
  if (max - min < 40) return { dati: out.fill(255), w, h, vuota: true };
  const scala = 255 / (max - min);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) * scala < 150 ? 0 : 255;
  return { dati: out, w, h, vuota: !out.some((v) => v === 0) };
}

// «9,50» → 09:30, «16,5» → 16:30, «6» → 06:00. null per tutto il resto:
// riposo («X»), note, celle vuote o lette male. Mai un orario inventato.
export function orarioDaCella(testo) {
  const s = String(testo || '').replace(/[xX]/g, '').replace('.', ',').trim();
  const m = s.match(/^(\d{1,2})(?:,(\d{1,2}))?$/);
  if (!m) return null;
  const ore = Number(m[1]);
  const frazione = m[2] ? Number(`0.${m[2]}`) : 0;
  const minuti = Math.round(frazione * 60);
  if (ore > 24 || minuti >= 60 || (ore === 24 && minuti > 0)) return null;
  return `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
}

// Le persone: una fascia col nome (almeno tre lettere) ne apre una nuova, le
// fasce senza nome (la seconda riga, con le ore del contratto) la continuano.
export function persone(nomiPerFascia) {
  const elenco = [];
  nomiPerFascia.forEach((testo, i) => {
    const nome = String(testo || '').replace(/[^A-Za-zÀ-ÿ' ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3) elenco.push({ nome, fasce: [i] });
    else if (elenco.length) elenco[elenco.length - 1].fasce.push(i);
  });
  return elenco;
}

// Il nome già noto (Impostazioni, `workerName`) ritrovato fra quelli letti:
// uguale, o quasi (una lettera letta male). Fra «GIULIA» e «GIULIA SALERNO»
// vince l'uguale.
export function trovaPersona(elenco, nome, minimo = 0.7) {
  if (!nome) return null;
  const n = normalizza(nome);
  let migliore = null, punti = 0;
  for (const p of elenco) {
    const s = somiglianza(normalizza(p.nome), n);
    if (s > punti) { migliore = p; punti = s; }
  }
  // 0,7: «CHARUE» ritrova CHARLIE (0,71), «JULIA» non diventa GIULIA (0,67).
  // Chi si ferma al primo nome trovato (services/lettore-immagine.js) chiede
  // di più, perché non ha ancora visto gli altri.
  return punti >= minimo ? migliore : null;
}

const normalizza = (s) => String(s).toUpperCase().normalize('NFD').replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();

function somiglianza(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1);
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Le date dall'intestazione («LUNEDI 19-ott»). Ogni giorno letto propone un lunedì (la
// sua data meno la sua posizione) e vince il più proposto, così un 9 letto come 5 non
// sposta la settimana. L'anno è quello che mette la data più vicina a oggi. null se non
// si legge nessun giorno: allora le date le chiede l'anteprima.
export function dateDaIntestazione(testi, oggi) {
  const l = lunediVotato(testi, oggi);
  return l ? Array.from({ length: 7 }, (_, d) => new Date(l.data.getFullYear(), l.data.getMonth(), l.data.getDate() + d)) : null;
}

// Il lunedì più votato e quanti giorni lo confermano: con due giorni d'accordo
// non serve leggere gli altri cinque.
export function lunediVotato(testi, oggi) {
  const voti = new Map();
  testi.forEach((t, i) => {
    // «19-0tt»: il lettore scambia la o con lo zero.
    const m = String(t || '').toLowerCase().match(/(\d{1,2})\s*[-/. ]\s*([a-z0]{3})/);
    const mese = m ? MESI.indexOf(m[2].replace(/0/g, 'o')) : -1;
    if (mese < 0 || Number(m[1]) > 31) return;
    const anni = [-1, 0, 1].map((d) => new Date(oggi.getFullYear() + d, mese, Number(m[1]) - i));
    const lunedi = anni.sort((a, b) => Math.abs(+a - +oggi) - Math.abs(+b - +oggi))[0];
    const k = lunedi.getTime();
    voti.set(k, (voti.get(k) || 0) + 1);
  });
  if (!voti.size) return null;
  const [k, n] = [...voti].sort((a, b) => b[1] - a[1])[0];
  return { data: new Date(k), voti: n };
}

const minuti = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
// Un turno dura più di zero e al massimo 13 ore (riposo minimo di 11 ore ogni 24, art. 7
// D.Lgs. 66/2003): oltre, è un orario letto male («17:00» diventato «7:00»).
const durataPlausibile = (a, b) => { const d = (minuti(b) - minuti(a) + 1440) % 1440; return d > 0 && d <= 13 * 60; };

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Le celle lette di una persona diventano il testo di «Incolla turni», che fa il resto
// (anteprima, doppioni, ferie, date): un formato di scambio che esiste già.
export function testoDaRighe(righe, date) {
  const linee = [];
  for (let g = 0; g < 7; g++) {
    for (const r of righe) {
      const inizio = orarioDaCella(r[2 * g]);
      const fine = orarioDaCella(r[2 * g + 1]);
      // Un turno che non dura, o dura più di quanto la legge consente, è rumore.
      if (!inizio || !fine || !durataPlausibile(inizio, fine)) continue;
      const giorno = date
        ? `${String(date[g].getDate()).padStart(2, '0')}/${String(date[g].getMonth() + 1).padStart(2, '0')}`
        : GIORNI[g];
      linee.push(`${giorno} ${inizio}-${fine}`);
    }
  }
  return linee.join('\n');
}

// ── Le foto: niente griglia, il righello ──
// Su una foto le linee spesso non si vedono: la riga la indica chi usa l'app col
// righello, e le COLONNE si ricavano dagli orari (gli inizi di una colonna sono allineati).

// Raddrizza attorno a (cx, cy) ciò che è inclinato di `gradi` nel verso di
// CSS `rotate()` (positivo = scende verso destra): la fascia inclinata del
// righello diventa orizzontale prima di ritagliarla.
export function ruotaGrigi(grigi, W, H, gradi, cx = W / 2, cy = H / 2) {
  if (!gradi) return grigi;
  const a = gradi * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const out = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.round(cx + (x - cx) * c - (y - cy) * s), sy = Math.round(cy + (x - cx) * s + (y - cy) * c);
    if (sx >= 0 && sy >= 0 && sx < W && sy < H) out[y * W + x] = grigi[sy * W + sx];
  }
  return out;
}

// Dalle parole lette (testo e riquadro) ai turni: due orari vicini sulla
// stessa riga, il secondo dopo il primo. La durata che spesso li segue
// («05:30») sta più lontana e non si accoppia.
export function coppieDaParole(parole) {
  // Una parola può contenerne più d'uno («12:3015:00»: lo spazio si perde):
  // ogni orario prende la sua parte del riquadro, in proporzione ai caratteri.
  const orari = parole.flatMap((p) => {
    const t = String(p.testo), n = Math.max(1, t.length), passo = (p.x1 - p.x0) / n;
    const trovati = /^\d{4}$/.test(t) ? [{ 0: t, 1: t.slice(0, 2), 2: t.slice(2), index: 0 }] : [...t.matchAll(/(\d{1,2}):(\d{2})/g)];
    return trovati.filter((m) => Number(m[1]) < 24 && Number(m[2]) < 60).map((m) => ({
      ora: `${m[1].padStart(2, '0')}:${m[2]}`, x0: p.x0 + m.index * passo, x1: p.x0 + (m.index + m[0].length) * passo,
      y0: p.y0, y1: p.y1, yc: (p.y0 + p.y1) / 2,
    }));
  }).sort((a, b) => a.yc - b.yc || a.x0 - b.x0);
  const coppie = [];
  const usati = new Set();
  for (const a of orari) {
    if (usati.has(a)) continue;
    const alto = a.y1 - a.y0, largo = a.x1 - a.x0;
    const b = orari.filter((o) => o !== a && !usati.has(o) && Math.abs(o.yc - a.yc) < alto * 0.6 && o.x0 > a.x0 && o.x0 - a.x1 < largo * 0.6)
      .sort((p, q) => p.x0 - q.x0)[0];
    if (b && durataPlausibile(a.ora, b.ora)) {
      usati.add(a); usati.add(b);
      coppie.push({ inizio: a.ora, fine: b.ora, x: a.x0, y: a.yc, largo });
    }
  }
  return coppie;
}

// Le colonne: gli inizi dei turni raggruppati per posizione orizzontale. Hanno passo
// regolare: una colonna senza letture (tutta riposi, o tagliata) si ricostruisce dal passo,
// altrimenti i giorni dopo scivolerebbero di uno. `larghezza` è quella dell'immagine.
export function colonneDaCoppie(coppie, larghezza = Infinity) {
  const xs = coppie.map((c) => c.x).sort((a, b) => a - b);
  const tolleranza = (coppie.map((c) => c.largo).sort((a, b) => a - b)[Math.floor(coppie.length / 2)] || 50) * 1.5;
  const gruppi = [];
  for (const x of xs) {
    const u = gruppi[gruppi.length - 1];
    if (u && x - u[u.length - 1] <= tolleranza) u.push(x); else gruppi.push([x]);
  }
  const centri = gruppi.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  if (centri.length < 2) return centri;
  const salti = centri.slice(1).map((x, i) => x - centri[i]);
  const passo = Math.min(...salti);
  const colonne = [centri[0]];
  for (const x of centri.slice(1)) {
    for (let k = Math.round((x - colonne[colonne.length - 1]) / passo) - 1; k > 0; k--) colonne.push(x - k * passo);
    colonne.push(x);
  }
  while (colonne[0] - passo >= 0) colonne.unshift(colonne[0] - passo);
  while (colonne[colonne.length - 1] + passo <= larghezza - passo * 0.3) colonne.push(colonne[colonne.length - 1] + passo);
  return colonne;
}

// Le celle della fascia: da poco prima dell'inizio di una colonna a poco
// prima della successiva. Dentro, la durata del turno resta in fondo alla
// riga e non disturba: di ogni riga si prendono i primi due orari.
export function celleDaColonne(colonneX, larghezza) {
  const passo = colonneX.length > 1 ? colonneX[1] - colonneX[0] : larghezza;
  // A sinistra quasi a filo del testo: prima c'è spesso un segno (la barretta
  // colorata dei gestionali) che il lettore prende per un «1».
  return colonneX.map((x, i) => [Math.max(0, Math.round(x - passo * 0.015)), Math.min(larghezza - 1, Math.round((colonneX[i + 1] ?? x + passo) - passo * 0.06))]);
}

// I turni di una cella letta: ogni riga coi suoi primi due orari, se il
// secondo viene dopo il primo e il turno sta in piedi.
export function turniDaTestoCella(testo) {
  const turni = [];
  for (const riga of String(testo || '').split('\n')) {
    const ore = [...riga.matchAll(/(\d{1,2}):?(\d{2})/g)]
      .filter((m) => Number(m[1]) < 24 && Number(m[2]) < 60).map((m) => `${m[1].padStart(2, '0')}:${m[2]}`);
    if (ore.length >= 2 && ore[1] > ore[0] && durataPlausibile(ore[0], ore[1])) turni.push(`${ore[0]}-${ore[1]}`);
  }
  return turni;
}

// La fascia scelta col righello, una cella per colonna, diventa testo di
// «Incolla turni». `primo` è il giorno della prima colonna (0 = lunedì): su
// una foto senza date lo dice chi la guarda.
export function testoDaFascia(testiCelle, primo = 0) {
  return testiCelle.flatMap((t, col) => turniDaTestoCella(t).map((o) => `${GIORNI[(primo + col) % 7]} ${o}`)).join('\n');
}

// Le celle della fascia scelta col righello, pronte per il lettore: raddrizzate, col
// contrasto steso, SENZA soglia (mangiava i «:» e le cifre sottili).
export function celleDellaFascia(grigi, W, H, { y0, y1, gradi = 0 }, colonneX) {
  const g = ruotaGrigi(grigi, W, H, gradi, W / 2, (y0 + y1) / 2);
  const t = Math.max(0, Math.round(y0)), b = Math.min(H, Math.round(y1)), h = Math.max(1, b - t);
  return celleDaColonne(colonneX, W).map(([x0, x1]) => {
    const w = Math.max(1, x1 - x0), dati = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dati[y * w + x] = g[(t + y) * W + x0 + x];
    return { ...contrasto(dati), w, h };
  });
}

// Il grigio steso fra l'1% e il 99% dei pixel, senza soglia. `vuota` se non
// c'è contrasto, cioè niente di scritto.
export function contrasto(dati) {
  const ist = new Uint32Array(256);
  for (const v of dati) ist[v] += 1;
  const q = (p) => { let n = 0; for (let v = 0; v < 256; v++) { n += ist[v]; if (n >= p * dati.length) return v; } return 255; };
  const min = q(0.01), max = q(0.99), scala = max > min ? 255 / (max - min) : 1;
  const out = new Uint8Array(dati.length);
  for (let i = 0; i < dati.length; i++) out[i] = Math.max(0, Math.min(255, Math.round((dati[i] - min) * scala)));
  return { dati: out, vuota: max - min < 40 };
}
