// Stima del NETTO annuo secondo la fiscalità italiana 2026 (BETA).
// Funzioni pure e testabili. Considera: contributi IVS, IRPEF a scaglioni,
// detrazione lavoro dipendente, addizionali regionale/comunale, trattamento
// integrativo (ex bonus Renzi) e cuneo fiscale.
//
// ATTENZIONE: è una STIMA a scopo indicativo, non sostituisce la busta paga
// né il conguaglio. Parametri verificati per il 2026.

// Estensione esplicita: così `scripts/check-busta-giugno-2026.mjs` può
// importare questo modulo con Node puro, senza passare dal bundler.
import { getCcnl, monthlyContractHours } from './ccnl.js';

// Arrotondamenti della busta paga. Non sono un dettaglio estetico: il cedolino
// chiude ogni voce a due decimali e le somme partono da quelle, quindi tenere
// la piena precisione fino in fondo fa sbagliare di qualche centesimo.
// Alcune voci (competenze esenti, quota Ente Bilaterale a carico ditta) il
// software paghe le TRONCA invece di arrotondarle — verificato sulla busta di
// luglio 2026: 1.200 × 31/365 = 101,9178 in busta è 101,91, non 101,92.
export const round2 = (x) => Math.round(x * 100) / 100;
export const trunc2 = (x) => Math.floor(x * 100 + 1e-9) / 100;

export const TAX_2026 = {
  // Contributi IVS a carico del dipendente (settore privato)
  ALIQUOTA_IVS: 0.0919,

  // Scaglioni IRPEF 2026 (2a aliquota ridotta al 33% dalla L. 199/2025)
  IRPEF_SCAGLIONI: [
    { fino: 28000, aliquota: 0.23 },
    { fino: 50000, aliquota: 0.33 },
    { fino: Infinity, aliquota: 0.43 },
  ],

  // Detrazione lavoro dipendente (art. 13 TUIR)
  DETR_LAV_FISSA: 1955,          // reddito <= 15.000
  DETR_LAV_BASE_2: 1910,         // 15.000–28.000
  DETR_LAV_EXTRA_2: 1190,
  DETR_LAV_RANGE_2: 13000,
  DETR_LAV_BASE_3: 1910,         // 28.000–50.000
  DETR_LAV_RANGE_3: 22000,
  DETR_LAV_BONUS_65_MIN: 25000,  // +65 € tra 25.000 e 35.000
  DETR_LAV_BONUS_65_MAX: 35000,
  DETR_LAV_BONUS_65: 65,

  // Trattamento integrativo (ex bonus Renzi)
  TI_SOGLIA_PIENO: 15000,
  TI_SOGLIA_MAX: 28000,
  TI_MASSIMO: 1200,
  // Sconto sulla detrazione nel test di capienza del TI: la norma confronta
  // l'imposta lorda con la detrazione da lavoro dipendente DIMINUITA di 75 €
  // (ragguagliati al periodo di lavoro nell'anno).
  TI_CAPIENZA_SCONTO: 75,

  // Cuneo fiscale 2026 (L. 207/2024)
  CUNEO_SOGLIA_SOMMA: 20000,     // sotto: somma non tassata
  CUNEO_PCT_1: 0.071,            // reddito lavoro <= 8.500
  CUNEO_PCT_1_SOGLIA: 8500,
  CUNEO_PCT_2: 0.053,            // 8.500–15.000
  CUNEO_PCT_2_SOGLIA: 15000,
  CUNEO_PCT_3: 0.048,            // 15.000–20.000
  CUNEO_DETR_SOGLIA_MIN: 20000,  // 20.000–40.000: ulteriore detrazione
  CUNEO_DETR_SOGLIA_PIENO: 32000,
  CUNEO_DETR_SOGLIA_MAX: 40000,
  CUNEO_DETR_IMPORTO: 1000,

  // Default addizionali (modificabili dall'utente)
  ADD_REGIONALE_DEFAULT: 1.23,   // %
  ADD_COMUNALE_DEFAULT: 0,       // %
};

