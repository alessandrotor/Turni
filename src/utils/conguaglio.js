// Il conguaglio di fine anno: quanto ti riprendono, o ti ridanno, a dicembre.
//
//   node scripts/check-conguaglio.mjs
//
// IL MECCANISMO (certo)
// Ogni mese il datore trattiene e accredita come se quel mese durasse tutto
// l'anno: lordo del mese × 12 decide IRPEF, detrazioni, trattamento integrativo
// e indennità L. 207/24 (verificato su cinque buste, `check-ti-mensile.mjs`).
// A dicembre rifà il conto sul reddito VERO dell'anno, e la differenza è il
// conguaglio. Qui si fanno i due conti con lo stesso motore e si sottraggono:
// nessuna regola nuova, solo `nettoDelMese` contro `calcNetAnnual`.
//
// Un reddito uguale tutti i mesi dà conguaglio zero: il software trattiene già
// giusto. Il conguaglio nasce dai mesi DIVERSI — un'estate piena, la 13ª, un
// mese sotto soglia e uno sopra — ed è per questo che chi lavora a turni ce
// l'ha quasi sempre.
//
// LA FORCHETTA (probabile)
// Non si dà una cifra: si fanno variare le due incognite che si possono
// misurare, e si mostra dove cadono gli estremi.
//  · I MESI CHE RESTANO: come da contratto, o come la media di quelli passati.
//  · IL BONUS GIÀ ACCREDITATO: quello che dà la regola mensile, o la quota
//    piena di legge sui mesi passati (il caso peggiore, come `restituzione.js`).
//    Il cedolino sa la cifra vera; l'app no.
//
// COSA NON SA (e la pagina lo dice): altri datori o redditi, detrazioni che
// non sono da lavoro (figli, spese), la fine del contratto. Queste NON
// allargano la forchetta, perché non si possono stimare: si scrivono.
//
// Modulo puro, senza React e senza browser.

import { calcTotalPay } from './pay.js';
import {
  nettoDelMese, lordoDelMese, calcNetAnnual, monthlyBaseGross, tiSospeso, trattamentoIntegrativo, TAX_2026,
} from './net.js';
import { getDaysInMonth, parseDate } from './dates.js';

/** Sotto questa cifra, da entrambi gli estremi, si dice «circa in pari». */
export const SOGLIA_PARI = 20;

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Il saldo del conguaglio su dodici mesi dati. `saldo` positivo = a debito
 * (te li riprendono), negativo = a credito.
 *
 * @param {Array<{lordo:number, extra:number, giorni:number}>} mesi dodici voci;
 *   `lordo` 0 fuori dal rapporto di lavoro.
 * @param {object} settings
 * @param {{ tiPienoFinoA?: number }} [opt] mesi (indice ≤) per cui si assume il
 *   bonus accreditato pieno invece che secondo la regola mensile.
 */
