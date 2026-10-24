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
// La proprietà che conta (→ riscontri/check-flusso-ore.mjs): voci più
// maggiorazioni fanno `calcTotalPay(...).total` al centesimo, e ogni ora
// segnata arriva in una voce sola.

import { calcShiftMinutes, isSunday } from './pay.js';
import { isHoliday } from './holidays.js';
import { tipoTurno, TIPO } from './assenze.js';

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
 * @param {Array<any>} turni i turni del mese (quelli contati)
 * @param {Record<string, any>} byShift la mappa di `computePayByShift` su TUTTI i turni
 * @param {Impostazioni} [settings]
 * @returns {{
 *   origini: Array<{id: string, nome: string, minuti: number}>,
 *   voci: Array<{id: string, nome: string, minuti: number, euro: number}>,
 *   flussi: Array<{da: string, a: string, minuti: number}>,
 *   maggiorazioni: Array<{id: string, nome: string, minuti: number, euro: number}>,
 *   totale: number,
 * }}
 */
export function flussoOre(turni, byShift, settings = {}) {
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

    if (tipo !== TIPO.LAVORO) {
      const a = tipo === TIPO.MALATTIA ? 'malattia' : 'retribuzione';
      scorre(tipo, a, m);
      voci[a].euro += v.base;
      continue;
    }
    if (isHoliday(s.date, settings)) {
      scorre('festivi', 'festivo', m);
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
  };
}
