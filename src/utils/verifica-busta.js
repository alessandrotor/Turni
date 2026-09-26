// Il confronto fra l'app e una busta paga, fatto sul telefono del tester.
//
//   node scripts/check-verifica-busta.mjs
//
// PERCHÉ ESISTE
// Per sapere se l'app torna con la busta di un tester, lui doveva mandare il
// cedolino: nome, codice fiscale, retribuzione, tutto. Qui il confronto lo fa
// lui, e a chi sviluppa arriva solo `testoDaCondividere`: gli SCARTI fra app e
// busta, mai le cifre intere. Si sa dove l'app sbaglia e di quanto, non quanto
// guadagna chi l'ha provata.
//
// DUE LIVELLI, PERCHÉ DICONO COSE DIVERSE
//  · CALCOLO — si parte dal lordo STAMPATO in busta e si chiede al motore
//    contributi, IRPEF, bonus e netto. Non servono turni: verifica il motore,
//    come fa `check-buste-2026.mjs` sulle buste di chi sviluppa.
//  · TURNI — il lordo che l'app ricava dai turni segnati in quel mese contro
//    quello della busta. Verifica turni, maggiorazioni e impostazioni.
//
// Modulo puro, senza rete: il riscontro controlla che resti così, perché la
// pagina promette in grande che la busta non va da nessuna parte.

import { calcTotalPay, calcShiftMinutes, computePayByShift, hasAnyRate } from './pay.js';
import { nettoDelMese, lordoDelMese } from './net.js';
import { lordoDaBusta, incoerenze } from './leggi-cedolino.js';
import { parseDate, payrollMonthKey, getDaysInMonth } from './dates.js';
import { isMensilizzato, getCcnl } from './ccnl.js';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// Tolleranze: quanto uno scarto può valere senza dire niente.
//  · contributi: somma di quattro voci (IVS, FIS, CIGS, Ente Bilaterale), ognuna
//    arrotondata al centesimo per conto suo;
//  · bonus: centesimi, la busta arrotonda lì;
//  · imponibile: con la 13ª/14ª la ripartizione fra i due imponibili balla di
//    ~13 centesimi (scarto noto, `check-buste-2026.mjs`);
//  · IRPEF e netto: un euro — il netto è pagato all'euro tondo, e la detrazione
//    ha un euro di scarto noto sopra soglia (`check-ti-mensile.mjs`);
//  · lordo dai turni: un euro;
//  · ore: il quarto d'ora a cui la busta arrotonda l'eccedenza.
const TOLLERANZA = {
  contributi: 0.1, imponibile: 0.2, irpef: 1.01, addizionali: 0.05,
  ti: 0.02, indennita: 0.1, netto: 1.01, lordo: 1, ore: 0.25,
};

// La PRIMA voce con quell'etichetta, in qualunque colonna: la stessa lettura di
// `check-buste-2026.mjs`, che su cinque buste torna al centesimo. Sommare tutte
// le voci che somigliano rischierebbe di contare due volte un imponibile.
const importo = (fx, re, sezione = null) =>
  fx.voci.find((v) => re.test(v.etichetta || '') && (!sezione || v.sezione === sezione))?.importo || 0;
const c2 = (n) => Math.round(n * 100) / 100;

export function riga(livello, voce, app, busta, tolleranza, unita = '€') {
  const scarto = c2(app - busta);
  const ok = Math.abs(scarto) <= tolleranza;
  // UN LATO A ZERO È UNA FUGA: lo scarto coincide con la cifra intera
  // dell'altro. «Addizionali +12,20 €» con la busta a zero è l'addizionale
  // dell'app, e da lì si risale al reddito. Trovato dal riscontro sulle buste
  // vere il 26/09/2026. Il testo da mandare dice solo da che parte c'è.
  const soloDa = ok ? null : (c2(busta) === 0 ? 'app' : (c2(app) === 0 ? 'busta' : null));
  return {
    livello, voce, unita, app: c2(app), busta: c2(busta), scarto, soloDa,
    pct: busta ? Math.round((scarto / Math.abs(busta)) * 1000) / 10 : null,
    ok,
  };
}

/** I turni che l'app conta per quel mese: stessa regola di `App.jsx` (mese di paga o di calendario). */
export function turniDelMese(allShifts, anno, mese, settings = {}) {
  if (isMensilizzato(settings) && settings.periodoConteggio !== 'calendario') {
    const chiave = `${anno}-${String(mese + 1).padStart(2, '0')}`;
    return allShifts.filter((s) => payrollMonthKey(s.date) === chiave);
  }
  return allShifts.filter((s) => {
    const d = parseDate(s.date);
    return d.getFullYear() === anno && d.getMonth() === mese;
  });
}

