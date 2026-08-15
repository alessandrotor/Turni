// Aggregazione mensile per la pagina Statistiche: stessa aritmetica del
// riepilogo di Calendario (calcTotalPay, calcNetMonthly), solo raggruppata
// su un intero anno invece che su un mese alla volta. Nessuna formula nuova
// qui dentro — se un numero non torna con Calendario, il bug è altrove.
//
// Estensione esplicita sugli import: stesso motivo di net.js e pay.js — così
// il modulo resta importabile da Node puro, se in futuro serve un riscontro.
import { calcShiftMinutes, calcTotalPay, hasAnyRate } from './pay.js';
import { parseDate, getDaysInMonth } from './dates.js';
import { calcNetMonthly, monthlyBaseGross, extraMonthAccrual, EXTRA_MONTHS } from './net.js';

// Raggruppa per MESE DI CALENDARIO, non di paga: è la vista d'insieme
// dell'anno, e l'utente ragiona in mesi solari (stessa scelta già fatta per
// l'export dei turni in CalendarView). Su un CCNL mensilizzato il totale ore
// di un mese qui può differire da quello che Calendario mostra per lo stesso
// mese (che conta sul mese di PAGA, a settimane intere): non è una
// discrepanza, sono due tagli diversi sugli stessi turni.
//
// @param {number} year
// @param {Array} allShifts TUTTI i turni (contesto per gli straordinari)
// @param {object} settings
// @param {object|null} payByShift mappa già calcolata da `computePayByShift`
// @param {number} annualGrossRef reddito annuo di riferimento per l'aliquota
//   IRPEF del mese — lo stesso valore che `projectAnnualIncome` calcola per
//   l'intero anno, passato una volta sola: usare qui una proiezione diversa
//   farebbe divergere il netto mensile da quello che Calendario mostra per lo
//   stesso mese.
// @param {boolean} enableNetCalc gate del motore fiscale (beta)
// @returns {Array<{monthIndex, shiftsCount, totalMinutes, ordinaryMinutes,
//   overtimeMinutes, gross, net}>} un elemento per ogni mese CON ALMENO UN
//   TURNO, in ordine cronologico — i mesi vuoti non compaiono.
export function monthlyBreakdown(year, allShifts, settings = {}, payByShift = null, annualGrossRef = 0, enableNetCalc = true) {
  const shiftsByMonth = new Map();
  for (const s of allShifts || []) {
    const d = parseDate(s.date);
    if (d.getFullYear() !== year) continue;
    const m = d.getMonth();
    if (!shiftsByMonth.has(m)) shiftsByMonth.set(m, []);
    shiftsByMonth.get(m).push(s);
  }

  const canPay = hasAnyRate(settings);
  const fixedMonthlyTotal = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;

  const rows = [];
  for (let m = 0; m < 12; m += 1) {
    const monthShifts = shiftsByMonth.get(m);
    if (!monthShifts || monthShifts.length === 0) continue;

    const totalMinutes = monthShifts.reduce((sum, s) => sum + calcShiftMinutes(s), 0);
    const pay = canPay ? calcTotalPay(monthShifts, settings, allShifts, payByShift) : null;
    const overtimeMinutes = pay ? pay.overtimeMinutes : 0;
    const ordinaryMinutes = Math.max(0, totalMinutes - overtimeMinutes);

    // 13ª/14ª maturata in questo mese: stesso rateo del pannello mensile di
    // Calendario (`useMonthlyNet.js`), non un calcolo diverso.
    const extraThisMonth = enableNetCalc
      ? monthlyBaseGross(settings) * (
          (settings.hasQuattordicesima && m === EXTRA_MONTHS.quattordicesima
            ? extraMonthAccrual('quattordicesima', year, settings) : 0)
          + (settings.hasTredicesima && m === EXTRA_MONTHS.tredicesima
            ? extraMonthAccrual('tredicesima', year, settings) : 0)
        )
      : 0;

    const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
    const bonusEntry = settings.monthlyBonus?.[monthKey];
    const perMonthBonus = typeof bonusEntry === 'number' ? bonusEntry : (bonusEntry ? monthlyBonusAmount : 0);

    const gross = pay ? pay.total + extraThisMonth + fixedMonthlyTotal + perMonthBonus : 0;
    const net = (enableNetCalc && pay && gross > 0)
      ? calcNetMonthly(gross, annualGrossRef, settings, getDaysInMonth(year, m), extraThisMonth).net
      : 0;

    rows.push({
      monthIndex: m,
      shiftsCount: monthShifts.length,
      totalMinutes, ordinaryMinutes, overtimeMinutes,
      gross, net,
    });
  }
  return rows;
}
