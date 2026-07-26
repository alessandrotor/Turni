import { minutesDiff, parseDate, getWeekStart, formatDate } from './dates';

export function calcShiftMinutes(shift) {
  const total = minutesDiff(shift.startTime, shift.endTime);
  return Math.max(0, total - (shift.breakMinutes || 0));
}

export function calcShiftHours(shift) {
  return calcShiftMinutes(shift) / 60;
}

export function calcWeekTotals(shifts) {
  const workedMinutes = shifts.reduce((sum, s) => sum + calcShiftMinutes(s), 0);
  return {
    workedMinutes,
    workedHours: workedMinutes / 60,
  };
}

export function calcPay(workedHours, hourlyRate) {
  if (!hourlyRate || hourlyRate <= 0) return null;
  return workedHours * hourlyRate;
}

// Parsing robusto di numeri all'italiana: accetta "7123,28", "17.213,28"
// e anche "7123.28". La virgola, se presente, è il separatore decimale.
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (s === '') return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.'); // punto = migliaia, virgola = decimali
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Paga oraria valida per una certa data.
// settings.hourlyRate è la paga ATTUALE. settings.previousRates elenca le
// paghe precedenti a un aumento: [{ until:'YYYY-MM-DD', rate:Number }] —
// i turni fino a quella data (inclusa) usano quella paga; gli altri l'attuale.
export function getRateForDate(dateStr, settings) {
  const current = Number(settings?.hourlyRate) || 0;
  const prev = Array.isArray(settings?.previousRates) ? settings.previousRates : [];
  const sorted = prev
    .filter(p => p?.until)
    .sort((a, b) => String(a.until).localeCompare(String(b.until)));
  for (const p of sorted) {
    if (dateStr <= p.until) return Number(p.rate) || 0;
  }
  return current;
}

// Esiste almeno una paga oraria configurata (attuale o precedente)?
export function hasAnyRate(settings) {
  if ((Number(settings?.hourlyRate) || 0) > 0) return true;
  const prev = Array.isArray(settings?.previousRates) ? settings.previousRates : [];
  return prev.some(p => (Number(p?.rate) || 0) > 0);
}

export function isSunday(dateStr) {
  return parseDate(dateStr).getDay() === 0;
}

// Percentuale di maggiorazione totale per un turno:
// maggiorazione domenicale (dalle impostazioni) + maggiorazione manuale del turno
export function getShiftSurchargePct(shift, settings) {
  let pct = 0;
  if (isSunday(shift.date)) pct += Number(settings?.sundaySurchargePct) || 0;
  pct += Number(shift.surchargePct) || 0;
  return pct;
}

// Calcola la paga di ogni turno tenendo conto della maggiorazione straordinari.
// Due modalità (dipende da settings.onCall):
//  - contratto (default): straordinario per le ore che, nella settimana (lun-dom),
//    superano le ore da contratto (expectedWeeklyHours);
//  - a chiamata (onCall): straordinario per le ore che, nel singolo GIORNO,
//    superano la soglia giornaliera (dailyOvertimeThreshold).
// Serve l'insieme completo dei turni per raggruppare correttamente.
// Ritorna una mappa { [shiftId]: { base, surcharge, overtimeMinutes } }.
export function computePayByShift(allShifts, settings) {
  const otPct = Number(settings?.overtimeSurchargePct) || 0;
  const onCall = !!settings?.onCall;
  const thresholdMin = onCall
    ? (Number(settings?.dailyOvertimeThreshold) || 0) * 60
    : (Number(settings?.expectedWeeklyHours) || 0) * 60;
  const applyOvertime = thresholdMin > 0 && otPct > 0;

  // Raggruppa per giorno (a chiamata) o per settimana (contratto).
  const groups = new Map();
  for (const s of allShifts) {
    const key = onCall ? s.date : formatDate(getWeekStart(parseDate(s.date)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const result = {};
  for (const groupShifts of groups.values()) {
    groupShifts.sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
    let cumMin = 0;
    for (const s of groupShifts) {
      const m = calcShiftMinutes(s);
      const ratePerMin = getRateForDate(s.date, settings) / 60;
      const pct = getShiftSurchargePct(s, settings);

      let overtimeMin = 0;
      if (applyOvertime) {
        const after = cumMin + m;
        overtimeMin = Math.max(0, after - Math.max(thresholdMin, cumMin));
      }

      const shiftBase = m * ratePerMin;
      const overtimeBase = overtimeMin * ratePerMin;
      const surcharge = shiftBase * (pct / 100) + overtimeBase * (otPct / 100);

      result[s.id] = { base: shiftBase, surcharge, overtimeMinutes: overtimeMin };
      cumMin += m;
    }
  }
  return result;
}

export function calcShiftPay(shift, settings) {
  const rate = getRateForDate(shift.date, settings);
  if (rate <= 0) return null;
  const base = calcShiftHours(shift) * rate;
  return base * (1 + getShiftSurchargePct(shift, settings) / 100);
}

// Totale paga con dettaglio maggiorazioni. Ritorna null se nessuna paga
// oraria è configurata. `allShifts` (default = shifts) fornisce il contesto
// settimanale per il calcolo degli straordinari.
export function calcTotalPay(shifts, settings, allShifts = shifts) {
  if (!hasAnyRate(settings)) return null;
  const byShift = computePayByShift(allShifts, settings);
  let base = 0;
  let surcharge = 0;
  let overtimeMinutes = 0;
  shifts.forEach(s => {
    const p = byShift[s.id];
    if (p) {
      base += p.base;
      surcharge += p.surcharge;
      overtimeMinutes += p.overtimeMinutes;
    }
  });
  return { base, surcharge, total: base + surcharge, overtimeMinutes };
}

// Stima del reddito annuo lordo annualizzando i turni già inseriti nell'anno:
// (lordo dei turni dell'anno) / (mesi con almeno un turno) × 12.
// Serve ai lavoratori a chiamata come base per l'aliquota fiscale quando non
// hanno un reddito annuo dichiarato a mano. Ritorna 0 se non stimabile.
export function annualizeFromShifts(allShifts, year, settings) {
  const yearShifts = (allShifts || []).filter(s => parseDate(s.date).getFullYear() === year);
  const pay = calcTotalPay(yearShifts, settings, yearShifts);
  if (!pay) return 0;
  const months = new Set(yearShifts.map(s => s.date.slice(0, 7))).size;
  if (months === 0) return 0;
  return (pay.total / months) * 12;
}

export function formatCurrency(amount) {
  return amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

// Struttura predisposta per futura integrazione CCNL
// eslint-disable-next-line no-unused-vars
export function calcCCNLPay(_shifts, _ccnlCode, _level) {
  // TODO: implementare calcolo con tabelle CCNL
  // es. CCNL Commercio, Metalmeccanici, Sanità...
  throw new Error('Calcolo CCNL non ancora implementato');
}
