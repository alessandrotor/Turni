// Estensioni esplicite: senza, Node puro non riesce a importare questo modulo e
// i riscontri in `scripts/` (che girano fuori da Vite) non partono.
import { minutesDiff, parseDate, getWeekStart, formatDate, payrollMonthKey } from './dates.js';
import { isHoliday } from './holidays.js';
import { isMensilizzato, monthlyContractHours, monthlyFullTimeHours } from './ccnl.js';
import { isAssenza, tipoTurno, percentualeAssenza, giorniEventoMalattia, TIPO } from './assenze.js';
import { minutiNotturni, pctNotturnoAggiuntiva } from './notturno.js';

// Ferie, permessi e malattia non hanno orari: portano una durata già in minuti,
// perché in busta valgono un numero fisso di ore e non un intervallo. Il
// controllo sta qui e non nei chiamanti così ore, totali e statistiche
// continuano a funzionare senza sapere che tipo di giornata stanno sommando.
export function calcShiftMinutes(shift) {
  if (shift?.durationMinutes != null) return Math.max(0, Number(shift.durationMinutes) || 0);
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

// NB: il notturno NON sta qui. Queste sono percentuali che valgono sul turno
// INTERO perché dipendono dal giorno; il notturno vale solo sui minuti che
// cadono nella fascia oraria, quindi ha un modulo suo (utils/notturno.js) e
// entra nel calcolo più sotto, in computePayByShift.

// Percentuale di maggiorazione totale per un turno: la somma delle tre componenti.
export function getShiftSurchargePct(shift, settings) {
  const p = getShiftSurchargeParts(shift, settings);
  return p.sunday + p.holiday + p.manual;
}

// Minuti compresi nella fascia [lo, hi) dell'intervallo [before, after).
// Serve a spezzare un turno che attraversa una soglia (es. inizia sotto il
// full-time e finisce sopra) fra le due fasce senza contarli due volte.
function minutesInBand(before, after, lo, hi) {
  return Math.max(0, Math.min(after, hi) - Math.max(before, lo));
}

// Calcola la paga di ogni turno tenendo conto delle maggiorazioni per ore
// eccedenti, su DUE soglie:
//  - supplementari: ore oltre il contratto (part-time) ma entro il full-time,
//    maggiorazione `overtimeSurchargePct`;
//  - straordinari: ore oltre il full-time, maggiorazione
//    `straordinarioSurchargePct` (vuoto = eredita quella dei supplementari,
//    stesso pattern di `tfrTaxRate` in net.js — così chi non tocca il campo
//    nuovo ha lo stesso comportamento di prima).
// La soglia full-time non si applica a chi lavora "a chiamata" (onCall): non
// esiste un contratto part-time da cui distinguerla, resta una sola soglia
// giornaliera come sempre.
//
// Tre modalità per la soglia-contratto (supplementari):
//  - contratto (default): oltre le ore da contratto nella settimana (lun-dom);
//  - contratto MENSILIZZATO (es. Turismo): la busta non ragiona a settimana ma a
//    mese — retribuisce un numero fisso di ore (24 × 4,3 = 103,20) e paga come
//    supplementari le ore eccedenti nel MESE DI PAGA, che è fatto di settimane
//    intere (vedi payrollMonthKey). Riscontrato sulle buste di giugno e luglio
//    2026: 131,45 − 103,20 = 28,25 e 109,70 − 103,20 = 6,50, entrambi esatti.
//    Con la soglia settimanale i conti non tornerebbero: quattro settimane da 24
//    ore fanno 96 ore ordinarie, non 103,20.
//  - a chiamata (onCall): oltre la soglia giornaliera (dailyOvertimeThreshold).
//    Ha la precedenza: chi lavora a chiamata non ha un orario mensilizzato da
//    rispettare, né una soglia full-time (vedi sopra).
// Serve l'insieme completo dei turni per raggruppare correttamente.
// Ritorna una mappa { [shiftId]: { base, surcharge, overtimeMinutes, ... } }.
export function computePayByShift(allShifts, settings) {
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
  const fullTimeThresholdMin = onCall ? 0
    : mensile
      ? monthlyFullTimeHours(settings) * 60
      : (Number(settings?.fullTimeWeeklyHours) || 0) * 60;
  const applyOvertime = thresholdMin > 0 && otPct > 0;
  const applyExtra = !onCall && fullTimeThresholdMin > 0 && extraPct > 0;

  // La carenza si conta per EVENTO di malattia, quindi va ricavata da tutti i
  // turni in una volta: un giorno isolato non sa di che evento fa parte.
  const eventoMalattia = giorniEventoMalattia(allShifts);

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
      const tipo = tipoTurno(s);
      const assenza = isAssenza(s);
      // Ferie e permessi valgono il 100%; la malattia dipende da quanti giorni
      // dura l'evento (carenza). Vedi utils/assenze.js.
      const pctAssenza = assenza
        ? percentualeAssenza(s, settings, eventoMalattia.get(s.date) || 0)
        : 100;
      // Nessuna maggiorazione su un giorno non lavorato: una domenica di ferie
      // non prende il domenicale, non ci si è andati.
      const parts = assenza ? { sunday: 0, holiday: 0, manual: 0 } : getShiftSurchargeParts(s, settings);

      // LE ORE FESTIVE STANNO FUORI DAL CONTEGGIO DELLE ECCEDENZE.
      //
      // In busta un giorno festivo lavorato ha una riga sua — «Lavoro festivo
      // ordinario» al 100%, piu' «Magg. festivo» — e quelle ore NON compaiono
      // fra le supplementari. Contarle in entrambi i posti le pagava al 130% +
      // 20% invece che al 120%.
      //
      // Si mettono da parte PRIMA della soglia, non solo dopo: e' la differenza
      // fra le due letture possibili, e la busta di giugno 2026 la decide.
      // 145,20 ore lavorate, 13,75 festive, soglia 103,20 →
      //   131,45 − 103,20 = 28,25 supplementari, esattamente quanto stampato.
      // Lasciandole nel monte ore (togliendole solo dalle supplementari) le 6,75
      // ore del 2 giugno riempirebbero parte della soglia e ne uscirebbero
      // 35,00. Vedi scripts/check-festivo-supplementare.mjs.
      //
      // Si guarda il GIORNO con `isHoliday`, non `parts.holiday`: con la
      // maggiorazione festiva impostata a zero quest'ultimo sarebbe zero, e le
      // ore rientrerebbero di nascosto fra le supplementari.
      const festivoLavorato = !assenza && isHoliday(s.date, settings);

      const before = cumMin;
      const after = cumMin + (festivoLavorato ? 0 : m);
      // Le assenze RIEMPIONO la soglia contrattuale — è così che la busta
      // arriva comunque alle ore del mese quando ci sono ferie — ma non
      // possono essere supplementari o straordinarie: in un giorno di ferie
      // non si lavora, e pagarle in più sarebbe un guadagno per essere stati
      // assenti.
      const supplementareMin = (!assenza && !festivoLavorato && applyOvertime)
        ? minutesInBand(before, after, thresholdMin, applyExtra ? fullTimeThresholdMin : Infinity)
        : 0;
      // Fascia straordinaria: oltre la soglia-full-time.
      const straordinarioMin = (!assenza && !festivoLavorato && applyExtra)
        ? minutesInBand(before, after, fullTimeThresholdMin, Infinity)
        : 0;

      const shiftBase = m * ratePerMin * (pctAssenza / 100);
      // Quota di `base` che spetta alle ore oltre soglia. Serve al riepilogo per
      // ricomporre le voci COME LE STAMPA LA BUSTA: il cedolino non scrive il
      // solo +30%, scrive le ore supplementari intere al 130%
      // (`overtimeBase + surchargeOvertime`) e la retribuzione ordinaria al
      // netto di quelle (`base − overtimeBase − straordinarioBase`). Senza
      // questo dato le due colonne non sono confrontabili.
      const overtimeBase = supplementareMin * ratePerMin;
      const straordinarioBase = straordinarioMin * ratePerMin;
      // Le maggiorazioni restano separate perché il riepilogo del mese le
      // mostra una per una: un unico totale non dice quale voce si scosta da
      // quella stampata in busta. `surcharge` resta la loro somma, invariata.
      const surchargeSunday = shiftBase * (parts.sunday / 100);
      const surchargeHoliday = shiftBase * (parts.holiday / 100);
      const surchargeManual = shiftBase * (parts.manual / 100);
      const surchargeOvertime = overtimeBase * (otPct / 100);
      const surchargeStraordinario = straordinarioBase * (extraPct / 100);

      // Notturno: si paga sui MINUTI in fascia, non sul turno intero — un
      // 20:00–02:00 ha quattro ore notturne e due diurne. E si aggiunge come
      // SUPPLEMENTO su quanto il turno prende già, perché i CCNL non cumulano
      // le maggiorazioni: la maggiore assorbe la minore (vedi notturno.js).
      // Con la maggiorazione notturna a zero questo blocco vale zero e il
      // motore resta identico a prima — è ciò che gli script di riscontro
      // sulle buste reali continuano a dimostrare.
      // La pausa si sottrae ai minuti pagati (calcShiftMinutes) ma non si sa in
      // che punto del turno cade, quindi non la si può sottrarre alla sola
      // fascia notturna. Il tetto evita l'unico esito palesemente sbagliato:
      // più minuti notturni che minuti pagati.
      const notteMin = assenza ? 0 : Math.min(minutiNotturni(s, settings), m);
      const nightBase = notteMin * ratePerMin;
      const surchargeNight = nightBase
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

export function calcShiftPay(shift, settings) {
  const rate = getRateForDate(shift.date, settings);
  if (rate <= 0) return null;
  const ratePerMin = rate / 60;
  const pctGiorno = getShiftSurchargePct(shift, settings);
  const base = calcShiftMinutes(shift) * ratePerMin;
  // Il notturno sta fuori dalla percentuale del turno: vale sui soli minuti in
  // fascia (vedi computePayByShift, che e' la strada che l'app percorre davvero).
  const notte = minutiNotturni(shift, settings) * ratePerMin
    * (pctNotturnoAggiuntiva(settings, pctGiorno) / 100);
  return base * (1 + pctGiorno / 100) + notte;
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

export function formatCurrency(amount) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
