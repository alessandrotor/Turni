// Stima del NETTO annuo secondo la fiscalità italiana 2026 (BETA).
// Funzioni pure e testabili. Considera: contributi IVS, IRPEF a scaglioni,
// detrazione lavoro dipendente, addizionali regionale/comunale, trattamento
// integrativo (ex bonus Renzi) e cuneo fiscale.
//
// ATTENZIONE: è una STIMA a scopo indicativo, non sostituisce la busta paga
// né il conguaglio. Parametri verificati per il 2026.

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

// Somma "cuneo" non tassata per redditi <= 20.000 (% sul reddito da lavoro)
function bonusCuneo(redditoComplessivo, redditoLavoro) {
  const T = TAX_2026;
  if (redditoComplessivo > T.CUNEO_SOGLIA_SOMMA) return 0;
  let pct;
  if (redditoLavoro <= T.CUNEO_PCT_1_SOGLIA) pct = T.CUNEO_PCT_1;
  else if (redditoLavoro <= T.CUNEO_PCT_2_SOGLIA) pct = T.CUNEO_PCT_2;
  else pct = T.CUNEO_PCT_3;
  return redditoLavoro * pct;
}

// Trattamento integrativo, calcolato sull'imponibile e sulle detrazioni.
function trattamentoIntegrativo(reddito, irpef, detLavoro, detrTotali) {
  const T = TAX_2026;
  if (reddito > T.TI_SOGLIA_MAX) return 0;
  if (reddito <= T.TI_SOGLIA_PIENO) {
    return irpef > detLavoro ? T.TI_MASSIMO : 0;
  }
  const diff = detrTotali - irpef;
  return Math.min(T.TI_MASSIMO, Math.max(0, diff));
}

// Settimane retribuite in un anno (convenzione standard).
export const WEEKS_PER_YEAR = 52;

// Mesi (indice 0-11) in cui arrivano le mensilità aggiuntive.
export const EXTRA_MONTHS = {
  quattordicesima: 5,  // giugno
  tredicesima: 11,     // dicembre
};

// Retribuzione mensile "base" da contratto: ore settimanali × paga oraria × (52/12).
// Serve come importo indicativo della tredicesima/quattordicesima (≈ una mensilità).
export function monthlyBaseGross(settings = {}) {
  const rate = Math.max(0, Number(settings.hourlyRate) || 0);
  const weeklyHours = Math.max(0, Number(settings.expectedWeeklyHours) || 0);
  return rate * weeklyHours * (WEEKS_PER_YEAR / 12);
}

// Numero di mensilità aggiuntive attive (tredicesima e/o quattordicesima).
export function extraMonthsCount(settings = {}) {
  return (settings.hasTredicesima ? 1 : 0) + (settings.hasQuattordicesima ? 1 : 0);
}

