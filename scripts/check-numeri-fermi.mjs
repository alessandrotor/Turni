// I NUMERI FERMI: l'uscita del motore su casi fissi, confrontata al centesimo
// con quella salvata.
//
//   node scripts/check-numeri-fermi.mjs              confronta
//   node scripts/check-numeri-fermi.mjs --aggiorna   riscrive numeri-fermi.json
//
// PERCHÉ ESISTE: è la rete per spostare il motore (docs/motore-portabile.md).
// Spostare un file, separare un contratto, cambiare una firma: nessuno di
// questi passi deve muovere un centesimo. Gli altri riscontri dicono se una
// regola è vera; questo dice se un numero è cambiato, ovunque.
//
// `--aggiorna` si usa SOLO quando si cambia una regola di proposito, col suo
// riscontro: allora i numeri devono cambiare, e il nuovo file lo dichiara nel
// commit. Per uno spostamento, mai: se un passo sposta un centesimo, il passo è
// sbagliato.
//
// I turni sono sintetici e deterministici (un generatore a seme fisso), su
// cinque profili di contratto. Nessuna data di oggi implicita: ogni funzione
// che la guarda la riceve.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePayByShift, calcTotalPay } from '../src/utils/pay.js';
import { lordoDelMese, nettoDelMese, calcNetAnnual, tiDecision } from '../src/utils/net.js';
import { capienzaProgressiva } from '../src/utils/capienza.js';
import { progressiviDellAnno, stimaConguaglio } from '../src/utils/conguaglio.js';
import { nettoDelMeseConPremio } from '../src/utils/premio-risultato.js';
import { rischioRestituzione, costoSoglia } from '../src/utils/restituzione.js';
import { calcBonusMargin } from '../src/utils/bonus.js';
import { lordoPerReddito, lordoMeseMinimoTi } from '../src/utils/soglia-lorda.js';
import { proponiPeriodo } from '../src/utils/periodo-assenza.js';

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'numeri-fermi.json');
const ANNO = 2026;
const OGGI = new Date(2026, 8, 15, 12);

// ── i turni ────────────────────────────────────────────────────────────────
function generatore(seme) {
  let s = seme >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function turni(seme, oreMedie) {
  const caso = generatore(seme);
  const out = [];
  for (let d = new Date(ANNO, 0, 1); d.getFullYear() === ANNO; d.setDate(d.getDate() + 1)) {
    const data = iso(d);
    const r = caso();
    const mese = d.getMonth();
    if (mese === 7 && d.getDate() >= 17 && d.getDate() <= 28) {
      if (d.getDay() !== 0) out.push({ id: `f${data}`, date: data, type: 'ferie', durationMinutes: 240 });
      continue;
    }
    if (mese === 2 && d.getDate() >= 9 && d.getDate() <= 12) {
      out.push({ id: `m${data}`, date: data, type: 'malattia', durationMinutes: 240 });
      continue;
    }
    if (r < 0.2) continue;
    if (r < 0.23) { out.push({ id: `p${data}`, date: data, type: 'permesso', durationMinutes: 120 }); continue; }
    const notte = r > 0.93;
    const inizio = notte ? 20 * 60 : (8 + Math.floor(caso() * 8)) * 60 + (caso() < 0.5 ? 30 : 0);
    const durata = Math.round((oreMedie * (0.6 + caso() * 0.8)) * 4) * 15;
    out.push({ id: `t${data}`, date: data, startTime: hhmm(inizio), endTime: hhmm(inizio + durata), breakMinutes: durata > 360 ? 30 : 0 });
    if (caso() < 0.08) out.push({ id: `s${data}`, date: data, startTime: '18:00', endTime: '21:30', breakMinutes: 0 });
  }
  return out;
}

// ── i profili ──────────────────────────────────────────────────────────────
const PROFILI = {
  turismo: {
    settings: {
      hourlyRate: 9.21802, previousRates: [{ until: '2026-02-28', rate: 9.1 }], expectedWeeklyHours: 24,
      fullTimeWeeklyHours: 40, workingDaysPerWeek: 6, ccnl: 'turismo', periodoConteggio: 'calendario',
      overtimeSurchargePct: 30, straordinarioSurchargePct: 30, sundaySurchargePct: 10, holidaySurchargePct: 20,
      nightSurchargePct: 25, hasTredicesima: true, hasQuattordicesima: true, hireDate: '2025-12-29',
      aziendaDipendenti: 'oltre15', addizionaliAltrove: true, monthlyBonusAmount: 120,
      monthlyBonus: { '2026-03': true, '2026-07': true, '2026-09': true }, fixedMonthlyItems: [{ amount: 10 }],
      patronSaintDate: '06-29',
    },
    turni: turni(7, 5),
  },
  montante: {
    settings: {
      hourlyRate: 9.21802, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo',
      periodoConteggio: 'calendario', overtimeSurchargePct: 30, sundaySurchargePct: 10, hasTredicesima: true,
      hasQuattordicesima: true, hireDate: '2025-12-29', priorTaxableIncome: 7200, priorIncomeDate: '2026-06-30',
      addRegionalePct: 1.73, addComunalePct: 0.8,
    },
    turni: turni(11, 5.5),
  },
  commercio: {
    settings: {
      hourlyRate: 11.4, expectedWeeklyHours: 40, fullTimeWeeklyHours: 40, ccnl: 'commercio',
      overtimeSurchargePct: 15, straordinarioSurchargePct: 30, sundaySurchargePct: 30, holidaySurchargePct: 30,
      hasTredicesima: true, hasQuattordicesima: true, fondoPensionePct: 1.55, cassaSanitariaEuro: 2,
      tiModo: 'auto',
    },
    turni: turni(23, 7.5),
  },
  senzaCcnl: {
    settings: {
      hourlyRate: 8.5, expectedWeeklyHours: 20, fullTimeWeeklyHours: 40, ccnl: '',
      overtimeSurchargePct: 10, straordinarioSurchargePct: 25, holidaySurchargePct: 50, holidaySundayMode: 'sum',
      nightSurchargePct: 15, nightCumuloMode: 'somma', bonusPremioRisultato: true, monthlyBonusAmount: 200,
      monthlyBonus: { '2026-05': true, '2026-11': true },
    },
    turni: turni(31, 4),
  },
  aChiamata: {
    settings: {
      hourlyRate: 10, expectedWeeklyHours: 0, ccnl: '', onCall: true, dailyOvertimeThreshold: 6,
      overtimeSurchargePct: 25, sundaySurchargePct: 15, tiModo: 'mai',
    },
    turni: turni(43, 6),
  },
};

// ── l'uscita ───────────────────────────────────────────────────────────────
const c2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);
const pulito = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? c2(v) : v)));

