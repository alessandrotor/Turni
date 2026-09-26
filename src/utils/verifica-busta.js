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
import {
  lordoDaBusta, incoerenze, ESENTE, FUORI_REDDITO, STORNO, EXTRA_MENSILITA,
} from './leggi-cedolino.js';
import { isHoliday } from './holidays.js';
import { tipoTurno, TIPO } from './assenze.js';
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

// ── Il lordo, voce per voce ─────────────────────────────────────────────────
//
// PERCHÉ ESISTE
// La riga «Lordo +76,88 €» diceva che qualcosa non tornava e non diceva cosa.
// Il primo tester che l'ha vista (agosto 2026) non poteva farci niente: i
// motivi possibili sono cinque o sei e non si distinguono da un totale. Qui il
// lordo si divide nelle stesse famiglie in cui lo divide il cedolino, e lo
// scarto finisce nella riga che lo produce: ore segnate in più, un festivo che
// la busta non conta, un bonus spuntato che in busta non c'è.
//
// LE FAMIGLIE sono quelle che la busta stampa su righe sue, e che il motore sa
// già separare (`computePayByShift`). L'ordine conta: vince la prima che
// combacia, quindi «Magg. festivo» finisce nei festivi e non nelle ore
// ordinarie, e «Festività» (non lavorata) resta fra le ordinarie.
//
// DUE INVARIANTI, verificate da check-verifica-busta.mjs: le voci dell'app
// sommano al lordo dell'app e quelle della busta al lordo della busta, al
// centesimo. Una scomposizione che non torna col totale che spiega sarebbe
// peggio del totale da solo.
export const FAMIGLIE = [
  { id: 'mensilita', voce: '13ª e 14ª', re: EXTRA_MENSILITA },
  { id: 'supplementari', voce: 'Supplementari e straordinari', re: /Supplementar|Straordin/i },
  { id: 'domenicale', voce: 'Maggiorazione domenicale', re: /Domenical|Magg\.?\s*dom/i },
  { id: 'notturno', voce: 'Maggiorazione notturna', re: /Nottur|Magg\.?\s*nott/i },
  // «Lavoro festivo ordinario» (l'ora intera) e «Magg. festivo»: la busta paga
  // i festivi lavorati FUORI dalla retribuzione mensile.
  { id: 'festivo', voce: 'Festivi lavorati', re: /festivo/i, ore: 'max' },
  {
    id: 'ordinarie', voce: 'Ore ordinarie, ferie, permessi',
    re: /Retribuzione|Ferie|Permess|R\.?O\.?L|Ex\s*fest|Festivit|Malattia|Paga base|Conting|Terzo el/i,
  },
  // Tutto il resto: nell'app bonus e voci fisse, in busta le voci che non
  // nascono dai turni (premi, indennità). Qui è normale che i NOMI non
  // coincidano, ed è per questo che la pagina mostra quelli della busta.
  { id: 'altre', voce: 'Bonus e altre voci', re: null },
  // Solo dell'app: la maggiorazione scritta a mano nel modulo del turno. In
  // busta ha il nome di quello che rappresenta, e finisce nella sua famiglia.
  { id: 'manuali', voce: 'Maggiorazioni scritte a mano', re: null },
];

const famigliaDi = (etichetta) =>
  FAMIGLIE.find((f) => f.re && f.re.test(etichetta || ''))?.id || 'altre';

// Le ore di una voce, solo se la voce le dichiara E tornano con l'importo:
// tariffa × ore = importo. Quando non tornano, il numero in penultima posizione
// non sono ore (una percentuale, una base) e dirlo ore sarebbe inventarlo.
function oreDellaVoce(v) {
  const n = v.numeri || [];
  if (v.unita !== 'ORE' || n.length < 3) return null;
  const [tariffa, ore, importo] = n.slice(-3);
  return Math.abs(tariffa * ore - importo) <= 0.05 ? ore : null;
}

const vuote = () => Object.fromEntries(FAMIGLIE.map((f) => [f.id, { euro: 0, ore: 0, voci: [] }]));