/**
 * Confronta una busta letta con l'app.
 *
 * @param {object} fx il cedolino come lo restituisce `leggiCedolinoDaRighe`
 * @param {{ allShifts: Array, settings: object }} app
 * @returns {{ periodo, righe: Array, turniNelMese: number, avvisi: string[] }}
 *   `righe` porta anche le cifre intere, che servono a mostrare la tabella sul
 *   telefono; NON escono dal telefono — esce solo `testoDaCondividere`.
 */
export function confronta(fx, { allShifts = [], settings = {} } = {}) {
  const avvisi = [];
  if (!fx?.voci?.length) return { periodo: null, righe: [], turniNelMese: 0, avvisi: ['nessuna voce letta'] };
  if (!fx.periodo) return { periodo: null, righe: [], turniNelMese: 0, avvisi: ['mese della busta non riconosciuto'] };

  // Se la busta non torna con sé stessa, il lettore ha saltato qualcosa, e ogni
  // scarto qui sotto potrebbe essere suo e non dell'app. Si dice.
  const guasti = incoerenze(fx);
  if (guasti.length) avvisi.push('la busta non è stata letta per intero: gli scarti vanno presi con cautela');

  const anno = fx.periodo.anno;
  const mese = fx.periodo.mese - 1;
  const giorni = getDaysInMonth(anno, mese);
  const b = lordoDaBusta(fx);
  const n = nettoDelMese(b.lordo, settings, giorni, b.extra);
  const righe = [];

  // ── Calcolo: dal lordo della busta ─────────────────────────────────────
  const contributiBusta = importo(fx, /Contributo IVS/) + importo(fx, /^FIS/) + importo(fx, /Contributo CIGS/)
    + importo(fx, /Bilaterale/, 'trattenuta');
  righe.push(riga('calcolo', 'Contributi', n.contributi, contributiBusta, TOLLERANZA.contributi));

  const imponibileBusta = importo(fx, /Imponibile IRPEF/) + importo(fx, /Imponibile Tass\.aut\./);
  if (imponibileBusta) righe.push(riga('calcolo', 'Imponibile IRPEF', n.imponibile, imponibileBusta, TOLLERANZA.imponibile));

  righe.push(riga('calcolo', 'IRPEF trattenuta', n.irpefNetta,
    importo(fx, /^Ritenute IRPEF$/) + importo(fx, /IRPEF lorda Tass\.aut\./), TOLLERANZA.irpef));

  const addizionaliBusta = fx.voci.filter((v) => v.sezione === 'trattenuta' && /Addizional/i.test(v.etichetta || ''))
    .reduce((t, v) => t + (v.importo || 0), 0);
  const addizionaliApp = (n.addRegionale || 0) + (n.addComunale || 0);
  if (addizionaliBusta || addizionaliApp) {
    righe.push(riga('calcolo', 'Addizionali', addizionaliApp, addizionaliBusta, TOLLERANZA.addizionali));
  }

  righe.push(riga('calcolo', 'Trattamento integrativo', n.trattamentoIntegrativo,
    importo(fx, /Trattamento integrativo/), TOLLERANZA.ti));
  righe.push(riga('calcolo', 'Indennità L. 207/24', n.bonusCuneo, importo(fx, /L\.207/), TOLLERANZA.indennita));

  // Il rimborso del 730 è pagato in busta ma non è reddito del mese: l'app non
  // può saperlo, e si toglie dal netto stampato prima di confrontare.
  if (fx.netto != null) {
    righe.push(riga('calcolo', 'Netto', n.net, fx.netto - b.fuoriReddito, TOLLERANZA.netto));
  }

  // ── Turni: dal calendario dell'app ─────────────────────────────────────
  const delMese = turniDelMese(allShifts, anno, mese, settings);
  if (delMese.length && hasAnyRate(settings)) {
    const paga = calcTotalPay(delMese, settings, allShifts, computePayByShift(allShifts, settings));
    const { lordo } = lordoDelMese(paga?.total, anno, mese, settings);
    righe.push(riga('turni', 'Lordo', lordo, b.lordo, TOLLERANZA.lordo));
    if (fx.presenze?.ordinarie != null && paga) {
      const oreBusta = fx.presenze.ordinarie + (fx.presenze.supplementari || 0);
      const oreApp = delMese.reduce((m, s) => m + calcShiftMinutes(s), 0) / 60;
      if (oreApp) righe.push(riga('turni', 'Ore', oreApp, oreBusta, TOLLERANZA.ore, 'h'));
    }
  } else if (!delMese.length) {
    avvisi.push(`nessun turno segnato per ${MESI[mese]} ${anno}: confronto solo sul calcolo`);
  } else {
    avvisi.push('paga oraria non impostata: confronto solo sul calcolo');
  }

  return { periodo: { anno, mese }, righe, turniNelMese: delMese.length, avvisi };
}

