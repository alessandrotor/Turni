// Calcolo del «Cosa cambia?»: impatto sul mese e sull'anno di una modifica a un turno.
//
// PERCHÉ ESISTE
// Chi usa l'app valuta di continuo variazioni: fare due ore in più, coprire un
// turno notturno, cedere una giornata o scambiare l'orario. La domanda immediata
// è pratica: «quanto mi entra in tasca netto?» e «rischio di sforare la soglia
// del trattamento integrativo?».
//
// Questo modulo calcola la differenza (delta) fra il mese PRIMA e il mese DOPO,
// usando lo stesso motore di calcolo già collaudato (pay.js e net.js).
// È una funzione pura, senza React e senza dipendenze dal DOM.

import { calcShiftMinutes, calcTotalPay, computePayByShift, hasAnyRate } from './pay.js';
import {
  nettoDelMese,
  lordoDelMese,
  computeAnnualGrossFromShifts,
  projectAnnualIncome,
} from './net.js';
import { calcBonusMargin, BONUS_STATUS } from './bonus.js';
import { getDaysInMonth } from './dates.js';

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
 * @returns {Object|null}
 */
export function calcolaCosaCambia({
  candidateShift = null,
  originalShift = null,
  allShifts = [],
  settings = {},
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

  // 4. Retribuzione lorda
  const rateAvailable = hasAnyRate(settings);
  let deltaLordo = 0;
  let payBefore = null;
  let payAfter = null;

  if (rateAvailable) {
    const payMapBefore = computePayByShift(shiftsBefore, settings);
    payBefore = calcTotalPay(monthShiftsBefore, settings, shiftsBefore, payMapBefore);

    const payMapAfter = computePayByShift(shiftsAfter, settings);
    payAfter = calcTotalPay(monthShiftsAfter, settings, shiftsAfter, payMapAfter);

    deltaLordo = (payAfter?.total || 0) - (payBefore?.total || 0);
  }

  // 5. Netto del mese
  let deltaNetto = 0;
  let deltaTrattenute = 0;
  let netBefore = null;
  let netAfter = null;

  if (rateAvailable && payBefore && payAfter) {
    const daysInMonth = getDaysInMonth(year, month);
    // Stessa composizione e stesso netto del pannello di Calendario: vedi
    // `lordoDelMese` e `nettoDelMese` in net.js. Qui ce n'era una copia, ed era
    // già rimasta indietro una volta sul formato del bonus.
    const prima = lordoDelMese(payBefore.total, year, month, settings);
    const dopo = lordoDelMese(payAfter.total, year, month, settings);
    netBefore = nettoDelMese(prima.lordo, settings, daysInMonth, prima.extraMese);
    netAfter = nettoDelMese(dopo.lordo, settings, daysInMonth, dopo.extraMese);

    if (netBefore && netAfter) {
      deltaNetto = netAfter.net - netBefore.net;
      deltaTrattenute = netAfter.trattenute - netBefore.trattenute;
    }
  }

  // 6. Proiezione annua e Margine Trattamento Integrativo
  let margineBonusBefore = null;
  let margineBonusAfter = null;
  let deltaMargineBonus = 0;
  let superaSoglia = false;
  let rientraSottoSoglia = false;

  if (rateAvailable) {
    const payMapBefore = computePayByShift(shiftsBefore, settings);
    const annualBefore = computeAnnualGrossFromShifts(year, shiftsBefore, settings, payMapBefore);
    const projBefore = projectAnnualIncome(annualBefore.total, annualBefore.extras, settings, year);

    const payMapAfter = computePayByShift(shiftsAfter, settings);
    const annualAfter = computeAnnualGrossFromShifts(year, shiftsAfter, settings, payMapAfter);
    const projAfter = projectAnnualIncome(annualAfter.total, annualAfter.extras, settings, year);

    // La soglia dei 15.000 vale sul REDDITO COMPLESSIVO, e la proiezione è un
    // LORDO: confrontarli direttamente faceva gridare «supera la soglia» con
    // ~1.500 € d'anticipo, mentre la striscia del bonus diceva ancora che
    // c'era margine. Si chiede alla stessa funzione della striscia.
    // → check-cosa-cambia.mjs
    const prima = calcBonusMargin(projBefore.value, settings);
    const dopo = calcBonusMargin(projAfter.value, settings);
    const sotto = (b) => b.status === BONUS_STATUS.PIENO || b.status === BONUS_STATUS.ATTESA;
    margineBonusBefore = prima.marginToFull ?? 0;
    margineBonusAfter = dopo.marginToFull ?? 0;
    deltaMargineBonus = margineBonusAfter - margineBonusBefore;

    superaSoglia = sotto(prima) && !sotto(dopo);
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
  };
}
