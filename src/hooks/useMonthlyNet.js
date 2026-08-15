import { useMemo } from 'react';
import {
  calcNetMonthly, monthlyBaseGross,
  extraMonthAccrual, EXTRA_MONTHS, TAX_2026, tiDecision, projectAnnualIncome,
} from '../utils/net';
import { ENABLE_NET_CALC } from '../config/features';

// Netto stimato del mese (beta): calcolato PARTENDO DAL MESE, come una busta
// paga. Estratto da CalendarView per leggibilità — la logica è identica.
// Trattenute (contributi + IRPEF + addizionali) e bonus (trattamento
// integrativo + cuneo) sono voci separate: il bonus non abbatte le trattenute.
// L'IRPEF, progressiva e annuale, usa come riferimento il reddito annuo pieno
// (proiezione da contratto + 13ª/14ª); se il contratto non è impostato si
// ripiega sul reddito maturato.
// Voci fisse mensili (ricorrenti) e bonus (per singolo mese): sommati al lordo,
// e inclusi nella proiezione annua (possono far superare le soglie del TI).
//
// Riceve gli aggregati già pronti (pay del mese, reddito annuo) e restituisce
// tutti i valori derivati usati dal riepilogo.
export default function useMonthlyNet({ year, month, settings, pay, annualGross, annualExtras = 0, daysInMonth }) {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const fixedMonthlyTotal = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  // Il bonus del mese è un importo fisso (impostato una volta in Impostazioni),
  // spuntato mese per mese dal calendario: la mappa contiene `true` per i mesi
  // in cui è stato preso. I valori numerici sono il formato legacy (prima che
  // il bonus diventasse un importo fisso) e restano quelli, invariati.
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;
  const resolveBonusEntry = (v) => (typeof v === 'number' ? v : (v ? monthlyBonusAmount : 0));
  const perMonthBonus = resolveBonusEntry(settings.monthlyBonus?.[monthKey]);

  // Reddito annuo di riferimento (aliquota IRPEF + decisione automatica TI):
  //  - 'stimato': stima annua (contratto/RAL/a chiamata) + voci fisse ×12 + bonus dell'anno;
  //  - 'ytd': reddito maturato (montante+turni+voci fisse+bonus finora) annualizzato sui mesi trascorsi.
  // Stessa funzione usata dalla pagina Statistiche (vedi `projectAnnualIncome`
  // in net.js): un'unica fonte evita che le due pagine mostrino cifre diverse
  // per lo stesso anno. `viewedMonth: month` mantiene qui lo stesso confine
  // del cedolino "maturato finora" (modalità YTD) che c'era prima dell'estrazione.
  const netProjection = useMemo(
    () => projectAnnualIncome(annualGross, annualExtras, settings, year, {
      enableNetCalc: ENABLE_NET_CALC, viewedMonth: month,
    }),
    [annualGross, annualExtras, settings, year, month],
  );
  const netBasis = netProjection.value;

  // Mensilità aggiuntiva che cade in questo mese (quattordicesima a giu, tredicesima a dic),
  // ridotta al rateo effettivamente maturato in base alla data di assunzione.
  const extraThisMonth = ENABLE_NET_CALC
    ? monthlyBaseGross(settings) * (
        (settings.hasQuattordicesima && month === EXTRA_MONTHS.quattordicesima
          ? extraMonthAccrual('quattordicesima', year, settings) : 0)
        + (settings.hasTredicesima && month === EXTRA_MONTHS.tredicesima
          ? extraMonthAccrual('tredicesima', year, settings) : 0)
      )
    : 0;
  const monthGross = (pay ? pay.total : 0) + extraThisMonth + fixedMonthlyTotal + perMonthBonus;
  const netMonth = useMemo(
    () => (ENABLE_NET_CALC ? calcNetMonthly(monthGross, netBasis, settings, daysInMonth, extraThisMonth) : null),
    [monthGross, netBasis, settings, daysInMonth, extraThisMonth],
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
    netProjection, netBasis, extraThisMonth, monthGross,
    netMonth, monthNet, monthTrattenute, monthBonus, monthTfr,
    tiInfo, effectiveRatePct, addizionaliPct, showNetPanel,
  };
}
