// Il conguaglio di fine anno: quanto ti riprendono, o ti ridanno, a dicembre.
//
//   node scripts/check-conguaglio.mjs
//
// Ogni mese il datore trattiene come se quel mese durasse tutto l'anno (lordo del
// mese × 12); a dicembre rifà il conto sul reddito vero, e la differenza è il
// conguaglio. Qui si fanno i due conti con lo stesso motore (`nettoDelMese` contro
// `calcNetAnnual`) e si sottraggono: nessuna regola nuova.
//
// Non una cifra ma una forchetta: l'anno è la proiezione del motore
// (`stimaConguaglio`) e si fa variare solo come erano i mesi del montante (uguali o
// alterni), che muove bonus e IRPEF insieme. La 14ª sta nel suo mese, non spalmata.
// Il bonus accreditato finora (`tiFinora`) è lo stesso del riquadro del bonus.
// Altri datori, detrazioni non da lavoro e fine del contratto non si stimano: si scrivono.
//
// Modulo puro, senza React e senza browser.

import { calcTotalPay } from './pay.js';
import { capienzaProgressiva } from './capienza.js';
import { nettoDelMeseConPremio } from './premio-risultato.js';
import {
  lordoDelMese, calcNetAnnual, monthlyBaseGross,
  modoTrattamentoIntegrativo
} from './net.js';
import { getDaysInMonth, parseDate, richiediOggi } from './date.js';
import { conFisco, fiscoDi } from './fisco/index.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

/** Sotto questa cifra, da entrambi gli estremi, si dice «circa in pari». */
export const SOGLIA_PARI = 20;

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Il saldo del conguaglio su dodici mesi dati. `saldo` positivo = a debito
 * (te li riprendono), negativo = a credito.
 *
 * @param {Array<{lordo:number, extra:number, giorni:number, premio?:number, montante?:boolean}>} mesi dodici voci;
 *   `lordo` 0 fuori dal rapporto di lavoro.
 * @param {Impostazioni} impostazioni
 * @param {{tiMontanteNoto?: any, irpefMontanteNota?: any, anno?: number}} [opzioni]
 */
export function saldoConguaglio(mesi, impostazioni = {}, { tiMontanteNoto = null, irpefMontanteNota = null, anno } = {}) {
  if (!Number.isInteger(anno)) throw new TypeError('saldoConguaglio: serve l\'anno');
  const settings = conFisco(impostazioni, anno);
  let cuneo = 0, lordoAnno = 0, giorni = 0, conLordo = 0;
  const irpefMesi = [];
  const sopraMesi = [];
  const tiMesi = mesi.map((m, i) => {
    irpefMesi[i] = 0;
    if (!(m.lordo > 0)) return 0;
    // La capienza sul progressivo, come nel calendario (capienza.js).
    // Il premio di risultato è tassato a parte (premio-risultato.js): fuori
    // dall'IRPEF dell'anno e dal reddito su cui si misura la capienza.
    const premio = Number(m.premio) || 0;
    const cap = capienzaProgressiva(m.lordo - premio, settings, { lordo: lordoAnno, mesi: conLordo, mese: i });
    const n = nettoDelMeseConPremio({ lordo: m.lordo, extraMese: m.extra || 0, premioMese: premio }, settings, m.giorni, anno, cap);
    conLordo += 1;
    irpefMesi[i] = n.irpefNetta;
    sopraMesi[i] = !n.esitoTi.spetta;
    cuneo += n.bonusCuneo;
    lordoAnno += m.lordo - premio;
    giorni += m.giorni;
    return n.trattamentoIntegrativo;
  });
  // Quello che le buste del montante hanno fatto davvero, se copiato: vale al posto
  // della stima, ripartito sui mesi come li ripartiva il modello.
  const sostituisci = (perMese, noto) => {
    if (noto == null) return;
    const idx = mesi.map((m, i) => (m.montante && m.lordo > 0 ? i : -1)).filter((i) => i >= 0);
    const modello = idx.reduce((t, i) => t + perMese[i], 0);
    idx.forEach((i) => {
      perMese[i] = modello > 0 ? noto * (perMese[i] / modello) : noto / idx.length;
    });
  };
  sostituisci(tiMesi, tiMontanteNoto);
  sostituisci(irpefMesi, irpefMontanteNota);
  const ti = tiMesi.reduce((t, v) => t + v, 0);
  const irpef = irpefMesi.reduce((t, v) => t + v, 0);

  // Il dovuto dell'anno, dal motore: detrazioni e bonus rapportati ai giorni
  // del rapporto di lavoro li fa `calcNetAnnual` (opzione `giorni`).
  const a = calcNetAnnual(lordoAnno, settings, { giorni });
  const irpefDovuta = a.irpefNetta;
  const tiDovuto = a.trattamentoIntegrativo;

  const voci = {
    irpef: r2(irpefDovuta - irpef),
    trattamentoIntegrativo: r2(ti - tiDovuto),
    indennita: r2(cuneo - a.bonusCuneo),
  };
  // Le due colonne da cui nascono le voci: quanto è passato in busta, e quanto è
  // dovuto sull'anno.
  const dettaglio = {
    irpef: { mesi: r2(irpef), anno: r2(irpefDovuta) },
    trattamentoIntegrativo: { mesi: r2(ti), anno: r2(tiDovuto) },
    indennita: { mesi: r2(cuneo), anno: r2(a.bonusCuneo) },
  };
  return {
    voci,
    dettaglio,
    annoSottoSoglia: a.imponibile <= fiscoDi(settings).TI_SOGLIA_PIENO,
    // Il reddito su cui si misurano i 15.000 (lordo meno contributi), non il lordo.
    redditoAnno: r2(a.imponibile),
    saldo: r2(voci.irpef + voci.trattamentoIntegrativo + voci.indennita),
    lordoAnno: r2(lordoAnno),
    tiAccreditato: r2(ti),
    tiMesi,
    sopraMesi,
    irpefMesi,
  };
}

