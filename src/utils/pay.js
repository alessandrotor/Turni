// Estensioni esplicite: senza, Node puro non riesce a importare questo modulo e
// i riscontri in `scripts/` (che girano fuori da Vite) non partono.
import { minutesDiff, parseDate, getWeekStart, formatDate, payrollMonthKey } from './dates.js';
import { isHoliday } from './holidays.js';
import { isMensilizzato, monthlyContractHours } from './ccnl.js';

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
// Senza virgola, i punti che formano gruppi da tre cifre sono migliaia
// ("17.213" → 17213); un punto isolato resta decimale ("7123.28" → 7123.28).
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (s === '') return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.'); // punto = migliaia, virgola = decimali
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // solo gruppi da tre cifre: separatore di migliaia
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

// Maggiorazioni di un turno, tenute DISTINTE per tipo (percentuali):
// domenicale (se domenica), festiva (se festività), manuale (impostata sul turno).
// Se il turno è sia domenica sia festivo, le due si combinano secondo
// settings.holidaySundayMode ('max' default | 'sum' | 'holiday'), perché i CCNL variano;
// qui la combinazione decide anche a QUALE delle due va attribuita la quota, così
// il riepilogo può dire quanto della paga viene da domeniche e quanto da festivi.
// A parità, in modalità 'max', la quota va al festivo: è la ragione più specifica.
export function getShiftSurchargeParts(shift, settings) {
  let sunday = isSunday(shift.date) ? (Number(settings?.sundaySurchargePct) || 0) : 0;
  let holiday = isHoliday(shift.date, settings) ? (Number(settings?.holidaySurchargePct) || 0) : 0;
  if (sunday > 0 && holiday > 0) {
    const mode = settings?.holidaySundayMode || 'max';
    if (mode === 'holiday') sunday = 0;
    else if (mode !== 'sum') { // 'max': vince la maggiore, l'altra sparisce
      if (sunday > holiday) holiday = 0;
      else sunday = 0;
    }
  }
  return { sunday, holiday, manual: Number(shift.surchargePct) || 0 };
}

// Percentuale di maggiorazione totale per un turno: la somma delle tre componenti.
export function getShiftSurchargePct(shift, settings) {
  const p = getShiftSurchargeParts(shift, settings);
  return p.sunday + p.holiday + p.manual;
}

// Calcola la paga di ogni turno tenendo conto della maggiorazione straordinari.
// Tre modalità:
//  - contratto (default): straordinario per le ore che, nella settimana (lun-dom),
//    superano le ore da contratto (expectedWeeklyHours);
//  - contratto MENSILIZZATO (es. Turismo): la busta non ragiona a settimana ma a
//    mese — retribuisce un numero fisso di ore (24 × 4,3 = 103,20) e paga come
//    supplementari le ore eccedenti nel MESE DI PAGA, che è fatto di settimane
//    intere (vedi payrollMonthKey). Riscontrato sulle buste di giugno e luglio
//    2026: 131,45 − 103,20 = 28,25 e 109,70 − 103,20 = 6,50, entrambi esatti.
//    Con la soglia settimanale i conti non tornerebbero: quattro settimane da 24
//    ore fanno 96 ore ordinarie, non 103,20.
//  - a chiamata (onCall): straordinario per le ore che, nel singolo GIORNO,
//    superano la soglia giornaliera (dailyOvertimeThreshold). Ha la precedenza:
//    chi lavora a chiamata non ha un orario mensilizzato da rispettare.
// Serve l'insieme completo dei turni per raggruppare correttamente.
// Ritorna una mappa { [shiftId]: { base, surcharge, overtimeMinutes } }.
export function computePayByShift(allShifts, settings) {
  const otPct = Number(settings?.overtimeSurchargePct) || 0;
  const onCall = !!settings?.onCall;
  const mensile = !onCall && isMensilizzato(settings);
  const thresholdMin = onCall
    ? (Number(settings?.dailyOvertimeThreshold) || 0) * 60
    : mensile
      ? monthlyContractHours(settings) * 60
      : (Number(settings?.expectedWeeklyHours) || 0) * 60;
  const applyOvertime = thresholdMin > 0 && otPct > 0;

  // Raggruppa per giorno (a chiamata), per mese di paga (mensilizzato) o per
  // settimana (contratto).
  const groups = new Map();
  for (const s of allShifts) {
    const key = onCall ? s.date
      : mensile ? payrollMonthKey(s.date)
        : formatDate(getWeekStart(parseDate(s.date)));
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
      const parts = getShiftSurchargeParts(s, settings);

      let overtimeMin = 0;
      if (applyOvertime) {
        const after = cumMin + m;
        overtimeMin = Math.max(0, after - Math.max(thresholdMin, cumMin));
      }

      const shiftBase = m * ratePerMin;
      const overtimeBase = overtimeMin * ratePerMin;
      // Le quattro maggiorazioni restano separate perché il riepilogo del mese
      // le mostra una per una: un unico totale non dice quale voce si scosta da
      // quella stampata in busta. `surcharge` resta la loro somma, invariata.
      const surchargeSunday = shiftBase * (parts.sunday / 100);
      const surchargeHoliday = shiftBase * (parts.holiday / 100);
      const surchargeManual = shiftBase * (parts.manual / 100);
      const surchargeOvertime = overtimeBase * (otPct / 100);

      result[s.id] = {
        base: shiftBase,
        surcharge: surchargeSunday + surchargeHoliday + surchargeManual + surchargeOvertime,
        surchargeSunday,
        surchargeHoliday,
        surchargeManual,
        surchargeOvertime,
        overtimeMinutes: overtimeMin,
        // Nessuna paga applicabile a questa data: il turno vale 0 € e va
        // segnalato, altrimenti il totale è silenziosamente sottostimato.
        missingRate: ratePerMin <= 0 && m > 0,
      };
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
// `byShift` opzionale: mappa già calcolata con computePayByShift(allShifts, settings).
// Passarla evita di ricostruirla a ogni chiamata (è O(N) su TUTTA la storia dei
// turni): con più viste che chiamano questa funzione, ricalcolarla ogni volta
// rallenta l'app man mano che i turni crescono.
export function calcTotalPay(shifts, settings, allShifts = shifts, byShift = null) {
  if (!hasAnyRate(settings)) return null;
  const map = byShift || computePayByShift(allShifts, settings);
  let base = 0;
  let surcharge = 0;
  let surchargeSunday = 0;
  let surchargeHoliday = 0;
  let surchargeManual = 0;
  let surchargeOvertime = 0;
  let overtimeMinutes = 0;
  let shiftsWithoutRate = 0;
  shifts.forEach(s => {
    const p = map[s.id];
    if (p) {
      base += p.base;
      surcharge += p.surcharge;
      surchargeSunday += p.surchargeSunday;
      surchargeHoliday += p.surchargeHoliday;
      surchargeManual += p.surchargeManual;
      surchargeOvertime += p.surchargeOvertime;
      overtimeMinutes += p.overtimeMinutes;
      if (p.missingRate) shiftsWithoutRate += 1;
    }
  });
  return {
    base, surcharge, total: base + surcharge,
    surchargeSunday, surchargeHoliday, surchargeManual, surchargeOvertime,
    overtimeMinutes, shiftsWithoutRate,
  };
}

export function formatCurrency(amount) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
