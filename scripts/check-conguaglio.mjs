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
import { nettoDelMese, calcNetAnnual } from '../src/utils/net.js';
import { rischioRestituzione } from '../src/utils/restituzione.js';
import { calcBonusMargin } from '../src/utils/bonus.js';
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

// Il rapporto ai giorni sta nel MOTORE (`calcNetAnnual`, opzione `giorni`),
// non qui: con l'anno intero il conto dev'essere identico a prima, a ogni
// reddito, perché è quello che usa tutto il resto dell'app.
esito([3000, 9000, 14800, 15500, 22000, 35000].every((g) =>
  JSON.stringify(calcNetAnnual(g, S, { giorni: 365 })) === JSON.stringify(calcNetAnnual(g, S))),
  'motore: con 365 giorni il netto annuo non cambia');
const meta = calcNetAnnual(6600, S, { giorni: 184 });
esito(Math.abs(meta.detrazioneLavoro - calcNetAnnual(6600, S).detrazioneLavoro * 184 / 365) < 0.01,
  'motore: assunto a luglio → detrazione rapportata ai giorni', `${Math.round(meta.detrazioneLavoro)} €`);

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
// Un reddito stabile resta stabile qualunque cosa succeda dopo: la forchetta
// si chiude. È giusto — il conguaglio nasce dai mesi diversi, non dal livello.
esito(st && st.max - st.min < 5, 'reddito stabile → forchetta stretta', st ? `larga ${Math.round(st.max - st.min)} €` : '');

// Un profilo come quello da cui è nata la correzione: montante fino a luglio,
// agosto e settembre segnati. La prima versione variava il SOLO bonus già
// accreditato — bonus dei mesi bassi con l'IRPEF dei mesi alti, una
// combinazione che non esiste — e dava una forchetta larga 960 €.
const conMontante = {
  ...S, hasTredicesima: true, hasQuattordicesima: true, hireDate: '2025-12-29',
  priorTaxableIncome: 9060, priorIncomeDate: '2026-07-01',
};
const turniAS = [];
for (const [m, n] of [['08', 26], ['09', 22]]) {
  for (let g = 1; g <= n; g += 1) {
    const d = `2026-${m}-${String(g).padStart(2, '0')}`;
    turniAS.push({ id: d, date: d, startTime: '10:00', endTime: '15:30' });
  }
}
const sm = stimaConguaglio({
  anno: 2026, allShifts: turniAS, settings: conMontante, payMap: computePayByShift(turniAS, conMontante),
  oggi: new Date(2026, 8, 27),
});
esito(sm && sm.max - sm.min < 300, 'montante: la distribuzione dei mesi muove bonus e IRPEF insieme',
  sm ? `da ${Math.round(sm.min)} a ${Math.round(sm.max)} €, era larga 960` : '');

console.log('\nIl montante e il bonus già preso\n');
// Il profilo da cui è nato il difetto: montante 9.060 € fino a luglio, 14ª a
// 6/12 pagata a giugno. Diviso in sette parti uguali faceva 1.294 € al mese,
// sopra i 1.250: nessun mese col bonus, e il popup diceva «+999 € te li
// ridanno» mentre il riquadro del bonus diceva «888 € presi finora». Le buste
// 2026 (`check-ti-mensile.mjs`) hanno il bonus a febbraio, maggio e luglio e
// non a giugno: è quello che deve uscire togliendo la 14ª prima di dividere.
const reale = { ...conMontante, fixedMonthlyItems: [{ amount: 10 }] };
const pmReale = computePayByShift(turniAS, reale);
const { mesi: mesiReale } = mesiDellAnno({
  anno: 2026, allShifts: turniAS, settings: reale, payMap: pmReale, oggi: new Date(2026, 8, 27),
});
const tiDi = (m) => nettoDelMese(m.lordo, reale, m.giorni, m.extra).trattamentoIntegrativo;
const conBonus = [1, 4, 6].filter((m) => tiDi(mesiReale[m]) > 0).length;
esito(conBonus === 3, 'febbraio, maggio e luglio col bonus, come in busta', `${conBonus} su 3`);
esito(tiDi(mesiReale[5]) === 0 && mesiReale[5].extra > 0, 'giugno senza: porta la 14ª, nel suo mese',
  `lordo ${Math.round(mesiReale[5].lordo)}, di cui 14ª ${Math.round(mesiReale[5].extra)}`);