function uscita({ settings, turni: tutti }) {
  const payMap = computePayByShift(tutti, settings);
  const progressivi = progressiviDellAnno({ anno: ANNO, allShifts: tutti, settings, payMap, oggi: OGGI });
  const mesi = [];
  for (let m = 0; m < 12; m += 1) {
    const delMese = tutti.filter((t) => t.date.startsWith(`${ANNO}-${String(m + 1).padStart(2, '0')}`));
    const paga = calcTotalPay(delMese, settings, tutti, payMap);
    const l = lordoDelMese(paga?.total, ANNO, m, settings);
    const giorni = new Date(ANNO, m + 1, 0).getDate();
    const cap = capienzaProgressiva(l.lordo - l.premioMese, settings, progressivi[m]);
    const { contributiRighe, ...netto } = nettoDelMese(l.lordo, settings, giorni, l.extraMese, cap);
    const conPremio = nettoDelMeseConPremio(l, settings, giorni, ANNO, cap).net;
    mesi.push({ paga, lordo: l, cap, netto, contributiRighe, conPremio });
  }
  const proiezione = 15800;
  return pulito({
    mesi,
    conguaglio: stimaConguaglio({ anno: ANNO, allShifts: tutti, settings, payMap, oggi: OGGI }),
    annuo: calcNetAnnual(16000, settings),
    ti: tiDecision(14500, settings),
    margine: calcBonusMargin(proiezione, settings),
    rischio: rischioRestituzione({ settings, proiezioneAnnua: proiezione, oggi: OGGI }),
    costo: costoSoglia(settings),
    soglia: { lordo: lordoPerReddito(15000, settings), minimoTi: lordoMeseMinimoTi(settings) },
    periodo: proponiPeriodo({ dal: '2026-10-05', al: '2026-10-18', turni: tutti, settings }),
  });
}

const adesso = Object.fromEntries(Object.entries(PROFILI).map(([k, p]) => [k, uscita(p)]));

if (process.argv.includes('--aggiorna')) {
  writeFileSync(FILE, JSON.stringify(adesso, null, 1) + '\n');
  console.log(`\nnumeri-fermi.json riscritto: ${Object.keys(adesso).length} profili.\n`);
  process.exit(0);
}
if (!existsSync(FILE)) {
  console.error('\nManca numeri-fermi.json: lancialo una volta con --aggiorna.\n');
  process.exit(1);
}

// Il confronto dice DOVE, non solo se: il primo percorso che diverge.
const salvato = JSON.parse(readFileSync(FILE, 'utf8'));
const differenze = [];
function confronta(a, b, via) {
  if (differenze.length >= 15) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 0.005) differenze.push(`${via}: ${b} → ${a}`);
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) confronta(a[k], b[k], `${via}.${k}`);
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) differenze.push(`${via}: ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
}
confronta(adesso, salvato, 'uscita');

console.log('\nI numeri fermi\n');
if (differenze.length) {
  for (const d of differenze) console.log(`  FALLITO ${d}`);
  console.log('\nUn numero è cambiato. Se il passo era uno spostamento, è sbagliato.\n');
  process.exit(1);
}
console.log(`  ok   ${Object.keys(adesso).length} profili, dodici mesi ciascuno: niente è cambiato.\n`);