/**
 * Il ripiego per la busta che il lettore non sa leggere: una scansione, o un
 * software paghe diverso da Zucchetti. Tre numeri scritti a mano dal tester,
 * confrontati allo stesso modo — più poveri, ma sempre sul telefono.
 *
 * @param {{ anno: number, mese: number, lordo: number, netto: number, ore?: number }} busta
 *   `mese` da 0 a 11; `lordo` è l'imponibile INPS stampato in busta.
 */
export function confrontaAMano(busta, { allShifts = [], settings = {} } = {}) {
  const { anno, mese } = busta;
  const lordo = Number(busta.lordo) || 0;
  const netto = Number(busta.netto) || 0;
  const righe = [];
  const avvisi = ['busta scritta a mano: confronto ridotto'];
  if (lordo > 0 && netto > 0) {
    righe.push(riga('calcolo', 'Netto', nettoDelMese(lordo, settings, getDaysInMonth(anno, mese), 0).net, netto, TOLLERANZA.netto));
  }
  const delMese = turniDelMese(allShifts, anno, mese, settings);
  if (delMese.length && hasAnyRate(settings) && lordo > 0) {
    const paga = calcTotalPay(delMese, settings, allShifts, computePayByShift(allShifts, settings));
    righe.push(riga('turni', 'Lordo', lordoDelMese(paga?.total, anno, mese, settings).lordo, lordo, TOLLERANZA.lordo));
  }
  if (delMese.length && Number(busta.ore) > 0) {
    righe.push(riga('turni', 'Ore', delMese.reduce((m, s) => m + calcShiftMinutes(s), 0) / 60,
      Number(busta.ore), TOLLERANZA.ore, 'h'));
  }
  if (!delMese.length) avvisi.push(`nessun turno segnato per ${MESI[mese]} ${anno}`);
  return { periodo: { anno, mese }, righe, turniNelMese: delMese.length, avvisi };
}

const segno = (n, dec) => `${n > 0 ? '+' : (n < 0 ? '−' : '')}${Math.abs(n).toLocaleString('it-IT', {
  minimumFractionDigits: dec, maximumFractionDigits: dec,
})}`;

/** Lo scarto come si legge: «+0,41 €», «−0,05 h». */
export function scartoScritto(r) {
  return `${segno(r.scarto, 2)} ${r.unita}`;
}

/**
 * Il testo che il tester manda. SOLO scarti e percentuali, più il contesto che
 * serve a capirli (mese, contratto, part-time): nessuna cifra intera, né
 * dell'app né della busta. È la promessa della pagina, e il riscontro la
 * verifica cercando nel testo ogni importo assoluto.
 */
export function testoDaCondividere(esito, { versione = '', settings = {}, partTimePct = null } = {}) {
  const intestazione = [
    `Turni ${versione}`.trim(),
    esito.periodo ? `verifica busta ${MESI[esito.periodo.mese]} ${esito.periodo.anno}` : 'verifica busta',
    getCcnl(settings.ccnl)?.label ? `CCNL ${getCcnl(settings.ccnl).label}` : null,
    partTimePct ? `part-time ${String(partTimePct).replace('.', ',')}%` : null,
  ].filter(Boolean).join(' · ');
  const linee = [intestazione];
  for (const [livello, titolo] of [['calcolo', 'Calcolo (dal lordo della busta)'], ['turni', 'Turni segnati nell\'app']]) {
    const del = esito.righe.filter((r) => r.livello === livello);
    if (!del.length) continue;
    linee.push(titolo);
    for (const r of del) {
      if (r.soloDa) {
        linee.push(`  ${r.voce.padEnd(24)} ${r.soloDa === 'app' ? 'solo nell’app' : 'solo in busta'}`);
        continue;
      }
      const pct = r.ok || r.pct == null ? '' : `  (${segno(r.pct, 1)}%)`;
      linee.push(`  ${r.voce.padEnd(24)} ${scartoScritto(r).padStart(10)}${r.ok ? '  ✓' : pct}`);
    }
  }
  for (const a of esito.avvisi) linee.push(`Nota: ${a}`);
  return linee.join('\n');
}
