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