// Primo giorno del rapporto dentro l'anno, dalla data di assunzione.
function inizioRapporto(anno, settings) {
  const raw = String(settings.hireDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { mese: 0, giorno: 1 };
  const d = parseDate(raw);
  if (d.getFullYear() < anno) return { mese: 0, giorno: 1 };
  if (d.getFullYear() > anno) return { mese: 12, giorno: 1 };
  return { mese: d.getMonth(), giorno: d.getDate() };
}

/**
 * I dodici mesi dell'anno come li vede l'app, in uno dei due scenari per i
 * mesi che restano.
 *
 *  · passati, coperti dal montante: 13ª/14ª nel loro mese, il resto diviso
 *    sui mesi che copre — come sia andato davvero l'app non lo sa;
 *  · passati, con turni: il lordo dei turni, come nel resto dell'app;
 *  · questo mese e i prossimi: `contratto` o `media` dei mesi passati, mai
 *    meno di quanto già segnato.
 *
 * @param {{anno: number, allShifts?: Array<any>, settings?: Impostazioni, payMap?: any, oggi: Date,
 *   scenario?: string, montanteAlterno?: boolean, totaleAnno?: number|null}} p
 * @returns {{ mesi: Array<any>, meseOggi: number, mesiVuoti: number, cutoffIdx: number }}
 */
export function mesiDellAnno({
  anno, allShifts = [], settings = {}, payMap, oggi, scenario = 'contratto', montanteAlterno = false,
  totaleAnno = null,
}) {
  richiediOggi(oggi, 'mesiDellAnno');
  const meseOggi = anno === oggi.getFullYear() ? oggi.getMonth() : (anno < oggi.getFullYear() ? 12 : 0);
  const inizio = inizioRapporto(anno, settings);

  const montante = Number(settings.priorTaxableIncome) || 0;
  const cutoff = String(settings.priorIncomeDate || '');
  const cutoffIdx = montante > 0 && Number(cutoff.slice(0, 4)) === anno ? Number(cutoff.slice(5, 7)) - 1 : -1;
  const mesiMontante = Math.max(1, cutoffIdx - inizio.mese + 1);
  // La 14ª (e la 13ª, per un montante fermato a dicembre) sta nel suo mese:
  // si toglie prima di dividere, e si rimette lì con il suo binario fiscale.
  const extraDi = (m) => lordoDelMese(0, anno, m, settings).extraMese;
  let extraMontante = 0;
  for (let m = inizio.mese; m <= cutoffIdx; m += 1) extraMontante += extraDi(m);
  const ordinarioMontante = Math.max(0, montante - extraMontante);

  const turniDi = (m) => allShifts.filter((s) => {
    const d = parseDate(s.date);
    return d.getFullYear() === anno && d.getMonth() === m;
  });
  const pagaDi = (m) => {
    const turni = turniDi(m);
    return turni.length ? (calcTotalPay(turni, settings, allShifts, payMap)?.total || 0) : 0;
  };

  // La media dei mesi passati si fa sulla sola paga dei turni: voci fisse,
  // bonus spuntato e 13ª/14ª le rimette `lordoDelMese`, mese per mese.
  const passati = [];
  for (let m = Math.max(inizio.mese, cutoffIdx + 1); m < Math.min(meseOggi, 12); m += 1) passati.push(pagaDi(m));
  const conTurni = passati.filter((p) => p > 0);
  const media = conTurni.length ? conTurni.reduce((s, p) => s + p, 0) / conTurni.length : monthlyBaseGross(settings);
  const futuro = scenario === 'media' ? media : monthlyBaseGross(settings);

  let mesiVuoti = 0;
  const mesi = [];
  for (let m = 0; m < 12; m += 1) {
    const giorniMese = getDaysInMonth(anno, m);
    if (m < inizio.mese) { mesi.push({ lordo: 0, extra: 0, giorni: 0 }); continue; }
    const giorni = m === inizio.mese ? giorniMese - inizio.giorno + 1 : giorniMese;
    if (m <= cutoffIdx) {
      // Alterni: +20% e −20% a coppie, e l'ultimo mese dispari pareggia la
      // somma. Il montante resta esatto: cambia solo come si distribuisce.
      const quota = ordinarioMontante / mesiMontante;
      const k = m - inizio.mese;
      const ultimoDispari = mesiMontante % 2 === 1 && k === mesiMontante - 1;
      const fattore = !montanteAlterno || ultimoDispari ? 1 : (k % 2 === 0 ? 0.8 : 1.2);
      const extra = Math.min(extraDi(m), montante);
      mesi.push({ lordo: quota * fattore + extra, extra, giorni, montante: true });
      continue;
    }
    const paga = pagaDi(m);
    const effettiva = m < meseOggi ? paga : Math.max(paga, futuro);
    if (m < meseOggi && paga === 0) mesiVuoti += 1;
    const { lordo, extraMese, premioMese } = lordoDelMese(effettiva, anno, m, settings);
    mesi.push({ lordo, extra: extraMese, premio: premioMese, giorni: lordo > 0 ? giorni : 0 });
  }
  // LA PROIEZIONE DEL MOTORE, non una somma rifatta qui: con `totaleAnno` (di
  // `projectAnnualIncome`) i mesi che restano si scalano finché l'anno fa quella
  // cifra. I mesi passati non si toccano.
  if (Number.isFinite(totaleAnno) && totaleAnno > 0) {
    const futuri = mesi.map((m, i) => (i >= meseOggi && m.lordo > 0 ? i : -1)).filter((i) => i >= 0);
    const fermo = mesi.reduce((t, m, i) => t + (futuri.includes(i) ? m.extra : m.lordo), 0);
    const mobile = futuri.reduce((t, i) => t + mesi[i].lordo - mesi[i].extra, 0);
    if (mobile > 0) {
      const k = Math.max(0, totaleAnno - fermo) / mobile;
      futuri.forEach((i) => {
        const m = mesi[i];
        mesi[i] = { ...m, lordo: m.extra + (m.lordo - m.extra) * k };
      });
    }
  }
  return { mesi, meseOggi, mesiVuoti, cutoffIdx };
}

/**
 * Il progressivo dell'anno PRIMA di ogni mese — lordo e mesi con un lordo —
 * dagli stessi mesi del conguaglio (montante diviso, turni, poi il contratto).
 * Serve alla capienza del trattamento integrativo (capienza.js): calendario,
 * statistiche e «cosa cambia» la chiedono qui, il conguaglio la fa da sé.
 */
export function progressiviDellAnno(args) {
  let lordo = 0, mesi = 0;
  return mesiDellAnno(args).mesi.map((m, mese) => {
    const p = { lordo, mesi, mese };
    if (m.lordo > 0) { lordo += m.lordo; mesi += 1; }
    return p;
  });
}

/**
 * Una cifra dei mesi del montante copiata dalle buste, se vale ancora: è
 * legata al mese del montante, e un montante spostato la rende vecchia. Meglio
 * tornare al modello che usare in silenzio la cifra di un altro periodo.
 */
function notoDelMontante(settings, chiave) {
  const v = settings[chiave];
  if (!v || typeof v !== 'object') return null;
  const importo = Number(v.importo);
  if (!Number.isFinite(importo) || importo < 0) return null;
  if (!(Number(settings.priorTaxableIncome) > 0)) return null;
  return v.fino === String(settings.priorIncomeDate || '').slice(0, 7) ? importo : null;
}

/** Il trattamento integrativo delle buste del montante (somma delle voci). */
export const tiMontanteNoto = (settings = {}) => notoDelMontante(settings, 'tiAccreditatoMontante');
/** L'IRPEF pagata fino al mese del montante: il progressivo «IRPEF pagata». */
export const irpefMontanteNota = (settings = {}) => notoDelMontante(settings, 'irpefPagataMontante');

/**
 * La stima da mostrare: forchetta, stima centrale per voce, e cosa non si sa.
 * `null` se non c'è niente su cui stimare (nessun reddito nell'anno).
 */
export function stimaConguaglio({ anno, allShifts, settings, payMap, oggi, proiezioneAnnua = null }) {
  richiediOggi(oggi, 'stimaConguaglio');
  const casi = [];
  let centrale = null;
  let mesiVuoti = 0;
  let meseOggi = 0;
  let cutoffIdx = -1;
  let mesiCentrale = [];
  const noto = tiMontanteNoto(settings);
  const irpefNota = irpefMontanteNota(settings);
  // L'ANNO È LA PROIEZIONE DEL MOTORE, anche agli estremi: la forchetta fa variare
  // solo come erano i mesi del montante. Contratto e media restano per chi non ha
  // una proiezione da passare.
  const centro = Number.isFinite(proiezioneAnnua) && proiezioneAnnua > 0 ? 'proiezione' : 'contratto';
  for (const scenario of centro === 'proiezione' ? ['proiezione'] : ['contratto', 'media']) {
    // Con una cifra delle buste la distribuzione non si fa variare: muoverebbe l'altra
    // voce lasciando ferma questa.
    for (const montanteAlterno of noto == null && irpefNota == null ? [false, true] : [false]) {
      const esito = mesiDellAnno({
        anno, allShifts, settings, payMap, oggi, montanteAlterno,
        scenario: scenario === 'proiezione' ? 'contratto' : scenario,
        totaleAnno: scenario === 'proiezione' ? proiezioneAnnua : null,
      });
      ({ mesiVuoti, meseOggi, cutoffIdx } = esito);
      const s = saldoConguaglio(esito.mesi, settings, { tiMontanteNoto: noto, irpefMontanteNota: irpefNota, anno });
      if (s.lordoAnno <= 0) return null;
      casi.push(s.saldo);
      if (scenario === centro && !montanteAlterno) { centrale = s; mesiCentrale = esito.mesi; }
    }
  }
  const min = Math.min(...casi);
  const max = Math.max(...casi);
  return {
    min, max, centrale,
    direzione: Math.max(Math.abs(min), Math.abs(max)) < SOGLIA_PARI ? 'pari'
      : (min >= 0 ? 'debito' : (max <= 0 ? 'credito' : 'incerta')),
    mesiVuoti,
    // Le buste già arrivate: quelle dei mesi prima di questo.
    tiFinora: r2(centrale.tiMesi.slice(0, meseOggi).reduce((t, v) => t + v, 0)),
    // Il mese a cui si ferma il montante (0-11), -1 senza montante nell'anno:
    // è il periodo di cui l'interfaccia può chiedere il bonus vero.
    meseMontante: cutoffIdx,
    tiMontanteNoto: noto,
    irpefMontanteNota: irpefNota,
    // Le buste dell'anno, per l'intestazione: chi è assunto a luglio ne ha sei.
    busteAnno: mesiCentrale.filter((m) => m.lordo > 0).length,
    // PERCHÉ bonus e IRPEF si muovono: i mesi in cui la regola mensile ha deciso
    // diversamente dall'anno. Solo con la decisione automatica.
    mesiSopraSoglia: modoTrattamentoIntegrativo(settings) === 'auto'
      ? mesiCentrale.map((m, i) => (m.lordo > 0 && centrale.sopraMesi[i] ? i : -1)).filter((i) => i >= 0)
      : null,
    mesiSottoSoglia: modoTrattamentoIntegrativo(settings) === 'auto'
      // Col bonus DAVVERO in busta: sotto i 1.250 senza capienza non c'è (check-ti-capienza).
      ? mesiCentrale.map((m, i) => (m.lordo > 0 && centrale.tiMesi[i] > 0 ? i : -1)).filter((i) => i >= 0)
      : null,
  };
}
