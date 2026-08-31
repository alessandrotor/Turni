// Riscontro delle regole del primo avvio:
//
//   node scripts/check-primo-avvio.mjs
//
// PERCHÉ ESISTE
// `utils/configurazione.js` decide quando l'app interrompe chi la sta usando.
// Sbagliare in un verso significa non chiedere mai niente e lasciare che i conti
// mentano; sbagliare nell'altro significa interrompere di continuo, che è il
// modo più rapido per far chiudere gli avvisi senza leggerli. Nessuno dei due
// difetti si vede guardando il codice: si vedono qui.
//
// COSA CONTA DAVVERO
// Non che le funzioni «rispondano», ma che rispettino tre proprietà:
//
//  1. una configurazione COMPLETA non deve chiedere niente. Se un avviso
//     compare a chi ha già messo tutto, l'utente impara che gli avvisi si
//     ignorano, e da lì in poi ignorerà anche quelli veri.
//  2. il «non ne ho» deve durare. Una domanda già rifiutata che ritorna è
//     peggio della domanda stessa.
//  3. le assenze non attivano maggiorazioni. Una domenica di ferie non prende
//     il domenicale — è la regola del motore, e l'avviso deve dire la stessa
//     cosa che il motore fa, non una sua approssimazione.

import {
  datiMinimiMancanti, haDatiMinimi, contrattoMancante,
  maggiorazioneDaChiedere, consigliatiMancanti, statoConfigurazione,
} from '../src/utils/configurazione.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

// Configurazione completa di riferimento: part-time 24 h, CCNL turismo, tutte
// le maggiorazioni del contratto impostate.
const COMPLETA = {
  hourlyRate: 9.00738, expectedWeeklyHours: 24, ccnl: 'turismo',
  sundaySurchargePct: 10, holidaySurchargePct: 20, nightSurchargePct: 25,
  overtimeSurchargePct: 30, addComunalePct: 0.8,
};

const feriale = { date: '2026-03-10', startTime: '09:00', endTime: '13:00' };
const domenica = { date: '2026-03-08', startTime: '09:00', endTime: '13:00' };
const notturno = { date: '2026-03-10', startTime: '22:00', endTime: '02:00' };
const primoMaggio = { date: '2026-05-01', startTime: '09:00', endTime: '13:00' };
const feriePorDomenica = { date: '2026-03-08', type: 'ferie', durationMinutes: 240 };

console.log('\nDati minimi — quelli senza cui non si segna un turno\n');

esito(datiMinimiMancanti({}).includes('hourlyRate'), 'app vuota: manca la paga');
esito(datiMinimiMancanti({}).includes('expectedWeeklyHours'), 'app vuota: mancano le ore');
esito(haDatiMinimi(COMPLETA), 'configurazione completa: non manca niente');
esito(!haDatiMinimi({ hourlyRate: 9 }), 'con la sola paga non basta', 'le ore reggono anche le ferie');
esito(haDatiMinimi({ hourlyRate: 9, expectedWeeklyHours: 24 }), 'paga + ore bastano');

// A chiamata non esistono ore settimanali: chiederle sarebbe chiedere un dato
// che quel contratto non ha.
esito(haDatiMinimi({ hourlyRate: 9, onCall: true }), 'a chiamata: le ore non si chiedono');

// Lo zero salvato è il caso di D2 in COSE-NUOVE.md: un campo svuotato salva 0 e
// si rimostra vuoto, quindi sembra il default 40. Deve contare come mancante.
esito(!haDatiMinimi({ hourlyRate: 9, expectedWeeklyHours: 0 }), 'ore a zero = mancanti', 'lo zero invisibile di D2');

console.log('\nContratto — non blocca, ma va chiesto\n');
esito(contrattoMancante({}), 'app vuota: il contratto manca');
esito(!contrattoMancante(COMPLETA), 'scelto: non si chiede più');
esito(contrattoMancante({ ccnl: '' }), 'stringa vuota = mancante', 'è quello che salva D6');

