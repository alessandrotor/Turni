// Stima del netto (fiscalità 2026, BETA): contributi, IRPEF, detrazioni, addizionali,
// trattamento integrativo e cuneo. Funzioni pure.

import { getCcnl, monthlyContractHours } from './ccnl.js';
import { contributiDiLegge } from './contributi-legge.js';
import { trattenuteFuoriReddito } from './previdenza.js';
import { calcTotalPay } from './pay.js';
import { parseDate, richiediOggi } from './date.js';
// Le regole fiscali dell'anno stanno in `fisco/`, un file per anno.
import { TAX_2026, FISCO_ULTIMO, fiscoDi } from './fisco/index.js';
import { EXTRA_MONTHS } from './mensilita.js';
import { programmaPaghe } from './programmi-paghe/index.js';

/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */

export { TAX_2026 };

// Arrotondamento e troncamento a due decimali, come nel cedolino.
export const round2 = (x) => Math.round(x * 100) / 100;
export const trunc2 = (x) => Math.floor(x * 100 + 1e-9) / 100;

export function irpefLorda(imponibile, T = FISCO_ULTIMO) {
  let imposta = 0;
  let prev = 0;
  for (const s of T.IRPEF_SCAGLIONI) {
    if (imponibile <= prev) break;
    const quota = Math.min(imponibile, s.fino) - prev;
    imposta += quota * s.aliquota;
    prev = s.fino;
  }
  return imposta;
}

// Aliquota dello scaglione del reddito: tassa a parte le mensilità aggiuntive.
export function aliquotaMarginale(imponibile, T = FISCO_ULTIMO) {
  for (const s of T.IRPEF_SCAGLIONI) {
    if (imponibile <= s.fino) return s.aliquota;
  }
  return T.IRPEF_SCAGLIONI[T.IRPEF_SCAGLIONI.length - 1].aliquota;
}

/**
 * Contributi a carico del dipendente, voce per voce come in busta paga.
 *
 * L'Ente Bilaterale ha una base propria (`ebBase`) e non è deducibile; la sua
 * quota ditta è un fringe benefit che si somma all'imponibile fiscale.
 *
 * @param {number} gross lordo del periodo
 * @param {Impostazioni} settings contiene `ccnl`
 * @param {number} ebBase base di calcolo dell'Ente Bilaterale (retribuzione contrattuale)
 * @param {number} [mesi=1] mesi coperti da `gross` (i tetti di previdenza.js sono annui)
 * @returns {{ totale, deducibili, fringeImponibile, righe }}
 */
export function calcContributi(gross, settings = {}, ebBase = 0, mesi = 1) {
  const T = fiscoDi(settings);
  const g = Math.max(0, Number(gross) || 0);
  const ccnl = getCcnl(settings.ccnl);

  const righe = [];
  let totale = 0;
  let deducibili = 0;
  let fringeImponibile = 0;

  // L'imponibile previdenziale è arrotondato all'euro.
  const baseInps = Math.round(g);

  const ivs = round2(baseInps * T.ALIQUOTA_IVS);
  righe.push({ label: 'Contributi IVS', pct: T.ALIQUOTA_IVS * 100, base: baseInps, importo: ivs, deducibile: true });
  totale += ivs;
  deducibili += ivs;

  // FIS e CIGS: contributi di legge; `contributiExtra` per trattenute contrattuali.
  const minori = [
    ...contributiDiLegge(settings, ccnl.ammortizzatori),
    ...(ccnl.contributiExtra || []),
  ];
  for (const c of minori) {
    const pct = Number(c.pct) || 0;
    const importo = round2(baseInps * (pct / 100));
    righe.push({ label: c.label, pct, base: baseInps, importo, deducibile: true });
    totale += importo;
    deducibili += importo;
  }

  // Ente Bilaterale: base a sé (`ebBase`), non il lordo. → docs/note-motore-net.md
  const eb = ccnl.enteBilaterale;
  const base = Math.max(0, Number(settings.ebtBase) || Number(ebBase) || 0);
  if (eb && base > 0) {
    const importo = round2(base * ((Number(eb.pct) || 0) / 100));
    righe.push({ label: eb.label, pct: Number(eb.pct) || 0, base, importo, deducibile: false });
    totale += importo;
    // Quota ditta: fringe benefit, troncata.
    fringeImponibile += programmaPaghe(settings).quota(base * ((Number(eb.quotaDitta) || 0) / 100));
  }

  // Fondo pensione e cassa sanitaria in busta: fuori dal reddito come l'INPS.
  for (const r of trattenuteFuoriReddito(g, settings, mesi)) {
    righe.push(r); totale += r.importo; deducibili += r.importo;
  }

  return { totale: round2(totale), deducibili: round2(deducibili), fringeImponibile, righe };
}

export function detrazioneLavoro(reddito, T = FISCO_ULTIMO) {
  let d = 0;
  if (reddito <= 15000) {
    d = T.DETR_LAV_FISSA;
  } else if (reddito <= 28000) {
    d = T.DETR_LAV_BASE_2 + T.DETR_LAV_EXTRA_2 * ((28000 - reddito) / T.DETR_LAV_RANGE_2);
  } else if (reddito <= 50000) {
    d = T.DETR_LAV_BASE_3 * ((50000 - reddito) / T.DETR_LAV_RANGE_3);
  }
  if (d < 0) d = 0;
  // Maggiorazione fissa di 65 € tra 25.000 e 35.000
  if (reddito >= T.DETR_LAV_BONUS_65_MIN && reddito <= T.DETR_LAV_BONUS_65_MAX) {
    d += T.DETR_LAV_BONUS_65;
  }
  return d;
}

