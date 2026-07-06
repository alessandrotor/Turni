import { minutesDiff, parseDate } from './dates';

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

export function calcShiftPay(shift, settings) {
  const rate = Number(settings?.hourlyRate) || 0;
  if (rate <= 0) return null;
  const base = calcShiftHours(shift) * rate;
  return base * (1 + getShiftSurchargePct(shift, settings) / 100);
}

// Totale paga con dettaglio maggiorazioni. Ritorna null senza paga oraria.
export function calcTotalPay(shifts, settings) {
  const rate = Number(settings?.hourlyRate) || 0;
  if (rate <= 0) return null;
  let base = 0;
  let surcharge = 0;
  shifts.forEach(s => {
    const shiftBase = calcShiftHours(s) * rate;
    base += shiftBase;
    surcharge += shiftBase * getShiftSurchargePct(s, settings) / 100;
  });
  return { base, surcharge, total: base + surcharge };
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
