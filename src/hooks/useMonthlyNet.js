import { useMemo } from 'react';
import {
  calcNetMonthly, projectAnnualGross, monthlyBaseGross,
  extraMonthsAccrued, extraMonthAccrual, EXTRA_MONTHS, TAX_2026, tiDecision,
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
  const mm = String(month + 1).padStart(2, '0');
  const fixedMonthlyTotal = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  // Il bonus del mese è un importo fisso (impostato una volta in Impostazioni),
  // spuntato mese per mese dal calendario: la mappa contiene `true` per i mesi
  // in cui è stato preso. I valori numerici sono il formato legacy (prima che
  // il bonus diventasse un importo fisso) e restano quelli, invariati.
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;
  const resolveBonusEntry = (v) => (typeof v === 'number' ? v : (v ? monthlyBonusAmount : 0));
  const perMonthBonus = resolveBonusEntry(settings.monthlyBonus?.[monthKey]);
  const bonusMap = settings.monthlyBonus || {};
  const bonusYearAll = Object.entries(bonusMap)
    .filter(([k]) => k.slice(0, 4) === String(year))
    .reduce((s, [, v]) => s + resolveBonusEntry(v), 0);
  const bonusYTD = Object.entries(bonusMap)
    .filter(([k]) => k.slice(0, 4) === String(year) && k.slice(5, 7) <= mm)
    .reduce((s, [, v]) => s + resolveBonusEntry(v), 0);

  // Reddito annuo di riferimento (aliquota IRPEF + decisione automatica TI):
  //  - 'stimato': stima annua (contratto/RAL/a chiamata) + voci fisse ×12 + bonus dell'anno;
  //  - 'ytd': reddito maturato (montante+turni+voci fisse+bonus finora) annualizzato sui mesi trascorsi.
  const fixedAnnual = fixedMonthlyTotal * 12;
  const netProjection = useMemo(() => {
    // 13ª/14ª sono una tantum: annualizzarle (×12/mesi trascorsi) le
    // moltiplicherebbe: a luglio la 14ª di giugno varrebbe quasi due mensilità.
    // Si annualizza solo la parte ricorrente e si riaggiungono per intero le
    // mensilità aggiuntive previste nell'anno.
    const recurring = Math.max(0, annualGross - annualExtras);
    const extrasFullYear = ENABLE_NET_CALC
      ? monthlyBaseGross(settings) * extraMonthsAccrued(settings, year)
      : 0;
    const now = new Date();
    const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const annualize = (v) => (monthsElapsed > 0 ? (v * 12) / monthsElapsed : v);
    const extras = (v) => v + fixedAnnual + bonusYearAll;

    if ((settings.tiProjectionMode || 'stimato') === 'ytd') {
      const cumulativo = recurring + fixedMonthlyTotal * monthsElapsed + bonusYTD;
      return { value: annualize(cumulativo) + extrasFullYear, source: 'maturato' };
    }

    // L'importo scritto a mano vince su tutto: è la valvola di sfogo per chi sa
    // che il resto dell'anno non somiglierà a quello appena passato.
    const manual = Number(settings.annualGrossManual) || 0;
    if (manual > 0) return { value: extras(manual), source: 'manuale' };

    if (settings.onCall) return { value: extras(annualize(recurring)), source: 'maturato' };

    // Il maturato annualizzato NON va scartato: la proiezione da contratto
    // conosce solo le ore contrattuali e ignora supplementari e festivi, che su
    // lavoro a turni pesano parecchio. Si prende la più alta delle due, come fa
    // il sostituto d'imposta — resta comunque una previsione: se il secondo
    // semestre porta meno ore, il conguaglio di dicembre restituisce il dovuto.
    const projectedAnnual = ENABLE_NET_CALC ? projectAnnualGross(settings, year) : 0;
    const fromActual = annualize(recurring) + extrasFullYear;
    const value = Math.max(projectedAnnual, fromActual, annualGross);
    const source = value === projectedAnnual ? 'contratto' : 'maturato';
    return { value: extras(value), source };
  }, [annualGross, annualExtras, settings, year, fixedMonthlyTotal, fixedAnnual, bonusYTD, bonusYearAll]);
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
