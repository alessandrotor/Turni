// Estensioni esplicite: senza, Node puro non riesce a importare questo modulo e
// i riscontri in `scripts/` (che girano fuori da Vite) non partono.
import { minutesDiff, parseDate, getWeekStart, formatDate, payrollMonthKey } from './dates.js';
import { isHoliday } from './holidays.js';
import { isMensilizzato, monthlyContractHours } from './ccnl.js';
import { isAssenza, tipoTurno, percentualeAssenza, giorniEventoMalattia, TIPO } from './assenze.js';
import { minutiNotturniPagati, pctNotturnoAggiuntiva, straordinarioNotturno } from './notturno.js';

// UNA SOLA STRADA PER LA PAGA, e non è una preferenza di stile.
//
// Il percorso vero è `computePayByShift` → `calcTotalPay`: è lì che stanno il
// monte ore del mese e il supplementare a settimana, le maggiorazioni che non
// si cumulano, le assenze che riempiono la soglia senza generare straordinari.
// È l'unico percorso riscontrato sulle buste reali —
// `check-supplementare-settimanale`, `check-busta-luglio-2026`.
//
// Fino al 1° settembre 2026 qui accanto ne vivevano altre quattro, esportate e
// mai chiamate da nessuno: `calcPay(ore, paga)` che moltiplicava e basta,
// `calcShiftPay` che calcolava un turno IGNORANDO la soglia mensile (e lo
// ammetteva nel proprio commento), più `calcShiftHours` e `calcWeekTotals`,
// resti di quando l'app ragionava a settimane. Non erano disordine: erano una
// trappola. Nomi autorevoli, export pubblico, e un numero diverso da quello
// riscontrato per chiunque le avesse chiamate credendole il motore.
//
// Chi aggiunge qui un secondo modo di calcolare la paga si porti il riscontro
// sulla busta, oppure non lo aggiunga.

// Ferie, permessi e malattia non hanno orari: portano una durata già in minuti,
// perché in busta valgono un numero fisso di ore e non un intervallo. Il
// controllo sta qui e non nei chiamanti così ore, totali e statistiche
// continuano a funzionare senza sapere che tipo di giornata stanno sommando.
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
//  - contratto MENSILIZZATO (es. Turismo): DUE regole insieme, e servono
//    tutte e due. Le ore ORDINARIE sono il monte ore del mese (24 × 4,3 =
//    103,20), comunque si distribuiscano: luglio 2026 ne ha 109,5 lavorate e
//    la busta ne paga 103,20, settembre 100,5 con le ferie e ne paga 103,20.
//    Il SUPPLEMENTARE invece si conta a SETTIMANA, oltre le ore da contratto,
//    nel giorno in cui lo si fa. Contarlo sul mese (le ore oltre 103,20) dava
//    11,55 h a settembre contro le 14,25 stampate, e la domenicale su ore che
//    la busta paga come supplementari. → check-supplementare-settimanale.mjs
//  - a chiamata (onCall): oltre la soglia giornaliera (dailyOvertimeThreshold).
//    Ha la precedenza: chi lavora a chiamata non ha un orario mensilizzato da
//    rispettare, né una soglia full-time (vedi sopra).
// Minuti di STRAORDINARIO di ogni turno, contati a settimana (lun-dom) sul
// lavoro effettivo: ferie e permessi non sono lavoro prestato, e le ore festive
// hanno la loro riga in busta (stessa regola del supplementare, sotto). La
// settimana a cavallo di due mesi resta una: le ore di fine settembre contano
// per le 40 della settimana che finisce in ottobre.
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

// Le assenze prima, poi il lavoro in ordine cronologico: vedi sotto, in
// computePayByShift, perché le ferie riempiono la soglia e non la superano.
function assenzePrima(a, b) {
  const pesoA = isAssenza(a) ? 0 : 1;
  const pesoB = isAssenza(b) ? 0 : 1;
  if (pesoA !== pesoB) return pesoA - pesoB;
  return (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || ''));
}

