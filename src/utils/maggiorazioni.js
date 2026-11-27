// Le percentuali copiate dal cedolino, tradotte in quello che l'app si aspetta.
//
// La busta usa due convenzioni nei nomi delle voci (17 cedolini reali, base 8,44942 €/h):
//   «Magg. dom. 10%» e «Magg. nott. 25%»  → la SOLA maggiorazione
//   «Supplementare 30%»                   → maggiorazione, l'ora è pagata intera al 130%
//   «Magg. fest. 120%»                    → il TOTALE (+20%)
// L'app chiede sempre «quanto in più»: chi scrive 120 dove andava 20 si ritrova un festivo
// gonfiato dell'83%. Sopra il 100% non c'è ambiguità (la maggiorazione più alta nei CCNL italiani
// è il 75%), quindi è un totale e si converte. La fascia 76–99 è ambigua: si avvisa e non si tocca.

/** La maggiorazione più alta riscontrata in un CCNL italiano. */
export const MAGGIORAZIONE_MASSIMA_NOTA = 75;

/**
 * Traduce quello che è stato scritto in quello che il motore si aspetta.
 *
 * @param {number|string} grezzo il valore appena scritto nel campo
 * @returns {{valore:number|string, convertito:boolean, sospetto:boolean, originale:number}}
 *   `valore` è ciò che va salvato (invariato se non c'è nulla da fare, anche un campo vuoto);
 *   `convertito` dice che il numero è stato cambiato; `sospetto` che merita un'occhiata.
 */
export function normalizzaMaggiorazione(grezzo) {
  const invariato = { valore: grezzo, convertito: false, sospetto: false, originale: 0 };

  // Campo vuoto o non numerico: non è compito di questa funzione ripulirlo.
  if (grezzo === '' || grezzo == null) return invariato;
  const n = Number(String(grezzo).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return invariato;

  // Sopra il 100: è un totale, la base è dentro. Si sottrae.
  if (n > 100) {
    return { valore: n - 100, convertito: true, sospetto: false, originale: n };
  }

  // Esattamente 100: sottrarre darebbe zero, cioè «nessuna maggiorazione», che
  // non è quasi mai ciò che si intende. Si segnala e si lascia stare.
  if (n === 100) {
    return { valore: grezzo, convertito: false, sospetto: true, originale: n };
  }

  // Zona grigia: più alta di ogni CCNL noto, ma non è un totale.
  if (n > MAGGIORAZIONE_MASSIMA_NOTA) {
    return { valore: grezzo, convertito: false, sospetto: true, originale: n };
  }

  return invariato;
}

/** Il messaggio da mostrare sotto il campo, o `null` se non c'è nulla da dire. */
export function messaggioMaggiorazione(esito) {
  if (!esito) return null;
  const num = (v) => String(Number(v)).replace('.', ',');

  if (esito.convertito) {
    return `Ho letto ${num(esito.originale)}% come il totale scritto in busta: qui va `
      + `${num(esito.valore)}, cioè quanto in più vale ogni ora di quel giorno.`;
  }
  if (esito.sospetto) {
    return `${num(esito.originale)}% è più alta di qualunque maggiorazione che si trovi `
      + `nei contratti (la massima è ${MAGGIORAZIONE_MASSIMA_NOTA}%). Controlla il cedolino: `
      + `se quel numero è il totale, qui va la differenza.`;
  }
  return null;
}
