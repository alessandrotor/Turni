// Calcolo del «Cosa cambia?»: impatto sul mese e sull'anno di una modifica a un turno (la
// differenza fra il mese PRIMA e DOPO, con lo stesso motore di pay.js e net.js). Funzione pura.

import { isMensilizzato, monthlyContractHours } from '../motore/ccnl.js';
import { calcShiftMinutes, calcTotalPay, computePayByShift, hasAnyRate } from '../motore/pay.js';
import {
  lordoDelMese,
  computeAnnualGrossFromShifts,
  projectAnnualIncome,
} from '../motore/net.js';
import { progressiviDellAnno } from '../motore/conguaglio.js';
import { capienzaProgressiva } from '../motore/capienza.js';
import { nettoDelMeseConPremio } from '../motore/premio-risultato.js';
import { calcBonusMargin, BONUS_STATUS } from '../motore/bonus.js';
import { getDaysInMonth } from './dates.js';

// IL MESE IN CORSO SALE COI TURNI, come la barra del calendario: stesso motore, stessa data
// (`oggi`). → check-cosa-cambia.mjs, check-mese-in-corso.mjs
const durata = (min) => formatDeltaMinutes(Math.abs(min)).replace('+', '');

// «di cui 4h 48m supplementari»: le ore pagate in più dentro il delta.
function testoDiCui(dopo, prima) {
  const sup = (dopo?.overtimeMinutes || 0) - (prima?.overtimeMinutes || 0);
  const str = (dopo?.straordinarioMinutes || 0) - (prima?.straordinarioMinutes || 0);
  const parti = [];
  if (Math.round(sup)) parti.push(`${durata(sup)} suppl.`);
  if (Math.round(str)) parti.push(`${durata(str)} straord.`);
  return parti.length ? `di cui ${parti.join(', ')}` : null;
}

