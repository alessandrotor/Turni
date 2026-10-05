// Fondo pensione e cassa sanitaria: trattenute in busta che ESCONO dal reddito.
//
// Perché contano: il reddito dei 15.000 è il lordo meno quello che la legge
// toglie dal reddito di lavoro dipendente (art. 51 c. 2 TUIR, vedi
// check-cu-2025.mjs). Oltre ai contributi INPS, ne escono altre due cose che
// il datore trattiene in busta:
//
//   - lett. h) i contributi alla previdenza complementare (il fondo pensione),
//     entro 5.300 € l'anno dal 2026 (L. 199/2025; erano 5.164,57). Il tetto
//     comprende anche la quota del datore, che qui non si chiede: alle cifre di
//     chi usa l'app (qualche centinaio di euro l'anno) non lo si sfiora.
//   - lett. a) i contributi a casse sanitarie di contratto (Fondo Est per
//     commercio e turismo, FASI per i dirigenti...), entro 3.615,20 € l'anno.
//
// Quindi per chi versa al fondo pensione la soglia lorda dei 15.000 SALE: a
// parità di reddito si può guadagnare di più. E l'IRPEF scende, il netto pure
// (la trattenuta esce dalla busta). Il TFR mandato al fondo invece non conta:
// non esce dallo stipendio del mese, e non è reddito di quell'anno.
//
// Vale SOLO per quello che il datore trattiene in busta. Chi versa da solo al
// fondo lo deduce col 730: è una deduzione dal reddito complessivo (art. 10),
// che viene dopo e alla soglia non conta. Per questo il campo dice «in busta».
//
// NON riscontrato su un cedolino: nessuna busta del progetto ha queste voci.
// Viene dalla norma; se un cedolino dicesse il contrario, vince il cedolino.
// → check-previdenza.mjs

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
 * @param {object} settings `fondoPensionePct`, `cassaSanitariaEuro`
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
