// Il bonus come PREMIO DI RISULTATO: tassato a parte, non con l'IRPEF.
//
// I premi di risultato previsti da un accordo aziendale o territoriale pagano
// un'imposta sostitutiva invece dell'IRPEF: 1% nel 2026 e nel 2027 (L. 30
// dicembre 2025 n. 199, art. 1 c. 9), 5% prima e dopo; fino a 5.000 € l'anno
// nel biennio (3.000 € prima), per chi l'anno prima ha avuto al massimo
// 80.000 € di reddito da lavoro dipendente. I contributi INPS restano, e
// l'imposta si paga sul premio al netto di quelli.
//
// NON è il caso di ogni «bonus»: quello della busta di riferimento è
// un'indennità nell'imponibile normale (IVS calcolato anche su di lei, agosto
// 2026), quindi il default resta spento e lo accende chi lo sa
// (`bonusPremioRisultato`). Dalla norma, nessuna busta del progetto ha un
// premio detassato. → check-premio-risultato.mjs
//
// Come entra nel netto: il mese si calcola SENZA il premio (IRPEF, detrazioni,
// regola dei 1.250 €, capienza: il premio non è reddito complessivo, perché un
// reddito a imposta sostitutiva non concorre a formarlo), poi il premio si
// aggiunge con i suoi contributi e la sua imposta. Che anche il programma paghe
// tolga il premio dal lordo × 12 della regola mensile NON è verificato.
//
// Il tetto annuo non si controlla mese per mese: 120 € al mese sono 1.440 €
// l'anno, lontani dai 5.000. Lo dice il riscontro, non un `Math.min`.

import { nettoDelMese, calcContributi, monthlyBaseGross } from './net.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Aliquota dell'imposta sostitutiva nell'anno: 1% nel 2026-2027, 5% altrimenti. */
export function aliquotaPremio(anno) {
  return anno === 2026 || anno === 2027 ? 0.01 : 0.05;
}

/**
 * Il netto del mese col premio di risultato tassato a parte. Quanto del lordo
 * è premio lo dice `lordoDelMese` (`premioMese`, col flag acceso). Senza premio è
 * esattamente `nettoDelMese`: chi non lo usa non vede cambiare un centesimo.
 *
 * @param {{lordo:number, extraMese?:number, premioMese?:number}} mese da `lordoDelMese`
 */
export function nettoDelMeseConPremio(mese, settings, giorniMese, anno, capienza = null) {
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
