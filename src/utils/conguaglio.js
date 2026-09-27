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
//  · COME ERANO I MESI DEL MONTANTE: tutti uguali, o alterni del 20% sopra e
//    sotto (le buste 2026 vanno da 1.099 a 2.048 €). A parità di somma
//    cambia chi ha preso il bonus, e con lui le tasse trattenute.
//
// Una prima versione variava il solo bonus già accreditato, «pieno» contro
// «regola mensile», e dava a un profilo reale da 170 € a credito a 790 € a
// debito. Era una combinazione che non esiste: bonus accreditato come nei mesi
// bassi, IRPEF trattenuta come nei mesi alti. Fatta variare la distribuzione
// dei mesi, che muove bonus e IRPEF insieme, lo stesso profilo sta fra 170 e
// 105 € a credito — bonus e detrazione si compensano, come in `costoSoglia`.
//
// LA 14ª NEL SUO MESE, non spalmata. Il montante fino a luglio contiene la 14ª
// di giugno: diviso in sette parti uguali dava 1.294 € al mese, appena sopra i
// 1.250, e nessun mese col bonus. Il popup del bonus diceva «888 € presi
// finora», questo «+999 € te li ridanno»: due schermate, due anni diversi. Le
// buste dicono il contrario del modello — bonus a febbraio, maggio e luglio,
// niente a giugno — ed è quello che esce togliendo la 14ª prima di dividere.
// Resta un'ipotesi: il bonus vero lo scrive il cedolino, e chi lo copia nel
// popup (`tiAccreditatoMontante`) lo fa valere al posto del modello.
//
// Il bonus accreditato finora (`tiFinora`) esce da qui ed è lo stesso che
// mostra il riquadro del bonus: una sola ipotesi per le due schermate.
//
// COSA NON SA (e la pagina lo dice): altri datori o redditi, detrazioni che
// non sono da lavoro (figli, spese), la fine del contratto. Queste NON
// allargano la forchetta, perché non si possono stimare: si scrivono.
//
// Modulo puro, senza React e senza browser.

import { calcTotalPay } from './pay.js';
import {
  nettoDelMese, lordoDelMese, calcNetAnnual, monthlyBaseGross, trattamentoIntegrativo, TAX_2026,
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
 */
export function saldoConguaglio(mesi, settings = {}, { tiMontanteNoto = null } = {}) {
  let irpef = 0, cuneo = 0, lordoAnno = 0, giorni = 0;
  const tiMesi = mesi.map((m) => {
    if (!(m.lordo > 0)) return 0;
    const n = nettoDelMese(m.lordo, settings, m.giorni, m.extra || 0);
    irpef += n.irpefNetta;
    cuneo += n.bonusCuneo;
    lordoAnno += m.lordo;
    giorni += m.giorni;
    return n.trattamentoIntegrativo;
  });
  // Il bonus dei mesi del montante, se lo ha copiato dalle buste, vale quello:
  // ripartito come il modello lo aveva ripartito, o in parti uguali se il
  // modello non ne vedeva. Così anche `tiFinora` a metà montante resta sensato.
  if (tiMontanteNoto != null) {
    const idx = mesi.map((m, i) => (m.montante && m.lordo > 0 ? i : -1)).filter((i) => i >= 0);
    const modello = idx.reduce((s, i) => s + tiMesi[i], 0);
    idx.forEach((i) => {
      tiMesi[i] = modello > 0 ? tiMontanteNoto * (tiMesi[i] / modello) : tiMontanteNoto / idx.length;
    });
  }
  const ti = tiMesi.reduce((s, v) => s + v, 0);

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
    tiMesi,
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
 * @returns {{ mesi: Array, meseOggi: number, mesiVuoti: number }}
 */
export function mesiDellAnno({
  anno, allShifts = [], settings = {}, payMap, oggi = new Date(), scenario = 'contratto', montanteAlterno = false,
}) {
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
    const { lordo, extraMese } = lordoDelMese(effettiva, anno, m, settings);
    mesi.push({ lordo, extra: extraMese, giorni: lordo > 0 ? giorni : 0 });
  }
  return { mesi, meseOggi, mesiVuoti, cutoffIdx };
}

/**
 * Il bonus dei mesi del montante copiato dalle buste, se vale ancora: è legato
 * al mese del montante, e un montante spostato lo rende vecchio. Meglio
 * tornare al modello che usare in silenzio la cifra di un altro periodo.
 */
export function tiMontanteNoto(settings = {}) {
  const v = settings.tiAccreditatoMontante;
  if (!v || typeof v !== 'object') return null;
  const importo = Number(v.importo);
  if (!Number.isFinite(importo) || importo < 0) return null;
  if (!(Number(settings.priorTaxableIncome) > 0)) return null;
  return v.fino === String(settings.priorIncomeDate || '').slice(0, 7) ? importo : null;
}

/**
 * La stima da mostrare: forchetta, stima centrale per voce, e cosa non si sa.
 * `null` se non c'è niente su cui stimare (nessun reddito nell'anno).
 */
export function stimaConguaglio({ anno, allShifts, settings, payMap, oggi = new Date() }) {
  const casi = [];
  let centrale = null;
  let mesiVuoti = 0;
  let meseOggi = 0;
  let cutoffIdx = -1;
  const noto = tiMontanteNoto(settings);
  for (const scenario of ['contratto', 'media']) {
    // Col bonus delle buste la distribuzione non si fa più variare: moverebbe
    // l'IRPEF lasciando fermo il bonus, la combinazione che non esiste.
    for (const montanteAlterno of noto == null ? [false, true] : [false]) {
      const esito = mesiDellAnno({
        anno, allShifts, settings, payMap, oggi, scenario, montanteAlterno,
      });
      ({ mesiVuoti, meseOggi, cutoffIdx } = esito);
      const s = saldoConguaglio(esito.mesi, settings, { tiMontanteNoto: noto });
      if (s.lordoAnno <= 0) return null;
      casi.push(s.saldo);
      if (scenario === 'contratto' && !montanteAlterno) centrale = s;
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
  };
}
