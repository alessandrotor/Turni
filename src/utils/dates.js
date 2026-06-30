export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dom, 1=Lun...
  const diff = day === 0 ? -6 : 1 - day; // lunedì
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function formatDayShort(date) {
  return DAY_NAMES[date.getDay()];
}

export function formatDayNumber(date) {
  return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
}

export function formatWeekRange(weekStart) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const startStr = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
  const endStr = `${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  return `${startStr} – ${endStr}`;
}

export function minutesDiff(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // turno notturno
  return mins;
}

export function formatMinutes(mins) {
  if (mins < 0) return '0h 00m';
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

export function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function isCurrentWeek(weekStart) {
  const thisWeek = getWeekStart(new Date());
  return formatDate(weekStart) === formatDate(thisWeek);
}

export function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
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
