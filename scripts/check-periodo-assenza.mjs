// Riscontro delle assenze a periodo, da eseguire con:
//
//   node scripts/check-periodo-assenza.mjs
//
// Due domande, e la seconda è quella che potrebbe costare soldi veri:
//
//  1. l'elenco dei giorni è quello giusto, anche a cavallo dei mesi e nei due
//     fine settimana in cui l'ora legale rende un giorno lungo 23 o 25 ore;
//  2. cinque giorni di malattia inseriti COME PERIODO valgono esattamente
//     quanto cinque inserimenti singoli. Se il periodo spezzasse l'evento, la
//     carenza ripartirebbe da capo e la paga sarebbe sbagliata.

import { giorniPeriodo, proponiPeriodo, totalePeriodo, giorniDiRiposo, MAX_GIORNI_PERIODO } from '../src/utils/periodo-assenza.js';
import { minutiGiornoAssenza } from '../src/utils/assenze.js';
import { computePayByShift } from '../src/utils/pay.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  const mostra = (v) => Array.isArray(v) ? `[${v.length}]` : String(v);
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(40)} atteso ${mostra(atteso).padStart(6)} → ${mostra(avuto).padStart(6)}  ${perche}`);
  if (!ok && Array.isArray(avuto)) console.log('        avuto:', avuto.join(' '), '\n        atteso:', atteso.join(' '));
}

// ── 1. L'elenco dei giorni ─────────────────────────────────────────────────
console.log('\nGiorni del periodo\n');

verifica('un giorno solo', giorniPeriodo('2026-08-03', '2026-08-03'), ['2026-08-03'], 'come inserirlo a mano');
verifica('una settimana', giorniPeriodo('2026-08-03', '2026-08-09').length, 7, 'estremi inclusi');
verifica('a cavallo di due mesi', giorniPeriodo('2026-07-30', '2026-08-02'),
  ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'], 'luglio finisce, agosto comincia');
verifica('date invertite', giorniPeriodo('2026-08-10', '2026-08-03'), [], 'nessun giorno, non un errore');
verifica('data non valida', giorniPeriodo('2026-13-01', '2026-13-05'), [], 'mese inesistente');
verifica('data vuota', giorniPeriodo('', '2026-08-05'), [], '');
verifica('anno bisestile', giorniPeriodo('2028-02-28', '2028-03-01'),
  ['2028-02-28', '2028-02-29', '2028-03-01'], 'il 29 febbraio esiste');
verifica('refuso sull anno, tetto', giorniPeriodo('2026-08-03', '2036-08-03').length, MAX_GIORNI_PERIODO,
  'un elenco assurdo si vede, ma non genera migliaia di record');

// Ora legale: due giorni consecutivi distano 23 o 25 ore, e sommare 24 ore
// sbaglierebbe proprio qui.
console.log('\nCambio dell ora legale\n');
verifica('marzo, il giorno si accorcia', giorniPeriodo('2026-03-28', '2026-03-30'),
  ['2026-03-28', '2026-03-29', '2026-03-30'], 'nessun giorno saltato');
verifica('ottobre, il giorno si allunga', giorniPeriodo('2026-10-24', '2026-10-26'),
  ['2026-10-24', '2026-10-25', '2026-10-26'], 'nessun giorno doppio');

// ── 2. La proposta ─────────────────────────────────────────────────────────
console.log('\nProposta: ore e giorni gia occupati\n');

// Part-time 60% CCNL Turismo: 24 ore su sei giorni = quattro ore al giorno.
const settings = { expectedWeeklyHours: 24, workingDaysPerWeek: 6 };
const oreGiorno = minutiGiornoAssenza(settings);
verifica('ore di una giornata', oreGiorno, 240, '24h su 6 giorni = 4h');

const turni = [{ id: 't1', date: '2026-08-05', startTime: '06:00', endTime: '14:00' }];
const proposta = proponiPeriodo({ dal: '2026-08-03', al: '2026-08-09', turni, settings });

verifica('giorni proposti', proposta.length, 7, 'la settimana intera');
verifica('sei selezionati, il riposo no', proposta.filter(r => r.selezionato).length, 6, 'un riposo ogni sette giorni');
verifica('  senza storico, la domenica', proposta.find(r => r.riposo)?.data, '2026-08-09', 'la regola di legge');
verifica('ore uguali per ogni giorno', new Set(proposta.map(r => r.minuti)).size, 1, 'sempre quelle da contratto');
verifica('ore proposte', proposta[0].minuti, oreGiorno, '');
verifica('turno esistente segnalato', proposta.find(r => r.data === '2026-08-05').turnoEsistente?.id, 't1', 'verra sostituito');
verifica('gli altri giorni sono liberi', proposta.filter(r => r.turnoEsistente).length, 1, '');

console.log('\nTotale mostrato prima di salvare\n');
verifica('settimana intera', totalePeriodo(proposta).minuti, 6 * 240, '24h, l orario settimanale');
const senzaRiposo = proposta;
verifica('tolto il riposo', totalePeriodo(senzaRiposo).giorni, 6, '');
verifica('  e le ore tornano', totalePeriodo(senzaRiposo).minuti, 24 * 60,
  'esattamente l orario settimanale: e la prova che il conto e giusto');

// ── 3. La malattia a periodo non spezza la carenza ─────────────────────────
console.log('\nMalattia: periodo contro inserimenti singoli\n');

const impostazioniMalattia = {
  hourlyRate: 10, expectedWeeklyHours: 24, workingDaysPerWeek: 6,
  malattiaCarenzaGiorni: 3, malattiaCarenzaPct: 0, malattiaPct: 100,
};

const daPeriodo = proponiPeriodo({ dal: '2026-06-08', al: '2026-06-12', settings: impostazioniMalattia })
  .map((r, i) => ({ id: `per${i}`, date: r.data, type: 'malattia', durationMinutes: r.minuti }));

const aMano = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12']
  .map((date, i) => ({ id: `man${i}`, date, type: 'malattia', durationMinutes: minutiGiornoAssenza(impostazioniMalattia) }));

const somma = (lista) => {
  const map = computePayByShift(lista, impostazioniMalattia);
  return Math.round(Object.values(map).reduce((t, p) => t + p.base + p.surcharge, 0) * 100) / 100;
};

verifica('giorni generati', daPeriodo.length, 5, '');
verifica('stessi euro degli inserimenti singoli', somma(daPeriodo), somma(aMano),
  'il periodo non spezza l evento, la carenza non riparte');
verifica('  e la carenza morde davvero', somma(aMano) < 5 * 4 * 10, true,
  'i primi 3 giorni non sono pagati: il confronto sopra non e banale');

// ── Il riposo settimanale, dallo storico ───────────────────────────────────
// Settembre 2026: ferie dal 31 agosto al 13 settembre segnate tutte, 13 giorni
// a settembre invece di 11. Il riposo non è ferie (D.Lgs. 66/2003 art. 9, e la
// settimana di sei del Turismo), e nel Turismo chi fa turni lavora spesso la
// domenica: il giorno si prende da quello in cui si lavora meno.
console.log('\nIl riposo settimanale\n');
const storico = [];
for (let g = 1; g <= 31; g++) {
  const d = new Date(2026, 6, g);
  if (d.getDay() !== 2) storico.push({ id: `l${g}`, date: `2026-07-${String(g).padStart(2, '0')}`, startTime: '10:00', endTime: '15:00' });
}
verifica('storico col martedì libero', giorniDiRiposo(storico, settings), [2], 'si lavora di domenica');
verifica('poco storico: la domenica', giorniDiRiposo(storico.slice(0, 5), settings), [0], 'non abbastanza per dirlo');
verifica('settimana corta: due riposi', giorniDiRiposo([], { workingDaysPerWeek: 5 }), [0, 6], 'domenica e sabato');
verifica('sette giorni su sette: nessuno', giorniDiRiposo([], { workingDaysPerWeek: 7 }), [], '');
const ferie = proponiPeriodo({ dal: '2026-08-31', al: '2026-09-13', turni: storico, settings });
const settembre = ferie.filter(r => r.selezionato && r.data >= '2026-09-01');
verifica('31 ago – 13 set: giorni di ferie a settembre', settembre.length, 11, 'due riposi, uno a settimana');
verifica('  e non sono le domeniche', ferie.filter(r => r.riposo).map(r => r.data), ['2026-09-01', '2026-09-08'], 'i martedì, come nello storico');

// LE FESTIVITÀ dentro le ferie: CCNL Turismo, «dal computo delle ferie si
// escludono le giornate di riposo settimanale e le festività nazionali e
// infrasettimanali» (art. 134 Fipe/Federalberghi, 116 Confsal). In busta sono
// una festività, giustificativo a sé (check-festivita.mjs).
console.log('\nLe festività dentro le ferie\n');
const agosto = proponiPeriodo({ dal: '2026-08-10', al: '2026-08-23', turni: storico, settings });
verifica('10–23 agosto: Ferragosto non è ferie', agosto.find(r => r.data === '2026-08-15')?.selezionato, false, 'festività nazionale');
verifica('  e si dice perché', agosto.find(r => r.data === '2026-08-15')?.festivita, true, '');
verifica('  ferie: 14 giorni − 2 riposi − Ferragosto', agosto.filter(r => r.selezionato).length, 11, '');
const patrono = proponiPeriodo({ dal: '2026-06-29', al: '2026-06-29', turni: [], settings: { ...settings, patronSaintDate: '06-29' } });
verifica('il santo patrono impostato conta', patrono[0].selezionato, false, '29 giugno a Roma');
const conRiposo = proponiPeriodo({ dal: '2026-12-21', al: '2026-12-27', turni: [], settings });
verifica('settimana di Natale: due festività e il riposo', conRiposo.filter(r => !r.selezionato).map(r => r.data),
  ['2026-12-25', '2026-12-26', '2026-12-27'], 'Natale, S. Stefano e la domenica');




console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
