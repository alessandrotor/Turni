// Le percentuali copiate dal cedolino, tradotte in quello che l'app si aspetta.
//
// IL PROBLEMA
// La busta usa due convenzioni diverse nei nomi delle voci, e non lo dichiara.
// Verificato su diciassette cedolini reali (CCNL turismo, pubblici esercizi),
// con i conti che tornano al centesimo sulla paga base di 8,44942 €/h:
//
//   «Magg. dom. 10%»          base × 0,10   →  10 è la SOLA maggiorazione
//   «Magg. nott. 25% P.E.»    base × 0,25   →  25 è la SOLA maggiorazione
//   «Supplementare 30% P.E.»  base × 1,30   →  30 è la maggiorazione, ma
//                                              l'ora è pagata intera al 130%
//   «Magg. fest. 120%»        base × 1,20   →  120 è il TOTALE: ogni ora di
//                                              quel giorno vale il 120% del
//                                              normale, cioè +20%
//
// L'app chiede sempre «quanto in più». Tre voci su quattro si copiano così
// come sono; il festivo no. Chi scrive 120 dove andava 20 si ritrova un giorno
// festivo gonfiato dell'83% — 125,47 € invece di 68,44 — e nulla glielo dice.
//
// PERCHÉ SI PUÒ CONVERTIRE SENZA INDOVINARE
// Perché sopra il 100% non esiste ambiguità. La maggiorazione più alta trovata
// nei CCNL italiani è il 75% (straordinario notturno festivo, Multiservizi e
// Industria); i metalmeccanici arrivano al 65%. Nessun contratto supera il
// 100%, quindi un valore che lo supera non è una maggiorazione: è un totale.
//
// La fascia 76–99 invece resta ambigua — non è un totale (quelli partono da
// 100) ma è più alta di qualunque contratto noto. Lì si avvisa e non si tocca:
// segnalare un dubbio è diverso dal risolverlo al posto di chi scrive.

/** La maggiorazione più alta riscontrata in un CCNL italiano. */
export const MAGGIORAZIONE_MASSIMA_NOTA = 75;

/**
 * Traduce quello che è stato scritto in quello che il motore si aspetta.
 *
 * @param {number|string} grezzo il valore appena scritto nel campo
 * @returns {{valore:number|string, convertito:boolean, sospetto:boolean, originale:number}}
 *   `valore` è ciò che va salvato — invariato quando non c'è nulla da fare,
 *   compreso il caso di un campo vuoto, che deve restare vuoto e non diventare
 *   zero. `convertito` dice che il numero è stato cambiato; `sospetto` che
 *   merita un'occhiata ma è stato lasciato com'è.
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
