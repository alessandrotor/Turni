// Quanto rischi di dover RIDARE INDIETRO del trattamento integrativo (TI): quello
// pagato ogni mese dal datore che, se il reddito dell'anno supera i 15.000, a
// dicembre torna indietro. Il conto vero della perdita è in `costoSoglia`.
// Il rimedio è `noTrattamentoIntegrativo`: non erogato, niente da restituire.
// → docs/note-motore-restituzione.md
//
// Modulo puro: `node src/motore/riscontri/check-restituzione.mjs`.

import { tiDecision, calcNetAnnual, tiSospeso } from './net.js';
import { richiediOggi } from './date.js';
import { fiscoDi, fiscoDellAnno, conFisco, FISCO_ULTIMO } from './fisco/index.js';
import { lordoPerReddito } from './soglia-lorda.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

/**
 * Soglia di legge per la rateizzazione: sopra i 60 € il datore non trattiene
 * tutto a dicembre, ma spalma il recupero. Sotto, se lo riprende in una volta
 * sola. Cambia molto come si vive la cosa, quindi si dice.
 */
export const SOGLIA_RATEIZZAZIONE = 60;

export const CAUSA = {
  NESSUNA: 'nessuna',
  RINUNCIATO: 'rinunciato',
  OLTRE_MAX: 'oltre-28k',
  SENZA_CAPIENZA: 'senza-capienza',
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const trunc2 = (n) => Math.trunc(n * 100) / 100;

// La differenza fra importi in centesimi si fa sui centesimi interi: `trunc2(a - b)` ne perde uno.
const menoCent = (a, b) => (Math.round(a * 100) - Math.round(b * 100)) / 100;

/**
 * Giorni dell'anno già trascorsi alla data indicata, estremi compresi.
 * È la stessa base dei giorni con cui la busta calcola la quota (÷365).
 */
export function giorniTrascorsi(data) {
  if (data == null) return 0;
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return 0;
  const inizio = Date.UTC(d.getFullYear(), 0, 1);
  const oggi = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.min(365, Math.max(0, Math.round((oggi - inizio) / 86400000) + 1));
}

/**
 * Il giorno a cui misurare l'anno GUARDATO: oggi, il 31 dicembre per un anno
 * chiuso, `null` (zero giorni) per uno non ancora cominciato.
 * → check-restituzione.mjs
 */
export function dataDiRiferimento(anno, oggi) {
  richiediOggi(oggi, 'dataDiRiferimento');
  const corrente = oggi.getFullYear();
  if (anno === corrente || anno == null) return oggi;
  return anno < corrente ? new Date(anno, 11, 31) : null;
}

/**
 * Quanto avresti già preso SE il datore ti accreditasse la quota piena fin qui:
 * l'ipotesi per l'anteprima «sei vicino alla soglia, se la superi restituisci
 * circa X». Un «e se», non un fatto. Separata da `rischioRestituzione`, che azzera
 * l'erogato sotto soglia anche per incapienza (dove non è mai stato accreditato
 * niente). Si usa solo con `bonus.nearThreshold`, a un soffio dai 15.000, dove la
 * capienza c'è sempre.
 */
export function quotaPotenziale(oggi) {
  if (oggi !== null) richiediOggi(oggi, 'quotaPotenziale'); // null: anno non cominciato
  const T = oggi ? fiscoDellAnno(oggi.getFullYear()) : FISCO_ULTIMO;
  return trunc2((T.TI_MASSIMO * giorniTrascorsi(oggi)) / 365);
}

/**
 * Il rischio di restituzione, in euro.
 *
 * @param {object} opts
 * @param {Impostazioni} [opts.settings] impostazioni dell'app
 * @param {number} [opts.proiezioneAnnua] reddito annuo LORDO previsto a fine anno
 * @param {Date}   [opts.oggi] per i riscontri; di default la data corrente
 * @param {number} [opts.erogatoStimato] il bonus accreditato finora secondo la
 *   regola mensile (`stimaConguaglio().tiFinora`). Senza, la quota piena.
 * @returns {{erogato, spettante, daRestituire, rateizzabile, causa, giorni, unSoloDatore}}
 */
export function rischioRestituzione({ settings: impostazioni = {}, proiezioneAnnua = 0, oggi, erogatoStimato = null } = {}) {
  if (oggi !== null) richiediOggi(oggi, 'rischioRestituzione'); // null: anno non cominciato
  // Il fisco dell'anno guardato, se chi chiama non l'ha già scelto.
  const settings = impostazioni.fisco ? impostazioni : conFisco(impostazioni, oggi?.getFullYear());
  const T = fiscoDi(settings);
  const giorni = giorniTrascorsi(oggi);
  const vuoto = {
    erogato: 0, spettante: 0, daRestituire: 0, rateizzabile: false,
    giorni, unSoloDatore: true,
  };

  // Ha chiesto di non farselo accreditare: rischio ZERO per costruzione.
  if (tiSospeso(settings)) {
    return { ...vuoto, causa: CAUSA.RINUNCIATO };
  }

  const decisione = tiDecision(num(proiezioneAnnua), settings);
  const spettante = num(decisione.importoAnnuo);

  // Il TI è zero per due motivi opposti: reddito troppo ALTO (rischio vero) o troppo
  // BASSO (incapienza: mai accreditato, niente da restituire). Si guarda la soglia,
  // non il solo `spettante`.
  const sopraSoglia = decisione.redditoStimato > T.TI_SOGLIA_PIENO;
  if (!sopraSoglia) {
    return { ...vuoto, spettante, causa: CAUSA.NESSUNA };
  }

  // Quanto il datore ha accreditato: la stima mese per mese del conguaglio se c'è,
  // altrimenti la quota piena sui giorni trascorsi (caso peggiore).
  const erogato = Number.isFinite(erogatoStimato) && erogatoStimato >= 0
    ? trunc2(erogatoStimato)
    : trunc2((T.TI_MASSIMO * giorni) / 365);
  const daRestituire = Math.max(0, menoCent(erogato, spettante));

  let causa = CAUSA.NESSUNA;
  if (daRestituire > 0) {
    causa = decisione.redditoStimato > T.TI_SOGLIA_MAX
      ? CAUSA.OLTRE_MAX
      : CAUSA.SENZA_CAPIENZA;
  }

  return {
    erogato,
    spettante,
    daRestituire,
    rateizzabile: daRestituire > SOGLIA_RATEIZZAZIONE,
    causa,
    giorni,
    // Promemoria per l'interfaccia: con più datori la stima è per DIFETTO.
    unSoloDatore: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUANTO COSTA DAVVERO SUPERARE LA SOGLIA (la «buca» attorno ai 15.000, non la
// restituzione). → check-costo-soglia.mjs, docs/note-motore-restituzione.md

/**
 * La forma della buca attorno ai 15.000 €, calcolata sul motore.
 *
 * Niente costanti: `perditaMax` esce da due chiamate a `calcNetAnnual` e il
 * resto da ricerche binarie (una trentina di valutazioni).
 *
 * @returns {{tetto, nettoTetto, perditaMax, pareggio, larghezzaBuca, voci}}
 *   `tetto` è l'ultimo lordo che resta sotto soglia; `pareggio` il primo oltre
 *   il quale si sta di nuovo bene come prima; `voci` scompone la perdita nei
 *   movimenti che la producono (vedi sotto).
 */
export function costoSoglia(settings = {}) {
  const netto = (g) => calcNetAnnual(g, settings).net;

  // Il tetto si cerca sull'IMPONIBILE, non convertendo la soglia in lordo (finiva già sopra).
  const tetto = lordoPerReddito(fiscoDi(settings).TI_SOGLIA_PIENO, settings);
  const nettoTetto = netto(tetto);

  // Lo scalino è tutto fra il tetto e l'euro successivo: due valutazioni bastano.
  const perditaMax = Math.max(0, nettoTetto - netto(tetto + 1));

  // Il pareggio per bisezione: dopo lo scalino il netto torna a crescere, quindi
  // «primo valore che raggiunge di nuovo nettoTetto» è ben definito.
  let pareggio = null;
  if (perditaMax > 0) {
    let a = tetto + 1;
    let b = tetto + 5000;
    if (netto(b) >= nettoTetto) {
      while (a < b) {
        const mid = Math.floor((a + b) / 2);
        if (netto(mid) >= nettoTetto) b = mid;
        else a = mid + 1;
      }
      pareggio = a;
    }
  }

  // Le voci che compongono la perdita, dal motore ai due lati dello scalino:
  // `altro` assorbe il resto, così sommano SEMPRE a `perditaMax`.
  const sotto = calcNetAnnual(tetto, settings);
  const sopra = calcNetAnnual(tetto + 1, settings);
  const tasseDi = (v) => v.irpefNetta + v.addRegionale + v.addComunale;
  const perdita = Math.round(perditaMax);
  const bonus = Math.round(sopra.trattamentoIntegrativo - sotto.trattamentoIntegrativo);
  const tasse = Math.round(tasseDi(sotto) - tasseDi(sopra));
  const indennita = Math.round(sopra.bonusCuneo - sotto.bonusCuneo);

  return {
    tetto,
    nettoTetto,
    perditaMax: perdita,
    pareggio,
    larghezzaBuca: pareggio === null ? null : pareggio - tetto,
    voci: {
      bonus,                                             // sparisce: negativo
      tasse,                                             // scendono: positivo
      indennita,                                         // scende: negativo
      altro: -perdita - (bonus + tasse + indennita),
      detrazioneSotto: Math.round(sotto.detrazioneLavoro),
      detrazioneSopra: Math.round(sopra.detrazioneLavoro),
    },
  };
}

export const POSIZIONE = {
  SOTTO: 'sotto',
  DENTRO: 'dentro-buca',
  OLTRE: 'oltre',
};

/**
 * Dove si trova il reddito previsto rispetto alla buca.
 *
 * L'interfaccia sceglie cosa dire da qui, e i tre casi vogliono tre messaggi:
 *  · SOTTO  quanto margine resta, e quanto costerebbe bruciarlo
 *  · DENTRO quanto manca per tornare in pari: l'unico caso azionabile
 *  · OLTRE  niente da fare e niente da temere, e va detto
 */
export function posizioneRispettoSoglia(proiezioneAnnua, settings = {}, costo = null) {
  const c = costo || costoSoglia(settings);
  const g = Math.max(0, Number(proiezioneAnnua) || 0);
  if (g <= c.tetto) return POSIZIONE.SOTTO;
  if (c.pareggio !== null && g < c.pareggio) return POSIZIONE.DENTRO;
  return POSIZIONE.OLTRE;
}

/**
 * Quanto manca, in euro di lordo, per uscire dalla buca dal basso.
 * Zero se non si è dentro: così l'interfaccia non deve rifare il confronto.
 */
export function mancaAlPareggio(proiezioneAnnua, settings = {}, costo = null) {
  const c = costo || costoSoglia(settings);
  if (c.pareggio === null) return 0;
  const g = Math.max(0, Number(proiezioneAnnua) || 0);
  return g > c.tetto && g < c.pareggio ? Math.round(c.pareggio - g) : 0;
}

/**
 * Cosa succede AL TUO LORDO, non nel punto peggiore: a questo lordo, rispetto a
 * essermi fermato sotto la soglia, cosa ho perso e guadagnato? Stesso conto di
 * `costoSoglia` (due `calcNetAnnual`) con altri estremi; le voci sommano SEMPRE
 * al totale (il lavoro in più assorbe gli arrotondamenti). → check-costo-soglia.mjs
 *
 * @returns {{ lordo, tetto, totale, voci: {bonus, tasse, indennita, lavoro,
 *   detrazioneSotto, detrazioneSopra} }}
 */
export function confrontoConSoglia(lordo, settings = {}, costo = null) {
  const c = costo || costoSoglia(settings);
  const g = Math.max(0, Number(lordo) || 0);
  const sotto = calcNetAnnual(c.tetto, settings);
  const sopra = calcNetAnnual(g, settings);
  const tasseDi = (v) => v.irpefNetta + v.addRegionale + v.addComunale;
  const totale = Math.round(sopra.net - sotto.net);
  const bonus = Math.round(sopra.trattamentoIntegrativo - sotto.trattamentoIntegrativo);
  const tasse = Math.round(tasseDi(sotto) - tasseDi(sopra));
  const indennita = Math.round(sopra.bonusCuneo - sotto.bonusCuneo);
  return {
    lordo: g,
    tetto: c.tetto,
    totale,
    voci: {
      bonus,
      tasse,
      indennita,
      lavoro: totale - (bonus + tasse + indennita),
      detrazioneSotto: Math.round(sotto.detrazioneLavoro),
      detrazioneSopra: Math.round(sopra.detrazioneLavoro),
    },
  };
}