// Ulteriore detrazione "cuneo" per redditi 20.000–40.000
function detrazioneCuneo(reddito, T = FISCO_ULTIMO) {
  if (reddito <= T.CUNEO_DETR_SOGLIA_MIN) return 0;
  if (reddito <= T.CUNEO_DETR_SOGLIA_PIENO) return T.CUNEO_DETR_IMPORTO;
  if (reddito <= T.CUNEO_DETR_SOGLIA_MAX) {
    return T.CUNEO_DETR_IMPORTO
      * ((T.CUNEO_DETR_SOGLIA_MAX - reddito) / (T.CUNEO_DETR_SOGLIA_MAX - T.CUNEO_DETR_SOGLIA_PIENO));
  }
  return 0;
}

// Percentuale della somma "cuneo" (L. 207/2024) spettante a un dato reddito.
// 0 sopra i 20.000 €.
export function cuneoPercent(redditoComplessivo, redditoLavoro = redditoComplessivo, T = FISCO_ULTIMO) {
  if (redditoComplessivo > T.CUNEO_SOGLIA_SOMMA) return 0;
  if (redditoLavoro <= T.CUNEO_PCT_1_SOGLIA) return T.CUNEO_PCT_1;
  if (redditoLavoro <= T.CUNEO_PCT_2_SOGLIA) return T.CUNEO_PCT_2;
  return T.CUNEO_PCT_3;
}

// Somma "cuneo" non tassata per redditi <= 20.000 (% sul reddito da lavoro)
function bonusCuneo(redditoComplessivo, redditoLavoro, T = FISCO_ULTIMO) {
  return redditoLavoro * cuneoPercent(redditoComplessivo, redditoLavoro, T);
}

// Trattamento integrativo: la capienza si confronta con la detrazione da lavoro
// meno 75 €; l'indennità L. 207/2024 resta fuori dal metro. → docs/note-motore-net.md
export function trattamentoIntegrativo(reddito, irpef, detLavoro, T = FISCO_ULTIMO) {
  if (reddito > T.TI_SOGLIA_MAX) return 0;
  if (reddito <= T.TI_SOGLIA_PIENO) {
    return irpef > detLavoro - T.TI_CAPIENZA_SCONTO ? T.TI_MASSIMO : 0;
  }
  const diff = detLavoro - irpef;
  return Math.min(T.TI_MASSIMO, Math.max(0, diff));
}

// Aliquota contributiva DEDUCIBILE totale (IVS + minori del CCNL, senza Ente Bilaterale).
export function deductibleContribRate(settings = {}) {
  const ccnl = getCcnl(settings.ccnl);
  const extra = [
    ...contributiDiLegge(settings, ccnl.ammortizzatori),
    ...(ccnl.contributiExtra || []),
  ].reduce((s, c) => s + (Number(c.pct) || 0), 0) / 100;
  return fiscoDi(settings).ALIQUOTA_IVS + extra;
}

// Le soglie di legge sono sul REDDITO COMPLESSIVO (lordo meno contributi
// deducibili). Dal reddito al lordo: `lordoPerReddito` (soglia-lorda.js);
// `taxableToGross` serve al riferimento mensile del programma paghe.

/**
 * Reddito complessivo ai fini IRPEF: lordo meno contributi DEDUCIBILI più il
 * fringe benefit della quota ditta. Unica definizione, usata da pannello,
 * riquadro e soglia lorda. → check-bonus.mjs
 *
 * @param {{deducibili: number, fringeImponibile: number}|null} [contributi] i contributi già calcolati, per non rifare il
 *   lavoro quando chi chiama li ha già.
 */
export function redditoComplessivo(gross, settings = {}, contributi = null) {
  const g = Math.max(0, Number(gross) || 0);
  const cont = contributi || calcContributi(g, settings, monthlyBaseGross(settings) * 12, 12);
  return g - cont.deducibili + cont.fringeImponibile;
}

/**
 * Il trattamento integrativo spetta in QUESTO mese? Il datore decide sul reddito
 * presunto dell'anno (`lordoPresuntoAnno()` in capienza.js), non sul mese.
 * Senza progressivo vale lordo del mese × 12. → check-reddito-presunto.mjs
 */
