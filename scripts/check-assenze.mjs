// Riscontro di ferie, permessi e malattia.
//
//   node scripts/check-assenze.mjs
//
// COSA È VERIFICATO SU BUSTA E COSA NO — la distinzione conta.
//
// Verificato (buste Turismo, giugno e luglio 2026):
//  - la retribuzione del mese è FISSA: le ore «Retribuzione» sono 103,20 in
//    entrambe, e il lordo torna al centesimo senza righe aggiuntive.
//
// ATTESO ma NON riscontrato — e fino al 1° settembre 2026 stava scritto qui
// sopra come se lo fosse:
//  - che ferie e permessi stiano DENTRO quelle 103,20 invece di aggiungersi.
//    Segue dalla mensilizzazione ed è quello che il motore fa, ma la busta di
//    luglio non lo dimostra: le ore «godute» che riporta sono un MONTANTE
//    progressivo dell'anno (risalgono a marzo), non assenze cadute nel periodo
//    6 lug → 2 ago. Un montante non dice QUANDO sono state consumate.
//  - che un giorno di assenza valga un numero fisso di ore (24 h settimanali
//    su sei giorni = 4 h al giorno). Stessa ragione: il 5,50 citato come prova
//    non è nemmeno un multiplo di 4.
//
// La busta di AGOSTO 2026 è la prima che può rispondere, perché contiene ferie
// cadute nel periodo (15 giorni dal 31 agosto). Si legge per differenza fra
// montanti — vedi RILASCIO.md, sezione «Un secondo discriminante».
//
// NON verificato, perché nessuna busta disponibile contiene malattia:
//  - quanto paga la carenza e quanto pagano i giorni successivi. La STRUTTURA
//    (carenza a giorni, contata per evento) segue lo schema INPS ed è quella
//    che si riscontra qui; gli IMPORTI dipendono dal CCNL e sono parametri
//    modificabili in Impostazioni. Se un domani arriva un cedolino con
//    malattia, i numeri attesi vanno rifatti su quello.

import { computePayByShift, calcTotalPay, calcShiftMinutes } from '../src/utils/pay.js';
import {
  TIPO, minutiGiornoAssenza, giorniEventoMalattia, percentualeAssenza,
} from '../src/utils/assenze.js';

const R = 9.21802;
const BASE = {
  hourlyRate: R,
  expectedWeeklyHours: 24,
  workingDaysPerWeek: 6,
  ccnl: 'turismo',
  sundaySurchargePct: 10,
  holidaySurchargePct: 30,
  overtimeSurchargePct: 30,
  straordinarioSurchargePct: '',
};

let failures = 0;
const CENT = 0.005;

function check(label, actual, expected, tol = CENT) {
  const delta = Math.abs(actual - expected);
  const ok = delta <= tol;
  if (!ok) failures += 1;
  const fmt = (n) => n.toFixed(2).padStart(9);
  console.log(`${ok ? '  ok  ' : '  XX  '} ${label.padEnd(48)} ${fmt(actual)}  atteso ${fmt(expected)}`);
}

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const lavoro = (date, min) => ({ id: `L${date}`, date, startTime: '09:00', endTime: hhmm(540 + min) });
const assenza = (date, type, min) => ({ id: `${type}${date}`, date, type, durationMinutes: min });
const paga = (shifts, settings = BASE) => calcTotalPay(shifts, settings, shifts, computePayByShift(shifts, settings));

console.log('\nOre di un giorno di assenza\n');
check('Turismo part-time 60%: 24 h su 6 giorni',
  minutiGiornoAssenza(BASE) / 60, 4);
check('full-time 40 h su 5 giorni',
  minutiGiornoAssenza({ expectedWeeklyHours: 40, workingDaysPerWeek: 5 }) / 60, 8);
check('override a mano vince sul calcolo',
  minutiGiornoAssenza({ ...BASE, absenceDailyHours: 6.5 }) / 60, 6.5);
check('durata salvata nel turno, letta da calcShiftMinutes',
  calcShiftMinutes(assenza('2026-07-07', TIPO.FERIE, 240)) / 60, 4);

console.log('\nFerie e permessi: 100%, dentro la retribuzione\n');
{
  const f = [assenza('2026-07-07', TIPO.FERIE, 240)];
  const p = paga(f);
  check('4 h di ferie valgono 4 h di paga', p.total, 4 * R);
  check('  contate come ferie', p.ferieMinutes / 60, 4);
  check('  nessuna maggiorazione', p.surcharge, 0);
}
{
  // 12 luglio 2026 è domenica: un giorno di ferie NON prende il domenicale,
  // non ci si è andati a lavorare.
  const dom = [assenza('2026-07-12', TIPO.FERIE, 240)];
  const p = paga(dom);
  check('ferie di domenica: maggiorazione domenicale', p.surchargeSunday, 0);
  check('ferie di domenica: pagate comunque 4 h', p.total, 4 * R);
}
{
  // 15 agosto 2026 è Ferragosto, festivo nazionale.
  const fest = [assenza('2026-08-15', TIPO.FERIE, 240)];
  check('ferie in un festivo: maggiorazione festiva', paga(fest).surchargeHoliday, 0);
}
{
  const perm = [assenza('2026-07-07', TIPO.PERMESSO, 120)];
  const p = paga(perm);
  check('2 h di permesso valgono 2 h di paga', p.total, 2 * R);
  check('  contate come permesso', p.permessoMinutes / 60, 2);
}

