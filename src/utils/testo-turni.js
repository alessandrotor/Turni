// Turni scritti a parole: «Lun 8-16, Mar 10-18, Mer riposo», o con le date
// («05/10 8:00-16:00», «5 ottobre 14.30-22»). Il testo di un messaggio, di
// un'email, di un foglio copiato.
//
//   node scripts/check-testo-turni.mjs
//
// TUTTO IN LOCALE. Il testo non va a nessun servizio: nessuna rete, nessun
// modello. È la ragione per cui l'import da testo non chiede il consenso che
// chiede la foto, e la frase «non viene inviato» deve restare vera.
//
// COSA SA FARE, e cosa no, dichiarato qui perché l'anteprima lo ripete:
//  · riconosce i GIORNI (nome del giorno, `gg/mm`, `gg/mm/aaaa`, `5 ottobre`)
//    e gli INTERVALLI (`8-16`, `8:00-16:00`, `14.30-22`, `dalle 8 alle 16`);
//  · più intervalli nello stesso giorno sono più turni;
//  · «riposo», «libero», «ferie», «permesso», «malattia» non sono turni: si
//    contano e si dicono, ma fanno avanzare i giorni (un «Mer riposo» in mezzo
//    sposta il «Gio» che segue);
//  · NON sa scegliere una persona in una tabella con tanti nomi: un testo, una
//    persona. Per le tabelle c'è la foto.
//
// LA DATA QUANDO C'È SOLO IL GIORNO DELLA SETTIMANA. «Lun» non dice quale
// lunedì. Il primo è quello più vicino a oggi (entro tre giorni, avanti o
// indietro), i seguenti vanno avanti in ordine. Non si indovina in silenzio: la
// data risolta è la prima cosa che l'anteprima mostra, e si può correggere con
// «Parti da».

import { parseDate, formatDate } from './dates.js';
import { avvicinaAnno } from './import-turni.js';

const GIORNO = { dom: 0, lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6 };
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const NOMI_GIORNO = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const NOMI_MESE = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
  'settembre', 'ottobre', 'novembre', 'dicembre'];

const L = 'a-zà-ù';
const SETTIMANA = 'lun(?:edì|edi)?|mar(?:tedì|tedi)?|mer(?:coledì|coledi)?|gio(?:vedì|vedi)?|ven(?:erdì|erdi)?|sab(?:ato)?|dom(?:enica)?';
// «mar» da solo è martedì se dopo c'è un numero («16 Mar 10-18»); marzo si
// scrive per intero, o l'abbreviazione non ha un numero dopo.
const MESE = 'gen|feb|apr|mag|giu|lug|ago|set|ott|nov|dic|marz|mar(?![a-zà-ù]|\\.?[ \\t]*\\d)';
const MARCATORE = new RegExp(
  `(?<![${L}])(${SETTIMANA})\\.?(?![${L}])`
  + `|(?<![\\d:.,/])(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?(?![\\d/])`
  + `|(?<![\\d:.,/\\-–])(\\d{1,2})[ \\t]+(${MESE})[${L}]*\\.?(?:[ \\t]+(\\d{4}))?`,
  'gi',
);
const INTERVALLO = /(\d{1,2})(?:[:.,h]\s?(\d{2}))?\s*(?:-|–|—|\ba\b|\balle\b)\s*(\d{1,2})(?:[:.,h]\s?(\d{2}))?/gi;
const NON_LAVORO = /\b(riposo|rip|libero|libera|off|smonto|ferie|permess\w*|rol|malattia|assente|assenza)\b/i;
const PAUSA = /paus\w*\s*(?:di\s*)?(\d{1,3})|(\d{1,3})\s*min\w*\s*(?:di\s*)?paus/i;

const GIORNO_MS = 86400000;
const iso = (d) => formatDate(d);
const piu = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const etichettaData = (d) => `${NOMI_GIORNO[d.getDay()].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1}`;

function dataValida(anno, mese, giorno) {
  const d = new Date(anno, mese - 1, giorno);
  return d.getFullYear() === anno && d.getMonth() === mese - 1 && d.getDate() === giorno ? d : null;
}

