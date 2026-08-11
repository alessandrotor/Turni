// Riscontro dell'attribuzione delle ore al MESE DI PAGA per i CCNL
// mensilizzati, da eseguire con:
//
//   node scripts/check-mese-paga-2026.mjs
//
// Il fatto da riprodurre sta su due buste reali (CCNL Turismo, livello 5,
// part-time 60%, paga oraria 9,21802):
//
//              ore attribuite   − 103,20 contrattuali   = supplementari in busta
//   giugno         131,45              103,20                   28,25
//   luglio         109,70              103,20                    6,50
//
// Da qui si ricavano le due regole implementate, senza doverle scegliere a caso:
//
//  1. La soglia del supplementare è MENSILE. Non può essere settimanale:
//     quattro settimane con tetto a 24 ore farebbero 96 ore ordinarie, non
//     103,20 — e la voce "Retribuzione" vale 103,20 h in ENTRAMBE le buste,
//     indipendentemente dai giorni di calendario.
//
//  2. La settimana a cavallo appartiene al mese del LUNEDÌ. Il 1° giugno 2026 è
//     lunedì: con questa regola giugno vale 5 settimane (1/6 → 5/7) e luglio 4
//     (6/7 → 2/8), e il rapporto fra le ore in busta — 131,45/109,70 = 1,198 —
//     è appunto ≈ 5/4. Con la convenzione opposta (mese della domenica) giugno
//     varrebbe 4 settimane e luglio 5, quindi giugno dovrebbe risultare MINORE
//     di luglio: il contrario di quel che è stampato.

import { payrollMonthKey, payrollMonthRange, formatDate, parseDate, getWeekStart } from '../src/utils/dates.js';
import { calcTotalPay, calcShiftMinutes } from '../src/utils/pay.js';

const RATE = 9.21802;

// Maggiorazioni domenicali e festive azzerate: qui si riscontra l'attribuzione
// delle ore e la quota di supplementare, non le maggiorazioni (che hanno già i
// loro riscontri nei check delle buste).
const SETTINGS = {
  hourlyRate: RATE,
  expectedWeeklyHours: 24,
  overtimeSurchargePct: 30,
  sundaySurchargePct: 0,
  holidaySurchargePct: 0,
  ccnl: 'turismo',
};

