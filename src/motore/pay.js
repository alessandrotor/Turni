// Estensioni esplicite: senza, Node puro non riesce a importare questo modulo e
// i riscontri in `scripts/` (che girano fuori da Vite) non partono.
import { minutesDiff, parseDate, getWeekStart, formatDate, payrollMonthKey } from './date.js';
import { isHoliday } from './holidays.js';
import { isMensilizzato, monthlyContractHours } from './ccnl.js';
import { isAssenza, tipoTurno, percentualeAssenza, giorniEventoMalattia, TIPO } from './assenze.js';
import { minutiNotturniPagati, pctNotturnoAggiuntiva, straordinarioNotturno } from './notturno.js';

// UNA SOLA STRADA PER LA PAGA: `computePayByShift` → `calcTotalPay`, l'unico
// percorso riscontrato sulle buste reali (`check-supplementare-settimanale`,
// `check-busta-luglio-2026`). Chi aggiunge un secondo modo di calcolare la paga
// si porti il riscontro sulla busta, oppure non lo aggiunga.

// Ferie, permessi e malattia non hanno orari: portano una durata già in minuti
// (`durationMinutes`), così ore, totali e statistiche non devono distinguerli.
export function calcShiftMinutes(shift) {
  if (shift?.durationMinutes != null) return Math.max(0, Number(shift.durationMinutes) || 0);
  const total = minutesDiff(shift.startTime, shift.endTime);
  return Math.max(0, total - (shift.breakMinutes || 0));
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

// Maggiorazioni di un turno, DISTINTE per tipo (percentuali): domenicale,
// festiva, manuale. Se è sia domenica sia festivo valgono `holidaySundayMode`
// ('max' default | 'sum' | 'holiday'); in 'max' a parità la quota va al festivo.
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

// Il notturno NON sta qui: vale solo sui minuti in fascia, ha un modulo suo
// (notturno.js).

// Percentuale di maggiorazione totale per un turno: la somma delle tre componenti.
export function getShiftSurchargePct(shift, settings) {
  const p = getShiftSurchargeParts(shift, settings);
  return p.sunday + p.holiday + p.manual;
}

// Minuti compresi nella fascia [lo, hi) dell'intervallo [before, after): spezza
// un turno che attraversa una soglia senza contarlo due volte.
function minutesInBand(before, after, lo, hi) {
  return Math.max(0, Math.min(after, hi) - Math.max(before, lo));
}

// Minuti di STRAORDINARIO di ogni turno, contati a settimana (lun-dom) sul lavoro
// effettivo: ferie e permessi non sono lavoro prestato, le ore festive hanno la
// loro riga in busta. Una settimana a cavallo di due mesi resta una.
function straordinarioPerSettimana(allShifts, settings, sogliaMin) {
  const ordinati = [...allShifts].sort((a, b) =>
    (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
  const cumulo = new Map();
  const esito = new Map();
  for (const s of ordinati) {
    if (isAssenza(s) || isHoliday(s.date, settings)) continue;
    const settimana = formatDate(getWeekStart(parseDate(s.date)));
    const prima = cumulo.get(settimana) || 0;
    const dopo = prima + calcShiftMinutes(s);
    cumulo.set(settimana, dopo);
    const extra = minutesInBand(prima, dopo, sogliaMin, Infinity);
    if (extra > 0) esito.set(s.id, extra);
  }
  return esito;
}

// Le assenze prima, poi il lavoro in ordine cronologico (vedi computePayByShift).
function assenzePrima(a, b) {
  const pesoA = isAssenza(a) ? 0 : 1;
  const pesoB = isAssenza(b) ? 0 : 1;
  if (pesoA !== pesoB) return pesoA - pesoB;
  return (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || ''));
}

// Minuti di SUPPLEMENTARE di ogni turno sul mensilizzato, a settimana (lun-dom):
// le ore oltre il contratto, nel giorno in cui si superano. Ferie, permessi e
// malattia riempiono la settimana; la festività NON lavorata no (è già nel monte
// ore). Fuori anche il festivo lavorato e le ore già straordinarie. Il permesso
// `presunto` di cosa-cambia.js riempie il mese, non la settimana.
function supplementarePerSettimana(allShifts, settings, sogliaMin, straordinario) {
  const settimane = new Map();
  for (const s of allShifts) {
    if (s.presunto || tipoTurno(s) === TIPO.FESTIVITA || (!isAssenza(s) && isHoliday(s.date, settings))) continue;
    const k = formatDate(getWeekStart(parseDate(s.date)));
    if (!settimane.has(k)) settimane.set(k, []);
    settimane.get(k).push(s);
  }
  const esito = new Map();
  for (const turni of settimane.values()) {
    turni.sort(assenzePrima);
    let cumulo = 0;
    for (const s of turni) {
      const prima = cumulo;
      cumulo += calcShiftMinutes(s) - (straordinario?.get(s.id) || 0);
      const extra = isAssenza(s) ? 0 : minutesInBand(prima, cumulo, sogliaMin, Infinity);
      if (extra > 0) esito.set(s.id, extra);
    }
  }
  return esito;
}

// Quanto vale un minuto ordinario lavorato nel mese del mensilizzato: le ore
// ordinarie pagate sono il monte ore, non quelle lavorate. Il festivo lavorato
// ha la sua riga e resta fuori.
//
// Il mese IN CORSO (`inCorso`) sale coi turni: ordinarie = ore segnate meno
// supplementari, fino al monte. A mese chiuso vale la busta.
// → check-mese-in-corso.mjs
function quotaOrdinaria(turni, settings, monteMin, supplementare, straordinario, inCorso = false) {
  let lavoro = 0;
  let assenze = 0;
  let sup = 0;
  for (const s of turni) {
    const m = calcShiftMinutes(s);
    if (isAssenza(s)) assenze += m;
    else if (!isHoliday(s.date, settings)) {
      lavoro += m - (straordinario?.get(s.id) || 0);
      sup += supplementare.get(s.id) || 0;
    }
  }
  const segnate = lavoro + assenze;
  const ordinarie = inCorso
    ? Math.min(monteMin, segnate - sup)
    : Math.min(monteMin, segnate) - Math.max(0, Math.min(sup, monteMin - segnate));
  const lavorate = lavoro - sup;
  return lavorate > 0 ? Math.max(0, ordinarie - assenze) / lavorate : 1;
}

// Serve l'insieme completo dei turni per raggruppare correttamente.
// Ritorna { [shiftId]: { base, surcharge, overtimeMinutes, ... } }.
// `oggi` (facoltativo): il mese che la contiene (e i successivi) è «in corso» e le
// ordinarie salgono coi turni; senza, ogni mese è chiuso, come in busta.
//
// Soglia del supplementare (le ore oltre il contratto):
//  - a chiamata (`onCall`): oltre la soglia giornaliera, ha la precedenza;
//  - mensilizzato (Turismo): ordinarie = monte ore del mese, supplementare a
//    SETTIMANA nel giorno in cui si supera. → check-supplementare-settimanale.mjs
//  - altrimenti: oltre le ore da contratto nella settimana (lun-dom).
// Lo straordinario (oltre il full-time, `straordinarioSurchargePct`; vuoto = come i
// supplementari) non si applica a chi lavora a chiamata.
export function computePayByShift(allShifts, settings, { oggi = null } = {}) {
  const otPct = Number(settings?.overtimeSurchargePct) || 0;
  const extraPctRaw = settings?.straordinarioSurchargePct;
  const extraPct = (extraPctRaw === '' || extraPctRaw == null) ? otPct : (Number(extraPctRaw) || 0);
  const onCall = !!settings?.onCall;
  const mensile = !onCall && isMensilizzato(settings);
  const thresholdMin = onCall
    ? (Number(settings?.dailyOvertimeThreshold) || 0) * 60
    : mensile
      ? monthlyContractHours(settings) * 60
      : (Number(settings?.expectedWeeklyHours) || 0) * 60;
  // Lo STRAORDINARIO è sempre a settimana, oltre 40 ore (D.Lgs. 66/2003, art. 1 e 3).
  // → check-straordinario-settimanale.mjs
  const fullTimeThresholdMin = onCall ? 0 : (Number(settings?.fullTimeWeeklyHours) || 0) * 60;
  const applyOvertime = thresholdMin > 0 && otPct > 0;
  const applyExtra = !onCall && fullTimeThresholdMin > 0 && extraPct > 0;
  const straordinarioSett = mensile && applyExtra
    ? straordinarioPerSettimana(allShifts, settings, fullTimeThresholdMin) : null;
  const supplementareSett = mensile && applyOvertime
    ? supplementarePerSettimana(allShifts, settings, (Number(settings?.expectedWeeklyHours) || 0) * 60, straordinarioSett)
    : null;

  // La carenza si conta per EVENTO di malattia: va ricavata da tutti i turni.
  const eventoMalattia = giorniEventoMalattia(allShifts);

  // Raggruppa per giorno (a chiamata), mese (mensilizzato) o settimana (contratto).
  // Sul mensilizzato segue `periodoConteggio`, come i turni visibili a schermo:
  // senza, «mese di calendario» dava un ibrido che non era la busta.
  const perCalendario = settings?.periodoConteggio === 'calendario';
  const groups = new Map();
  for (const s of allShifts) {
    const key = onCall ? s.date
      : mensile ? (perCalendario ? s.date.slice(0, 7) : payrollMonthKey(s.date))
        : formatDate(getWeekStart(parseDate(s.date)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const meseOggi = mensile && oggi ? (perCalendario ? iso(oggi).slice(0, 7) : payrollMonthKey(iso(oggi))) : null;

  const result = {};
  for (const [chiave, groupShifts] of groups.entries()) {
    // LE ASSENZE PRIMA, poi il lavoro in ordine cronologico: riempiono la soglia
    // del monte ore (busta: 4,00 ferie + 99,20 retribuzione = 103,20). In ordine
    // cronologico le ferie di fine mese non la riempivano e si perdevano ore
    // supplementari (agosto 2026: 13,55 h contro 17,50). → docs/note-motore-pay.md
    groupShifts.sort(assenzePrima);
    const quota = supplementareSett
      ? quotaOrdinaria(groupShifts, settings, thresholdMin, supplementareSett, straordinarioSett, meseOggi != null && chiave >= meseOggi) : 1;
    let cumMin = 0;
    for (const s of groupShifts) {
      const m = calcShiftMinutes(s);
      const ratePerMin = getRateForDate(s.date, settings) / 60;
      const tipo = tipoTurno(s);
      const assenza = isAssenza(s);
      // Ferie e permessi valgono il 100%; la malattia dipende da quanti giorni
      // dura l'evento (carenza). Vedi motore/assenze.js.
      const pctAssenza = assenza
        ? percentualeAssenza(s, settings, eventoMalattia.get(s.date) || 0)
        : 100;
      // Nessuna maggiorazione su un giorno non lavorato: una domenica di ferie
      // non prende il domenicale, non ci si è andati.
      const parts = assenza ? { sunday: 0, holiday: 0, manual: 0 } : getShiftSurchargeParts(s, settings);

      // Le ore FESTIVE stanno fuori dal conteggio delle eccedenze: in busta hanno una
      // riga loro. Si tolgono PRIMA della soglia, non solo dopo (giugno 2026:
      // 131,45 − 103,20 = 28,25 h, come stampato). Si guarda il GIORNO con
      // `isHoliday`, non `parts.holiday`, che con maggiorazione a zero varrebbe 0.
      // → check-festivo-supplementare.mjs
      const festivoLavorato = !assenza && isHoliday(s.date, settings);

      // Sul mensilizzato lo straordinario è già deciso a settimana, e le sue ore
      // non riempiono il monte ore del mese: sono oltre, per definizione.
      const straordSett = straordinarioSett?.get(s.id) || 0;
      const before = cumMin;
      const after = cumMin + (festivoLavorato ? 0 : m - straordSett);
      // Le assenze RIEMPIONO la soglia contrattuale, ma non possono essere
      // supplementari o straordinarie.
      const supplementareMin = supplementareSett ? (supplementareSett.get(s.id) || 0)
        : (!assenza && !festivoLavorato && applyOvertime)
          ? minutesInBand(before, after, thresholdMin, applyExtra && !mensile ? fullTimeThresholdMin : Infinity)
          : 0;
      // Fascia straordinaria: oltre la soglia-full-time della settimana.
      const straordinarioMin = straordinarioSett ? straordSett
        : (!assenza && !festivoLavorato && applyExtra)
          ? minutesInBand(before, after, fullTimeThresholdMin, Infinity)
          : 0;
      // Minuti ordinari: quelli che non sono già supplementari o straordinari.
      const ordinariMin = m - supplementareMin - straordinarioMin;

      // Sul mensilizzato i minuti ordinari lavorati valgono `quota`: il mese
      // paga il monte ore, non le ore lavorate (vedi `quotaOrdinaria`).
      const shiftBase = assenza ? m * ratePerMin * (pctAssenza / 100)
        : (ordinariMin * (festivoLavorato ? 1 : quota) + supplementareMin + straordinarioMin) * ratePerMin;
      // Quota di `base` delle ore oltre soglia: la busta scrive le supplementari
      // intere al 130%, non il solo +30%.
      const overtimeBase = supplementareMin * ratePerMin;
      const straordinarioBase = straordinarioMin * ratePerMin;
      // Maggiorazioni separate: il riepilogo le mostra una per una. La domenicale
      // NON si cumula con supplementare e straordinario (la maggiore assorbe la
      // minore): settembre 2026, 15,5 h di domenica = 5,75 domenicali + 9,75
      // supplementari. Si calcola sulle ore vere, non sulla quota.
      const orarioMin = ratePerMin * (assenza ? 0 : 1);
      const surchargeSunday = orarioMin * (ordinariMin * parts.sunday
        + supplementareMin * Math.max(0, parts.sunday - (applyOvertime ? otPct : 0))
        + straordinarioMin * Math.max(0, parts.sunday - extraPct)) / 100;
      const surchargeHoliday = orarioMin * m * (parts.holiday / 100);
      const surchargeManual = orarioMin * m * (parts.manual / 100);
      const surchargeOvertime = overtimeBase * (otPct / 100);
      // Straordinario NOTTURNO (Turismo: 60% fra le 24 e le 6): sostituisce il
      // 30% e assorbe la maggiorazione notturna ordinaria su quei minuti.
      const notteStraord = assenza ? { minuti: 0, pct: 0 } : straordinarioNotturno(s, straordinarioMin, settings);
      const surchargeStraordinario = (straordinarioBase * extraPct
        + notteStraord.minuti * ratePerMin * Math.max(0, notteStraord.pct - extraPct)) / 100;

      // Notturno: sui MINUTI in fascia, come SUPPLEMENTO su quanto il turno prende
      // già (le maggiorazioni non si cumulano). Regola e tetto in notturno.js.
      const notteMin = assenza ? 0 : minutiNotturniPagati(s, settings, m);
      const nightBase = notteMin * ratePerMin;
      const surchargeNight = Math.max(0, notteMin - notteStraord.minuti) * ratePerMin
        * (pctNotturnoAggiuntiva(settings, parts.sunday + parts.holiday + parts.manual) / 100);

      result[s.id] = {
        base: shiftBase,
        surcharge: surchargeSunday + surchargeHoliday + surchargeManual
          + surchargeOvertime + surchargeStraordinario + surchargeNight,
        surchargeSunday,
        surchargeHoliday,
        surchargeManual,
        surchargeOvertime,
        surchargeStraordinario,
        surchargeNight,
        overtimeBase,
        straordinarioBase,
        nightBase,
        overtimeMinutes: supplementareMin,
        straordinarioMinutes: straordinarioMin,
        // Minuti ordinari PAGATI (col monte ore del mensilizzato) e minuti che
        // prendono la domenicale: le ore che la busta stampa accanto agli euro.
        ordinariPagatiMinutes: assenza ? m : ordinariMin * (festivoLavorato ? 1 : quota),
        sundayMinutes: parts.sunday > 0 ? ordinariMin : 0,
        nightMinutes: notteMin,
        // Le assenze restano contate a parte: in busta ferie e permessi
        // stanno DENTRO la retribuzione ordinaria, la malattia è una voce sua.
        tipo,
        ferieMinutes: tipo === TIPO.FERIE ? m : 0,
        permessoMinutes: tipo === TIPO.PERMESSO ? m : 0,
        malattiaMinutes: tipo === TIPO.MALATTIA ? m : 0,
        malattiaBase: tipo === TIPO.MALATTIA ? shiftBase : 0,
        // Nessuna paga applicabile a questa data: il turno vale 0 € e va
        // segnalato, altrimenti il totale è silenziosamente sottostimato.
        missingRate: ratePerMin <= 0 && m > 0,
      };
      // Le ore festive non avanzano il contatore: vedi sopra.
      cumMin = after;
    }
  }
  return result;
}

/**
 * Il lordo di UN turno: base + tutte le maggiorazioni. Una somma sola, in un
 * posto solo: `calcTotalPay` accumula questi due addendi, e se la cella del
 * calendario ne facesse una sua i numeri divergerebbero di qualche centesimo.
 * → src/motore/riscontri/check-lordo-turno.mjs
 *
 *
 * @param {{base?: number, surcharge?: number}|null} voce una voce di `computePayByShift`
 * @returns {number} euro lordi del turno
 */
export function lordoTurno(voce) {
  if (!voce) return 0;
  return (Number(voce.base) || 0) + (Number(voce.surcharge) || 0);
}

// Totale paga con dettaglio maggiorazioni; null se manca la paga oraria.
// `allShifts` dà il contesto settimanale; `byShift` (da computePayByShift) evita di
// ricostruire la mappa, che è O(N) su tutta la storia.
export function calcTotalPay(shifts, settings, allShifts = shifts, byShift = null) {
  if (!hasAnyRate(settings)) return null;
  const map = byShift || computePayByShift(allShifts, settings);
  let base = 0;
  let surcharge = 0;
  let surchargeSunday = 0;
  let surchargeHoliday = 0;
  let surchargeManual = 0;
  let surchargeOvertime = 0;
  let surchargeStraordinario = 0;
  let surchargeNight = 0;
  let overtimeBase = 0;
  let straordinarioBase = 0;
  let nightBase = 0;
  let overtimeMinutes = 0;
  let straordinarioMinutes = 0;
  let nightMinutes = 0;
  let ferieMinutes = 0;
  let permessoMinutes = 0;
  let malattiaMinutes = 0;
  let malattiaBase = 0;
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
      surchargeStraordinario += p.surchargeStraordinario;
      surchargeNight += p.surchargeNight;
      overtimeBase += p.overtimeBase;
      straordinarioBase += p.straordinarioBase;
      nightBase += p.nightBase;
      overtimeMinutes += p.overtimeMinutes;
      straordinarioMinutes += p.straordinarioMinutes;
      nightMinutes += p.nightMinutes;
      ferieMinutes += p.ferieMinutes;
      permessoMinutes += p.permessoMinutes;
      malattiaMinutes += p.malattiaMinutes;
      malattiaBase += p.malattiaBase;
      if (p.missingRate) shiftsWithoutRate += 1;
    }
  });
  return {
    base, surcharge, total: base + surcharge,
    surchargeSunday, surchargeHoliday, surchargeManual, surchargeOvertime, surchargeStraordinario,
    surchargeNight,
    overtimeBase, straordinarioBase, nightBase,
    overtimeMinutes, straordinarioMinutes, nightMinutes,
    ferieMinutes, permessoMinutes, malattiaMinutes, malattiaBase,
    shiftsWithoutRate,
  };
}

// `useGrouping: 'always'`: l'it-IT raggruppa le migliaia da cinque cifre, e il
// riepilogo scriveva «2317,25 €» sotto la barra che diceva «2.317 €».
export function formatCurrency(amount) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    // @ts-expect-error 'always' è valido nei browser, non ancora nei tipi della libreria
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n);
  } catch {
    return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  }
}
