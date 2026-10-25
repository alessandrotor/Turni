
/** @typedef {import('./impostazioni.js').Impostazioni} Impostazioni */
// Fondo pensione e cassa sanitaria: trattenute in busta che ESCONO dal reddito (art. 51 c. 2 TUIR,
// vedi check-cu-2025.mjs), oltre ai contributi INPS:
//   - lett. h) previdenza complementare, entro 5.300 € l'anno dal 2026 (L. 199/2025);
//   - lett. a) casse sanitarie di contratto, entro 3.615,20 € l'anno.
// Per chi versa al fondo la soglia lorda dei 15.000 SALE, e il netto scende. Il TFR mandato al
// fondo non conta. Vale SOLO per ciò che il datore trattiene in busta (la deduzione del 730 viene
// dopo e alla soglia non conta).
//
// NON riscontrato su un cedolino: viene dalla norma, e se un cedolino dicesse il contrario vince
// il cedolino. → check-previdenza.mjs

export const TETTO_FONDO_PENSIONE = 5300;
export const TETTO_CASSA_SANITARIA = 3615.2;

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => Math.max(0, Number(v) || 0);

/**
 * Le righe di trattenuta del periodo, nello stesso formato di `calcContributi`.
 * Il fondo è una percentuale della retribuzione (qui il lordo: la base vera è
 * la retribuzione utile al TFR, che per chi è pagato a ore coincide quasi); la
 * cassa sanitaria è una quota fissa al mese.
 *
 * @param {number} gross lordo del periodo
 * @param {Impostazioni} settings `fondoPensionePct`, `cassaSanitariaEuro`
 * @param {number} mesi quanti mesi copre il periodo (1 per la busta, 12 per l'anno)
 * @returns {Array<{label, pct?, base, importo, deducibile: true}>}
 */
export function trattenuteFuoriReddito(gross, settings = {}, mesi = 1) {
  const righe = [];
  const pct = num(settings.fondoPensionePct);
  if (pct > 0 && gross > 0) {
    const importo = round2(Math.min(gross * (pct / 100), TETTO_FONDO_PENSIONE * (mesi / 12)));
    righe.push({ label: 'Fondo pensione', pct, base: round2(gross), importo, deducibile: true });
  }
  const cassa = num(settings.cassaSanitariaEuro);
  if (cassa > 0 && gross > 0) {
    const importo = round2(Math.min(cassa * mesi, TETTO_CASSA_SANITARIA * (mesi / 12)));
    righe.push({ label: 'Cassa sanitaria', base: round2(gross), importo, deducibile: true });
  }
  return righe;
}
