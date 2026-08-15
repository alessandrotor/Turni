// Aggregazione mensile per la pagina Statistiche: stessa aritmetica del
// riepilogo di Calendario (calcTotalPay, calcNetMonthly), solo raggruppata
// su un intero anno invece che su un mese alla volta. Nessuna formula nuova
// qui dentro — se un numero non torna con Calendario, il bug è altrove.
//
// Estensione esplicita sugli import: stesso motivo di net.js e pay.js — così
// il modulo resta importabile da Node puro, se in futuro serve un riscontro.
import { calcShiftMinutes, calcTotalPay, hasAnyRate, isSunday } from './pay.js';
import { parseDate, getDaysInMonth, formatDate } from './dates.js';
import { isHoliday } from './holidays.js';
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
//   overtimeMinutes, straordinarioMinutes, gross, net}>} un elemento per ogni
//   mese CON ALMENO UN TURNO, in ordine cronologico — i mesi vuoti non
//   compaiono. `overtimeMinutes` sono le supplementari (fra soglia-contratto
//   e soglia-full-time, o l'unica fascia per chi lavora a chiamata),
//   `straordinarioMinutes` quelle oltre il full-time — stessa distinzione a
//   due soglie di `computePayByShift` in pay.js, non una fascia unica.
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
    // computePayByShift assegna supplementari/straordinari a ogni turno
    // indipendentemente dalla paga oraria (sono soglie sulle ORE, non
    // sull'importo): ma calcTotalPay si rifiuta di aggregarle senza una paga
    // configurata (`hasAnyRate`), quindi senza paga oraria la ripartizione
    // qui non è disponibile — stesso limite del riepilogo di Calendario, non
    // uno nuovo di questa pagina.
    const pay = canPay ? calcTotalPay(monthShifts, settings, allShifts, payByShift) : null;
    const overtimeMinutes = pay ? pay.overtimeMinutes : 0;
    const straordinarioMinutes = pay ? pay.straordinarioMinutes : 0;
    const ordinaryMinutes = Math.max(0, totalMinutes - overtimeMinutes - straordinarioMinutes);

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
      totalMinutes, ordinaryMinutes, overtimeMinutes, straordinarioMinutes,
      gross, net,
    });
  }
  return rows;
}

/**
 * Ore di ogni GIORNO dell'anno, divise per fascia — la base del calendarietto
 * di riepilogo. Le fasce arrivano da `computePayByShift` (mappa `payByShift`),
 * che le assegna turno per turno cumulando sulla settimana o sul mese di paga:
 * un giorno può quindi essere in parte ordinario e in parte supplementare, ed
 * è giusto che sia così — la soglia non cade a mezzanotte.
 *
 * @returns {Map<string, {totalMinutes, overtimeMinutes, straordinarioMinutes,
 *   shiftsCount, sunday, holiday}>} chiave 'YYYY-MM-DD', solo i giorni con
 *   almeno un turno.
 */
export function dailyBreakdown(year, allShifts, settings = {}, payByShift = null) {
  const byDay = new Map();
  for (const s of allShifts || []) {
    if (Number(s.date.slice(0, 4)) !== year) continue;
    let day = byDay.get(s.date);
    if (!day) {
      day = {
        totalMinutes: 0, overtimeMinutes: 0, straordinarioMinutes: 0, shiftsCount: 0,
        sunday: isSunday(s.date), holiday: isHoliday(s.date, settings),
      };
      byDay.set(s.date, day);
    }
    day.totalMinutes += calcShiftMinutes(s);
    day.shiftsCount += 1;
    // Senza paga oraria `computePayByShift` non viene calcolata a monte: le
    // fasce restano a zero e il giorno risulta tutto ordinario. È lo stesso
    // limite del riepilogo di Calendario, non uno nuovo di questa vista.
    const p = payByShift?.[s.id];
    if (p) {
      day.overtimeMinutes += p.overtimeMinutes;
      day.straordinarioMinutes += p.straordinarioMinutes;
    }
  }
  return byDay;
}

/**
 * Totali dell'anno per la card di riepilogo: quello che un lavoratore a turni
 * guarda per primo, e che nessuna altra vista dell'app mette insieme.
 *
 * `longestStreak` conta i giorni lavorati CONSECUTIVI: è l'unico numero qui
 * che non si ricava a occhio dal calendario, e su lavoro a turni è quello che
 * salta di più (la legge prevede 24 ore di riposo consecutive ogni sette
 * giorni, di norma in coincidenza con la domenica). Si ferma ai confini
 * dell'anno: una serie a cavallo di capodanno viene spezzata.
 */
export function yearSummary(byDay) {
  let workedDays = 0;
  let totalMinutes = 0;
  let overtimeMinutes = 0;
  let straordinarioMinutes = 0;
  let sundays = 0;
  let holidays = 0;
  for (const d of byDay.values()) {
    workedDays += 1;
    totalMinutes += d.totalMinutes;
    overtimeMinutes += d.overtimeMinutes;
    straordinarioMinutes += d.straordinarioMinutes;
    if (d.sunday) sundays += 1;
    if (d.holiday) holidays += 1;
  }

  // Serie più lunga di giorni consecutivi lavorati.
  const dates = Array.from(byDay.keys()).sort();
  let longestStreak = 0;
  let longestStreakEnd = null;
  let run = 0;
  let prev = null;
  for (const iso of dates) {
    const d = parseDate(iso);
    const consecutive = prev && (d - prev) === 86400000;
    run = consecutive ? run + 1 : 1;
    if (run > longestStreak) { longestStreak = run; longestStreakEnd = iso; }
    prev = d;
  }

  return {
    workedDays, totalMinutes,
    overtimeMinutes, straordinarioMinutes,
    ordinaryMinutes: Math.max(0, totalMinutes - overtimeMinutes - straordinarioMinutes),
    sundays, holidays,
    longestStreak, longestStreakEnd,
  };
}

/**
 * Griglia di un mese per il calendarietto: celle da lunedì a domenica, con
 * `null` nei buchi prima del primo e dopo l'ultimo giorno. Stessa convenzione
 * lunedì-primo della griglia grande in CalendarView.
 *
 * Sempre 42 celle (6 settimane), anche quando il mese ne riempirebbe 5: così
 * tutti i mesi hanno la stessa altezza e, affiancati nella griglia dell'anno,
 * i totali sotto restano incolonnati. 42 basta sempre — il caso peggiore è
 * offset 6 + 31 giorni = 37 celle.
 */
export function monthGrid(year, monthIndex) {
  const days = getDaysInMonth(year, monthIndex);
  const firstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstOffset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(formatDate(new Date(year, monthIndex, d)));
  while (cells.length < 42) cells.push(null);
  return cells;
}