/** Il lordo della busta nelle famiglie di `FAMIGLIE`. Somma = `lordoDaBusta(fx).lordo`. */
export function lordoBustaPerVoce(fx) {
  const per = vuote();
  const competenze = fx.voci.filter((v) => v.sezione === 'competenza'
    && !ESENTE.test(v.etichetta || '') && !FUORI_REDDITO.test(v.etichetta || ''));
  for (const v of competenze) {
    const id = famigliaDi(v.etichetta);
    const f = FAMIGLIE.find((x) => x.id === id);
    per[id].euro += v.importo || 0;
    per[id].voci.push(v.etichetta);
    const ore = oreDellaVoce(v);
    // «Lavoro festivo ordinario» e «Magg. festivo» sono le STESSE ore scritte
    // due volte: sommarle le raddoppierebbe.
    if (ore != null) per[id].ore = f.ore === 'max' ? Math.max(per[id].ore, ore) : per[id].ore + ore;
  }
  // La malattia in busta è uno storno fra le trattenute: toglie dalla
  // retribuzione quello che paga l'INPS. `lordoDaBusta` lo sottrae, e qui pure.
  for (const v of fx.voci.filter((x) => x.sezione === 'trattenuta' && STORNO.test(x.etichetta || ''))) {
    per.ordinarie.euro -= v.importo || 0;
  }
  return per;
}

/** Il lordo dell'app nelle stesse famiglie. Somma = `lordoDelMese(...).lordo`. */
export function lordoAppPerVoce(delMese, settings, payMap, anno, mese, pagaTotale) {
  const per = vuote();
  for (const s of delMese) {
    const p = payMap[s.id];
    if (!p) continue;
    const ore = calcShiftMinutes(s) / 60;
    // Stessa regola del motore (`pay.js`): il festivo lavorato sta fuori dal
    // monte ore, e la busta lo paga su una riga sua.
    const festivo = tipoTurno(s) === TIPO.LAVORO && isHoliday(s.date, settings);
    const suppl = p.overtimeBase + p.surchargeOvertime + p.straordinarioBase + p.surchargeStraordinario;
    const oreSuppl = (p.overtimeMinutes + p.straordinarioMinutes) / 60;

    per.supplementari.euro += suppl;
    per.supplementari.ore += oreSuppl;
    per.domenicale.euro += p.surchargeSunday;
    if (p.surchargeSunday > 0) per.domenicale.ore += ore;
    per.notturno.euro += p.surchargeNight;
    per.notturno.ore += p.nightMinutes / 60;
    per.manuali.euro += p.surchargeManual;
    if (festivo) {
      per.festivo.euro += p.base + p.surchargeHoliday;
      per.festivo.ore += ore;
    } else {
      per.festivo.euro += p.surchargeHoliday;
      per.ordinarie.euro += p.base - p.overtimeBase - p.straordinarioBase;
      per.ordinarie.ore += ore - oreSuppl;
    }
  }
  const { lordo, extraMese } = lordoDelMese(pagaTotale, anno, mese, settings);
  per.mensilita.euro += extraMese;
  // Bonus spuntato e voci fisse: quello che resta del lordo dopo turni e
  // mensilità. Per differenza, così la somma torna per costruzione.
  per.altre.euro += lordo - (Number(pagaTotale) || 0) - extraMese;
  return per;
}

/**
 * Le righe della scomposizione, pronte per la tabella e per il testo. Solo le
 * famiglie che esistono da almeno un lato: una fila di zeri è rumore.
 */
export function scomponiLordo(app, busta) {
  return FAMIGLIE
    .filter((f) => Math.abs(app[f.id].euro) >= 0.005 || Math.abs(busta[f.id].euro) >= 0.005)
    .map((f) => ({
      ...riga('lordo', f.voce, app[f.id].euro, busta[f.id].euro, TOLLERANZA.lordo),
      id: f.id,
      oreApp: Math.round(app[f.id].ore * 100) / 100,
      // Zero ore in busta su una voce in euro vuol dire «non dichiarate», non
      // «nessuna ora»: si mostra il vuoto, non uno zero che sembra un dato.
      oreBusta: busta[f.id].ore ? Math.round(busta[f.id].ore * 100) / 100 : null,
      vociBusta: busta[f.id].voci,
    }));
}

