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

// L'app usa ovunque la stringa ISO 'YYYY-MM-DD' come chiave e come criterio di
// ordinamento (slice per anno/mese, confronti lessicografici). Una data fuori
// formato passerebbe i controlli truthy ma non combacerebbe con le celle del
// calendario: qui si verifica sia il formato sia che sia un giorno reale.
export function isIsoDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str ?? ''))) return false;
  const d = parseDate(str);
  return !Number.isNaN(d.getTime()) && formatDate(d) === str;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

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

// 'HH:MM' → minuti dalla mezzanotte, oppure null se non è un orario valido.
// Serve a non propagare NaN fino alla UI quando un campo orario è vuoto o
// contiene un formato inatteso (es. import da immagine).
export function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesDiff(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null) return 0;
  let mins = end - start;
  if (mins < 0) mins += 24 * 60; // turno notturno
  return mins;
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

export function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function isCurrentWeek(weekStart) {
  const thisWeek = getWeekStart(new Date());
  return formatDate(weekStart) === formatDate(thisWeek);
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

// Mese di paga di una data, come 'YYYY-MM'.
export function payrollMonthKey(dateStr) {
  const monday = getWeekStart(parseDate(dateStr));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}`;
}

// Primo giorno del mese di paga: il primo lunedì che cade dentro il mese di
// calendario.
function payrollMonthStart(year, month) {
  // `month` può valere 12 (chiamata sul mese successivo a dicembre): si passa
  // da una Date per normalizzare anno e mese prima di confrontarli.
  const first = new Date(year, month, 1);
  const monday = getWeekStart(first);
  if (monday.getMonth() !== first.getMonth()) monday.setDate(monday.getDate() + 7);
  return monday;
}

// Estremi del mese di paga: dal primo lunedì del mese alla domenica che
// precede il primo lunedì del mese successivo.
export function payrollMonthRange(year, month) {
  const start = payrollMonthStart(year, month);
  const next = payrollMonthStart(year, month + 1); // Date normalizza dicembre → gennaio
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  return { start, end };
}

// 'dal 6 lug al 2 ago', per dire a quale periodo si riferiscono le ore quando
// non coincide con il mese di calendario.
export function formatPayrollRange(year, month) {
  const { start, end } = payrollMonthRange(year, month);
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
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