// Mensilità aggiuntive GIÀ arrivate entro il mese indicato (indice 0-11).
// A luglio (6) la quattordicesima di giugno (5) è già arrivata; la tredicesima no.
export function receivedExtraMonthsCount(settings = {}, monthIndex = 11) {
  let n = 0;
  if (settings.hasQuattordicesima && monthIndex >= EXTRA_MONTHS.quattordicesima) n += 1;
  if (settings.hasTredicesima && monthIndex >= EXTRA_MONTHS.tredicesima) n += 1;
  return n;
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
 * @returns {number} reddito annuo lordo stimato (0 se dati insufficienti)
 */
export function projectAnnualGross(settings = {}) {
  return monthlyBaseGross(settings) * (12 + extraMonthsCount(settings));
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
      gross: 0, contributi: 0, imponibile: 0, irpefLorda: 0,
      detrazioneLavoro: 0, detrazioneCuneo: 0, irpefNetta: 0,
      addRegionale: 0, addComunale: 0, trattamentoIntegrativo: 0,
      bonusCuneo: 0, net: 0,
    };
  }

  const contributi = gross * T.ALIQUOTA_IVS;
  const imponibile = gross - contributi; // reddito complessivo ≈ imponibile

  const lorda = irpefLorda(imponibile);
  const detLav = detrazioneLavoro(imponibile);
  const detCuneo = detrazioneCuneo(imponibile);
  const detrTotali = detLav + detCuneo;

  const irpefNetta = Math.max(0, lorda - detrTotali);

  const pctOr = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const aliqReg = pctOr(settings.addRegionalePct, T.ADD_REGIONALE_DEFAULT) / 100;
  const aliqCom = pctOr(settings.addComunalePct, T.ADD_COMUNALE_DEFAULT) / 100;
  // Le addizionali sono dovute solo se c'è imposta netta
  const addRegionale = irpefNetta > 0 ? imponibile * aliqReg : 0;
  const addComunale = irpefNetta > 0 ? imponibile * aliqCom : 0;

  const ti = trattamentoIntegrativo(imponibile, lorda, detLav, detrTotali);
  const cuneo = bonusCuneo(imponibile, imponibile);

  const net = gross - contributi - irpefNetta - addRegionale - addComunale + ti + cuneo;

  return {
    gross,
    contributi,
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
 */
export function calcNetMonthly(monthGross, annualGrossRef, settings = {}, monthDays = 365 / 12) {
  const T = TAX_2026;
  const gross = Math.max(0, Number(monthGross) || 0);
  const ann = calcNetAnnual(annualGrossRef, settings);

  const contributi = gross * T.ALIQUOTA_IVS;
  const imponibile = gross - contributi;

  // IRPEF come in busta paga:
  //  - IRPEF LORDA = quota del mese sull'imponibile annuo (scala col reddito del mese);
  //  - DETRAZIONI da lavoro dipendente = importo annuo rapportato ai GIORNI del mese
  //    (giorni/365), NON alla quota di imponibile. È così che le calcola il sostituto
  //    d'imposta (verificato su busta reale: 1.955 × 31/365 = 166,04).
  const ratio = ann.imponibile > 0 ? imponibile / ann.imponibile : 0;
  const irpefLorda = ann.irpefLorda * ratio;
  const detrazioni = (ann.detrazioneLavoro + ann.detrazioneCuneo) * (monthDays / 365);
  const irpefNetta = Math.max(0, irpefLorda - detrazioni);

  // Addizionali: stessa aliquota sull'imponibile del mese, dovute solo con imposta netta.
  // Se già trattenute da un altro datore (conguaglio a saldo altrove), sono 0 in questa busta.
  const pctOr = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const aliqReg = pctOr(settings.addRegionalePct, T.ADD_REGIONALE_DEFAULT) / 100;
  const aliqCom = pctOr(settings.addComunalePct, T.ADD_COMUNALE_DEFAULT) / 100;
  const addDovute = !settings.addizionaliAltrove && ann.irpefNetta > 0;
  const addRegionale = addDovute ? imponibile * aliqReg : 0;
  const addComunale = addDovute ? imponibile * aliqCom : 0;

  const trattenute = contributi + irpefNetta + addRegionale + addComunale;

  // Trattamento integrativo e indennità (L. 207/2024): quota del mese rapportata
  // ai giorni (giorni di calendario / 365), come in busta paga. Voci separate,
  // aggiunte SOLO alla fine: non riducono le trattenute.
  // Il TI può non essere erogato in busta (il software paghe lo rimanda a conguaglio
  // in base alle proiezioni): interruttore `noTrattamentoIntegrativo`.
  const dayFraction = monthDays / 365;
  const trattamentoIntegrativo = settings.noTrattamentoIntegrativo ? 0 : ann.trattamentoIntegrativo * dayFraction;
  const bonusCuneo = ann.bonusCuneo * dayFraction;
  const bonus = trattamentoIntegrativo + bonusCuneo;

  // Anticipo TFR in busta (opzionale): quota che matura sul lordo (1/13,5 meno lo
  // 0,50% al Fondo di garanzia ≈ 6,91%). Esclusa da IRPEF/contributi: si aggiunge
  // come anticipo sul netto.
  const tfr = settings.tfrInBusta ? gross * (1 / 13.5 - 0.005) : 0;

  const net = gross - trattenute + bonus + tfr;

  return {
    gross, contributi, imponibile,
    irpefLorda, detrazioni, irpefNetta,
    addRegionale, addComunale, trattenute,
    trattamentoIntegrativo, bonusCuneo, bonus, tfr, net,
  };
}