export function saldoConguaglio(mesi, settings = {}, { tiPienoFinoA = -1 } = {}) {
  let irpef = 0, ti = 0, cuneo = 0, lordoAnno = 0, giorni = 0;
  mesi.forEach((m, i) => {
    if (!(m.lordo > 0)) return;
    const n = nettoDelMese(m.lordo, settings, m.giorni, m.extra || 0);
    irpef += n.irpefNetta;
    cuneo += n.bonusCuneo;
    ti += (i <= tiPienoFinoA && !tiSospeso(settings))
      ? (TAX_2026.TI_MASSIMO * m.giorni) / 365
      : n.trattamentoIntegrativo;
    lordoAnno += m.lordo;
    giorni += m.giorni;
  });

  // Il dovuto dell'anno. Detrazioni e bonus sono RAPPORTATI AL PERIODO DI
  // LAVORO: il calcolo annuo li dà per 365 giorni, e chi è stato assunto a
  // luglio si vedrebbe accreditare a dicembre detrazioni che non ha maturato.
  const a = calcNetAnnual(lordoAnno, settings);
  const quota = Math.min(1, giorni / 365);
  const detLavoro = a.detrazioneLavoro * quota;
  const irpefDovuta = Math.max(0, a.irpefLorda - detLavoro - a.detrazioneCuneo * quota);
  // La capienza si misura con la detrazione dei giorni lavorati, non con quella
  // di un anno intero: con questa, chi è assunto a luglio con 6.600 € risultava
  // incapiente e il modello gli inventava 500 € di bonus da restituire.
  // Sotto i 15.000 il bonus è 1.200 € rapportati al periodo; sopra, la norma
  // lo lega alla differenza fra detrazione e imposta, che è già dei giorni.
  const tiAnno = trattamentoIntegrativo(a.imponibile, a.irpefLorda, detLavoro);
  const tiDovuto = a.imponibile <= TAX_2026.TI_SOGLIA_PIENO ? tiAnno * quota : tiAnno;

  const voci = {
    irpef: r2(irpefDovuta - irpef),
    trattamentoIntegrativo: r2(ti - tiDovuto),
    indennita: r2(cuneo - a.bonusCuneo),
  };
  return {
    voci,
    saldo: r2(voci.irpef + voci.trattamentoIntegrativo + voci.indennita),
    lordoAnno: r2(lordoAnno),
    tiAccreditato: r2(ti),
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
 *  · passati, coperti dal montante: il montante diviso sui mesi che copre —
 *    come il datore l'abbia distribuito davvero l'app non lo sa;
 *  · passati, con turni: il lordo dei turni, come nel resto dell'app;
 *  · questo mese e i prossimi: `contratto` o `media` dei mesi passati, mai
 *    meno di quanto già segnato.
 *
 * @returns {{ mesi: Array, meseOggi: number, mesiVuoti: number }}
 */
export function mesiDellAnno({ anno, allShifts = [], settings = {}, payMap, oggi = new Date(), scenario = 'contratto' }) {
  const meseOggi = anno === oggi.getFullYear() ? oggi.getMonth() : (anno < oggi.getFullYear() ? 12 : 0);
  const inizio = inizioRapporto(anno, settings);

  const montante = Number(settings.priorTaxableIncome) || 0;
  const cutoff = String(settings.priorIncomeDate || '');
  const cutoffIdx = montante > 0 && Number(cutoff.slice(0, 4)) === anno ? Number(cutoff.slice(5, 7)) - 1 : -1;
  const mesiMontante = Math.max(1, cutoffIdx - inizio.mese + 1);

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
    if (m <= cutoffIdx) { mesi.push({ lordo: montante / mesiMontante, extra: 0, giorni }); continue; }
    const paga = pagaDi(m);
    const effettiva = m < meseOggi ? paga : Math.max(paga, futuro);
    if (m < meseOggi && paga === 0) mesiVuoti += 1;
    const { lordo, extraMese } = lordoDelMese(effettiva, anno, m, settings);
    mesi.push({ lordo, extra: extraMese, giorni: lordo > 0 ? giorni : 0 });
  }
  return { mesi, meseOggi, mesiVuoti };
}

/**
 * La stima da mostrare: forchetta, stima centrale per voce, e cosa non si sa.
 * `null` se non c'è niente su cui stimare (nessun reddito nell'anno).
 */
export function stimaConguaglio({ anno, allShifts, settings, payMap, oggi = new Date() }) {
  const casi = [];
  let centrale = null;
  let mesiVuoti = 0;
  for (const scenario of ['contratto', 'media']) {
    const { mesi, meseOggi, mesiVuoti: vuoti } = mesiDellAnno({ anno, allShifts, settings, payMap, oggi, scenario });
    mesiVuoti = vuoti;
    for (const tiPienoFinoA of [-1, meseOggi - 1]) {
      const s = saldoConguaglio(mesi, settings, { tiPienoFinoA });
      if (s.lordoAnno <= 0) return null;
      casi.push(s.saldo);
      if (scenario === 'contratto' && tiPienoFinoA === -1) centrale = s;
    }
  }
  const min = Math.min(...casi);
  const max = Math.max(...casi);
  return {
    min, max, centrale,
    direzione: Math.max(Math.abs(min), Math.abs(max)) < SOGLIA_PARI ? 'pari'
      : (min >= 0 ? 'debito' : (max <= 0 ? 'credito' : 'incerta')),
    mesiVuoti,
  };
}