let fail = 0;
const check = (label, ok, extra = '') => {
  if (!ok) fail += 1;
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label}${extra ? '  → ' + extra : ''}`);
};
const eq = (label, actual, expected, tol = 0.005) =>
  check(label, Math.abs(actual - expected) <= tol, `${actual} (atteso ${expected})`);

// Turni finti da `minutiTotali` complessivi, uno al giorno a partire da `dal`,
// al massimo 8 ore ciascuno.
function generaTurni(dal, minutiTotali, prefisso) {
  const out = [];
  const d = parseDate(dal);
  let resto = minutiTotali;
  let i = 0;
  while (resto > 0) {
    const m = Math.min(480, resto);
    const fine = 9 * 60 + m;
    out.push({
      id: `${prefisso}${i}`,
      date: formatDate(d),
      startTime: '09:00',
      endTime: `${String(Math.floor(fine / 60)).padStart(2, '0')}:${String(fine % 60).padStart(2, '0')}`,
      breakMinutes: 0,
    });
    resto -= m;
    i += 1;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

console.log('\nEstremi del mese di paga 2026\n');
{
  const g = payrollMonthRange(2026, 5); // giugno
  const l = payrollMonthRange(2026, 6); // luglio
  const a = payrollMonthRange(2026, 7); // agosto
  check('giugno = 1/6 → 5/7', formatDate(g.start) === '2026-06-01' && formatDate(g.end) === '2026-07-05',
        `${formatDate(g.start)} → ${formatDate(g.end)}`);
  check('  cinque settimane intere', (g.end - g.start) / 86400000 + 1 === 35);
  check('luglio = 6/7 → 2/8', formatDate(l.start) === '2026-07-06' && formatDate(l.end) === '2026-08-02',
        `${formatDate(l.start)} → ${formatDate(l.end)}`);
  check('  quattro settimane intere', (l.end - l.start) / 86400000 + 1 === 28);
  // Agosto ha cinque lunedì (3, 10, 17, 24, 31): l'ultima settimana comincia il
  // 31/8 e appartiene quindi ad agosto per intero, fino al 6 settembre.
  check('agosto = 3/8 → 6/9', formatDate(a.start) === '2026-08-03' && formatDate(a.end) === '2026-09-06',
        `${formatDate(a.start)} → ${formatDate(a.end)}`);
  // Il passaggio d'anno è il caso in cui è facile sbagliare la normalizzazione
  // del mese (dicembre + 1).
  const dic = payrollMonthRange(2025, 11);
  check('dicembre 2025 = 1/12 → 4/1/2026', formatDate(dic.start) === '2025-12-01' && formatDate(dic.end) === '2026-01-04',
        `${formatDate(dic.start)} → ${formatDate(dic.end)}`);
  // Nessun buco e nessuna sovrapposizione fra un mese di paga e il successivo.
  let contigui = true;
  for (let m = 0; m < 24; m += 1) {
    const y = 2025 + Math.floor(m / 12);
    const r = payrollMonthRange(y, m % 12);
    const succ = payrollMonthRange(y, (m % 12) + 1);
    if (Math.round((succ.start - r.end) / 86400000) !== 1) contigui = false;
  }
  check('mesi di paga contigui, senza buchi né sovrapposizioni', contigui);
}

console.log('\nAttribuzione dei singoli giorni\n');
{
  check('3 luglio (venerdì, settimana del 29/6) → giugno', payrollMonthKey('2026-07-03') === '2026-06',
        payrollMonthKey('2026-07-03'));
  check('5 luglio (domenica, stessa settimana) → giugno', payrollMonthKey('2026-07-05') === '2026-06');
  check('6 luglio (lunedì dopo) → luglio', payrollMonthKey('2026-07-06') === '2026-07');
  check('1 agosto (sabato, settimana del 27/7) → luglio', payrollMonthKey('2026-08-01') === '2026-07',
        payrollMonthKey('2026-08-01'));
  check('3 agosto (lunedì) → agosto', payrollMonthKey('2026-08-03') === '2026-08');
}

// Giugno: 131,45 h a partire dal 19/6, così cinque turni cadono in giorni di
// LUGLIO (1–5) e devono comunque finire nel mese di paga di giugno.
const TURNI_GIUGNO = generaTurni('2026-06-19', Math.round(131.45 * 60), 'g');
// Luglio: 109,70 h dal 20/7, con due turni in giorni di AGOSTO (1–2).
const TURNI_LUGLIO = generaTurni('2026-07-20', Math.round(109.70 * 60), 'l');
const TUTTI = [...TURNI_GIUGNO, ...TURNI_LUGLIO];

console.log('\nOre e supplementari del mese di paga\n');
{
  const inMese = (chiave) => TUTTI.filter(s => payrollMonthKey(s.date) === chiave);
  const giugno = inMese('2026-06');
  const luglio = inMese('2026-07');

  check('nessun turno perso o contato due volte', giugno.length + luglio.length === TUTTI.length);
  check('turni di giugno che cadono a luglio', giugno.filter(s => s.date.startsWith('2026-07')).length === 5,
        String(giugno.filter(s => s.date.startsWith('2026-07')).length));
  check('turni di luglio che cadono ad agosto', luglio.filter(s => s.date.startsWith('2026-08')).length === 2,
        String(luglio.filter(s => s.date.startsWith('2026-08')).length));

  const ore = (list) => list.reduce((s, t) => s + calcShiftMinutes(t), 0) / 60;
  eq('ore attribuite a giugno', ore(giugno), 131.45);
  eq('ore attribuite a luglio', ore(luglio), 109.70);

  const payG = calcTotalPay(giugno, SETTINGS, TUTTI);
  const payL = calcTotalPay(luglio, SETTINGS, TUTTI);
  eq('supplementari giugno (h)', payG.overtimeMinutes / 60, 28.25);
  eq('supplementari luglio (h)', payL.overtimeMinutes / 60, 6.50);

  // Voci della busta di luglio: 951,30 (103,20 h) + 77,89 (6,50 h al 30%).
  eq('lordo luglio da turni', payL.total, 951.30 + 77.89, 0.02);
  eq('  di cui maggiorazione supplementare', payL.surcharge, 6.50 * RATE * 0.30, 0.01);
  // Giugno: 103,20 h ordinarie + 28,25 h al 30%.
  eq('lordo giugno da turni', payG.total, (103.20 + 28.25) * RATE + 28.25 * RATE * 0.30, 0.02);
}

console.log('\nContratti NON mensilizzati: regola settimanale invariata\n');
{
  // Riconteggio indipendente della vecchia regola: eccedenza oltre 24 h in
  // ciascuna settimana lun-dom.
  const attesoSettimanale = (turni) => {
    const perSettimana = new Map();
    for (const t of turni) {
      const k = formatDate(getWeekStart(parseDate(t.date)));
      perSettimana.set(k, (perSettimana.get(k) || 0) + calcShiftMinutes(t));
    }
    let ecc = 0;
    for (const min of perSettimana.values()) ecc += Math.max(0, min - 24 * 60);
    return ecc / 60;
  };

  const senzaCcnl = { ...SETTINGS, ccnl: '' };
  const mesiCalendario = (aa, mm) => TUTTI.filter(s => s.date.slice(0, 7) === `${aa}-${mm}`);
  const giugnoCal = mesiCalendario('2026', '06');
  const pay = calcTotalPay(TUTTI, senzaCcnl, TUTTI);
  eq('senza CCNL, straordinari su tutta la serie = regola settimanale',
     pay.overtimeMinutes / 60, attesoSettimanale(TUTTI), 0.01);
  check('senza CCNL il mese resta quello di calendario (nessun turno di luglio in giugno)',
        giugnoCal.every(s => s.date.startsWith('2026-06')));

  // A chiamata: soglia giornaliera, mai mensile, anche col CCNL mensilizzato.
  const aChiamata = { ...SETTINGS, onCall: true, dailyOvertimeThreshold: 6 };
  const payChiamata = calcTotalPay(TURNI_LUGLIO, aChiamata, TUTTI);
  const attesoGiornaliero = TURNI_LUGLIO
    .reduce((s, t) => s + Math.max(0, calcShiftMinutes(t) - 6 * 60), 0) / 60;
  eq('a chiamata: soglia giornaliera, non mensile', payChiamata.overtimeMinutes / 60, attesoGiornaliero, 0.01);
}

console.log(fail === 0 ? '\n✓ mese di paga e supplementari coerenti con le buste\n' : `\n✗ ${fail} riscontri falliti\n`);
process.exit(fail === 0 ? 0 : 1);
