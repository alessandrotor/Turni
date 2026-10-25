import { useMemo } from 'react';
import useOggi from './useOggi';
import {
  lordoDelMese, riferimentoAnnuoDelMese, TAX_2026, tiDecision, projectAnnualIncome,
} from '../motore/net';
import { ENABLE_NET_CALC } from '../config/features';
import { progressiviDellAnno } from '../motore/conguaglio';
import { capienzaProgressiva, simulaTi } from '../motore/capienza';
import { conFisco } from '../motore/fisco/index.js';
import { nettoDelMeseConPremio } from '../motore/premio-risultato';

// Netto stimato del mese (beta), calcolato PARTENDO DAL MESE come una busta. Estratto da
// CalendarView. Trattenute (contributi + IRPEF + addizionali) e bonus (trattamento integrativo +
// cuneo) sono voci separate. Voci fisse e bonus sono sommati al lordo e inclusi nella proiezione.
//
// Riceve gli aggregati già pronti (pay del mese, reddito annuo) e restituisce i valori derivati
// usati dal riepilogo.
export default function useMonthlyNet({
  year, month, settings, pay, annualGross, annualExtras = 0, daysInMonth, allShifts = [], payMap,
  tiSimulato = null,
}) {
  const oggi = useOggi();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const fixedMonthlyTotal = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  // Il bonus del mese è un importo fisso spuntato mese per mese (`true`); i numeri sono il formato legacy.
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;
  const resolveBonusEntry = (v) => (typeof v === 'number' ? v : (v ? monthlyBonusAmount : 0));
  const perMonthBonus = resolveBonusEntry(settings.monthlyBonus?.[monthKey]);

  // Reddito annuo di riferimento (aliquota IRPEF + decisione automatica TI):
  //  - 'stimato': stima annua (contratto/RAL/a chiamata) + voci fisse ×12 + bonus dell'anno;
  //  - 'ytd': reddito maturato annualizzato sui mesi trascorsi.
  // Stessa funzione di Statistiche (`projectAnnualIncome`); NON dipende dal mese sfogliato.
  const netProjection = useMemo(
    () => projectAnnualIncome(annualGross, annualExtras, settings, year, {
      enableNetCalc: ENABLE_NET_CALC, oggi,
    }),
    [annualGross, annualExtras, settings, year, oggi],
  );
  const netBasis = netProjection.value;

  // Paga dei turni + 13ª/14ª + voci fisse + bonus: la composizione è in `lordoDelMese`. Voci
  // fisse e bonus restano qui perché il riepilogo li mostra uno per uno.
  const meseLordo = lordoDelMese(
    pay?.total, year, month, settings, { enableNetCalc: ENABLE_NET_CALC },
  );
  const { lordo: monthGross, extraMese: extraThisMonth, premioMese } = meseLordo;
  // IL RIFERIMENTO DEL MESE, non quello dell'anno: il software paghe moltiplica per dodici il
  // lordo del mese e da lì decide fascia, detrazione e bonus. La proiezione annua resta per
  // spiegare l'aliquota e per il margine del bonus.
  const riferimento = useMemo(
    () => riferimentoAnnuoDelMese(monthGross, settings),
    [monthGross, settings],
  );
  // La capienza del trattamento integrativo si costruisce sull'anno (progressivo dei mesi prima,
  // capienza.js), calcolato UNA volta: sfogliare i mesi estrae soltanto l'elemento.
  const progressiviAnno = useMemo(
    () => (ENABLE_NET_CALC ? progressiviDellAnno({ anno: year, allShifts, settings, payMap: payMap || {}, oggi }) : null),
    [year, allShifts, settings, payMap, oggi],
  );
  const progressivo = progressiviAnno ? progressiviAnno[month] : null;
  // Statistiche passa dalla stessa funzione: vedi `nettoDelMeseConPremio`.
  const netMonth = useMemo(
    () => (ENABLE_NET_CALC ? nettoDelMeseConPremio({ lordo: monthGross, extraMese: extraThisMonth, premioMese },
      settings, daysInMonth, year, capienzaProgressiva(monthGross - premioMese, settings, progressivo)) : null),
    [monthGross, extraThisMonth, premioMese, settings, daysInMonth, year, progressivo],
  );
  // UNA SIMULAZIONE del tratt. integrativo, per il solo riquadro del netto: `tiSimulato`
  // true/false lo forza presente o assente, `null` lascia decidere il motore.
  const forzaTi = (presente) => (netMonth ? simulaTi(netMonth, daysInMonth, presente, conFisco(settings, year)) : null);
  // Quanto varrebbe, se ci fosse: la cifra del riquadro anche quando è spento.
  const tiSePresente = useMemo(
    () => (ENABLE_NET_CALC ? forzaTi(true)?.trattamentoIntegrativo || 0 : 0),
    [netMonth, daysInMonth, settings, year],
  );
  const netMonthSimulato = useMemo(
    () => (ENABLE_NET_CALC && tiSimulato != null ? forzaTi(tiSimulato) : null),
    [tiSimulato, netMonth, daysInMonth, settings, year],
  );
  const monthNet = netMonth ? netMonth.net : 0;
  const monthTrattenute = netMonth ? netMonth.trattenute : 0;
  const monthBonus = netMonth ? netMonth.bonus : 0;
  const monthTfr = netMonth ? netMonth.tfr : 0;
  const tiInfo = useMemo(
    () => (ENABLE_NET_CALC ? tiDecision(netBasis, settings) : null),
    [netBasis, settings],
  );
  const effectiveRatePct = monthGross > 0 ? (monthTrattenute / monthGross) * 100 : 0;
  const addRegPct = Number.isFinite(Number(settings.addRegionalePct)) ? Number(settings.addRegionalePct) : TAX_2026.ADD_REGIONALE_DEFAULT;
  const addComPct = Number.isFinite(Number(settings.addComunalePct)) ? Number(settings.addComunalePct) : TAX_2026.ADD_COMUNALE_DEFAULT;
  const addizionaliPct = (addRegPct + addComPct).toFixed(2).replace('.', ',');
  const showNetPanel = ENABLE_NET_CALC && pay !== null && netBasis > 0 && monthGross > 0;

  return {
    monthKey, perMonthBonus, fixedMonthlyTotal,
    netProjection, netBasis, riferimento, extraThisMonth, monthGross,
    netMonth, netMonthSimulato, tiSePresente, monthNet, monthTrattenute, monthBonus, monthTfr,
    tiInfo, effectiveRatePct, addizionaliPct, showNetPanel,
  };
}
