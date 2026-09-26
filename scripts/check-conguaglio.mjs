// Riscontro della stima del conguaglio di fine anno:
//
//   node scripts/check-conguaglio.mjs
//
// Il conguaglio è la differenza fra quanto il datore trattiene mese per mese
// (lordo del mese × 12, `check-ti-mensile.mjs`) e quanto è dovuto sull'anno.
// Nessuna busta di dicembre è ancora stata letta: questi controlli NON dicono
// che la cifra è giusta, dicono che il modello si comporta come il meccanismo
// che descrive. Il riscontro sulle buste vere arriverà con dicembre 2026.

import { saldoConguaglio, stimaConguaglio, mesiDellAnno, SOGLIA_PARI } from '../src/utils/conguaglio.js';
import { computePayByShift } from '../src/utils/pay.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const S = { hourlyRate: 9.21802, expectedWeeklyHours: 24, ccnl: 'turismo', aziendaDipendenti: 'oltre15' };
const GIORNI = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const anno = (lordi) => lordi.map((lordo, i) => ({ lordo, extra: 0, giorni: lordo > 0 ? GIORNI[i] : 0 }));

console.log('\nIl meccanismo\n');
const stabile = saldoConguaglio(anno(Array(12).fill(1100)), S);
esito(Math.abs(stabile.saldo) < 1, 'reddito uguale tutti i mesi → nessun conguaglio', `${stabile.saldo} €`);

// Mesi sotto 1.250 (bonus accreditato) e mesi sopra, con l'anno oltre 15.000:
// il bonus preso nei mesi bassi non spettava, e torna indietro.
const sale = saldoConguaglio(anno([1100, 1100, 1100, 1100, 1100, 1100, 1900, 1900, 1900, 1900, 1900, 1900]), S);
esito(sale.voci.trattamentoIntegrativo > 0, 'mesi bassi poi alti, anno oltre soglia → il bonus torna indietro',
  `${sale.voci.trattamentoIntegrativo} €`);

// Il caso opposto, verificato in busta a giugno 2026: un mese sopra 1.250 perde
// il bonus, ma se l'anno resta sotto 15.000 a dicembre lo si riceve.
const picco = saldoConguaglio(anno([1100, 1100, 1100, 1100, 1100, 2000, 1100, 1100, 1100, 1100, 1100, 1100]), S);
esito(picco.voci.trattamentoIntegrativo < 0, 'un mese sopra 1.250, anno sotto soglia → bonus a credito',
  `${picco.voci.trattamentoIntegrativo} €`);

// Assunto a luglio: il calcolo annuo misurava la capienza con la detrazione di
// un anno intero, e inventava 500 € di bonus da restituire. IRPEF e bonus
// devono tornare in pari. L'indennità L. 207/24 invece NO, ed è giusto: è una
// percentuale che dipende dalla fascia di reddito dell'anno, e i 6.600 € veri
// stanno in una fascia più generosa dei 13.200 che il datore vede ogni mese.
const luglio = saldoConguaglio(anno([0, 0, 0, 0, 0, 0, 1100, 1100, 1100, 1100, 1100, 1100]), S);
// Resta qualche euro: il calcolo annuo tassa la quota Ente Bilaterale del
// datore (un fringe benefit) su dodici mesi anche per chi ne ha lavorati sei.
// Noto, sotto la soglia «circa in pari»: tollerato, non nascosto.
esito(Math.abs(luglio.voci.irpef + luglio.voci.trattamentoIntegrativo) < 5,
  'assunto a luglio → IRPEF e bonus in pari, niente di inventato', `${luglio.voci.irpef + luglio.voci.trattamentoIntegrativo} €`);
esito(luglio.voci.indennita < 0, '  e l\'indennità L. 207/24 a credito: fascia dell\'anno più bassa', `${luglio.voci.indennita} €`);

// Il bonus a zero per reddito BASSO non è mai stato accreditato: niente da ridare.
const poco = saldoConguaglio(anno([180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180]), S);
esito(poco.voci.trattamentoIntegrativo <= 0.01, 'sotto la no tax area → nessuna restituzione', `${poco.voci.trattamentoIntegrativo} €`);

// Bonus sospeso su richiesta e anno sotto soglia: a dicembre lo si riceve tutto.
const sospeso = saldoConguaglio(anno(Array(12).fill(1100)), { ...S, noTrattamentoIntegrativo: true, tiModo: 'mai' });
esito(sospeso.voci.trattamentoIntegrativo < -1000, 'bonus sospeso e anno sotto soglia → a credito a dicembre',
  `${sospeso.voci.trattamentoIntegrativo} €`);

esito(Math.abs(stabile.voci.irpef + stabile.voci.trattamentoIntegrativo + stabile.voci.indennita - stabile.saldo) < 0.02,
  'le voci sommano al saldo');

console.log('\nLa forchetta\n');
// Un anno di turni vero: gennaio–agosto segnati, settembre–dicembre da stimare.
const turni = [];
for (let m = 0; m < 8; m += 1) {
  for (let g = 1; g <= 26; g += 1) {
    const d = `2026-${String(m + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
    turni.push({ id: d, date: d, startTime: '10:00', endTime: m >= 5 ? '16:00' : '14:00' });
  }
}
const oggi = new Date(2026, 8, 15);
const payMap = computePayByShift(turni, S);
const st = stimaConguaglio({ anno: 2026, allShifts: turni, settings: S, payMap, oggi });
esito(st && st.min <= st.centrale.saldo && st.centrale.saldo <= st.max, 'la stima centrale sta dentro la forchetta',
  st ? `${st.min} ≤ ${st.centrale.saldo} ≤ ${st.max}` : 'nessuna stima');
esito(st && st.max - st.min > 0, 'mesi che restano e bonus accreditato la allargano davvero',
  st ? `larga ${Math.round(st.max - st.min)} €` : '');
const { mesi } = mesiDellAnno({ anno: 2026, allShifts: turni, settings: S, payMap, oggi, scenario: 'contratto' });
esito(mesi[11].extra === 0 || mesi[11].lordo > mesi[10].lordo, 'dicembre porta la 13ª se è impostata', '');
esito(stimaConguaglio({ anno: 2026, allShifts: [], settings: S, payMap: {}, oggi }).min !== undefined,
  'senza turni ma con contratto la stima c\'è', 'dal primo momento utile');
esito(stimaConguaglio({ anno: 2026, allShifts: [], settings: { ...S, hourlyRate: 0 }, payMap: {}, oggi }) === null,
  'senza reddito nell\'anno → nessuna stima', 'niente da dire, non si dice niente');
esito(['pari', 'debito', 'credito', 'incerta'].includes(st?.direzione), 'la direzione è sempre dichiarata',
  `${st?.direzione}, soglia pari ${SOGLIA_PARI} €`);

console.log();
if (falliti) { console.error(`${falliti} caso/i non tornano.`); process.exit(1); }
console.log('Tutti i casi tornano.');
