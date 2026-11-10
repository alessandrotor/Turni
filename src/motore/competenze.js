// Il «Totale competenze» del cedolino, dal netto del mese del motore.
//
// In busta il totale delle competenze NON è il lordo: ci stanno anche le somme
// che non sono retribuzione ma arrivano lo stesso in busta — il trattamento
// integrativo e l'Indennità L. 207/24 (crediti fiscali anticipati dal datore:
// niente contributi, niente IRPEF). L'app mostra
// il lordo, e chi cerca quella cifra sul cedolino trovava 50-150 € di più
// senza capire da dove (novembre 2026).
//
// Busta di luglio 2026: 1.173,48 + 101,91 + 56,22 = 1.331,61, il totale
// stampato. → check-busta-luglio-2026.mjs. Il TFR anticipato in busta resta
// FUORI: nessun cedolino del progetto lo ha, e dove lo metta Zucchetti non si sa.

/**
 * Le voci che in busta fanno il «Totale competenze», con la somma.
 * @param {{ gross: number, trattamentoIntegrativo?: number, bonusCuneo?: number }} n
 *   il netto del mese (`nettoDelMese` o `calcNetMonthly`)
 */
export function totaleCompetenze(n) {
  const voci = {
    lordo: Number(n?.gross) || 0,
    trattamentoIntegrativo: Number(n?.trattamentoIntegrativo) || 0,
    indennita: Number(n?.bonusCuneo) || 0,
  };
  const totale = Math.round((voci.lordo + voci.trattamentoIntegrativo + voci.indennita) * 100) / 100;
  return { voci, totale };
}
