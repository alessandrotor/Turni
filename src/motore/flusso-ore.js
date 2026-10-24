// DOVE VANNO LE ORE DEL MESE: da che giornate vengono e in quale voce della
// busta finiscono. È il diagramma a flussi del riepilogo, ma qui non si
// calcola niente di nuovo: si RIAFFETTANO i campi che `computePayByShift` ha
// già prodotto per ogni turno. Un conto rifatto qui prima o poi direbbe una
// cifra diversa dal totale del mese, e allora nessuno dei due sarebbe credibile.
//
// A sinistra le ore segnate, per tipo di giornata (feriali, domeniche, festivi
// lavorati, ferie, permessi, festività, malattia). A destra le voci in cui la
// busta le paga, con gli euro: retribuzione ordinaria (dove stanno anche ferie
// e permessi, come in busta), supplementare, straordinario, lavoro festivo,
// malattia. Due flussi che la busta non scrive ma che spiegano le sue cifre:
//  - «monte ore»: a mese chiuso la retribuzione paga il monte ore intero anche
//    quando parte delle ore è già andata in supplementare (luglio 2026: 103,20
//    ore ordinarie più le supplementari). Quelle ore non vengono da nessun
//    turno: è il contratto che le garantisce.
//  - «già nel monte»: ore lavorate entro le 24 della settimana in un mese che
//    ha già il monte pieno. Non aggiungono euro, e il diagramma lo dice invece
//    di farle sparire.
// Domenicale, notturno e maggiorazioni a mano NON sono ore in più: sono
// percentuali sopra ore già contate. Stanno a parte, in `maggiorazioni`.
//
// Per la vista «settimane» (`settimane`) le stesse ore si rimettono nelle
// settimane lun-dom, perché il supplementare si conta lì: oltre le ore del
// contratto. Una settimana a cavallo di due mesi porta con sé le ore
// dell'altro mese (`altroMese`): riempiono la soglia anche se non si vedono
// qui, ed è il motivo per cui il supplementare può cominciare prima della linea.
//
// La proprietà che conta (→ riscontri/check-flusso-ore.mjs): voci più
// maggiorazioni fanno `calcTotalPay(...).total` al centesimo, e ogni ora
// segnata arriva in una voce sola.

import { calcShiftMinutes, isSunday } from './pay.js';
import { isHoliday } from './holidays.js';
import { tipoTurno, TIPO } from './assenze.js';
import { parseDate, getWeekStart, formatDate } from './date.js';
import { isMensilizzato, monthlyContractHours } from './ccnl.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

// In quest'ordine perché i nastri si incrocino il meno possibile: prima tutto
// ciò che va (anche) in retribuzione, poi domeniche, festivi e malattia, nello
// stesso ordine delle voci a destra.
export const ORIGINI = {
  monte: 'Monte ore',
  feriali: 'Feriali',
  [TIPO.FERIE]: 'Ferie',
  [TIPO.PERMESSO]: 'Permessi',
  [TIPO.FESTIVITA]: 'Festività',
  domeniche: 'Domeniche',
  festivi: 'Festivi lavorati',
  [TIPO.MALATTIA]: 'Malattia',
};

/**
 * @typedef {{inizio: string, altroMese: number, ferie: number, permesso: number, malattia: number,
 *   ordinarie: number, supplementare: number, straordinario: number, festivo: number, festivita: number,
 *   euroSupplementare: number, euroStraordinario: number}} Settimana
 */

/**
 * @param {Array<any>} turni i turni del mese (quelli contati)
 * @param {Record<string, any>} byShift la mappa di `computePayByShift` su TUTTI i turni
 * @param {Impostazioni} [settings]
 * @param {Array<any>} [tutti] tutti i turni, per le ore dell'altro mese nelle settimane a cavallo
 * @returns {{
 *   origini: Array<{id: string, nome: string, minuti: number}>,
 *   voci: Array<{id: string, nome: string, minuti: number, euro: number}>,
 *   flussi: Array<{da: string, a: string, minuti: number}>,
 *   maggiorazioni: Array<{id: string, nome: string, minuti: number, euro: number}>,
 *   totale: number,
 *   settimane: Array<Settimana>,
 *   monte: {pagate: number, monte: number}|null,
 * }}
 */
