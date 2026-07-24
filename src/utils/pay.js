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

// Paga oraria valida per una certa data, tenendo conto degli aumenti.
// settings.rateChanges: [{ date:'YYYY-MM-DD', rate:Number }] — dal giorno
// indicato (incluso) vale la nuova paga; prima vale la paga oraria base.
export function getRateForDate(dateStr, settings) {
  const base = Number(settings?.hourlyRate) || 0;
  const changes = Array.isArray(settings?.rateChanges) ? settings.rateChanges : [];
  let rate = base;
  let bestDate = null;
  for (const ch of changes) {
    if (!ch?.date) continue;
    if (ch.date <= dateStr && (bestDate === null || ch.date > bestDate)) {
      bestDate = ch.date;
      rate = Number(ch.rate) || 0;
    }
  }
  return rate;
}

// Esiste almeno una paga oraria configurata (base o un aumento)?
export function hasAnyRate(settings) {
  if ((Number(settings?.hourlyRate) || 0) > 0) return true;
  const changes = Array.isArray(settings?.rateChanges) ? settings.rateChanges : [];
  return changes.some(ch => (Number(ch?.rate) || 0) > 0);
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
  const rate = getRateForDate(shift.date, settings);
  if (rate <= 0) return null;
  const base = calcShiftHours(shift) * rate;
  return base * (1 + getShiftSurchargePct(shift, settings) / 100);
}

// Totale paga con dettaglio maggiorazioni. Ritorna null se nessuna paga
// oraria è configurata. Ogni turno usa la paga valida alla sua data.
export function calcTotalPay(shifts, settings) {
  if (!hasAnyRate(settings)) return null;
  let base = 0;
  let surcharge = 0;
  shifts.forEach(s => {
    const rate = getRateForDate(s.date, settings);
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