console.log('\nLe assenze riempiono la soglia ma non diventano supplementari\n');
{
  // Mese di paga di luglio 2026 (6 lug – 2 ago), soglia mensilizzata 103,20 h.
  const giorni = [];
  for (let d = new Date(2026, 6, 6); d <= new Date(2026, 7, 2); d.setDate(d.getDate() + 1)) {
    giorni.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  // 100 h di lavoro + 2 giorni di ferie (8 h) = 108 h, oltre le 103,20.
  const misto = [];
  let restano = 100 * 60;
  for (const g of giorni) {
    if (restano <= 0) break;
    const m = Math.min(restano, 300);
    misto.push(lavoro(g, m));
    restano -= m;
  }
  const conFerie = [...misto, assenza(giorni[26], TIPO.FERIE, 240), assenza(giorni[27], TIPO.FERIE, 240)];
  const p = paga(conFerie);
  check('ore totali del mese', (100 * 60 + 480) / 60, 108);
  check('  di cui ferie', p.ferieMinutes / 60, 8);
  // Le ferie stanno in coda al mese: superano la soglia ma restano ferie.
  // Il lavoro (100 h) da solo non arriva a 103,20, quindi zero supplementari.
  check('  supplementari generate dalle ferie', p.overtimeMinutes / 60, 0);

  // Le stesse ferie a INIZIO mese riempiono la soglia, e il lavoro che segue
  // la supera davvero: quelle sì che sono ore supplementari.
  const ferriePrima = [assenza(giorni[0], TIPO.FERIE, 240), assenza(giorni[1], TIPO.FERIE, 240), ...misto];
  const p2 = paga(ferriePrima);
  check('ferie a inizio mese: supplementari del lavoro', p2.overtimeMinutes / 60, 108 - 103.2);
  check('  il lordo non cambia con l\'ordine', p2.base, p.base);
}

console.log('\nMalattia: carenza contata per evento\n');
{
  const SET = { ...BASE, malattiaCarenzaGiorni: 3, malattiaCarenzaPct: 0, malattiaPct: 100 };
  // Due eventi distinti; il primo attraversa il cambio d'ora del 29 marzo.
  const date = ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-06-10', '2026-06-11'];
  const sh = date.map(d => assenza(d, TIPO.MALATTIA, 240));
  const ev = giorniEventoMalattia(sh);

  check('27 mar è il giorno 1 del primo evento', ev.get('2026-03-27'), 1, 0);
  check('31 mar è il giorno 5 (cambio d\'ora attraversato)', ev.get('2026-03-31'), 5, 0);
  check('10 giu riparte da 1: evento nuovo', ev.get('2026-06-10'), 1, 0);

  check('giorno 1: in carenza', percentualeAssenza({ type: TIPO.MALATTIA }, SET, 1), 0, 0);
  check('giorno 3: ancora in carenza', percentualeAssenza({ type: TIPO.MALATTIA }, SET, 3), 0, 0);
  check('giorno 4: fuori carenza', percentualeAssenza({ type: TIPO.MALATTIA }, SET, 4), 100, 0);

  const p = paga(sh, SET);
  // 7 giorni da 4 h: 5 in carenza (3 del primo evento + 2 del secondo) e 2 pagati.
  check('ore di malattia', p.malattiaMinutes / 60, 28);
  check('pagate solo le 8 h fuori carenza', p.malattiaBase, 8 * R);
  check('  la malattia è una voce a sé', p.malattiaBase, p.total);
}
{
  // Con la carenza pagata al 50% il conto cambia solo lì.
  const SET = { ...BASE, malattiaCarenzaGiorni: 3, malattiaCarenzaPct: 50, malattiaPct: 100 };
  const sh = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07']
    .map(d => assenza(d, TIPO.MALATTIA, 240));
  check('3 giorni al 50% + 1 al 100%', paga(sh, SET).malattiaBase, (3 * 4 * 0.5 + 4) * R);
}

console.log('\nCompatibilità con i turni già salvati\n');
{
  // I turni inseriti prima di questa funzione non hanno `type`: devono
  // continuare a valere come lavoro, senza migrazioni sui dati.
  const vecchio = [{ id: 'v1', date: '2026-07-07', startTime: '09:00', endTime: '17:00' }];
  const p = paga(vecchio);
  check('turno senza `type` vale 8 h di lavoro', p.base, 8 * R);
  check('  nessuna assenza contata', p.ferieMinutes + p.permessoMinutes + p.malattiaMinutes, 0);
}

console.log(failures === 0
  ? '\n✓ tutti i riscontri superati\n'
  : `\n✗ ${failures} riscontri falliti\n`);
process.exit(failures === 0 ? 0 : 1);
