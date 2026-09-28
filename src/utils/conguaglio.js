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
  nettoDelMese, lordoDelMese, calcNetAnnual, monthlyBaseGross, TAX_2026,
  tiSpettaQuestoMese, modoTrattamentoIntegrativo,
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
export function saldoConguaglio(mesi, settings = {}, { tiMontanteNoto = null, irpefMontanteNota = null } = {}) {
  let cuneo = 0, lordoAnno = 0, giorni = 0;
  const irpefMesi = [];
  const tiMesi = mesi.map((m, i) => {
    irpefMesi[i] = 0;
    if (!(m.lordo > 0)) return 0;
    const n = nettoDelMese(m.lordo, settings, m.giorni, m.extra || 0);
    irpefMesi[i] = n.irpefNetta;
    cuneo += n.bonusCuneo;
    lordoAnno += m.lordo;
    giorni += m.giorni;
    return n.trattamentoIntegrativo;
  });
  // Quello che le buste del montante hanno fatto davvero, se lo ha copiato:
  // vale al posto della stima, ripartito sui mesi come li ripartiva il
  // modello (o in parti uguali se il modello non ne vedeva). Il montante è
  // un totale, e diviso in parti uguali sbagliava di 170 € l'IRPEF di
  // gennaio–agosto contro il progressivo stampato in busta.
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
  // Le due colonne da cui nascono le voci: quanto è passato in busta mese per
  // mese, e quanto è dovuto sull'anno. «IRPEF −317 €» da solo non si capisce;
  // «trattenute 900, dovute 1.217» sì.
  const dettaglio = {
    irpef: { mesi: r2(irpef), anno: r2(irpefDovuta) },
    trattamentoIntegrativo: { mesi: r2(ti), anno: r2(tiDovuto) },
    indennita: { mesi: r2(cuneo), anno: r2(a.bonusCuneo) },
  };
  return {
    voci,
    dettaglio,
    annoSottoSoglia: a.imponibile <= TAX_2026.TI_SOGLIA_PIENO,
    saldo: r2(voci.irpef + voci.trattamentoIntegrativo + voci.indennita),
    lordoAnno: r2(lordoAnno),
    tiAccreditato: r2(ti),
    tiMesi,
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
 * @returns {{ mesi: Array, meseOggi: number, mesiVuoti: number }}
 */
export function mesiDellAnno({
  anno, allShifts = [], settings = {}, payMap, oggi = new Date(), scenario = 'contratto', montanteAlterno = false,
  totaleAnno = null,
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
  // LA PROIEZIONE DEL MOTORE, non una somma rifatta qui. Con `totaleAnno` (il
  // valore di `projectAnnualIncome`, lo stesso del riquadro del bonus) i mesi
  // che restano si scalano finché l'anno fa esattamente quella cifra. Prima il
  // conguaglio sommava i mesi per conto suo: il riquadro diceva «superi i
  // 15.000» e il popup, sugli stessi dati, «resti sotto». I mesi passati non
  // si toccano: sono fatti, e il bonus già preso viene da lì.
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
export function stimaConguaglio({ anno, allShifts, settings, payMap, oggi = new Date(), proiezioneAnnua = null }) {
  const casi = [];
  let centrale = null;
  let mesiVuoti = 0;
  let meseOggi = 0;
  let cutoffIdx = -1;
  let mesiCentrale = [];
  const noto = tiMontanteNoto(settings);
  const irpefNota = irpefMontanteNota(settings);
  // Il centro è la proiezione del motore quando c'è; contratto e media dei
  // mesi passati fanno gli estremi.
  const centro = Number.isFinite(proiezioneAnnua) && proiezioneAnnua > 0 ? 'proiezione' : 'contratto';
  for (const scenario of centro === 'proiezione' ? ['proiezione', 'contratto', 'media'] : ['contratto', 'media']) {
    // Con una cifra delle buste la distribuzione non si fa più variare:
    // moverebbe l'altra voce lasciando ferma questa, la combinazione che non
    // esiste (vedi l'intestazione).
    for (const montanteAlterno of noto == null && irpefNota == null ? [false, true] : [false]) {
      const esito = mesiDellAnno({
        anno, allShifts, settings, payMap, oggi, montanteAlterno,
        scenario: scenario === 'proiezione' ? 'contratto' : scenario,
        totaleAnno: scenario === 'proiezione' ? proiezioneAnnua : null,
      });
      ({ mesiVuoti, meseOggi, cutoffIdx } = esito);
      const s = saldoConguaglio(esito.mesi, settings, { tiMontanteNoto: noto, irpefMontanteNota: irpefNota });
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
    // PERCHÉ bonus e IRPEF si muovono: i mesi in cui la regola mensile ha
    // deciso diversamente dall'anno. Sopra 1.250 € il datore non dà il bonus
    // ma applica la detrazione più alta; sotto, il contrario. Solo con la
    // decisione automatica: a mano, la ragione è la scelta, non il mese.
    mesiSopraSoglia: modoTrattamentoIntegrativo(settings) === 'auto'
      ? mesiCentrale.map((m, i) => (m.lordo > 0 && !tiSpettaQuestoMese(m.lordo, settings).spetta ? i : -1)).filter((i) => i >= 0)
      : null,
    mesiSottoSoglia: modoTrattamentoIntegrativo(settings) === 'auto'
      ? mesiCentrale.map((m, i) => (m.lordo > 0 && tiSpettaQuestoMese(m.lordo, settings).spetta ? i : -1)).filter((i) => i >= 0)
      : null,
  };
}