function irpefLorda(imponibile) {
  const T = TAX_2026;
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

// Aliquota dello scaglione in cui cade il reddito: serve per le mensilità
// aggiuntive, che il sostituto d'imposta tassa a parte con l'aliquota marginale
// invece di spalmarle sull'aliquota media dell'anno.
export function aliquotaMarginale(imponibile) {
  const T = TAX_2026;
  for (const s of T.IRPEF_SCAGLIONI) {
    if (imponibile <= s.fino) return s.aliquota;
  }
  return T.IRPEF_SCAGLIONI[T.IRPEF_SCAGLIONI.length - 1].aliquota;
}

/**
 * Contributi a carico del dipendente, voce per voce come in busta paga.
 *
 * Oltre all'IVS (9,19%) il CCNL può prevedere trattenute minori — FIS, CIGS,
 * Ente Bilaterale — che il motore ignorava del tutto: su CCNL Turismo l'aliquota
 * vera è 9,85%, non 9,19%. Due dettagli riscontrati sulla busta reale:
 *
 *  - l'Ente Bilaterale non si calcola sul lordo ma sulla retribuzione
 *    CONTRATTUALE (paga base + contingenza riproporzionata al part-time), qui
 *    approssimata da `ebBase`; e NON è deducibile dall'imponibile fiscale;
 *  - la quota Ente Bilaterale a carico DITTA non viene trattenuta, ma è un
 *    fringe benefit che si somma all'imponibile fiscale.
 *
 * @param {number} gross lordo del periodo
 * @param {object} settings contiene `ccnl`
 * @param {number} ebBase base di calcolo dell'Ente Bilaterale (retribuzione contrattuale)
 * @returns {{ totale, deducibili, fringeImponibile, righe }}
 */
export function calcContributi(gross, settings = {}, ebBase = 0) {
  const T = TAX_2026;
  const g = Math.max(0, Number(gross) || 0);
  const ccnl = getCcnl(settings.ccnl);

  const righe = [];
  let totale = 0;
  let deducibili = 0;
  let fringeImponibile = 0;

  // I contributi NON si calcolano sul lordo esatto: l'imponibile previdenziale
  // viene arrotondato all'EURO, e le aliquote si applicano a quello. Verificato
  // su due buste diverse — Turismo luglio 2026 (lordo 1.173,48 → IVS su 1.173,00
  // = 107,80) e servizi fiduciari giugno 2026 (756,77 → IVS su 757,00 = 69,57).
  // Sul lordo pieno uscirebbero 107,84 e 69,55.
  const baseInps = Math.round(g);

  const ivs = round2(baseInps * T.ALIQUOTA_IVS);
  righe.push({ label: 'Contributi IVS', pct: T.ALIQUOTA_IVS * 100, base: baseInps, importo: ivs, deducibile: true });
  totale += ivs;
  deducibili += ivs;

  for (const c of ccnl.contributiExtra || []) {
    const pct = Number(c.pct) || 0;
    const importo = round2(baseInps * (pct / 100));
    righe.push({ label: c.label, pct, base: baseInps, importo, deducibile: true });
    totale += importo;
    deducibili += importo;
  }

  // Ente Bilaterale: base a sé, NON il lordo. È il minimo tabellare più la
  // contingenza, riproporzionati al part-time — un numero che l'app non sa
  // ricostruire dalla paga oraria (che può contenere superminimi), quindi si può
  // leggere dalla busta e scriverlo in `ebtBase`. Senza, si ripiega sulla
  // mensilità da contratto: sulla busta di luglio la differenza è 951,30 contro
  // 948,05, cioè un centesimo sull'imponibile fiscale.
  const eb = ccnl.enteBilaterale;
  const base = Math.max(0, Number(settings.ebtBase) || Number(ebBase) || 0);
  if (eb && base > 0) {
    const importo = round2(base * ((Number(eb.pct) || 0) / 100));
    righe.push({ label: eb.label, pct: Number(eb.pct) || 0, base, importo, deducibile: false });
    totale += importo;
    // La quota ditta è un fringe benefit: tassato pur non essendo trattenuto.
    // In busta è TRONCATA (948,05 × 0,20% = 1,8961 → 1,89).
    fringeImponibile += trunc2(base * ((Number(eb.quotaDitta) || 0) / 100));
  }

  return { totale: round2(totale), deducibili: round2(deducibili), fringeImponibile, righe };
}

function detrazioneLavoro(reddito) {
  const T = TAX_2026;
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
function detrazioneCuneo(reddito) {
  const T = TAX_2026;
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
export function cuneoPercent(redditoComplessivo, redditoLavoro = redditoComplessivo) {
  const T = TAX_2026;
  if (redditoComplessivo > T.CUNEO_SOGLIA_SOMMA) return 0;
  if (redditoLavoro <= T.CUNEO_PCT_1_SOGLIA) return T.CUNEO_PCT_1;
  if (redditoLavoro <= T.CUNEO_PCT_2_SOGLIA) return T.CUNEO_PCT_2;
  return T.CUNEO_PCT_3;
}

// Somma "cuneo" non tassata per redditi <= 20.000 (% sul reddito da lavoro)
function bonusCuneo(redditoComplessivo, redditoLavoro) {
  return redditoLavoro * cuneoPercent(redditoComplessivo, redditoLavoro);
}

// Trattamento integrativo, calcolato sull'imponibile e sulle detrazioni.
//
// La capienza NON si misura sulla detrazione piena: la norma la confronta con la
// detrazione da lavoro dipendente diminuita di 75 € (ragguagliati al periodo di
// lavoro; qui si ragiona su base annua, quindi 75 pieni). Senza quello sconto il
// TI verrebbe negato a chi per legge ci rientra, in una fascia stretta ma reale:
// imposta lorda fra detrazione−75 e detrazione, cioè attorno agli 8.200–8.500 €
// di imponibile.
//
// NON riscontrato su busta: nelle buste disponibili la capienza c'è comunque, con
// o senza lo sconto. Viene dalla norma, non dai dati — se un cedolino dovesse
// dire il contrario, è il cedolino a vincere.
function trattamentoIntegrativo(reddito, irpef, detLavoro, detrTotali) {
  const T = TAX_2026;
  if (reddito > T.TI_SOGLIA_MAX) return 0;
  if (reddito <= T.TI_SOGLIA_PIENO) {
    return irpef > detLavoro - T.TI_CAPIENZA_SCONTO ? T.TI_MASSIMO : 0;
  }
  const diff = detrTotali - irpef;
  return Math.min(T.TI_MASSIMO, Math.max(0, diff));
}

// Aliquota contributiva DEDUCIBILE totale (IVS + contributi minori del CCNL).
// L'Ente Bilaterale resta fuori: è trattenuto ma non deducibile, e la sua base
// non è il lordo.
export function deductibleContribRate(settings = {}) {
  const extra = (getCcnl(settings.ccnl).contributiExtra || [])
    .reduce((s, c) => s + (Number(c.pct) || 0), 0) / 100;
  return TAX_2026.ALIQUOTA_IVS + extra;
}

// Conversioni lordo ↔ imponibile fiscale. Le soglie di legge (15.000/28.000 per
// il trattamento integrativo, 20.000/40.000 per il cuneo) sono definite sul
// REDDITO COMPLESSIVO, che per un dipendente è il lordo al netto dei contributi
// deducibili. Chi ragiona in lordo (come l'utente che somma i turni) ha bisogno
// di queste due funzioni per confrontare mele con mele.
export function grossToTaxable(gross, settings = {}) {
  return Math.max(0, Number(gross) || 0) * (1 - deductibleContribRate(settings));
}

export function taxableToGross(taxable, settings = {}) {
  return Math.max(0, Number(taxable) || 0) / (1 - deductibleContribRate(settings));
}

// Mesi (indice 0-11) in cui arrivano le mensilità aggiuntive.
export const EXTRA_MONTHS = {
  quattordicesima: 5,  // giugno
  tredicesima: 11,     // dicembre
};

// Retribuzione mensile "base" da contratto: ore settimanali × paga oraria ×
// divisore orario del CCNL. Il divisore NON è sempre 52/12: il CCNL Turismo usa
// 172 ore mensili su 40 settimanali, cioè 4,30 settimane, ed è la differenza fra
// le 103,20 ore che compaiono in busta e le 104,04 che uscivano da 52/12.
// Serve come importo indicativo della tredicesima/quattordicesima (≈ una mensilità).
// Per un lavoratore a chiamata non esiste un orario contrattuale: le ore
// settimanali rimaste in memoria da una configurazione precedente darebbero una
// mensilità inventata, quindi vale 0.
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
 * Frazione di mensilità aggiuntiva effettivamente maturata (0..1).
 *
 * La 13ª/14ª non è quasi mai una mensilità piena: si matura in dodicesimi lungo
 * un periodo di competenza, che per la quattordicesima va da luglio dell'anno
 * prima a giugno, per la tredicesima segue l'anno solare. Chi è stato assunto a
 * metà periodo ne prende solo una quota — sulla busta di riferimento, assunzione
 * 29/12/2025, la 14ª di giugno 2026 vale 6/12.
 *
 * Senza data di assunzione si assume la mensilità piena (comportamento storico).
 *
 * @param {'tredicesima'|'quattordicesima'} kind
 * @param {number} year anno in cui la mensilità viene erogata
 * @param {object} settings contiene `hireDate` (ISO 'YYYY-MM-DD')
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

// Mensilità aggiuntive GIÀ arrivate entro il mese indicato (indice 0-11),
// espresse in mensilità equivalenti: una 14ª maturata a metà pesa 0,5.
// A luglio (6) la quattordicesima di giugno (5) è già arrivata; la tredicesima no.
export function receivedExtraMonthsCount(settings = {}, monthIndex = 11, year = new Date().getFullYear()) {
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
export function extraMonthsAccrued(settings = {}, year = new Date().getFullYear()) {
  return (settings.hasTredicesima ? extraMonthAccrual('tredicesima', year, settings) : 0)
    + (settings.hasQuattordicesima ? extraMonthAccrual('quattordicesima', year, settings) : 0);
}

/**
 * Stima del reddito annuo lordo pieno a partire dal contratto:
 * (ore settimanali × paga oraria × 52) + tredicesima/quattordicesima.
 *
 * Serve come riferimento per l'aliquota IRPEF effettiva: la tassazione è
 * progressiva e annuale, quindi va ancorata al reddito annuo pieno (incluse
 * le mensilità aggiuntive), non a quello maturato finora nell'anno.
 *
 * @param {object} settings hourlyRate, expectedWeeklyHours, has(Tre|Quattor)dicesima
 * @param {number} year anno di riferimento (per il rateo delle mensilità aggiuntive)
 * @returns {number} reddito annuo lordo stimato (0 se dati insufficienti)
 */
export function projectAnnualGross(settings = {}, year = new Date().getFullYear()) {
  return monthlyBaseGross(settings) * (12 + extraMonthsAccrued(settings, year));
}

/**
 * Calcola la stima del netto annuo.
 * @param {number} grossAnnual reddito lordo annuo da lavoro dipendente
 * @param {object} settings può contenere addRegionalePct / addComunalePct
 */
export function calcNetAnnual(grossAnnual, settings = {}) {
  const T = TAX_2026;
  const gross = Math.max(0, Number(grossAnnual) || 0);

  if (gross <= 0) {
    return {
      gross: 0, contributi: 0, contributiRighe: [], imponibile: 0, irpefLorda: 0,
      detrazioneLavoro: 0, detrazioneCuneo: 0, irpefNetta: 0,
      addRegionale: 0, addComunale: 0, trattamentoIntegrativo: 0,
      bonusCuneo: 0, net: 0,
    };
  }

  const cont = calcContributi(gross, settings, monthlyBaseGross(settings) * 12);
  const contributi = cont.totale;
  // Reddito complessivo ≈ imponibile: al lordo si tolgono i soli contributi
  // deducibili e si aggiunge l'eventuale fringe benefit (quota Ente Bilaterale
  // a carico ditta), che è tassato pur non essendo trattenuto.
  const imponibile = gross - cont.deducibili + cont.fringeImponibile;

  const lorda = irpefLorda(imponibile);
  const detLav = detrazioneLavoro(imponibile);
  const detCuneo = detrazioneCuneo(imponibile);
  const detrTotali = detLav + detCuneo;

  const irpefNetta = Math.max(0, lorda - detrTotali);

  const pctOr = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const aliqReg = pctOr(settings.addRegionalePct, T.ADD_REGIONALE_DEFAULT) / 100;
  const aliqCom = pctOr(settings.addComunalePct, T.ADD_COMUNALE_DEFAULT) / 100;
  // Le addizionali sono dovute solo se c'è imposta netta, e solo se non sono
  // già trattenute da un altro datore o sospese per primo anno di lavoro
  // (stessa regola del calcolo mensile).
  const addDovute = !settings.addizionaliAltrove && !settings.noAddizionali && irpefNetta > 0;
  const addRegionale = addDovute ? imponibile * aliqReg : 0;
  const addComunale = addDovute ? imponibile * aliqCom : 0;

  const ti = trattamentoIntegrativo(imponibile, lorda, detLav, detrTotali);
  const cuneo = bonusCuneo(imponibile, imponibile);

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
  const T = TAX_2026;
  const ann = calcNetAnnual(annualGrossRef, settings);
  const imp = ann.imponibile;
  const override = !!settings.noTrattamentoIntegrativo;
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
 * Stima del netto del MESE, partendo dal lordo mensile — come una busta paga.
 *
 * Trattenute e bonus sono voci SEPARATE (il bonus non riduce le trattenute):
 *   - Trattenute = contributi IVS (9,19%) + IRPEF + addizionali  → sempre ≥ 9,19%
 *   - Bonus      = trattamento integrativo + cuneo (quota mensile)
 *   - Netto      = lordo − trattenute + bonus
 *
 * Contributi e addizionali si applicano direttamente al lordo del mese.
 * L'IRPEF è progressiva e annuale: si usa l'aliquota IRPEF effettiva ricavata
 * dal reddito annuo di riferimento (`annualGrossRef`, es. proiezione da
 * contratto + 13ª/14ª) applicata all'imponibile del mese.
 * Trattamento integrativo e indennità (L. 207/2024) sono rapportati ai giorni
 * del mese (giorni di calendario / 365), come in busta paga.
 *
 * @param {number} monthGross lordo del mese (turni + eventuale mensilità agg.)
 * @param {number} annualGrossRef reddito annuo lordo di riferimento (per aliquote IRPEF/bonus)
 * @param {object} settings addRegionalePct / addComunalePct / tfrInBusta
 * @param {number} monthDays giorni di calendario del mese (per la prorata di TI/indennità)
 * @param {number} extraMonthGross quota di `monthGross` che è 13ª/14ª (tassata a parte)
 */
export function calcNetMonthly(monthGross, annualGrossRef, settings = {}, monthDays = 365 / 12, extraMonthGross = 0) {
  const T = TAX_2026;
  const gross = Math.max(0, Number(monthGross) || 0);
  const ann = calcNetAnnual(annualGrossRef, settings);

  const cont = calcContributi(gross, settings, monthlyBaseGross(settings));
  const contributi = cont.totale;
  // Imponibile fiscale come lo scrive la busta: lordo meno i soli contributi
  // DEDUCIBILI (l'Ente Bilaterale a carico dipendente non lo è) più la quota
  // ditta, che è un fringe benefit tassato pur non essendo trattenuto.
  const imponibile = round2(gross - cont.deducibili + cont.fringeImponibile);

  // La mensilità aggiuntiva viaggia su un binario fiscale separato: in busta ha
  // un proprio imponibile ("tassazione autonoma") e NON assorbe detrazioni.
  // I contributi deducibili sono tutti percentuali sul lordo, quindi la stessa
  // aliquota si applica alla quota di 13ª/14ª.
  const aliqDeducibile = gross > 0 ? cont.deducibili / gross : 0;
  const extraGross = Math.min(Math.max(0, Number(extraMonthGross) || 0), gross);
  const imponibileExtra = extraGross * (1 - aliqDeducibile);
  const imponibileOrdinario = Math.max(0, imponibile - imponibileExtra);

  // IRPEF come in busta paga:
  //  - IRPEF LORDA ordinaria = quota del mese sull'imponibile annuo (scala col reddito del mese);
  //  - DETRAZIONI da lavoro dipendente = importo annuo rapportato ai GIORNI del mese
  //    (giorni/365), NON alla quota di imponibile. È così che le calcola il sostituto
  //    d'imposta (verificato su busta reale: 1.955 × 31/365 = 166,04);
  //  - IRPEF sulla mensilità aggiuntiva = aliquota MARGINALE, senza detrazioni.
  const ratio = ann.imponibile > 0 ? imponibileOrdinario / ann.imponibile : 0;
  const irpefLordaOrdinaria = round2(ann.irpefLorda * ratio);
  const irpefExtra = round2(imponibileExtra * aliquotaMarginale(ann.imponibile));
  const irpefLorda = round2(irpefLordaOrdinaria + irpefExtra);
  const detrazioni = round2((ann.detrazioneLavoro + ann.detrazioneCuneo) * (monthDays / 365));
  // Le detrazioni si scaricano solo sull'ordinario: l'eventuale eccedenza non
  // abbatte l'imposta della 13ª/14ª, va a conguaglio.
  const irpefNetta = round2(Math.max(0, irpefLordaOrdinaria - detrazioni) + irpefExtra);
  // Quota di detrazione che trova CAPIENZA nell'imposta. Quando la detrazione
  // supera l'IRPEF lorda il netto è già giusto (l'imposta si azzera e basta), ma
  // scrivere «lorda 157 − detrazioni 161 = netta 0» sembra un errore di conto:
  // in busta compare la parte capiente. Verificato su una busta reale, dove la
  // detrazione teorica di 160,68 è stampata 157,06, cioè pari all'imposta.
  const detrazioniApplicate = Math.min(detrazioni, irpefLordaOrdinaria);

  // Addizionali: stessa aliquota sull'imponibile del mese, dovute solo con imposta netta.
  // Se già trattenute da un altro datore (conguaglio a saldo altrove) o sospese
  // per primo anno di lavoro (nessun anno precedente da cui calcolarle), sono 0.
  const pctOr = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const aliqReg = pctOr(settings.addRegionalePct, T.ADD_REGIONALE_DEFAULT) / 100;
  const aliqCom = pctOr(settings.addComunalePct, T.ADD_COMUNALE_DEFAULT) / 100;
  const addDovute = !settings.addizionaliAltrove && !settings.noAddizionali && ann.irpefNetta > 0;
  const addRegionale = addDovute ? round2(imponibile * aliqReg) : 0;
  const addComunale = addDovute ? round2(imponibile * aliqCom) : 0;

  // Trattenute fisse mensili (quota associativa, rata di un prestito...):
  // voce generica, non fiscale — non tocca imponibile/IRPEF/TI/cuneo, si
  // sottrae così com'è, come in busta.
  const trattenuteFisse = round2(
    (Array.isArray(settings.fixedMonthlyDeductions) ? settings.fixedMonthlyDeductions : [])
      .reduce((s, v) => s + (Number(v.amount) || 0), 0),
  );

  const trattenute = round2(contributi + irpefNetta + addRegionale + addComunale + trattenuteFisse);

  // Trattamento integrativo e indennità (L. 207/2024): quota del mese rapportata
  // ai giorni (giorni di calendario / 365), come in busta paga. Voci separate,
  // aggiunte SOLO alla fine: non riducono le trattenute.
  // Il TI può non essere erogato in busta (il software paghe lo rimanda a conguaglio
  // in base alle proiezioni): interruttore `noTrattamentoIntegrativo`.
  // Entrambe TRONCATE a due decimali, non arrotondate: in busta 1.200 × 31/365
  // fa 101,91 (il valore pieno è 101,9178) e 1.060,92 × 5,3% fa 56,22 (56,2288).
  const dayFraction = monthDays / 365;
  const trattamentoIntegrativo = settings.noTrattamentoIntegrativo
    ? 0 : trunc2(ann.trattamentoIntegrativo * dayFraction);
  // L'indennità L. 207/2024 NON è una quota annua spalmata sui giorni: in busta
  // è la percentuale di fascia applicata all'imponibile fiscale DEL MESE, quindi
  // segue le ore effettivamente lavorate (verificato: 4,8% × 1.849,65 = 88,78).
  const cuneoPct = cuneoPercent(ann.imponibile);
  const bonusCuneo = trunc2(imponibile * cuneoPct);
  const bonus = round2(trattamentoIntegrativo + bonusCuneo);

  // Anticipo TFR in busta (opzionale): quota che matura sul lordo (1/13,5 meno lo
  // 0,50% al Fondo di garanzia ≈ 6,91%). NON è soggetto a IRPEF ordinaria/contributi,
  // ma a TASSAZIONE SEPARATA (aliquota media, senza addizionali): a differenza di TI e
  // cuneo — che sono esenti — qui l'imposta va sottratta. Aliquota stimata (default 23%,
  // dove cade quasi sempre il reddito di riferimento del TFR) o impostabile a mano.
  // NOTA APERTA sulla BASE del TFR. Le due buste disponibili la calcolano in due
  // modi diversi e nessuno dei due è il lordo pieno che usiamo qui:
  //   - fiduciari giugno: solo la retribuzione ordinaria, senza maggiorazioni;
  //   - Turismo luglio:   retribuzione + indennità «utili al TFR» + maggiorazione
  //     domenicale, ma senza il lavoro supplementare e senza TOP STORE — e
  //     nemmeno così torna, perché la formula dà 67,39 contro i 66,39 stampati.
  // Due buste che si contraddicono e una che non quadra non bastano a stabilire
  // una regola: la base resta il lordo finché non arriva un terzo cedolino.
  // Non tocca il netto del mese in nessuno dei due casi.
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
    trattamentoIntegrativo, bonusCuneo, bonus,
    tfrLordo, tfrImposta, aliqTfr, tfr, net,
  };
}