const oreScritte = (n) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} h`;

/**
 * Cosa vuol dire, in una frase, lo scarto di una famiglia. Resta sul telefono:
 * nomina ore e voci della busta, che nel testo da condividere non vanno.
 *
 * Le frasi dicono la causa PIÙ PROBABILE, non quella certa: l'app non vede il
 * cartellino del datore. Per questo la prima distinzione è sempre fra ore ed
 * euro — ore diverse vuol dire turni segnati diversamente, ore uguali con euro
 * diversi vuol dire una tariffa o una percentuale diversa.
 */
export function spiegaScarto(r) {
  if (r.ok) return null;
  const oreDiverse = r.oreBusta != null && Math.abs((r.oreApp || 0) - r.oreBusta) >= 0.25;
  const ore = r.oreBusta != null ? ` L'app conta ${oreScritte(r.oreApp || 0)}, la busta ${oreScritte(r.oreBusta)}.` : '';
  switch (r.id) {
    case 'supplementari':
      return oreDiverse
        ? `Ore oltre il monte ore del contratto.${ore} Di solito è un turno segnato in più o in meno, o un orario diverso da quello timbrato.`
        : `Le ore tornano, l'importo no: la percentuale del supplementare o la paga oraria sono diverse da quelle della busta.`;
    case 'domenicale':
      return oreDiverse
        ? `Ore lavorate di domenica.${ore} Un turno di domenica segnato in più o in meno, o un orario diverso da quello timbrato.`
        : 'Le ore tornano, l\'importo no: la percentuale domenicale in Impostazioni è diversa da quella della busta.';
    case 'notturno':
      return oreDiverse
        ? `Ore in fascia notturna.${ore} Un turno di notte in più o in meno, o una fascia notturna diversa da quella del contratto (Impostazioni).`
        : 'Le ore tornano, l\'importo no: la percentuale notturna in Impostazioni è diversa da quella della busta.';
    case 'festivo':
      if (r.soloDa === 'app') return 'L\'app conta un festivo lavorato che in busta non c\'è. Se quel giorno non hai lavorato, segnalo come festività, non come turno.';
      if (r.soloDa === 'busta') return 'La busta paga un festivo lavorato che l\'app non vede: controlla il turno di quel giorno, e il santo patrono in Impostazioni.';
      return `Festivi lavorati.${ore} La busta li paga fuori dalla retribuzione del mese: controlla quali giorni sono segnati come festivi.`;
    case 'ordinarie':
      return `Retribuzione del mese, ferie e permessi.${ore} Di solito sono ferie, permessi o malattia segnati diversamente, o una paga oraria diversa.`;
    case 'mensilita':
      return 'La 13ª o la 14ª: l\'app la conta in un mese diverso, o con un rateo diverso. Controlla la data di assunzione in Impostazioni.';
    case 'altre': {
      const inBusta = r.vociBusta?.length ? ` In busta: ${r.vociBusta.join(', ')}.` : ' In busta non ce ne sono.';
      return `Nell'app: bonus spuntato questo mese e voci fisse.${inBusta} Se il bonus di questo mese in busta non c'era, togli la spunta dal calendario — o mettila, se c'era.`;
    }
    case 'manuali':
      return 'Maggiorazioni scritte a mano nel modulo del turno. In busta hanno il nome di quello che rappresentano, quindi compaiono in un\'altra riga.';
    default:
      return null;
  }
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
  let scomposizione = [];
  if (delMese.length && hasAnyRate(settings)) {
    const payMap = computePayByShift(allShifts, settings);
    const paga = calcTotalPay(delMese, settings, allShifts, payMap);
    const { lordo } = lordoDelMese(paga?.total, anno, mese, settings);
    const rigaLordo = riga('turni', 'Lordo', lordo, b.lordo, TOLLERANZA.lordo);
    righe.push(rigaLordo);
    // Solo quando il lordo non torna: se torna, sei righe di ✓ non dicono niente.
    if (!rigaLordo.ok) {
      scomposizione = scomponiLordo(
        lordoAppPerVoce(delMese, settings, payMap, anno, mese, paga?.total),
        lordoBustaPerVoce(fx),
      );
    }
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

  return { periodo: { anno, mese }, righe, scomposizione, turniNelMese: delMese.length, avvisi };
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
  // La scomposizione esce con le stesse regole delle righe: scarti, mai cifre.
  // Vale anche per le ORE: con un lato a zero lo scarto sarebbe il totale di
  // ore dell'altro lato, e si dice solo da che parte. Le voci che tornano non
  // si elencano — chi legge cerca dove sta lo scarto, non dove non sta.
  const fuori = (esito.scomposizione || []).filter((r) => !r.ok);
  if (fuori.length) {
    linee.push('Lordo, voce per voce');
    for (const r of fuori) {
      if (r.soloDa) {
        linee.push(`  ${r.voce.padEnd(30)} ${r.soloDa === 'app' ? 'solo nell’app' : 'solo in busta'}`);
        continue;
      }
      const ore = r.oreBusta != null && r.oreApp && Math.abs(r.oreApp - r.oreBusta) >= 0.01
        ? `  (${segno(Math.round((r.oreApp - r.oreBusta) * 100) / 100, 2)} h)` : '';
      linee.push(`  ${r.voce.padEnd(30)} ${scartoScritto(r).padStart(10)}${ore}`);
    }
  }
  for (const a of esito.avvisi) linee.push(`Nota: ${a}`);
  return linee.join('\n');
}
