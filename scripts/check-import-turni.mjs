// Cosa entra nell'archivio da un import da foto:
//
//   node scripts/check-import-turni.mjs
//
// Tre difetti trovati il 23/09/2026 leggendo il percorso dalla risposta del
// modello a `setShifts`, nessuno dei quali dava un errore:
//
//  1. l'anno a cavallo di capodanno: il foglio non lo scrive, il modello mette
//     quello in corso, e i turni di gennaio importati a dicembre finivano undici
//     mesi indietro con un'anteprima che mostrava solo giorno e mese;
//  2. il lavoro sopra le ferie: l'import deduplicava su data e orari e basta,
//     mentre ovunque altrove un giorno di assenza esclude il lavoro;
//  3. i campi grezzi del modello (testo, codice, riga, colonna) salvati per
//     sempre nell'archivio e nei backup — e la riga può essere un collega.
//
// Regola in `src/utils/import-turni.js`; qui la si prova, e si controlla che
// App e anteprima passino davvero da lì.

import { readFileSync } from 'node:fs';
import { avvicinaAnno, turniDaImportare } from '../src/utils/import-turni.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

console.log('\nL\'anno a cavallo di capodanno\n');
const DIC = new Date(2026, 11, 28);
const GEN = new Date(2027, 0, 4);
esito(avvicinaAnno('2026-01-05', DIC) === '2027-01-05', 'a dicembre, «5 gennaio» è il prossimo', avvicinaAnno('2026-01-05', DIC));
esito(avvicinaAnno('2027-12-30', GEN) === '2026-12-30', 'a gennaio, «30 dicembre» è il passato', avvicinaAnno('2027-12-30', GEN));
esito(avvicinaAnno('2026-10-15', DIC) === '2026-10-15', 'una data vicina non si tocca');
esito(avvicinaAnno('2026-07-01', DIC) === '2026-07-01', 'sei mesi fa resta dov\'è');
esito(avvicinaAnno('2025-02-29', DIC) === '2025-02-29', 'una data impossibile passa com\'è (la scarta chi chiama)');
esito(avvicinaAnno('2028-02-29', new Date(2027, 2, 1)) === '2028-02-29', 'il 29 febbraio non scivola a marzo');

console.log('\nI giorni già presi e i doppioni\n');
const esistenti = [
  { id: 'f', date: '2026-09-10', type: 'ferie', durationMinutes: 288 },
  { id: 'l', date: '2026-09-11', startTime: '09:00', endTime: '16:00' },
];
const riconosciuti = [
  { date: '2026-09-10', startTime: '09:00', endTime: '16:00', note: '', _riga: 'Mario Rossi', _testoGrezzo: 'x' },
  { date: '2026-09-11', startTime: '09:00', endTime: '16:00', note: '' },
  { date: '2026-09-12', startTime: '09:00', endTime: '16:00', note: 'CASSA', _riga: 'Mario Rossi', _codice: 'C', _colonna: 'Sab 12' },
  { date: '2026-09-12', startTime: '09:00', endTime: '16:00', note: 'CASSA' },
];
const { daSalvare, suAssenza, doppioni } = turniDaImportare(riconosciuti, esistenti);
esito(suAssenza.length === 1 && suAssenza[0].date === '2026-09-10', 'il lavoro sul giorno di ferie si salta');
esito(doppioni === 2, 'già segnato e ripetuto nella foto: due doppioni', String(doppioni));
esito(daSalvare.length === 1 && daSalvare[0].date === '2026-09-12', 'resta un turno solo');

console.log('\nI campi che entrano nell\'archivio\n');
const chiavi = Object.keys(daSalvare[0]).sort().join(',');
esito(chiavi === 'breakMinutes,date,endTime,note,startTime', 'solo i campi del turno', chiavi);
esito(!JSON.stringify(daSalvare).includes('Mario'), 'la riga abbinata non si salva');
esito(daSalvare[0].note === 'CASSA', 'la nota sì');
esito(turniDaImportare([{ date: '2026-09-13', startTime: '09:00', endTime: '10:00', note: 42 }], []).daSalvare[0].note === '',
  'una nota che non è testo diventa vuota');

console.log('\nChi usa la regola\n');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const modale = readFileSync(new URL('../src/components/ImportModal.jsx', import.meta.url), 'utf8');
const servizio = readFileSync(new URL('../src/services/gemini.js', import.meta.url), 'utf8');
esito(/turniDaImportare\(parsedShifts/.test(app), 'App salva passando da turniDaImportare');
esito(/turniDaImportare\(shifts, esistenti\)/.test(modale), 'l\'anteprima conta con la stessa funzione');
esito(/avvicinaAnno\(toIsoDate/.test(servizio), 'il servizio corregge l\'anno');

console.log(`\n${falliti === 0 ? '✓ dalla foto entra solo quello che si è visto' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