/** Toglie gli orari e i nomi che WhatsApp mette davanti a ogni messaggio copiato. */
function ripulisci(testo) {
  return String(testo || '')
    .replace(/[  ]/g, ' ')
    .replace(/\[?\d{1,2}[:.]\d{2}(?::\d{2})?,?\s+\d{1,2}\/\d{1,2}\/\d{2,4}\]?\s*(?:[-–]\s*)?[^:\n]{0,40}:/g, ' ')
    .replace(/\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}[:.]\d{2}(?::\d{2})?\]?\s*(?:[-–]\s*)?[^:\n]{0,40}:/g, ' ');
}

/**
 * @param {string} testo
 * @param {{ oggi?: Date, inizio?: string }} [opz] `inizio`: 'AAAA-MM-GG', da dove
 *   contare il primo giorno scritto solo col nome.
 * @returns {{ turni: Array, saltati: Array, nonCapite: Array, avvisi: Array,
 *   serveInizio: boolean, inizioUsato: string|null }}
 */
export function leggiTestoTurni(testo, { oggi = new Date(), inizio = '' } = {}) {
  const turni = [];
  const saltati = [];
  const nonCapite = [];
  const avvisi = [];
  let pulito = ripulisci(testo);
  const base = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());

  // «dal 5 al 11 ottobre»: dice da dove si parte, non è un giorno di lavoro.
  let inizioAuto = '';
  pulito = pulito.replace(new RegExp(`dal\\s+(\\d{1,2})\\s+al\\s+\\d{1,2}\\s+(${MESE})[${L}]*(?:\\s+(\\d{4}))?`, 'i'),
    (_, g, m, a) => {
      const mese = MESI.indexOf(m.toLowerCase().slice(0, 3)) + 1;
      const anno = a ? Number(a) : base.getFullYear();
      const d = dataValida(anno, mese, Number(g));
      if (d) inizioAuto = a ? iso(d) : avvicinaAnno(iso(d), oggi);
      return ' ';
    });
  const partenza = inizio || inizioAuto;

  // Mese e anno scritti da soli, in testa («Ottobre 2026»): contesto dei giorni «Lun 5».
  const senzaMarcatori = pulito.replace(MARCATORE, ' ');
  const mTesta = senzaMarcatori.match(new RegExp(`\\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\\b`, 'i'));
  const aTesta = senzaMarcatori.match(/\b(20\d{2})\b/);
  const ctxMese = mTesta ? NOMI_MESE.indexOf(mTesta[1].toLowerCase()) + 1 : null;
  const ctxAnno = aTesta ? Number(aTesta[1]) : null;

  // I marcatori: ogni giorno scritto apre un tratto di testo che arriva al successivo.
  const marc = [];
  for (const m of pulito.matchAll(MARCATORE)) {
    marc.push({ da: m.index, a: m.index + m[0].length, m });
  }
  // «Lun 05/10»: il nome del giorno seguito da una data è un giorno solo.
  const uniti = [];
  for (let i = 0; i < marc.length; i += 1) {
    const x = marc[i];
    const succ = marc[i + 1];
    const nome = x.m[1];
    if (nome && succ && !succ.m[1] && /^[\s,.:\-–]*$/.test(pulito.slice(x.a, succ.da))) {
      uniti.push({ da: x.da, a: succ.a, m: succ.m, nomeGiorno: nome });
      i += 1;
    } else uniti.push({ ...x, nomeGiorno: nome || null });
  }

  let cursore = null;          // l'ultimo giorno risolto
  let ultimoSoloNome = null;   // il giorno della settimana dell'ultimo marcatore «solo nome»
  let usatoNomeSolo = false;
  let inizioUsato = null;

  uniti.forEach((x, i) => {
    const fine = i + 1 < uniti.length ? uniti[i + 1].da : pulito.length;
    let tratto = pulito.slice(x.a, fine);
    let data = null;
    let soloNome = false;
    const wd = x.nomeGiorno ? GIORNO[x.nomeGiorno.toLowerCase().slice(0, 3)] : null;

    if (x.m[2] !== undefined) {              // gg/mm[/aaaa]
      const g = Number(x.m[2]); const me = Number(x.m[3]);
      const a = x.m[4] ? (x.m[4].length === 2 ? 2000 + Number(x.m[4]) : Number(x.m[4])) : (ctxAnno || base.getFullYear());
      const d = dataValida(a, me, g);
      if (d) data = x.m[4] || ctxAnno ? d : parseDate(avvicinaAnno(iso(d), oggi));
    } else if (x.m[5] !== undefined) {       // «5 ottobre [2026]»
      const g = Number(x.m[5]); const me = MESI.indexOf(x.m[6].toLowerCase().slice(0, 3)) + 1;
      const a = x.m[7] ? Number(x.m[7]) : (ctxAnno || base.getFullYear());
      const d = dataValida(a, me, g);
      if (d) data = x.m[7] || ctxAnno ? d : parseDate(avvicinaAnno(iso(d), oggi));
    } else if (wd !== null) {                // solo il nome del giorno, forse con il numero
      const num = tratto.match(/^[\s,.:;)\-–]*(\d{1,2})(?![\d:.,h]|\s*[-–]\s*\d)/);
      if (num) {                             // «Lun 5»
        const g = Number(num[1]);
        tratto = tratto.slice(num[0].length);
        const rif = cursore || base;
        const mesi = ctxMese ? [[ctxAnno || rif.getFullYear(), ctxMese]]
          : [0, 1, -1].map((k) => { const t = new Date(rif.getFullYear(), rif.getMonth() + k, 1); return [t.getFullYear(), t.getMonth() + 1]; });
        const cand = mesi.map(([a, me]) => dataValida(a, me, g)).filter(Boolean);
        data = cand.find((d) => d.getDay() === wd) || null;
        if (!data && cand[0]) {
          data = cand[0];
          avvisi.push(`«${NOMI_GIORNO[wd].slice(0, 3)} ${g}»: il ${g}/${data.getMonth() + 1} è un ${NOMI_GIORNO[data.getDay()]}. Ho tenuto la data.`);
        }
      } else {                               // «Lun» e basta
        soloNome = true;
        usatoNomeSolo = true;
        if (cursore && ultimoSoloNome === wd && uniti[i - 1] && uniti[i - 1].nomeGiorno && !uniti[i - 1].m[2] && !uniti[i - 1].m[5]) {
          data = cursore;                    // «Lun 8-12, Lun 14-18»: lo stesso lunedì
        } else if (cursore || partenza) {
          let d = cursore ? piu(cursore, 1) : parseDate(partenza);
          for (let k = 0; k < 7 && d.getDay() !== wd; k += 1) d = piu(d, 1);
          data = d;
          if (!cursore) inizioUsato = iso(d);
        } else {
          let d = piu(base, -3);
          for (let k = 0; k < 7 && d.getDay() !== wd; k += 1) d = piu(d, 1);
          data = d;
          inizioUsato = iso(d);
        }
      }
    }

    if (data) { cursore = data; ultimoSoloNome = soloNome ? wd : null; }
    if (!data) { nonCapite.push({ testo: pulito.slice(x.da, fine).trim().slice(0, 60) }); return; }

    // Gli intervalli del tratto.
    const trovati = [];
    for (const r of tratto.matchAll(INTERVALLO)) {
      const h1 = Number(r[1]); const m1 = r[2] ? Number(r[2]) : 0;
      const h2 = Number(r[3]); const m2 = r[4] ? Number(r[4]) : 0;
      if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) continue;
      if (h1 === h2 && m1 === m2) continue;
      trovati.push({ startTime: hhmm(h1 % 24, m1), endTime: hhmm(h2 % 24, m2) });
    }
    const pausaM = tratto.match(PAUSA);
    const pausa = pausaM ? Number(pausaM[1] || pausaM[2]) : 0;
    const kw = tratto.match(NON_LAVORO);
    const quando = etichettaData(data);

    if (trovati.length && !(kw && /^(ferie|permess|rol|malattia|assen)/i.test(kw[1]))) {
      for (const t of trovati) turni.push({ date: iso(data), ...t, breakMinutes: pausa, note: '' });
    } else if (kw) {
      saltati.push({ date: iso(data), etichetta: quando, motivo: kw[1].toLowerCase() });
    } else {
      nonCapite.push({ testo: pulito.slice(x.da, fine).trim().slice(0, 60) });
    }
  });

  // Orari scritti senza nessun giorno: si dice, non si indovina.
  if (!uniti.length) {
    for (const r of pulito.matchAll(INTERVALLO)) nonCapite.push({ testo: r[0] });
  }

  return {
    turni,
    saltati,
    nonCapite: nonCapite.slice(0, 8),
    avvisi,
    serveInizio: usatoNomeSolo,
    inizioUsato,
  };
}