// Minuti di SUPPLEMENTARE di ogni turno sul mensilizzato, a settimana (lun-dom):
// le ore oltre il contratto, nel giorno in cui si superano. Ferie, permessi e
// malattia riempiono la settimana; la festività NON lavorata no — è già dentro
// il monte ore del mese, e ad agosto 2026 contarla dava 22,5 h contro 17,5.
// Fuori anche il festivo lavorato, che in busta ha la sua riga, e le ore già
// straordinarie. Una settimana a cavallo resta una: il 2 agosto 2026 chiude
// una settimana di luglio, e le sue 2,5 h oltre le 24 sono nella busta di agosto.
// Il permesso `presunto` di cosa-cambia.js riempie il mese, non la settimana.
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
// ordinarie pagate sono il monte ore, non quelle lavorate. 1 se il mese non
// è ancora pieno: lì si mostrano le ore segnate (supplementari a parte), e la
// parte ordinaria sale fino al monte man mano che il mese si riempie, senza
// salti. Il festivo lavorato ha la sua riga e resta fuori.
function quotaOrdinaria(turni, settings, monteMin, supplementare, straordinario) {
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
  const ordinarie = Math.min(monteMin, segnate) - Math.max(0, Math.min(sup, monteMin - segnate));
  const lavorate = lavoro - sup;
  return lavorate > 0 ? Math.max(0, ordinarie - assenze) / lavorate : 1;
}

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
  // Lo STRAORDINARIO è sempre a settimana: lavoro oltre l'orario normale di
  // 40 ore settimanali (D.Lgs. 66/2003, art. 1 e 3). Sul mensilizzato si contava
  // sul mese (40 × 4,3 = 172 h), e chi faceva 45 ore in una settimana e poche
  // nelle altre non ne vedeva nessuna. → check-straordinario-settimanale.mjs
  const fullTimeThresholdMin = onCall ? 0 : (Number(settings?.fullTimeWeeklyHours) || 0) * 60;
  const applyOvertime = thresholdMin > 0 && otPct > 0;
  const applyExtra = !onCall && fullTimeThresholdMin > 0 && extraPct > 0;
  const straordinarioSett = mensile && applyExtra
    ? straordinarioPerSettimana(allShifts, settings, fullTimeThresholdMin) : null;
  const supplementareSett = mensile && applyOvertime
    ? supplementarePerSettimana(allShifts, settings, (Number(settings?.expectedWeeklyHours) || 0) * 60, straordinarioSett)
    : null;

  // La carenza si conta per EVENTO di malattia, quindi va ricavata da tutti i
  // turni in una volta: un giorno isolato non sa di che evento fa parte.
  const eventoMalattia = giorniEventoMalattia(allShifts);

  // Raggruppa per giorno (a chiamata), per mese (mensilizzato) o per settimana
  // (contratto).
  //
  // Sul mensilizzato il raggruppamento SEGUE `periodoConteggio`, cioè la stessa
  // scelta che decide quali turni si vedono a schermo. Finché non lo faceva,
  // chi sceglieva «mese di calendario» otteneva un ibrido: i turni dell'1-31
  // ma con le quote di supplementare calcolate su gruppi a settimane intere,
  // che sconfinano nel mese dopo. La ripartizione fra ore ordinarie e
  // supplementari che ne usciva non era né quella di una regola né quella
  // dell'altra, e non corrispondeva a nessuna busta.
  const perCalendario = settings?.periodoConteggio === 'calendario';
  const groups = new Map();
  for (const s of allShifts) {
    const key = onCall ? s.date
      : mensile ? (perCalendario ? s.date.slice(0, 7) : payrollMonthKey(s.date))
        : formatDate(getWeekStart(parseDate(s.date)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const result = {};
  for (const groupShifts of groups.values()) {
    // LE ASSENZE PRIMA, poi il lavoro in ordine cronologico.
    //
    // Non è un vezzo: decide quante ore risultano supplementari, e lo si vede
    // sulla busta di agosto 2026. Quel mese ha quindici giorni di ferie che
    // cominciano il 31, cioè DOPO che la soglia mensile è già stata superata.
    //
    // In ordine puramente cronologico il motore incontrava quelle 4 ore a
    // soglia piena: le scartava dai supplementari — giustamente, un'assenza non
    // si paga in più — ma così non riempivano più la soglia, e altrettante ore
    // di lavoro restavano ordinarie. Risultato: 13,55 ore supplementari contro
    // le 17,50 stampate, esattamente 4 ore di meno.
    //
    // La busta fa l'opposto, e lo dichiara nella propria aritmetica:
    //   4,00 ferie + 99,20 retribuzione = 103,20 (il monte ore fisso)
    //   + 17,50 supplementare
    // Le ferie stanno DENTRO le ore fisse, non oltre.
    //
    // Vale in generale, non solo per agosto: chi va in ferie a fine mese si
    // vedeva sottrarre ore supplementari già maturate, e l'effetto cresceva con
    // la durata dell'assenza. Fra assenze, e fra turni di lavoro, l'ordine
    // resta quello cronologico — cambia solo quale dei due gruppi viene prima.
    groupShifts.sort(assenzePrima);
    const quota = supplementareSett
      ? quotaOrdinaria(groupShifts, settings, thresholdMin, supplementareSett, straordinarioSett) : 1;
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

      // Sul mensilizzato lo straordinario è già deciso a settimana, e le sue ore
      // non riempiono il monte ore del mese: sono oltre, per definizione.
      const straordSett = straordinarioSett?.get(s.id) || 0;
      const before = cumMin;
      const after = cumMin + (festivoLavorato ? 0 : m - straordSett);
      // Le assenze RIEMPIONO la soglia contrattuale — è così che la busta
      // arriva comunque alle ore del mese quando ci sono ferie — ma non
      // possono essere supplementari o straordinarie: in un giorno di ferie
      // non si lavora, e pagarle in più sarebbe un guadagno per essere stati
      // assenti.
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
      // La domenicale NON si cumula col supplementare né con lo straordinario:
      // la maggiore assorbe la minore, come fra domenica e festivo. Sulle ore
      // oltre soglia di una domenica resta solo l'eventuale differenza. Settembre
      // 2026: 15,5 ore di domenica, 5,75 pagate come domenicale — le altre
      // 9,75 erano supplementari. Si calcola sulle ore vere, non sulla quota.
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

      // Notturno: si paga sui MINUTI in fascia, non sul turno intero — un
      // 20:00–02:00 ha quattro ore notturne e due diurne. E si aggiunge come
      // SUPPLEMENTO su quanto il turno prende già, perché i CCNL non cumulano
      // le maggiorazioni: la maggiore assorbe la minore (vedi notturno.js).
      // Con la maggiorazione notturna a zero questo blocco vale zero e il
      // motore resta identico a prima — è ciò che gli script di riscontro
      // sulle buste reali continuano a dimostrare.
      // Il tetto sui minuti pagati vive in notturno.js, cosi' motore e
      // interfaccia usano la stessa regola invece di due copie che divergono.
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


// Totale paga con dettaglio maggiorazioni. Ritorna null se nessuna paga
// oraria è configurata. `allShifts` (default = shifts) fornisce il contesto
// settimanale per il calcolo degli straordinari.
// `byShift` opzionale: mappa già calcolata con computePayByShift(allShifts, settings).
// Passarla evita di ricostruirla a ogni chiamata (è O(N) su TUTTA la storia dei
// turni): con più viste che chiamano questa funzione, ricalcolarla ogni volta
// rallenta l'app man mano che i turni crescono.
/**
 * Il lordo di UN turno: base + tutte le maggiorazioni.
 *
 * Sembra una somma da scrivere sul posto, e invece deve stare qui. Il totale
 * del mese (`calcTotalPay`) accumula esattamente questi due addendi: se la
 * cella del calendario ne facesse una sua, prima o poi i due numeri
 * divergerebbero di qualche centesimo e nessuno saprebbe quale credere. Una
 * somma sola, in un posto solo — è la regola dichiarata in testa a questo file.
 *
 * `scripts/check-lordo-turno.mjs` verifica che la somma dei lordi dei turni di
 * un mese sia identica al totale di quel mese.
 *
 * @param {object} voce una voce di `computePayByShift`
 * @returns {number} euro lordi del turno
 */
export function lordoTurno(voce) {
  if (!voce) return 0;
  return (Number(voce.base) || 0) + (Number(voce.surcharge) || 0);
}

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

// `useGrouping: 'always'`: in italiano il punto delle migliaia parte da cinque
// cifre, e il riepilogo scriveva «2317,25 €» sotto la barra che diceva
// «2.317 €». Stessa scelta di `numeroIt` in CalendarView, stesso fallback per
// le WebView vecchie.
export function formatCurrency(amount) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n);
  } catch {
    return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  }
}
