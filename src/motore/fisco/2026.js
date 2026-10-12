// Il fisco del 2026: scaglioni IRPEF, detrazioni, trattamento integrativo,
// indennità L. 207/2024, aliquota IVS. Per un anno nuovo: copia questo file in
// `<anno>.js`, cambia i valori che la legge di bilancio cambia, aggiungi la
// sua riga in `fisco/index.js`.

export default {
  anno: 2026,

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