console.log('\nMaggiorazioni — chieste sul turno che le attiva\n');

esito(maggiorazioneDaChiedere(domenica, {})?.tipo === 'domenica', 'turno di domenica, domenicale a zero → si chiede');
esito(maggiorazioneDaChiedere(notturno, {})?.tipo === 'notte', 'turno che tocca la notte → si chiede');
esito(maggiorazioneDaChiedere(primoMaggio, {})?.tipo === 'festivo', '1° maggio → si chiede la festiva');
esito(maggiorazioneDaChiedere(feriale, {}) === null, 'martedì normale → non si chiede niente');

// PROPRIETÀ 1: chi ha già tutto non deve essere interrotto mai.
const mai = [feriale, domenica, notturno, primoMaggio]
  .every((t) => maggiorazioneDaChiedere(t, COMPLETA) === null);
esito(mai, 'configurazione completa: nessun avviso su nessun turno');

// PROPRIETÀ 2: il «non ne ho» dura.
const rifiutata = { ...COMPLETA, sundaySurchargePct: 0, maggiorazioniNonDovute: ['domenica'] };
esito(maggiorazioneDaChiedere(domenica, rifiutata) === null, '«non ne ho» non viene richiesto');
esito(maggiorazioneDaChiedere(notturno, { maggiorazioniNonDovute: ['domenica'] })?.tipo === 'notte',
  'rifiutarne una non zittisce le altre');

// PROPRIETÀ 3: le assenze non attivano niente.
esito(maggiorazioneDaChiedere(feriePorDomenica, {}) === null,
  'domenica di ferie → nessun avviso', 'non ci si è andati');

// Un solo avviso alla volta, anche quando il turno ne attiverebbe due.
const domenicaNotte = { date: '2026-03-08', startTime: '22:00', endTime: '02:00' };
const uno = maggiorazioneDaChiedere(domenicaNotte, {});
esito(uno !== null && typeof uno.tipo === 'string', 'domenica di notte → un avviso solo, non due');

// Un turno a metà compilazione non deve far cadere il form.
esito(maggiorazioneDaChiedere({ date: '', startTime: '', endTime: '' }, {}) === null,
  'turno incompleto → nessun avviso, nessun errore');
esito(maggiorazioneDaChiedere(null, {}) === null, 'nessun turno → nessun avviso');

console.log('\nQuadro d\'insieme\n');

const vuota = statoConfigurazione({});
esito(vuota.quanteMancano > 0 && !vuota.completo, 'app vuota: manca parecchio', `${vuota.quanteMancano} voci`);
const piena = statoConfigurazione(COMPLETA);
esito(piena.completo && piena.quanteMancano === 0, 'configurazione completa: niente da segnalare');

// Chi ha detto «non ne ho» non deve trovarsele fra le cose che mancano: sarebbe
// la stessa domanda, riproposta da un'altra parte.
const senzaNotti = statoConfigurazione({
  ...COMPLETA, nightSurchargePct: 0, maggiorazioniNonDovute: ['notte'],
});
esito(!senzaNotti.consigliatiMancanti.some((c) => c.chiave === 'nightSurchargePct'),
  'una maggiorazione rifiutata non torna fra i consigliati');

// Ogni consigliato deve dire in che direzione sbaglia: è l'informazione che
// rende la segnalazione utile invece che ansiogena.
const tutti = consigliatiMancanti({});
esito(tutti.length > 0 && tutti.every((c) => c.direzione === 'meno' || c.direzione === 'piu'),
  'ogni voce dice se l\'app conta di più o di meno');
esito(tutti.every((c) => typeof c.perche === 'string' && c.perche.length > 20),
  'ogni voce spiega perché conviene sistemarla');

console.log(`\n${falliti === 0 ? '✓ le regole del primo avvio reggono' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
