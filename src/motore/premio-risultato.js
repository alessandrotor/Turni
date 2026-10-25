// Il bonus come PREMIO DI RISULTATO: tassato a parte con un'imposta sostitutiva (aliquota per anno
// in fisco/index.js), fino a 5.000 € l'anno nel biennio, per chi l'anno prima ha avuto al massimo
// 80.000 € di lavoro dipendente. I contributi INPS restano.
//
// NON è il caso di ogni «bonus»: quello della busta di riferimento è un'indennità nell'imponibile
// normale, quindi il default è spento (`bonusPremioRisultato`). Dalla norma, nessuna busta del
// progetto ha un premio detassato. → check-premio-risultato.mjs
//
// Il mese si calcola SENZA il premio (non è reddito complessivo), poi il premio si aggiunge con i
// suoi contributi e la sua imposta. Che anche il programma paghe lo tolga dal lordo × 12 della
// regola mensile NON è verificato. Il tetto annuo non si controlla mese per mese (lo dice il
// riscontro, non un `Math.min`).

import { nettoDelMese, calcContributi, monthlyBaseGross } from './net.js';
import { aliquotaPremio, conFisco } from './fisco/index.js';

const round2 = (n) => Math.round(n * 100) / 100;

// L'aliquota dell'anno sta in fisco/index.js.
export { aliquotaPremio };

/**
 * Il netto del mese col premio di risultato tassato a parte. Quanto del lordo
 * è premio lo dice `lordoDelMese` (`premioMese`, col flag acceso). Senza premio è
 * esattamente `nettoDelMese`: chi non lo usa non vede cambiare un centesimo.
 *
 * @param {{lordo:number, extraMese?:number, premioMese?:number}} mese da `lordoDelMese`
 */
export function nettoDelMeseConPremio(mese, impostazioni, giorniMese, anno, capienza = null) {
  const settings = conFisco(impostazioni, anno);
  const premio = Math.min(Math.max(0, Number(mese.premioMese) || 0), Number(mese.lordo) || 0);
  if (!premio) return nettoDelMese(mese.lordo, settings, giorniMese, mese.extraMese || 0, capienza);
  const resto = mese.lordo - premio;
  const base = nettoDelMese(resto, settings, giorniMese, mese.extraMese || 0, capienza);
  // I contributi del premio: quelli del mese intero meno quelli del mese senza.
  const eb = monthlyBaseGross(settings);
  const contributiPremio = round2(calcContributi(mese.lordo, settings, eb).totale - calcContributi(resto, settings, eb).totale);
  const impostaSostitutiva = round2((premio - contributiPremio) * aliquotaPremio(anno));
  return {
    ...base,
    gross: mese.lordo,
    premio,
    contributiPremio,
    impostaSostitutiva,
    contributi: round2(base.contributi + contributiPremio),
    trattenute: round2(base.trattenute + contributiPremio + impostaSostitutiva),
    net: round2(base.net + premio - contributiPremio - impostaSostitutiva),
  };
}
