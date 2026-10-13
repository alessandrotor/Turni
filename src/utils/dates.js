export {
  getWeekStart, formatDate, parseDate, dayNumber, isIsoDate, parseTime, minutesDiff, payrollMonthKey, payrollMonthRange, getDaysInMonth,
} from '../motore/date.js';
import { parseTime, payrollMonthRange } from '../motore/date.js';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function formatDayShort(date) {
  return DAY_NAMES[date.getDay()];
}

// Sposta un orario 'HH:MM' di `delta` minuti, girando sulla mezzanotte
// (23:45 + 30 = 00:15). Un orario non valido resta com'è: lo stepper non deve
// inventarne uno. → scripts/check-sposta-orario.mjs
export function spostaOrario(hhmm, delta) {
  const t = parseTime(hhmm);
  if (t === null || !Number.isFinite(delta)) return hhmm;
  const m = (((t + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatMinutes(mins) {
  if (!Number.isFinite(mins) || mins < 0) return '0h 00m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function isToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

// --- Mese di paga (contratti mensilizzati) ---------------------------------
//
// In busta la settimana lun-dom NON si spezza a fine mese: appartiene per
// intero al mese in cui cade il suo LUNEDÌ. Giugno 2026 comincia di lunedì e
// vale quindi 5 settimane (1/6 → 5/7), luglio ne vale 4 (6/7 → 2/8).
//
// La regola non è un'ipotesi: è l'unica compatibile con le due buste reali,
// dove giugno risulta 131,45 h e luglio 109,70 h (rapporto 1,198 ≈ 5/4).
// Con la convenzione opposta — settimana al mese della domenica — giugno
// varrebbe 4 settimane e luglio 5, e giugno dovrebbe risultare MINORE di
// luglio: il contrario di quel che è stampato in busta.

// 'dal 6 lug al 2 ago', per dire a quale periodo si riferiscono le ore quando
// non coincide con il mese di calendario.
export function formatPayrollRange(year, month) {
  const { start, end } = payrollMonthRange(year, month);
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
}

export function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function isCurrentMonth(date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

const MONTH_NAMES_FULL = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

export function formatMonthYear(date) {
  return `${MONTH_NAMES_FULL[date.getMonth()]} ${date.getFullYear()}`;
}
