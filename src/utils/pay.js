import { minutesDiff } from './dates';

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
