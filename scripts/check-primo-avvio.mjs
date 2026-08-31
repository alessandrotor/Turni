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
import { FASCIA_NOTTURNA_DEFAULT, FASCIA_NOTTURNA_POSSIBILE } from '../src/utils/notturno.js';
import ccnl from '../src/data/ccnl.json' with { type: 'json' };

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


// ── Il promemoria di quello che resta ─────────────────────────────────────
//
// Il banner è la parte più facile da sbagliare in modo invisibile: se compare
// quando non deve, l'utente impara a chiuderlo senza leggerlo, e da lì in poi
// chiuderà anche gli avvisi che contano.
console.log('Promemoria dei consigliati');
console.log('');

const quanti = (s) => consigliatiMancanti(s).length;

esito(quanti(COMPLETA) === 0, 'chi ha tutto non ha niente da sistemare');
esito(quanti({}) > 0, 'app appena aperta: qualcosa manca sempre');

// Il contratto NON entra fra i consigliati: ha già il suo avviso sotto il
// totale del mese, e ripeterlo in due posti lo farebbe sembrare più urgente di
// quanto la sua natura rimandabile giustifichi.
esito(!consigliatiMancanti({}).some((c) => c.chiave === 'ccnl'),
  "il contratto non è nell'elenco", 'ha già il suo avviso altrove');

// Le voci nominate devono avere un nome leggibile: è quello che l'utente legge,
// non la chiave.
esito(consigliatiMancanti({}).every((c) => typeof c.etichetta === 'string' && c.etichetta.length > 3),
  'ogni voce ha un nome da leggere, non una chiave');

// Sistemarne una la toglie dall'elenco: senza, il promemoria direbbe lo stesso
// numero dopo che l'utente ha lavorato, ed è il modo più rapido per farlo
// smettere di crederci.
const primaDi = quanti({});
const dopoUna = quanti({ sundaySurchargePct: 10 });
esito(dopoUna === primaDi - 1, "sistemarne una la toglie dall'elenco", primaDi + ' → ' + dopoUna);

// ── La notte, quando il contratto non l'ha detto ───────────────────────────
//
// È l'unica maggiorazione che non si legge dalla data: dipende da una fascia
// oraria, e chi non ha ancora scelto il contratto non ce l'ha detta. La regola
// (vedi `fasciaNotturnaPossibile`) è che finché non si sa si guarda la fascia
// più larga fra quelle che esistono davvero, e si dice «potrebbe».
//
// I due errori non pesano uguale, ed è tutto qui: chiedere per un turno che
// notturno non era costa un tocco; non chiedere per un turno che lo era costa
// soldi ogni mese, in silenzio. Quindi si allarga — ma solo finché non si sa.
console.log('\n  La notte senza contratto\n');

const SENZA_CCNL = { hourlyRate: 9, expectedWeeklyHours: 24 };
const CON_TURISMO = { ...SENZA_CCNL, ccnl: 'turismo' };
const turno = (startTime, endTime, date = '2026-08-25') => ({ date, startTime, endTime });
const chiedeNotte = (shift, settings) => {
  const m = maggiorazioneDaChiedere(shift, settings);
  return !!m && m.tipo === 'notte';
};

esito(chiedeNotte(turno('23:00', '06:30'), SENZA_CCNL),
  '23:00–06:30 senza contratto: lo chiede', 'è il caso di partenza');
esito(!chiedeNotte(turno('10:00', '18:00'), SENZA_CCNL),
  'un turno di giorno non lo chiede mai', "chiedere a sproposito insegna a ignorare gli avvisi");
esito(chiedeNotte(turno('05:30', '09:00'), SENZA_CCNL),
  'anche il primo mattino dentro la fascia larga', 'la notte finisce al più tardi alle 06:30');

// Appena il contratto c'è, si torna alla fascia VERA: il Turismo comincia alle
// 23:00, quindi un turno che finisce alle 23:00 non è notturno e non si chiede.
esito(!chiedeNotte(turno('19:00', '23:00'), CON_TURISMO),
  'col Turismo un turno fino alle 23:00 non lo chiede', 'la fascia del contratto parte da lì');
esito(chiedeNotte(turno('23:00', '06:30'), CON_TURISMO),
  'col Turismo lo stesso turno notturno lo chiede');

// La fascia «possibile» deve contenere tutte quelle che l'app conosce: se un
// domani se ne aggiunge una che comincia prima delle 22:00, questo lo scopre.
const inMinuti = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const note = [FASCIA_NOTTURNA_DEFAULT, ...ccnl.map((c) => c.fasciaNotturna).filter(Boolean)];
const larga = FASCIA_NOTTURNA_POSSIBILE;
esito(note.every((f) => inMinuti(f.inizio) >= inMinuti(larga.inizio)),
  'la fascia larga comincia prima di ogni fascia nota', larga.inizio);
esito(note.every((f) => inMinuti(f.fine) <= inMinuti(larga.fine)),
  'e finisce dopo ogni fascia nota', larga.fine);

// Il testo deve dire la verità sul proprio grado di certezza: «potrebbe» quando
// non si sa, l'affermazione quando si sa. È la differenza fra un avviso che si
// può valutare e uno che si subisce.
const senza = maggiorazioneDaChiedere(turno('23:00', '06:30'), SENZA_CCNL);
const con = maggiorazioneDaChiedere(turno('23:00', '06:30'), CON_TURISMO);
esito(/potrebbe/i.test(senza.titolo), 'senza contratto il titolo dice «potrebbe»', senza.titolo);
esito(!/potrebbe/i.test(con.titolo), 'col contratto lo afferma', con.titolo);
esito(typeof senza.dopo === 'string' && senza.dopo.includes('22:00'),
  'e avvisa con che fascia conterà', 'altrimenti la percentuale entra su una fascia supposta');
esito(con.dopo === null, 'col contratto non c\'è niente da aggiungere');

// Ogni avviso deve poter essere disegnato senza sapere com'è fatto dentro:
// titolo, domanda e costo sono stringhe, sempre.
for (const [nome, m] of [['senza contratto', senza], ['col contratto', con]]) {
  esito(['titolo', 'domanda', 'costo'].every((k) => typeof m[k] === 'string' && m[k].length > 0),
    `${nome}: i testi arrivano già risolti`, 'chi disegna non deve chiamare funzioni');
}

console.log(`\n${falliti === 0 ? '✓ le regole del primo avvio reggono' : falliti + ' controlli falliti'}\n`);
process.exit(falliti > 0 ? 1 : 0);