export function flussoOre(turni, byShift, settings = {}, tutti = turni) {
  const fascia1 = settings.onCall ? 'Straordinario' : 'Supplementare';
  const voci = {
    retribuzione: { nome: 'Retribuzione', minuti: 0, euro: 0 },
    supplementare: { nome: fascia1, minuti: 0, euro: 0 },
    straordinario: { nome: 'Straordinario', minuti: 0, euro: 0 },
    festivo: { nome: 'Lavoro festivo', minuti: 0, euro: 0 },
    malattia: { nome: 'Malattia', minuti: 0, euro: 0 },
    giaNelMonte: { nome: 'Già nel monte ore', minuti: 0, euro: 0 },
  };
  const magg = {
    domenicale: { nome: 'Domenicale', minuti: 0, euro: 0 },
    notturno: { nome: 'Notturno', minuti: 0, euro: 0 },
    manuale: { nome: 'A mano', minuti: 0, euro: 0 },
  };
  const origini = new Map();
  const flussi = new Map();
  const settimane = new Map();
  const settimana = (data) => {
    const k = formatDate(getWeekStart(parseDate(data)));
    if (!settimane.has(k)) {
      settimane.set(k, { inizio: k, altroMese: 0, ferie: 0, permesso: 0, malattia: 0, ordinarie: 0,
        supplementare: 0, straordinario: 0, festivo: 0, festivita: 0, euroSupplementare: 0, euroStraordinario: 0 });
    }
    return settimane.get(k);
  };
  const scorre = (da, a, minuti) => {
    if (minuti <= 0) return;
    origini.set(da, (origini.get(da) || 0) + minuti);
    flussi.set(`${da}>${a}`, (flussi.get(`${da}>${a}`) || 0) + minuti);
    voci[a].minuti += minuti;
  };

  for (const s of turni) {
    const v = byShift?.[s.id];
    if (!v) continue;
    const m = calcShiftMinutes(s);
    const tipo = tipoTurno(s);
    magg.domenicale.euro += v.surchargeSunday;
    magg.domenicale.minuti += v.surchargeSunday > 0 ? v.sundayMinutes : 0;
    magg.notturno.euro += v.surchargeNight;
    magg.notturno.minuti += v.nightMinutes;
    magg.manuale.euro += v.surchargeManual;

    const w = settimana(s.date);
    if (tipo !== TIPO.LAVORO) {
      const a = tipo === TIPO.MALATTIA ? 'malattia' : 'retribuzione';
      scorre(tipo, a, m);
      voci[a].euro += v.base;
      w[tipo] += m;
      continue;
    }
    if (isHoliday(s.date, settings)) {
      scorre('festivi', 'festivo', m);
      w.festivo += m;
      voci.festivo.euro += v.base + v.surchargeHoliday;
      continue;
    }
    voci.festivo.euro += v.surchargeHoliday;   // zero fuori dai festivi
    const da = isSunday(s.date) ? 'domeniche' : 'feriali';
    const ordinari = m - v.overtimeMinutes - v.straordinarioMinutes;
    const pagati = v.ordinariPagatiMinutes;
    scorre(da, 'supplementare', v.overtimeMinutes);
    scorre(da, 'straordinario', v.straordinarioMinutes);
    scorre(da, 'retribuzione', Math.min(ordinari, pagati));
    scorre(da, 'giaNelMonte', ordinari - pagati);
    scorre('monte', 'retribuzione', pagati - ordinari);
    voci.retribuzione.euro += v.base - v.overtimeBase - v.straordinarioBase;
    voci.supplementare.euro += v.overtimeBase + v.surchargeOvertime;
    voci.straordinario.euro += v.straordinarioBase + v.surchargeStraordinario;
    w.ordinarie += ordinari;
    w.supplementare += v.overtimeMinutes;
    w.straordinario += v.straordinarioMinutes;
    w.euroSupplementare += v.overtimeBase + v.surchargeOvertime;
    w.euroStraordinario += v.straordinarioBase + v.surchargeStraordinario;
  }
  // Le ore dell'altro mese che riempiono la stessa soglia (non i festivi, che
  // stanno fuori dal conteggio, come in pay.js).
  const delMese = new Set(turni.map((s) => s.id));
  for (const s of tutti) {
    if (delMese.has(s.id) || tipoTurno(s) === TIPO.FESTIVITA) continue;
    if (tipoTurno(s) === TIPO.LAVORO && isHoliday(s.date, settings)) continue;
    const k = formatDate(getWeekStart(parseDate(s.date)));
    if (settimane.has(k)) settimane.get(k).altroMese += calcShiftMinutes(s);
  }

  // Sotto il centesimo di minuto è rumore della quota ordinaria, non un flusso.
  const tieni = (x) => x.minuti >= 0.5 || Math.abs(x.euro || 0) >= 0.005;
  const elenco = (o) => Object.entries(o).map(([id, x]) => ({ id, ...x })).filter(tieni);
  const vociOut = elenco(voci);
  const maggOut = elenco(magg);
  return {
    origini: Object.keys(ORIGINI).filter((id) => (origini.get(id) || 0) >= 0.5)
      .map((id) => ({ id, nome: ORIGINI[id], minuti: origini.get(id) })),
    voci: vociOut,
    flussi: [...flussi.entries()].filter(([, min]) => min >= 0.5)
      .map(([k, minuti]) => { const [da, a] = k.split('>'); return { da, a, minuti }; }),
    maggiorazioni: maggOut,
    totale: [...vociOut, ...maggOut].reduce((t, x) => t + x.euro, 0),
    settimane: [...settimane.values()].sort((a, b) => a.inizio.localeCompare(b.inizio)),
    // Il monte ore del mensilizzato: quante ore ordinarie paga la busta sul totale.
    monte: !settings.onCall && isMensilizzato(settings)
      ? { pagate: voci.retribuzione.minuti, monte: monthlyContractHours(settings) * 60 } : null,
  };
}
