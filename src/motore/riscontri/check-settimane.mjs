// Le ore di ogni settimana del calendario, e quante stanno oltre il contratto:
//
//   node src/motore/riscontri/check-settimane.mjs
//
// La colonna «ore» del calendario. Non è una regola nuova: deve dire, per
// ogni settimana, le stesse ore oltre il contratto che `computePayByShift` ha
// già assegnato ai turni (supplementari fra 24 e 40, straordinarie oltre).
// Quello che può andare storto è il bordo: le righe del calendario, la
// settimana a cavallo di due mesi, le ferie e le festività.

import { settimaneDelMese } from '../settimane.js';
import { computePayByShift } from '../pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const S = { hourlyRate: 10, expectedWeeklyHours: 24, workingDaysPerWeek: 6, ccnl: 'turismo', overtimeSurchargePct: 30, fullTimeWeeklyHours: 40 };
const turno = (id, date, startTime, endTime) => ({ id, date, startTime, endTime, breakMinutes: 0 });

// Novembre 2026: il 1° è domenica, quindi la prima riga va dal 26 ottobre.
const vuoto = settimaneDelMese(2026, 10, [], null);
esito(vuoto.length === 6 && vuoto[0].dal === '2026-10-26' && vuoto[5].al === '2026-12-06',
  'novembre 2026: sei righe, dal 26 ottobre al 6 dicembre', `${vuoto.length} righe`);

// Settimana del 2 novembre: 7 h al giorno da lunedì a sabato (42 h) e 6 h la domenica.
const turni = [];
for (let d = 2; d <= 7; d += 1) turni.push(turno(`n${d}`, `2026-11-0${d}`, '08:00', '15:00'));
turni.push(turno('n8', '2026-11-08', '10:00', '16:00'));
// Settimana a cavallo con Ognissanti: 30 e 31 ottobre 10 h ciascuno, 1° novembre 6 h.
turni.push(turno('o30', '2026-10-30', '08:00', '18:00'), turno('o31', '2026-10-31', '08:00', '18:00'), turno('n1', '2026-11-01', '10:00', '16:00'));
// Settimana a cavallo senza festività: 30 novembre e 1° dicembre 10 h, 2 dicembre 6 h.
turni.push(turno('n30', '2026-11-30', '08:00', '18:00'), turno('d1', '2026-12-01', '08:00', '18:00'), turno('d2', '2026-12-02', '10:00', '16:00'));
// Settimana del 9: 16 h di ferie e 12 h di lavoro, più una festività non lavorata.
turni.push({ id: 'f9', date: '2026-11-09', type: 'ferie', durationMinutes: 480 }, { id: 'f10', date: '2026-11-10', type: 'ferie', durationMinutes: 480 });
turni.push(turno('n11', '2026-11-11', '08:00', '14:00'), turno('n12', '2026-11-12', '08:00', '14:00'));
turni.push({ id: 'fest', date: '2026-11-13', type: 'festivita', durationMinutes: 240 });
const mappa = computePayByShift(turni, S);
const sett = settimaneDelMese(2026, 10, turni, mappa);
const oltre = (ids) => ids.reduce((s, id) => s + mappa[id].overtimeMinutes + mappa[id].straordinarioMinutes, 0);

esito(sett[1].minuti === 48 * 60, 'settimana del 2: 48 h', `${sett[1].minuti / 60} h`);
esito(sett[1].oltreMinuti === 24 * 60, 'e 24 h oltre il contratto (16 supplementari + 8 straordinarie)', `${sett[1].oltreMinuti / 60} h`);
esito(sett[1].oltreMinuti === oltre(['n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']), 'le stesse ore che il motore ha dato ai turni');
esito(sett[5].minuti === 26 * 60 && sett[5].oltreMinuti === 2 * 60, 'a cavallo di due mesi: si conta intera, coi giorni di dicembre: 26 h, +2',
  `${sett[5].minuti / 60} h, +${sett[5].oltreMinuti / 60}`);
// Il festivo lavorato è un'ora lavorata, ma non riempie le 24 (busta di giugno
// 2026, check-festivo-supplementare.mjs): 26 h in settimana, nessuna oltre.
esito(sett[0].minuti === 26 * 60 && sett[0].oltreMinuti === 0, 'col festivo lavorato (Ognissanti): 26 h, ma +0',
  `${sett[0].minuti / 60} h, +${sett[0].oltreMinuti / 60}`);
// La griglia non mostra i giorni dell'altro mese: la riga dice quante ore ci stanno.
esito(sett[0].fuoriMinuti === 20 * 60 && sett[5].fuoriMinuti === 16 * 60 && sett[1].fuoriMinuti === 0,
  'le ore nei giorni dell\'altro mese: 20 a ottobre, 16 a dicembre', `${sett[0].fuoriMinuti / 60}, ${sett[5].fuoriMinuti / 60}`);
esito(sett[2].minuti === 28 * 60, 'ferie contate, festività non lavorata no: 28 h', `${sett[2].minuti / 60} h`);
esito(sett[2].oltreMinuti === 4 * 60, 'le ferie riempiono le 24: +4', `+${sett[2].oltreMinuti / 60}`);
esito(sett[3].minuti === 0 && sett[3].oltreMinuti === 0, 'settimana senza turni: zero');
esito(settimaneDelMese(2026, 1, [], null).length === 5, 'febbraio 2026, che comincia di domenica: cinque righe',
  `${settimaneDelMese(2026, 1, [], null).length}`);
esito(settimaneDelMese(2027, 1, [], null).length === 4, 'febbraio 2027, che comincia di lunedì: quattro righe',
  `${settimaneDelMese(2027, 1, [], null).length}`);

console.log();
if (falliti) { console.error(`${falliti} casi non tornano.`); process.exit(1); }
console.log('Le ore delle settimane tornano.');
