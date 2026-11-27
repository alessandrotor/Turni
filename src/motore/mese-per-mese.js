// LA DETRAZIONE MESE PER MESE: perché in busta cambia ogni mese. Ogni mese il
// programma paghe stima l'anno (`lordoPresuntoAnno()`, capienza.js) e da quella
// stima sceglie detrazione e trattamento integrativo; la detrazione del mese è
// quella annua per i giorni del mese su 365. Novembre 2026: «la detrazione
// cambia di mese in mese in base al calcolo che fa il datore sul totale» non si
// capiva da nessuna parte, nemmeno a chi mantiene il progetto.
//
// I mesi passati senza turni NON vengono dal montante diviso in parti uguali
// (lo fa il conguaglio, che deve tornare col totale): qui serve la forma
// dell'anno, e un mese senza dati vale la paga da contratto, che il datore
// deve dare comunque. Si dice quale mese è stimato così (`fonte`).
// → check-mese-per-mese.mjs

import { lordoDelMese, monthlyBaseGross, detrazioneLavoro, redditoComplessivo } from './net.js';
import { calcTotalPay } from './pay.js';
import { capienzaProgressiva } from './capienza.js';
import { nettoDelMeseConPremio } from './premio-risultato.js';
import { fiscoDi } from './fisco/index.js';
import { parseDate, richiediOggi } from './date.js';

/**
 * I dodici mesi come li decide il datore.
 * @param {{ anno: number, allShifts?: Array<any>, settings?: import('./impostazioni.js').Impostazioni, payMap?: object|null,
 *   oggi: Date, premioOgniMese?: boolean }} p `premioOgniMese`: il premio fisso
 *   (`monthlyBonusAmount`) in tutti i mesi, come se fosse spuntato ovunque
 * @returns {Array<null | { mese: number, lordo: number, fonte: 'turni'|'contratto',
 *   finora: number, moltiplicatore: number, stimaLorda: number, stima: number,
 *   sopra: boolean, detrazioneAnnua: number, giorni: number, detrazione: number, ti: number }>}
 *   null per i mesi prima dell'assunzione. `stima` è il reddito (lordo meno
 *   contributi) su cui si misurano i 15.000.
 */
export function detrazioneMesePerMese({
  anno, allShifts = [], settings = {}, payMap = null, oggi, premioOgniMese = false,
}) {
  richiediOggi(oggi, 'detrazioneMesePerMese');
  const s = premioOgniMese
    ? { ...settings, monthlyBonus: Object.fromEntries(Array.from({ length: 12 }, (_, m) => [`${anno}-${String(m + 1).padStart(2, '0')}`, true])) }
    : settings;
  const T = fiscoDi(s);
  const assunto = /^\d{4}-\d{2}-\d{2}$/.test(String(s.hireDate || '')) ? parseDate(s.hireDate) : null;
  const primoMese = assunto && assunto.getFullYear() === anno ? assunto.getMonth()
    : assunto && assunto.getFullYear() > anno ? 12 : 0;
  const base = monthlyBaseGross(s);

  let progressivo = 0;
  let mesiPagati = 0;
  const esito = [];
  for (let m = 0; m < 12; m += 1) {
    if (m < primoMese) { esito.push(null); continue; }
    const turni = allShifts.filter((t) => {
      const d = parseDate(t.date);
      return d.getFullYear() === anno && d.getMonth() === m;
    });
    const paga = turni.length ? (calcTotalPay(turni, s, allShifts, payMap)?.total || 0) : 0;
    // Almeno la paga da contratto, che il datore deve dare comunque: un mese
    // senza turni, o con pochi segnati (aprile 2026: 3 turni, 136 €), la vale.
    const fonte = paga >= base && paga > 0 ? 'turni' : 'contratto';
    const effettiva = Math.max(paga, base);
    const { lordo, extraMese, premioMese } = lordoDelMese(effettiva, anno, m, s);
    const giorni = new Date(anno, m + 1, 0).getDate();
    const prog = { lordo: progressivo, mesi: mesiPagati, mese: m };
    const netto = nettoDelMeseConPremio({ lordo, extraMese, premioMese }, s, giorni, anno,
      capienzaProgressiva(lordo - premioMese, s, prog));
    const stimaLorda = netto.esitoTi?.lordoPresunto ?? lordo * 12;
    const stima = netto.esitoTi?.proiezione ?? Math.round(redditoComplessivo(stimaLorda, s));
    const lordoOrdinario = lordo - (extraMese || 0);
    esito.push({
      mese: m,
      lordo,
      fonte,
      finora: progressivo,
      moltiplicatore: lordoOrdinario > 0 ? Math.round((stimaLorda - progressivo) / lordo) : 0,
      stimaLorda,
      stima,
      sopra: stima > T.TI_SOGLIA_PIENO,
      detrazioneAnnua: detrazioneLavoro(stima, T),
      giorni,
      detrazione: netto.detrazioniApplicate || 0,
      ti: netto.trattamentoIntegrativo || 0,
    });
    if (lordo > 0) { progressivo += lordo; mesiPagati += 1; }
  }
  return esito;
}
