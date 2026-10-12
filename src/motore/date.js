// Le date del motore: solo aritmetica di calendario, nessuna data di oggi.
// Le funzioni per lo schermo (nomi dei mesi, «oggi») stanno in
// `utils/dates.js`, che riesporta queste.

export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dom, 1=Lun...
  const diff = day === 0 ? -6 : 1 - day; // lunedì
  d.setDate(d.getDate() + diff);
  return d;
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
// Numero progressivo del giorno, per stabilire se due date sono consecutive.
// Passa da Date.UTC e NON dalla differenza fra due `Date` locali: con l'ora
// legale due giorni consecutivi distano 23 o 25 ore, non 24 (in Italia il
// 29 marzo e il 25 ottobre 2026), e un confronto in millisecondi spezzerebbe
// la sequenza proprio lì — in silenzio, e solo sui dispositivi con fuso
// europeo. Lo usano sia le serie di giorni lavorati sia gli eventi di malattia.
export function dayNumber(iso) {
  return Math.round(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000,
  );
}

export function isIsoDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str ?? ''))) return false;
  const d = parseDate(str);
  return !Number.isNaN(d.getTime()) && formatDate(d) === str;
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

// Mese di paga di una data, come 'YYYY-MM'.
export function payrollMonthKey(dateStr) {
  const monday = getWeekStart(parseDate(dateStr));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}`;
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

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// IL MOTORE NON LEGGE L'OROLOGIO: la data di oggi la passa chi chiama. Una
// data presa da sola qui dentro ha già fatto diventare rosso un riscontro il
// primo ottobre, e un motore portato in un'altra app non sa che giorno è.
// → check-confine-motore.mjs
export function richiediOggi(oggi, chi) {
  if (!(oggi instanceof Date) || Number.isNaN(oggi.getTime())) {
    throw new TypeError(`${chi}: serve la data di oggi (oggi: Date)`);
  }
  return oggi;
}