export function formatDeltaCurrency(val) {
  const n = Number.isFinite(Number(val)) ? Number(val) : 0;
  const segno = n > 0 ? '+' : (n < 0 ? '−' : '');
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${segno}${formatted} €`;
}

export function formatDeltaMinutes(mins) {
  const m = Number.isFinite(Number(mins)) ? Math.round(Number(mins)) : 0;
  const segno = m > 0 ? '+' : (m < 0 ? '−' : '');
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const restMins = abs % 60;
  if (h === 0 && restMins === 0) return '0h';
  if (restMins === 0) return `${segno}${h}h`;
  if (h === 0) return `${segno}${restMins}m`;
  return `${segno}${h}h ${restMins}m`;
}

/**
 * Calcola l'impatto di un turno candidato (nuovo, modificato o rimosso).
 *
 * @param {Object} params
 * @param {Object|null} params.candidateShift turno dopo la modifica (null per cancellazione)
 * @param {Object|null} params.originalShift turno prima della modifica (null per nuovo inserimento)
 * @param {Array|Object} params.allShifts turni attuali
 * @param {Object} params.settings impostazioni utente
 * @param {Date} [params.oggi]
 * @returns {Object|null}
 */
export function calcolaCosaCambia({
  candidateShift = null,
  originalShift = null,
  allShifts = [],
  settings = {},
  oggi = new Date(),
}) {
  const targetDate = candidateShift?.date || originalShift?.date;
  if (!targetDate || typeof targetDate !== 'string') return null;

  const year = Number(targetDate.slice(0, 4));
  const month = Number(targetDate.slice(5, 7)) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;

  const monthPrefix = targetDate.slice(0, 7);
  const shiftsList = Array.isArray(allShifts) ? allShifts : Object.values(allShifts);

  // 1. Costruzione insiemi PRIMA e DOPO
  const shiftsBefore = shiftsList.filter(s => s && s.date);
  const shiftsAfter = shiftsBefore.filter(s => s.id !== originalShift?.id);
  if (candidateShift) {
    const candidateId = candidateShift.id || originalShift?.id || 'temp_candidate_id';
    shiftsAfter.push({ ...candidateShift, id: candidateId });
  }

  // 2. Filtraggio sul mese
  const monthShiftsBefore = shiftsBefore.filter(s => s.date.startsWith(monthPrefix));
  const monthShiftsAfter = shiftsAfter.filter(s => s.date.startsWith(monthPrefix));

  // 3. Minuti lavorati
  const minsBefore = monthShiftsBefore.reduce((acc, s) => acc + calcShiftMinutes(s), 0);
  const minsAfter = monthShiftsAfter.reduce((acc, s) => acc + calcShiftMinutes(s), 0);
  const deltaMinuti = minsAfter - minsBefore;

  // 4-5. Lordo e netto del mese, prima e dopo, come li mostra il calendario.
  const rateAvailable = hasAnyRate(settings);
  const daysInMonth = getDaysInMonth(year, month);
  const conti = () => {
    const mapPrima = computePayByShift(shiftsBefore, settings, { oggi });
    const mapDopo = computePayByShift(shiftsAfter, settings, { oggi });
    const pagaPrima = calcTotalPay(monthShiftsBefore, settings, shiftsBefore, mapPrima);
    const pagaDopo = calcTotalPay(monthShiftsAfter, settings, shiftsAfter, mapDopo);
    // Stessa composizione e stesso netto del pannello di Calendario (`lordoDelMese`,
    // `nettoDelMese`). I mesi prima non cambiano: un progressivo solo, per la capienza.
    const prima = lordoDelMese(pagaPrima?.total, year, month, settings);
    const dopo = lordoDelMese(pagaDopo?.total, year, month, settings);
    const prog = progressiviDellAnno({ anno: year, allShifts: shiftsBefore, settings, payMap: mapPrima, oggi })[month];
    const netto = (l) => nettoDelMeseConPremio(l, settings, daysInMonth, year, capienzaProgressiva(l.lordo - l.premioMese, settings, prog));
    return { pagaPrima, pagaDopo, nettoPrima: netto(prima), nettoDopo: netto(dopo) };
  };
  const scelto = rateAvailable ? conti() : null;
  const payBefore = scelto?.pagaPrima ?? null;
  const payAfter = scelto?.pagaDopo ?? null;
  const netBefore = scelto?.nettoPrima ?? null;
  const netAfter = scelto?.nettoDopo ?? null;
  const deltaLordo = (payAfter?.total || 0) - (payBefore?.total || 0);
  const deltaNetto = netBefore && netAfter ? netAfter.net - netBefore.net : 0;
  const deltaTrattenute = netBefore && netAfter ? netAfter.trattenute - netBefore.trattenute : 0;

  // 6. Proiezione annua e Margine Trattamento Integrativo
  let margineBonusBefore = null;
  let margineBonusAfter = null;
  let deltaMargineBonus = 0;
  let superaSoglia = false;
  let rientraSottoSoglia = false;
  let sogliaLorda = null;

  if (rateAvailable) {
    const payMapBefore = computePayByShift(shiftsBefore, settings, { oggi });
    const annualBefore = computeAnnualGrossFromShifts(year, shiftsBefore, settings, payMapBefore, oggi);
    const projBefore = projectAnnualIncome(annualBefore.total, annualBefore.extras, settings, year, { oggi });

    const payMapAfter = computePayByShift(shiftsAfter, settings, { oggi });
    const annualAfter = computeAnnualGrossFromShifts(year, shiftsAfter, settings, payMapAfter, oggi);
    const projAfter = projectAnnualIncome(annualAfter.total, annualAfter.extras, settings, year, { oggi });

    // La soglia dei 15.000 vale sul REDDITO COMPLESSIVO e la proiezione è un LORDO: si chiede
    // alla stessa funzione della striscia del bonus. → check-cosa-cambia.mjs
    const prima = calcBonusMargin(projBefore.value, settings);
    const dopo = calcBonusMargin(projAfter.value, settings);
    const sotto = (b) => b.status === BONUS_STATUS.PIENO || b.status === BONUS_STATUS.ATTESA;
    margineBonusBefore = prima.marginToFull ?? 0;
    margineBonusAfter = dopo.marginToFull ?? 0;
    deltaMargineBonus = margineBonusAfter - margineBonusBefore;

    superaSoglia = sotto(prima) && !sotto(dopo);
    sogliaLorda = dopo.thresholdFullGross ?? null;
    rientraSottoSoglia = !sotto(prima) && sotto(dopo);
  }

  return {
    deltaMinuti,
    deltaLordo,
    deltaNetto,
    deltaTrattenute,
    hasRate: rateAvailable,
    margineBonus: margineBonusAfter,
    deltaMargineBonus,
    superaSoglia,
    rientraSottoSoglia,
    netBefore: netBefore?.net ?? null,
    netAfter: netAfter?.net ?? null,
    grossBefore: payBefore?.total ?? null,
    grossAfter: payAfter?.total ?? null,
    testoDeltaNetto: formatDeltaCurrency(deltaNetto),
    testoDeltaLordo: formatDeltaCurrency(deltaLordo),
    testoDeltaOre: formatDeltaMinutes(deltaMinuti),
    // Di cui pagate in più: «+8h» da solo non dice se valgono il 100% o il 130%.
    deltaSupplementareMin: (payAfter?.overtimeMinutes || 0) - (payBefore?.overtimeMinutes || 0),
    deltaStraordinarioMin: (payAfter?.straordinarioMinutes || 0) - (payBefore?.straordinarioMinutes || 0),
    testoDiCui: testoDiCui(payAfter, payBefore),
    // Più ore e nemmeno un euro: il mese ha già il monte ore pieno e la busta non ne paga di più.
    // Un «+0 €» senza il perché sembra un guasto.
    testoMonte: deltaMinuti > 0 && Math.abs(deltaLordo) < 0.005 && isMensilizzato(settings) && !settings.onCall
      ? `${new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long' }).replace(/^./, (c) => c.toUpperCase())} ha già le ${(Math.round(monthlyContractHours(settings) * 10) / 10).toLocaleString('it-IT')} h ordinarie che la busta paga: fino a ${settings.expectedWeeklyHours} h a settimana questo turno non aggiunge euro.`
      : null,
    sogliaLorda,
  };
}