export function tiSpettaQuestoMese(lordoMese, settings = {}, lordoPresunto = null) {
  const modo = modoTrattamentoIntegrativo(settings);
  if (modo === 'mai') return { spetta: false, motivo: 'escluso a mano' };
  if (modo === 'sempre') return { spetta: true, motivo: 'incluso a mano' };
  if (lordoPresunto != null) {
    const reddito = Math.round(redditoComplessivo(lordoPresunto, settings));
    const spetta = reddito <= fiscoDi(settings).TI_SOGLIA_PIENO;
    return {
      spetta, presunto: true, proiezione: reddito, lordoPresunto: Math.round(lordoPresunto),
      motivo: `reddito presunto dell'anno ${reddito} €, ${spetta ? 'sotto' : 'sopra'} i 15.000`,
    };
  }
  // Senza progressivo decide la regola del programma paghe (programmi-paghe/).
  const { baseMese, proiezione } = programmaPaghe(settings).annoSenzaProgressivo(lordoMese);
  const spetta = proiezione <= fiscoDi(settings).TI_SOGLIA_PIENO;
  return {
    spetta,
    proiezione,
    baseMese,
    motivo: `${baseMese} × 12 = ${proiezione} €, ${spetta ? 'sotto' : 'sopra'} i 15.000`,
  };
}

/**
 * 'auto' (come il datore) · 'sempre' · 'mai'.
 * `noTrattamentoIntegrativo` è il flag di prima e resta valido.
 */
export function modoTrattamentoIntegrativo(settings = {}) {
  // Il flag vecchio viene PRIMA: i default fondono sempre `tiModo: 'auto'`, e
  // guardarlo per secondo voleva dire non guardarlo mai. → check-ti-mensile.mjs
  if (settings.noTrattamentoIntegrativo) return 'mai';
  if (settings.tiModo === 'sempre' || settings.tiModo === 'mai' || settings.tiModo === 'auto') {
    return settings.tiModo;
  }
  return 'auto';
}

/** Il bonus è stato fatto sospendere dal datore (a mano, in una delle due schermate). */
export function tiSospeso(settings = {}) {
  return modoTrattamentoIntegrativo(settings) === 'mai';
}

/** I due campi insieme, sempre: scriverne uno solo li disallinea. */
export function patchTiSospeso(sospeso) {
  return { noTrattamentoIntegrativo: !!sospeso, tiModo: sospeso ? 'mai' : 'auto' };
}

/**
 * Il reddito annuo di riferimento che il software paghe usa per questo mese:
 * governa detrazione, indennità L. 207/2024 e trattamento integrativo.
 */
export function riferimentoAnnuoDelMese(lordoMese, settings = {}, lordoPresunto = null) {
  const esito = tiSpettaQuestoMese(lordoMese, settings, lordoPresunto);
  // Col progressivo il riferimento è il reddito presunto. → check-reddito-presunto.mjs
  if (lordoPresunto != null) {
    return esito.spetta ? Math.min(lordoPresunto, taxableToGross(fiscoDi(settings).TI_SOGLIA_PIENO, settings)) : lordoPresunto;
  }
  if (esito.spetta) {
    const base = programmaPaghe(settings).annoSenzaProgressivo(lordoMese).proiezione;
    return Math.min(base, taxableToGross(fiscoDi(settings).TI_SOGLIA_PIENO, settings));
  }
  // Sopra soglia, senza progressivo: appena oltre i 15.000. Un ripiego, non un dato.
  return taxableToGross(fiscoDi(settings).TI_SOGLIA_PIENO + 100, settings);
}

/**
 * Il lordo di UN mese come lo mostra l'app: paga dei turni, 13ª/14ª che matura,
 * voci fisse e bonus spuntato. Unica funzione per Calendario, Statistiche,
 * «cosa cambia» e confronto con la busta.
 *
 * @returns {{ lordo: number, extraMese: number, premioMese: number }} `extraMese` è la quota di
 *   mensilità aggiuntiva dentro `lordo` (serve a `nettoDelMese`, che la tassa a
 *   parte).
 */
export function lordoDelMese(pagaTurni, anno, mese, settings = {}, { enableNetCalc = true } = {}) {
  const vociFisse = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  // Importo fisso spuntato mese per mese (`true`); un numero è il formato di prima.
  const voce = settings.monthlyBonus?.[`${anno}-${String(mese + 1).padStart(2, '0')}`];
  const bonus = typeof voce === 'number' ? voce : (voce ? Number(settings.monthlyBonusAmount) || 0 : 0);
  const extraMese = enableNetCalc
    ? monthlyBaseGross(settings) * (
        (settings.hasQuattordicesima && mese === EXTRA_MONTHS.quattordicesima
          ? extraMonthAccrual('quattordicesima', anno, settings) : 0)
        + (settings.hasTredicesima && mese === EXTRA_MONTHS.tredicesima
          ? extraMonthAccrual('tredicesima', anno, settings) : 0)
      )
    : 0;
  return { lordo: (Number(pagaTurni) || 0) + extraMese + vociFisse + bonus, extraMese, premioMese: settings.bonusPremioRisultato ? bonus : 0 };
}

/**
 * Il netto di UN mese come lo mostra l'app, uguale per Calendario e Statistiche.
 * → check-netto-coerente.mjs
 */
export function nettoDelMese(lordoMese, settings, giorniMese, extraMese = 0, capienza = null) {
  const ref = riferimentoAnnuoDelMese(lordoMese, settings, capienza?.lordoPresunto ?? null);
  return calcNetMonthly(lordoMese, ref, settings, giorniMese, extraMese, capienza);
}

export function taxableToGross(taxable, settings = {}) {
  return Math.max(0, Number(taxable) || 0) / (1 - deductibleContribRate(settings));
}

export { EXTRA_MONTHS };