esito(Math.abs(mesiReale.slice(0, 7).reduce((t, m) => t + m.lordo, 0) - 9060) < 0.01, 'il montante resta esatto');

const sr = stimaConguaglio({ anno: 2026, allShifts: turniAS, settings: reale, payMap: pmReale, oggi: new Date(2026, 8, 27) });
esito(sr.centrale.voci.trattamentoIntegrativo > -600, 'non promette più il bonus di un anno intero',
  `${sr.centrale.voci.trattamentoIntegrativo} €, era −901`);
// Il riquadro del bonus riceve la STESSA cifra: due schermate, un'ipotesi.
const rr = rischioRestituzione({ settings: reale, proiezioneAnnua: 20000, oggi: new Date(2026, 8, 27), erogatoStimato: sr.tiFinora });
esito(rr.erogato === Math.trunc(sr.tiFinora * 100) / 100, 'il riquadro del bonus usa il «finora» del conguaglio',
  `${sr.tiFinora} €, era la quota piena 888`);

// Le colonne del popup: «IRPEF −317 €» da solo non si capiva. Ogni voce è la
// differenza fra quanto è passato nelle buste e quanto è dovuto sull'anno, e
// il perché sta nei mesi che la regola mensile ha deciso diversamente.
const d = sr.centrale.dettaglio;
esito(Math.abs(d.irpef.anno - d.irpef.mesi - sr.centrale.voci.irpef) < 0.02
  && Math.abs(d.trattamentoIntegrativo.mesi - d.trattamentoIntegrativo.anno - sr.centrale.voci.trattamentoIntegrativo) < 0.02
  && Math.abs(d.indennita.mesi - d.indennita.anno - sr.centrale.voci.indennita) < 0.02,
  'ogni voce è «nelle buste» contro «sull\'anno»',
  `IRPEF ${d.irpef.mesi} → ${d.irpef.anno}, bonus ${d.trattamentoIntegrativo.mesi} → ${d.trattamentoIntegrativo.anno}`);
esito(sr.centrale.annoSottoSoglia && sr.mesiSopraSoglia.includes(5) && !sr.mesiSopraSoglia.includes(1),
  'il perché: giugno sopra 1.250, febbraio no, anno sotto i 15.000', `mesi sopra: ${sr.mesiSopraSoglia.join(', ')}`);
esito(stimaConguaglio({ anno: 2026, allShifts: turniAS, payMap: pmReale, oggi: new Date(2026, 8, 27),
  settings: { ...reale, tiModo: 'mai', noTrattamentoIntegrativo: true } }).mesiSopraSoglia === null,
  'bonus deciso a mano → nessun perché mensile');

// UNA proiezione per tutta l'app. Il conguaglio sommava i mesi per conto suo,
// e il riquadro del bonus (che usa `projectAnnualIncome`) diceva «superi i
// 15.000» mentre il popup diceva «resti sotto». Con la proiezione del motore
// l'anno del conguaglio È quella cifra, e il lato della soglia è lo stesso.
for (const proiezione of [14000, 16237.49, 17500]) {
  const sp = stimaConguaglio({
    anno: 2026, allShifts: turniAS, settings: reale, payMap: pmReale, oggi: new Date(2026, 8, 27), proiezioneAnnua: proiezione,
  });
  const bm = calcBonusMargin(proiezione, reale);
  esito(Math.abs(sp.centrale.lordoAnno - proiezione) < 0.02 && sp.centrale.annoSottoSoglia === (bm.taxable <= 15000),
    `proiezione ${proiezione} € → stesso anno e stesso lato della soglia del riquadro`,
    `${sp.centrale.annoSottoSoglia ? 'sotto' : 'sopra'}, bonus ${sp.centrale.voci.trattamentoIntegrativo > 0 ? 'da ridare' : 'a credito'}`);
  esito(sp.min <= sp.centrale.saldo && sp.centrale.saldo <= sp.max, '  e il saldo sta nella forchetta', `${Math.round(sp.min)} ≤ ${Math.round(sp.centrale.saldo)} ≤ ${Math.round(sp.max)}`);
}

