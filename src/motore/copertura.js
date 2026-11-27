// Il resto dell'anno «almeno da contratto», senza contare due volte i turni già
// segnati. Dal mese di oggi in poi ogni mese vale la mensilità da contratto, e
// le ore ORDINARIE segnate in quel mese (ferie comprese) ne coprono una parte:
// si aggiunge solo quella che manca. Le supplementari stanno sopra la mensilità,
// sono già nel maturato e restano lì.
// Prima il resto si contava a giorni di calendario: le ferie del 25–28 novembre,
// già segnate, venivano contate una volta come turni e una come «resto del mese
// da contratto» (~190 € in più a fine novembre 2026). → check-proiezione.mjs

/**
 * Euro di ore ordinarie già segnate dal mese di `oggi` in poi, ciascun mese al
 * massimo una mensilità.
 * @param {Array} turni quelli contati nel maturato (dopo il montante)
 * @param {object|null} mappa uscita di `computePayByShift`
 * @param {number} anno @param {Date} oggi @param {number} mensile
 * @returns {number|null} null senza mappa: chi chiama torna alla regola a giorni
 */
export function giaCoperto(turni, mappa, anno, oggi, mensile) {
  if (!mappa) return null;
  if (anno < oggi.getFullYear()) return 0;
  const da = anno > oggi.getFullYear() ? 0 : oggi.getMonth();
  const perMese = new Array(12).fill(0);
  for (const s of turni || []) {
    const m = Number(String(s.date).slice(5, 7)) - 1;
    const v = mappa[s.id];
    if (m >= da && v) perMese[m] += (v.base || 0) - (v.overtimeBase || 0) - (v.straordinarioBase || 0);
  }
  return perMese.reduce((t, e) => t + Math.min(mensile, Math.max(0, e)), 0);
}

/**
 * Quanto manca, da contratto, per arrivare a fine anno: i mesi da quello di
 * `oggi` compreso, meno la parte già coperta dai turni.
 * @returns {number}
 */
export function restoDaContratto(anno, oggi, mensile, coperto) {
  const mesi = anno < oggi.getFullYear() ? 0 : anno > oggi.getFullYear() ? 12 : 12 - oggi.getMonth();
  return Math.max(0, mesi * mensile - coperto);
}