// Retribuzione mensile "base" da contratto: ore settimanali × paga oraria ×
// divisore del CCNL (Turismo: 172 h su 40 settimanali = 4,30 settimane, non
// 52/12). Vale 0 per il lavoro a chiamata, che non ha un orario contrattuale.
export function monthlyBaseGross(settings = {}) {
  if (settings.onCall) return 0;
  const rate = Math.max(0, Number(settings.hourlyRate) || 0);
  return rate * monthlyContractHours(settings);
}

// Un mese matura il rateo solo se lavorato per almeno 15 giorni (regola CCNL).
function monthAccrues(year, monthIndex, hire) {
  if (year < hire.y || (year === hire.y && monthIndex < hire.m)) return false;
  if (year > hire.y || monthIndex > hire.m) return true;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return daysInMonth - hire.d + 1 >= 15;
}

/**
 * Frazione di mensilità aggiuntiva maturata (0..1), in dodicesimi sul periodo di
 * competenza: luglio–giugno per la 14ª, anno solare per la 13ª. Assunzione
 * 29/12/2025 → 14ª di giugno 2026 = 6/12. Senza data di assunzione, 1.
 *
 * @param {'tredicesima'|'quattordicesima'} kind
 * @param {number} year anno in cui la mensilità viene erogata
 * @param {Impostazioni} settings contiene `hireDate` (ISO 'YYYY-MM-DD')
 */
