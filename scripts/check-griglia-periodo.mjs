// Riscontro della griglia del calendario contro il PERIODO CHE VIENE CONTATO:
//
//   node scripts/check-griglia-periodo.mjs
//
// Il fatto da garantire è uno solo, ed è quello che l'utente vede: le giornate
// disegnate e contate nel mese devono essere ESATTAMENTE quelle del periodo su
// cui l'app fa i totali. Quando le due cose divergevano, il riepilogo scriveva
// «7 giorni di ferie» sotto un agosto in cui se ne vedeva uno (gli altri sei
// stavano nella prima settimana di settembre, dentro il mese di paga).
//
// Si controllano tre proprietà su tutti i mesi dal 2024 al 2030:
//
//  1. mese di calendario: le celle piene sono i giorni dal 1 all'ultimo;
//  2. mese di paga: le celle piene NON fuori periodo sono esattamente i giorni
//     del `payrollMonthRange`, nello stesso ordine e senza buchi;
//  3. nessun giorno compare due volte «pieno»: quelli marcati fuori periodo in
//     un mese sono pieni nel mese precedente, quindi ogni data del calendario
//     è contata una volta sola nell'anno.

import { celleMese } from '../src/utils/griglia.js';
import { formatDate, getDaysInMonth, payrollMonthRange } from '../src/utils/dates.js';

let fail = 0;
const check = (label, ok, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label}${extra ? '  → ' + extra : ''}`);
};

const giorniFra = (start, end) => {
  const out = [];
  const d = new Date(start);
  while (d <= end) {
    out.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

const ANNI = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

// 1. Mese di calendario
{
  let problemi = 0;
  for (const y of ANNI) {
    for (let m = 0; m < 12; m++) {
      const piene = celleMese(y, m, false).filter(Boolean);
      const attesi = Array.from({ length: getDaysInMonth(y, m) }, (_, i) => formatDate(new Date(y, m, i + 1)));
      if (piene.some(c => c.altroMese || c.fuoriPeriodo)) problemi += 1;
      if (piene.map(c => c.iso).join() !== attesi.join()) problemi += 1;
    }
  }
  check('mese di calendario: celle = giorni del mese', problemi === 0, `${problemi} mesi fuori posto`);
}

// 2. Mese di paga
{
  let problemi = 0;
  const esempi = [];
  for (const y of ANNI) {
    for (let m = 0; m < 12; m++) {
      const celle = celleMese(y, m, true).filter(Boolean);
      const contate = celle.filter(c => !c.fuoriPeriodo).map(c => c.iso);
      const { start, end } = payrollMonthRange(y, m);
      const attesi = giorniFra(start, end);
      if (contate.join() !== attesi.join()) {
        problemi += 1;
        if (esempi.length < 3) esempi.push(`${y}-${m + 1}: ${contate[0]}…${contate[contate.length - 1]} invece di ${attesi[0]}…${attesi[attesi.length - 1]}`);
      }
      // La griglia è fatta di settimane intere: il periodo di paga anche.
      if (contate.length % 7 !== 0) problemi += 1;
    }
  }
  check('mese di paga: celle contate = periodo di paga', problemi === 0, esempi.join(' | ') || `${problemi}`);
}

// 3. Ogni data è «piena» in un mese solo
{
  const pieno = new Map();   // iso → elenco dei mesi che la contano
  for (const y of ANNI) {
    for (let m = 0; m < 12; m++) {
      for (const c of celleMese(y, m, true)) {
        if (!c || c.fuoriPeriodo) continue;
        if (!pieno.has(c.iso)) pieno.set(c.iso, []);
        pieno.get(c.iso).push(`${y}-${m + 1}`);
      }
    }
  }
  const doppi = [...pieno.entries()].filter(([, mesi]) => mesi.length > 1);
  check('nessuna data contata da due mesi', doppi.length === 0,
    doppi.slice(0, 3).map(([iso, mesi]) => `${iso} in ${mesi.join(' e ')}`).join(' | '));

  // E nessun buco dentro l'arco coperto: le date contate sono consecutive.
  const tutte = [...pieno.keys()].sort();
  const primo = new Date(tutte[0]);
  const ultimo = new Date(tutte[tutte.length - 1]);
  const attese = giorniFra(primo, ultimo);
  check('nessun giorno saltato fra un mese e l\'altro', tutte.length === attese.length,
    `${tutte.length} contate su ${attese.length} del periodo`);
}

// 4. Il caso concreto che ha fatto nascere tutto questo: agosto 2026.
{
  const celle = celleMese(2026, 7, true).filter(Boolean);
  const fuori = celle.filter(c => c.fuoriPeriodo).map(c => c.iso);
  const coda = celle.filter(c => c.altroMese).map(c => c.iso);
  check('agosto 2026: 1–2 ago fuori periodo', fuori.join() === '2026-08-01,2026-08-02', fuori.join(' '));
  check('agosto 2026: 1–6 set nella griglia',
    coda.join() === ['01','02','03','04','05','06'].map(d => `2026-09-${d}`).join(),
    coda.join(' '));
}

console.log(fail === 0
  ? '\nLa griglia mostra esattamente i giorni che conta.\n'
  : `\n${fail} problema/i.\n`);
process.exit(fail === 0 ? 0 : 1);
