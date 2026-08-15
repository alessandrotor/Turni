// Riscontro delle serie di giorni lavorati consecutivi.
//
//   node scripts/check-serie-giorni.mjs
//
// Nasce da un difetto vero: la prima versione stabiliva se due giorni fossero
// consecutivi sottraendo due `Date` locali e confrontando con 86.400.000 ms.
// Nei giorni del cambio d'ora quella differenza è 23 o 25 ore — in Italia il
// 29 marzo e il 25 ottobre 2026 — quindi la serie si spezzava proprio lì. In
// UTC il difetto NON si manifesta: sarebbe passato inosservato in sviluppo e
// comparso solo sui telefoni degli utenti, due giorni all'anno.
//
// Per questo lo script si ri-esegue da solo con TZ=Europe/Rome: senza quel
// fuso il riscontro non proverebbe niente.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workStreaks, daysInLongStreaks, STREAK_LUNGA } from '../src/utils/stats.js';

if (process.env.TZ !== 'Europe/Rome') {
  // `fileURLToPath` e non `new URL(...).pathname`: su Windows quest'ultimo
  // restituisce «/D:/…» con lo slash iniziale, che Node risolve come percorso
  // relativo al disco corrente («D:\D:\…»). Lo script non partiva affatto, e
  // proprio qui non ci si può accorgere di nulla: il riscontro che protegge dal
  // difetto del cambio d'ora non veniva mai eseguito.
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, TZ: 'Europe/Rome' },
  });
  process.exit(r.status ?? 1);
}

let failures = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label.padEnd(46)} ${a}${ok ? '' : `  atteso ${e}`}`);
}

// Un giorno lavorato vale l'altro: qui contano solo le date. La forma è quella
// che produce `dailyBreakdown`, campi delle assenze compresi — un fixture più
// povero del dato vero fa passare riscontri che in app fallirebbero.
const giorni = (...date) => new Map(date.map(d => [d, {
  totalMinutes: 480, overtimeMinutes: 0, straordinarioMinutes: 0,
  assenzaMinutes: 0, assenzaTipo: null,
  shiftsCount: 1, sunday: false, holiday: false,
}]));

// Giornata di sola assenza: stesse ore, ma nessuna lavorata.
const assenze = (...date) => new Map(date.map(d => [d, {
  totalMinutes: 240, overtimeMinutes: 0, straordinarioMinutes: 0,
  assenzaMinutes: 240, assenzaTipo: 'ferie',
  shiftsCount: 1, sunday: false, holiday: false,
}]));

const seq = (start, n) => {
  const out = [];
  const [y, m, d] = start.split('-').map(Number);
  for (let i = 0; i < n; i += 1) {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    out.push(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`);
  }
  return out;
};

console.log(`\nFuso attivo: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`);
console.log('Cambio d\'ora — è qui che il conteggio si rompeva\n');

// 29 marzo 2026: ora legale, la giornata locale dura 23 ore.
check('serie di 7 giorni a cavallo del 29 marzo',
  workStreaks(giorni(...seq('2026-03-26', 7))),
  [{ start: '2026-03-26', end: '2026-04-01', days: 7 }]);

// 25 ottobre 2026: ora solare, la giornata locale dura 25 ore.
check('serie di 6 giorni a cavallo del 25 ottobre',
  workStreaks(giorni(...seq('2026-10-22', 6))),
  [{ start: '2026-10-22', end: '2026-10-27', days: 6 }]);

console.log('\nCasi ordinari\n');

check('un giorno solo',
  workStreaks(giorni('2026-05-04')),
  [{ start: '2026-05-04', end: '2026-05-04', days: 1 }]);

check('due serie separate da un riposo',
  workStreaks(giorni('2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05')),
  [{ start: '2026-06-01', end: '2026-06-02', days: 2 },
   { start: '2026-06-04', end: '2026-06-05', days: 2 }]);

check('ordinate dalla più lunga',
  workStreaks(giorni('2026-02-01', '2026-02-03', '2026-02-04', '2026-02-05')).map(r => r.days),
  [3, 1]);

check('nessun turno',
  workStreaks(new Map()),
  []);

// Le date arrivano in ordine sparso dalla mappa dei turni: l'ordinamento
// interno deve reggere, altrimenti una serie si spezza a seconda di come
// l'utente ha inserito i turni.
check('date fuori ordine',
  workStreaks(giorni('2026-07-03', '2026-07-01', '2026-07-02')),
  [{ start: '2026-07-01', end: '2026-07-03', days: 3 }]);

// Capodanno: la serie si ferma al confine dell'anno, perché `dailyBreakdown`
// raccoglie un anno per volta.
check('serie a cavallo di capodanno (dentro lo stesso insieme)',
  workStreaks(giorni('2025-12-30', '2025-12-31', '2026-01-01')),
  [{ start: '2025-12-30', end: '2026-01-01', days: 3 }]);

console.log('\nLe assenze spezzano la serie\n');

// Un giorno di ferie è riposo dal lavoro: interrompe i giorni consecutivi,
// altrimenti una settimana di ferie in mezzo a due mesi pieni risulterebbe
// come un'unica lunghissima serie senza riposo — il contrario del vero.
check('ferie in mezzo: due serie, non una',
  workStreaks(new Map([
    ...giorni('2026-09-01', '2026-09-02'),
    ...assenze('2026-09-03'),
    ...giorni('2026-09-04', '2026-09-05'),
  ])),
  [{ start: '2026-09-01', end: '2026-09-02', days: 2 },
   { start: '2026-09-04', end: '2026-09-05', days: 2 }]);

check('solo assenze: nessuna serie',
  workStreaks(assenze('2026-09-07', '2026-09-08', '2026-09-09')),
  []);

console.log('\nGiorni dentro una serie lunga\n');

const miste = workStreaks(giorni(...seq('2026-03-26', 7), ...seq('2026-05-10', 3)));
check(`solo le serie da ${STREAK_LUNGA}+ giorni`,
  [...daysInLongStreaks(miste)].sort(),
  seq('2026-03-26', 7));

check('la soglia si può alzare', daysInLongStreaks(miste, 8).size, 0);

console.log(failures === 0
  ? '\n✓ tutti i riscontri superati\n'
  : `\n✗ ${failures} riscontri falliti\n`);
process.exit(failures === 0 ? 0 : 1);
