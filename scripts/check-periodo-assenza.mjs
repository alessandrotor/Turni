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

import { giorniPeriodo, proponiPeriodo, totalePeriodo, MAX_GIORNI_PERIODO } from '../src/utils/periodo-assenza.js';
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
verifica('tutti selezionati', proposta.every(r => r.selezionato), true, 'i riposi li toglie l utente');
verifica('ore uguali per ogni giorno', new Set(proposta.map(r => r.minuti)).size, 1, 'sempre quelle da contratto');
verifica('ore proposte', proposta[0].minuti, oreGiorno, '');
verifica('turno esistente segnalato', proposta.find(r => r.data === '2026-08-05').turnoEsistente?.id, 't1', 'verra sostituito');
verifica('gli altri giorni sono liberi', proposta.filter(r => r.turnoEsistente).length, 1, '');

console.log('\nTotale mostrato prima di salvare\n');
verifica('settimana intera', totalePeriodo(proposta).minuti, 7 * 240, '28h: una di troppo');
const senzaRiposo = proposta.map((r, i) => i === 6 ? { ...r, selezionato: false } : r);
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

console.log();
if (falliti) {
  console.error(`${falliti} caso/i su ${totale} non tornano.`);
  process.exit(1);
}
console.log(`Tutti i ${totale} casi tornano.`);