export function extraMonthAccrual(kind, year, settings = {}) {
  const raw = String(settings.hireDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 1;
  const hire = {
    y: Number(raw.slice(0, 4)),
    m: Number(raw.slice(5, 7)) - 1,
    d: Number(raw.slice(8, 10)),
  };

  // Inizio del periodo di competenza: luglio dell'anno prima per la 14ª,
  // gennaio dello stesso anno per la 13ª.
  const startYear = kind === 'quattordicesima' ? year - 1 : year;
  const startMonth = kind === 'quattordicesima' ? 6 : 0;

  let matured = 0;
  for (let i = 0; i < 12; i += 1) {
    const m = startMonth + i;
    if (monthAccrues(startYear + Math.floor(m / 12), m % 12, hire)) matured += 1;
  }
  return matured / 12;
}

// Mensilità aggiuntive già arrivate entro il mese (indice 0-11), in mensilità
// equivalenti: una 14ª maturata a metà pesa 0,5.
export function receivedExtraMonthsCount(settings, monthIndex, year) {
  let n = 0;
  if (settings.hasQuattordicesima && monthIndex >= EXTRA_MONTHS.quattordicesima) {
    n += extraMonthAccrual('quattordicesima', year, settings);
  }
  if (settings.hasTredicesima && monthIndex >= EXTRA_MONTHS.tredicesima) {
    n += extraMonthAccrual('tredicesima', year, settings);
  }
  return n;
}

// Mensilità aggiuntive previste nell'INTERO anno, in mensilità equivalenti.
export function extraMonthsAccrued(settings, year) {
  return (settings.hasTredicesima ? extraMonthAccrual('tredicesima', year, settings) : 0)
    + (settings.hasQuattordicesima ? extraMonthAccrual('quattordicesima', year, settings) : 0);
}

/**
 * Reddito lordo MATURATO nell'anno: turni (più il montante, se impostato) e
 * mensilità aggiuntive già incassate. Alimenta calendario e Statistiche.
 *
 * @param {number} year
 * @param {Array} allShifts TUTTI i turni (non solo quelli dell'anno): serve
 *   come contesto per gli straordinari, che si calcolano per settimana/mese di
 *   paga e non vanno spezzati a cavallo di capodanno.
 * @param {Impostazioni} settings
 * @param {object|null} payByShift mappa già calcolata da `computePayByShift`,
 *   `null` — evita di ricalcolarla se il chiamante la possiede già.
 * @param {Date} oggi
 * @returns {{ total: number, extras: number }} extras = quota di mensilità
 *   aggiuntive già incassate, inclusa in total.
 */
export function computeAnnualGrossFromShifts(year, allShifts, settings = {}, payByShift = null, oggi) {
  richiediOggi(oggi, 'computeAnnualGrossFromShifts');
  const y = year;
  const yearShifts = (allShifts || []).filter(s => parseDate(s.date).getFullYear() === y);
  // Il montante copre i mesi fino al suo: i turni di quei mesi non si ri-sommano.
  const montante = Number(settings.priorTaxableIncome) || 0;
  const cutoff = settings.priorIncomeDate || '';
  const cutoffMonth = cutoff.slice(0, 7); // 'YYYY-MM'
  const sameYear = cutoff && Number(cutoff.slice(0, 4)) === y;
  const useCutoff = montante > 0 && sameYear;
  const counted = useCutoff ? yearShifts.filter(s => s.date.slice(0, 7) > cutoffMonth) : yearShifts;
  // Contesto = TUTTI i turni: le settimane a cavallo di capodanno vanno intere.
  const pay = calcTotalPay(counted, settings, allShifts, payByShift);
  const fromShifts = pay ? pay.total : 0;
  // Le mensilità incassate dipendono da OGGI, non dal mese sfogliato, e contano
  // per il rateo maturato.
  const now = oggi;
  // `extras` = mensilità che stanno DENTRO `total`: `projectAnnualIncome` le
  // sottrae prima di annualizzare.
  let extras = 0;
  let daSommare = 0;
  if (y <= now.getFullYear()) {
    const monthIndex = y < now.getFullYear() ? 11 : now.getMonth();
    const mensile = monthlyBaseGross(settings);
    const incassate = receivedExtraMonthsCount(settings, monthIndex, y);
    // Le mensilità erogate entro il mese del montante ci sono già dentro:
    // sommarle le contava due volte.
    const nelMontante = useCutoff
      ? receivedExtraMonthsCount(settings, Number(cutoffMonth.slice(5, 7)) - 1, y)
      : 0;
    // Il mese del montante può stare avanti a oggi (il selettore non ha tetto):
    // vale il più alto dei due.
    extras = mensile * Math.max(incassate, nelMontante);
    daSommare = mensile * Math.max(0, incassate - nelMontante);
  }
  const applyMontante = montante > 0 && (!cutoff || sameYear);
  return { total: fromShifts + (applyMontante ? montante : 0) + daSommare, extras };
}


// «1 mese» / «5 mesi».
const fmtMesi = (n) => `${n} mes${n === 1 ? 'e' : 'i'}`;

/**
 * Reddito annuo di RIFERIMENTO per aliquota IRPEF e soglie del trattamento
 * integrativo, nell'ordine in cui lo userebbe un sostituto d'imposta:
 *  - importo scritto a mano;
 *  - lavoro a chiamata e modalità 'ytd': maturato annualizzato;
 *  - altrimenti la PREVISIONE IN AVANTI: maturato più il resto dell'anno da
 *    contratto (→ docs/note-motore-net.md).
 * Si sommano voci fisse mensili e bonus dell'anno. Unica funzione per Calendario
 * e Statistiche.
 *
 * @param {number} annualGross reddito maturato nell'anno (`computeAnnualGrossFromShifts`)
 * @param {number} annualExtras quota di `annualGross` che è 13ª/14ª (una
 *   tantum: non si annualizza, altrimenti si moltiplicherebbe)
 * @param {Impostazioni} settings
 * @param {number} [year]
 * @param {object} [opts]
 * @param {boolean} [opts.enableNetCalc] gate del motore fiscale (beta): a
 *   false i termini che dipendono dal contratto restano a zero — stesso
 *   comportamento di un chiamante che tiene il motore spento.
 * @param {Date} [opts.oggi] richiesto: il motore non legge l'orologio
 * @returns {{ value: number, source: 'contratto'|'maturato'|'manuale'|'previsione', voci: any, mesiTrascorsi: number, mesiRestanti?: number }}
 */
export function projectAnnualIncome(
  annualGross, annualExtras, settings = {}, year,
  { enableNetCalc = true, oggi } = {},
) {
  richiediOggi(oggi, 'projectAnnualIncome');
  const fixedMonthlyTotal = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  // Il montante contiene già voci fisse e premi dei suoi mesi: non si contano
  // due volte. → check-proiezione.mjs
  const priorDate = String(settings.priorIncomeDate || '');
  const mesiNelMontante = Number(settings.priorTaxableIncome) > 0 && Number(priorDate.slice(0, 4)) === year
    ? Math.min(12, Math.max(0, Number(priorDate.slice(5, 7)) || 0)) : 0;
  const fixedAnnual = fixedMonthlyTotal * (12 - mesiNelMontante);
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;
  const resolveBonusEntry = (v) => (typeof v === 'number' ? v : (v ? monthlyBonusAmount : 0));
  const bonusMap = settings.monthlyBonus || {};

  const now = oggi;
  const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const bonusYearAll = Object.entries(bonusMap)
    .filter(([k]) => k.slice(0, 4) === String(year) && Number(k.slice(5, 7)) > mesiNelMontante)
    .reduce((s, [, v]) => s + resolveBonusEntry(v), 0);

  // 13ª/14ª sono una tantum: si annualizza solo la parte ricorrente e si
  // riaggiungono per intero.
  const recurring = Math.max(0, annualGross - annualExtras);
  const extrasFullYear = enableNetCalc
    ? monthlyBaseGross(settings) * extraMonthsAccrued(settings, year)
    : 0;
  const annualize = (v) => (monthsElapsed > 0 ? (v * 12) / monthsElapsed : v);
  const extras = (v) => v + fixedAnnual + bonusYearAll;

  // Le voci stanno qui e non nella UI: una spiegazione che ricalcola per conto
  // suo smette di combaciare col totale.
  const voci = [];
  const aggiungi = (label, valore, nota = null) => {
    if (Math.abs(valore) >= 0.005) voci.push({ label, valore, nota });
  };
  const conVociFisse = () => {
    aggiungi(mesiNelMontante ? `Voci fisse × ${12 - mesiNelMontante} mesi dopo il montante` : 'Voci fisse mensili × 12', fixedAnnual);
    aggiungi('Bonus segnati nell\'anno', bonusYearAll);
  };

  if ((settings.tiProjectionMode || 'stimato') === 'ytd') {
    // Il bonus non si annualizza (è già avvenuto, e un premio non torna ogni
    // mese); le voci fisse sì, ma non quelle dei mesi del montante, già in `recurring`.
    const cumulativo = recurring + fixedMonthlyTotal * Math.max(0, monthsElapsed - mesiNelMontante);
    aggiungi('Maturato finora, annualizzato', annualize(cumulativo),
      `${fmtMesi(monthsElapsed)} × 12 ⁄ ${monthsElapsed}`);
    aggiungi('13ª/14ª previste nell\'anno', extrasFullYear);
    aggiungi('Bonus segnati nell\'anno', bonusYearAll, 'quelli spuntati, non annualizzati');
    return {
      value: annualize(cumulativo) + extrasFullYear + bonusYearAll,
      source: 'maturato', voci, mesiTrascorsi: monthsElapsed,
    };
  }

  const manual = Number(settings.annualGrossManual) || 0;
  if (manual > 0) {
    aggiungi('Reddito annuo scritto a mano', manual);
    conVociFisse();
    return { value: extras(manual), source: 'manuale', voci, mesiTrascorsi: monthsElapsed };
  }

  if (settings.onCall) {
    aggiungi('Maturato finora, annualizzato', annualize(recurring),
      `${fmtMesi(monthsElapsed)} × 12 ⁄ ${monthsElapsed}`);
    conVociFisse();
    return { value: extras(annualize(recurring)), source: 'maturato', voci, mesiTrascorsi: monthsElapsed };
  }

  // Previsione IN AVANTI: maturato reale + resto dell'anno da contratto, senza
  // annualizzare il passato. Il mese in corso vale per i giorni che restano.
  // → docs/note-motore-net.md, check-proiezione.mjs
  const annoOggi = now.getFullYear();
  const giorniMese = new Date(annoOggi, now.getMonth() + 1, 0).getDate();
  const mesiRestanti = year < annoOggi ? 0
    : year > annoOggi ? 12
      : (11 - now.getMonth()) + (giorniMese - now.getDate() + 1) / giorniMese;
  // Indice dell'ultimo mese le cui mensilità aggiuntive sono già dentro
  // `annualGross`: -1 per un anno che non è ancora cominciato.
  const meseIncassate = year < annoOggi ? 11 : year > annoOggi ? -1 : now.getMonth();
  const mensile = enableNetCalc ? monthlyBaseGross(settings) : 0;
  // Quelle già incassate stanno in `annualGross`: si aggiungono solo le altre.
  const extraResidue = enableNetCalc
    ? mensile * Math.max(0, extraMonthsAccrued(settings, year) - receivedExtraMonthsCount(settings, meseIncassate, year))
    : 0;
  const value = annualGross + mesiRestanti * mensile + extraResidue;

  // 13ª e 14ª come due righe, ciascuna col proprio rateo.
  const rateo = (kind) => (settings[kind === 'tredicesima' ? 'hasTredicesima' : 'hasQuattordicesima']
    ? extraMonthAccrual(kind, year, settings) : 0);
  const notaRateo = (frazione) => {
    const dodicesimi = Math.round(frazione * 12);
    return dodicesimi >= 12
      ? 'rateo intero, 12/12'
      : `${dodicesimi}/12 — il periodo di competenza comincia prima dell'assunzione`;
  };

  aggiungi('Maturato finora', annualGross,
    'turni segnati, più il montante e le 13ª/14ª già incassate');
  const mesiScritti = Number.isInteger(mesiRestanti)
    ? String(mesiRestanti)
    : mesiRestanti.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  aggiungi(Number.isInteger(mesiRestanti) ? `I ${fmtMesi(mesiRestanti)} che restano` : 'Il resto dell’anno',
    mesiRestanti * mensile,
    mesiRestanti > 0 ? `${mesiScritti} × la mensilità da contratto` : null);

  for (const kind of ['quattordicesima', 'tredicesima']) {
    const frazione = rateo(kind);
    if (frazione <= 0) continue;
    // Già incassata = sta dentro «Maturato finora», non va riaggiunta qui.
    if (meseIncassate >= EXTRA_MONTHS[kind]) continue;
    const nome = kind === 'tredicesima' ? 'Tredicesima' : 'Quattordicesima';
    const mese = kind === 'tredicesima' ? 'dicembre' : 'giugno';
    aggiungi(`${nome} di ${mese}`, mensile * frazione, notaRateo(frazione));
  }

  conVociFisse();

  return { value: extras(value), source: 'previsione', voci, mesiTrascorsi: monthsElapsed, mesiRestanti };
}

/**
 * Calcola la stima del netto annuo.
 * @param {number} grossAnnual reddito lordo annuo da lavoro dipendente
 * @param {Impostazioni} settings può contenere addRegionalePct / addComunalePct
 * @param {object} [opts]
 * @param {number} [opts.giorni=365] giorni del rapporto nell'anno: detrazioni e
 *   TI pieno spettano in proporzione (art. 13 TUIR). L'indennità L. 207/24 no.
 *   → check-conguaglio.mjs
 */
export function calcNetAnnual(grossAnnual, settings = {}, { giorni = 365 } = {}) {
  const T = fiscoDi(settings);
  const gross = Math.max(0, Number(grossAnnual) || 0);

  if (gross <= 0) {
    return {
      gross: 0, contributi: 0, contributiRighe: [], imponibile: 0, irpefLorda: 0,
      detrazioneLavoro: 0, detrazioneCuneo: 0, irpefNetta: 0,
      addRegionale: 0, addComunale: 0, trattamentoIntegrativo: 0,
      bonusCuneo: 0, net: 0,
    };
  }

  const cont = calcContributi(gross, settings, monthlyBaseGross(settings) * 12, 12);
  const contributi = cont.totale;
  const imponibile = redditoComplessivo(gross, settings, cont);

  const lorda = irpefLorda(imponibile, T);
  const quota = Math.min(1, Math.max(0, Number(giorni) || 0) / 365);
  const detLav = detrazioneLavoro(imponibile, T) * quota;
  const detCuneo = detrazioneCuneo(imponibile, T) * quota;
  const detrTotali = detLav + detCuneo;

  const irpefNetta = Math.max(0, lorda - detrTotali);

  const pctOr = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const aliqReg = pctOr(settings.addRegionalePct, T.ADD_REGIONALE_DEFAULT) / 100;
  const aliqCom = pctOr(settings.addComunalePct, T.ADD_COMUNALE_DEFAULT) / 100;
  // Addizionali dovute solo con imposta netta, e non se trattenute altrove o sospese.
  const addDovute = !settings.addizionaliAltrove && !settings.noAddizionali && irpefNetta > 0;
  const addRegionale = addDovute ? imponibile * aliqReg : 0;
  const addComunale = addDovute ? imponibile * aliqCom : 0;

  // Capienza con la detrazione dei giorni lavorati; sotto i 15.000 il TI è
  // rapportato al periodo.
  const tiPieno = trattamentoIntegrativo(imponibile, lorda, detLav, T);
  const ti = imponibile <= T.TI_SOGLIA_PIENO ? tiPieno * quota : tiPieno;
  const cuneo = bonusCuneo(imponibile, imponibile, T);

  const net = gross - contributi - irpefNetta - addRegionale - addComunale + ti + cuneo;

  return {
    gross,
    contributi,
    contributiRighe: cont.righe,
    imponibile,
    irpefLorda: lorda,
    detrazioneLavoro: detLav,
    detrazioneCuneo: detCuneo,
    irpefNetta,
    addRegionale,
    addComunale,
    trattamentoIntegrativo: ti,
    bonusCuneo: cuneo,
    net,
  };
}

/**
 * Decisione automatica sul trattamento integrativo (come un software paghe),
 * data la proiezione di reddito annuo `annualGrossRef`. Applica le regole ufficiali
 * (fasce + capienza) e restituisce importo annuo, se incluso e il motivo (per la UI).
 */
export function tiDecision(annualGrossRef, settings = {}) {
  const T = fiscoDi(settings);
  const ann = calcNetAnnual(annualGrossRef, settings);
  const imp = ann.imponibile;
  const override = tiSospeso(settings);
  const incluso = !override && ann.trattamentoIntegrativo > 0;

  let motivo;
  if (override) motivo = 'escluso (forzato, a conguaglio)';
  else if (imp > T.TI_SOGLIA_MAX) motivo = `reddito stimato oltre ${T.TI_SOGLIA_MAX}€ → escluso`;
  else if (imp <= T.TI_SOGLIA_PIENO) motivo = incluso
    ? 'reddito stimato ≤ 15.000€ con capienza → incluso'
    : 'reddito stimato ≤ 15.000€ ma senza capienza → escluso';
  else motivo = incluso
    ? 'fascia 15.000–28.000€, detrazioni eccedenti → incluso'
    : 'fascia 15.000–28.000€, imposta ≥ detrazioni → escluso';

  return { importoAnnuo: incluso ? ann.trattamentoIntegrativo : 0, incluso, motivo, redditoStimato: imp };
}

/**
 * Stima del netto del MESE dal lordo mensile, come una busta:
 * netto = lordo − trattenute + bonus (TI e cuneo sono voci separate).
 * L'IRPEF usa l'aliquota effettiva del reddito annuo di riferimento
 * (`annualGrossRef`); TI e indennità sono rapportati ai giorni del mese.
 *
 * @param {number} monthGross lordo del mese (turni + eventuale mensilità agg.)
 * @param {number} annualGrossRef reddito annuo lordo di riferimento (per aliquote IRPEF/bonus)
 * @param {Impostazioni} settings addRegionalePct / addComunalePct / tfrInBusta
 * @param {number} monthDays giorni di calendario del mese (per la prorata di TI/indennità)
 * @param {number} extraMonthGross quota di `monthGross` che è 13ª/14ª (tassata a parte)
 */
export function calcNetMonthly(monthGross, annualGrossRef, settings = {}, monthDays = 365 / 12, extraMonthGross = 0, capienza = null) {
  const T = fiscoDi(settings);
  const gross = Math.max(0, Number(monthGross) || 0);
  const ann = calcNetAnnual(annualGrossRef, settings);

  const cont = calcContributi(gross, settings, monthlyBaseGross(settings));
  const contributi = cont.totale;
  // Imponibile come in busta: lordo meno contributi DEDUCIBILI più la quota ditta.
  const imponibile = round2(gross - cont.deducibili + cont.fringeImponibile);

  // La mensilità aggiuntiva ha un imponibile proprio (tassazione autonoma) e non
  // assorbe detrazioni.
  const aliqDeducibile = gross > 0 ? cont.deducibili / gross : 0;
  const extraGross = Math.min(Math.max(0, Number(extraMonthGross) || 0), gross);
  const imponibileExtra = extraGross * (1 - aliqDeducibile);
  const imponibileOrdinario = Math.max(0, imponibile - imponibileExtra);

  // IRPEF come in busta: lorda ordinaria in quota dell'imponibile annuo; detrazioni =
  // importo annuo × giorni/365; mensilità aggiuntiva all'aliquota marginale, senza detrazioni.
  const ratio = ann.imponibile > 0 ? imponibileOrdinario / ann.imponibile : 0;
  const irpefLordaOrdinaria = round2(ann.irpefLorda * ratio);
  const irpefExtra = round2(imponibileExtra * aliquotaMarginale(ann.imponibile, T));
  const irpefLorda = round2(irpefLordaOrdinaria + irpefExtra);
  const detrazioni = round2((ann.detrazioneLavoro + ann.detrazioneCuneo) * (monthDays / 365));
  // Le detrazioni si scaricano solo sull'ordinario: l'eventuale eccedenza non
  // abbatte l'imposta della 13ª/14ª, va a conguaglio.
  const irpefNetta = round2(Math.max(0, irpefLordaOrdinaria - detrazioni) + irpefExtra);
  // Quota di detrazione capiente: la busta stampa solo la parte che trova imposta.
  const detrazioniApplicate = Math.min(detrazioni, irpefLordaOrdinaria);

  // Addizionali: come sopra, sull'imponibile del mese.
  const pctOr = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const aliqReg = pctOr(settings.addRegionalePct, T.ADD_REGIONALE_DEFAULT) / 100;
  const aliqCom = pctOr(settings.addComunalePct, T.ADD_COMUNALE_DEFAULT) / 100;
  const addDovute = !settings.addizionaliAltrove && !settings.noAddizionali && ann.irpefNetta > 0;
  const addRegionale = addDovute ? round2(imponibile * aliqReg) : 0;
  const addComunale = addDovute ? round2(imponibile * aliqCom) : 0;

  // Trattenute fisse (quota associativa, prestito...): non fiscali, si sottraggono
  // così come sono.
  const trattenuteFisse = round2(
    (Array.isArray(settings.fixedMonthlyDeductions) ? settings.fixedMonthlyDeductions : [])
      .reduce((s, v) => s + (Number(v.amount) || 0), 0),
  );

  const trattenute = round2(contributi + irpefNetta + addRegionale + addComunale + trattenuteFisse);

  // TI e indennità L. 207/2024: quota del mese TRONCATA, aggiunte solo alla fine.
  // Il TI può non essere erogato (`noTrattamentoIntegrativo`).
  const dayFraction = monthDays / 365;
  // Soglia sul reddito presunto e capienza sul progressivo dell'anno
  // (`capienza`, da capienza.js; senza, sul solo mese). → check-ti-capienza.mjs
  const esitoTi = /** @type {ReturnType<typeof tiSpettaQuestoMese> & {senzaCapienza?: boolean, media?: number|null}} */ (
    { ...tiSpettaQuestoMese(gross, settings, capienza?.lordoPresunto ?? null), media: capienza?.media ?? null });
  esitoTi.senzaCapienza = esitoTi.spetta && !(capienza ? capienza.capiente : ann.trattamentoIntegrativo > 0);
  const trattamentoIntegrativo = esitoTi.spetta && !esitoTi.senzaCapienza
    ? programmaPaghe(settings).quota((ann.trattamentoIntegrativo || T.TI_MASSIMO) * dayFraction) : 0;
  // L'indennità L. 207/2024 è la percentuale di fascia sull'imponibile DEL MESE,
  // non una quota annua spalmata sui giorni.
  const cuneoPct = cuneoPercent(ann.imponibile, ann.imponibile, T);
  const bonusCuneo = programmaPaghe(settings).quota(imponibile * cuneoPct);
  const bonus = round2(trattamentoIntegrativo + bonusCuneo);

  // Anticipo TFR in busta: matura sul lordo (≈ 6,91%), a tassazione separata
  // (default 23%). → docs/note-motore-net.md
  const tfrLordo = settings.tfrInBusta ? round2(gross * (1 / 13.5 - 0.005)) : 0;
  const aliqTfr = Number.isFinite(Number(settings.tfrTaxRate)) && settings.tfrTaxRate !== ''
    ? Number(settings.tfrTaxRate) / 100
    : 0.23;
  const tfrImposta = round2(tfrLordo * aliqTfr);
  const tfr = round2(tfrLordo - tfrImposta);

  const net = round2(gross - trattenute + bonus + tfr);

  return {
    gross, contributi, contributiRighe: cont.righe, imponibile,
    imponibileOrdinario, imponibileExtra, irpefExtra, cuneoPct,
    irpefLorda, detrazioni, detrazioniApplicate, irpefNetta,
    addRegionale, addComunale, trattenuteFisse, trattenute,
    trattamentoIntegrativo, bonusCuneo, bonus, esitoTi, tfrLordo, tfrImposta, aliqTfr, tfr, net,
  };
}