// Il bonus copiato dalle buste vale al posto del modello, ma solo per il
// montante a cui si riferisce: spostato il montante, torna il modello.
const noto = stimaConguaglio({
  anno: 2026, allShifts: turniAS, payMap: pmReale, oggi: new Date(2026, 8, 27),
  settings: { ...reale, tiAccreditatoMontante: { importo: 300, fino: '2026-07' } },
});
const modelloMontante = sr.centrale.tiMesi.slice(0, 7).reduce((t, v) => t + v, 0);
esito(Math.abs(noto.centrale.tiAccreditato - (sr.centrale.tiAccreditato - modelloMontante + 300)) < 0.02,
  'il bonus delle buste sostituisce quello stimato', `${Math.round(modelloMontante)} → 300 €`);
const vecchio = stimaConguaglio({
  anno: 2026, allShifts: turniAS, payMap: pmReale, oggi: new Date(2026, 8, 27),
  settings: { ...reale, tiAccreditatoMontante: { importo: 300, fino: '2026-05' } },
});
esito(vecchio.tiMontanteNoto === null && vecchio.centrale.tiAccreditato === sr.centrale.tiAccreditato,
  'riferito a un altro montante → ignorato');

// L'IRPEF PAGATA delle buste del montante. Busta di agosto 2026 (LUL
// Zucchetti, Turismo liv. 5, part-time 60%), riquadro dei progressivi:
// «Imp. INPS 10.358,00 … IRPEF pagata 590,70». Col montante diviso in parti
// uguali (~1.235 € al mese, appena sotto 1.250) ogni mese risultava col
// trattamento integrativo e la detrazione bassa, e l'IRPEF di gennaio–agosto
// veniva ~170 € sopra la busta: giugno e agosto, sopra 1.250, hanno la
// detrazione alta e un'IRPEF quasi nulla (agosto: 8,38 €).
const agosto = { ...reale, priorTaxableIncome: 10358, priorIncomeDate: '2026-08-01' };
const turniSet = turniAS.filter((t) => t.date.startsWith('2026-09'));
const pmSet = computePayByShift(turniSet, agosto);
const senza = stimaConguaglio({ anno: 2026, allShifts: turniSet, settings: agosto, payMap: pmSet, oggi: new Date(2026, 8, 28) });
const irpefStimata = senza.centrale.irpefMesi.slice(0, 8).reduce((t, v) => t + v, 0);
esito(irpefStimata > 590.70 + 100, 'senza la cifra delle buste la stima di gen–ago è troppo alta (il difetto)',
  `${Math.round(irpefStimata)} € contro 590,70 in busta`);
const con = stimaConguaglio({
  anno: 2026, allShifts: turniSet, payMap: pmSet, oggi: new Date(2026, 8, 28),
  settings: { ...agosto, irpefPagataMontante: { importo: 590.70, fino: '2026-08' } },
});
const irpefBuste = con.centrale.irpefMesi.slice(0, 8).reduce((t, v) => t + v, 0);
esito(Math.abs(irpefBuste - 590.70) < 0.01, 'con «IRPEF pagata» gen–ago è la busta, al centesimo', `${irpefBuste.toFixed(2)} €`);
esito(Math.abs(con.centrale.dettaglio.irpef.mesi - (senza.centrale.dettaglio.irpef.mesi - irpefStimata + 590.70)) < 0.02,
  '  e settembre–dicembre restano quelli stimati');
esito(con.min <= con.centrale.saldo && con.centrale.saldo <= con.max, '  e il saldo sta nella forchetta',
  `${Math.round(con.min)} ≤ ${Math.round(con.centrale.saldo)} ≤ ${Math.round(con.max)}`);
const vecchia = stimaConguaglio({
  anno: 2026, allShifts: turniSet, payMap: pmSet, oggi: new Date(2026, 8, 28),
  settings: { ...agosto, irpefPagataMontante: { importo: 590.70, fino: '2026-07' } },
});
esito(vecchia.irpefMontanteNota === null, 'IRPEF di un altro montante → ignorata');
// La soglia dei 15.000 è sul REDDITO (lordo meno contributi): il popup del
// mese la confronta con `redditoAnno`, che deve essere quello del motore.
esito(Math.abs(senza.centrale.redditoAnno - calcNetAnnual(senza.centrale.lordoAnno, agosto).imponibile) < 0.01
  && senza.centrale.annoSottoSoglia === (senza.centrale.redditoAnno <= 15000),
  'il reddito dell\'anno accanto alla soglia è quello del motore', `${senza.centrale.redditoAnno} €`);
esito(senza.busteAnno === 12, 'l\'intestazione conta le buste dell\'anno', `${senza.busteAnno}`);

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
