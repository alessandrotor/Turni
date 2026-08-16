// Riscontro del motore netto contro una busta paga REALE, luglio 2026.
//
//   node scripts/check-busta-luglio-2026-fiduciari.mjs
//
// Stessa lavoratrice e stesso CCNL di check-busta-giugno-2026-fiduciari.mjs
// (servizi fiduciari, divisore 173, intermittente), un mese dopo.
//
// Nella busta reale le addizionali NON sono a zero: risultano trattenute
// come "ADDIZ.REG.A.P. 8,29 + ADDIZ.COM.A.P. 5,39 + ADD.COM.ACC./SALDO 1,98
// = 15,66", una rata legata all'anno precedente più un acconto/saldo — non
// una percentuale sul lordo del mese corrente. Il motore approssima con una
// percentuale fissa (qui 2,03%, ≈14,24€): abbastanza vicino da lasciare
// attiva l'aliquota normale (noAddizionali resta false, è per il PRIMO anno
// di lavoro, che non è questo caso).
//
// La differenza più grossa era un'altra voce che il motore non modellava
// affatto: 12,81€ di trattenuta sindacale (quota associativa). Con la nuova
// "trattenuta fissa mensile" generica il netto torna entro ~3€ dal reale.
//
// DATI PERSONALI: solo cifre — ore, aliquote, importi. Nessun nome, codice
// fiscale, indirizzo, IBAN o datore di lavoro. "Quota" è un'etichetta
// generica scelta di proposito: vedi la nota privacy nel piano che ha
// introdotto questa funzione (l'appartenenza sindacale è categoria
// particolare ex art. 9 GDPR, l'app non ha un campo dedicato per non
// etichettarla come tale).

import { calcNetMonthly } from '../src/utils/net.js';

const SETTINGS = {
  hourlyRate: 9.43022,
  onCall: true,
  dailyOvertimeThreshold: 10,
  ccnl: 'vigilanza',
  hasTredicesima: false,
  hasQuattordicesima: false,
  addRegionalePct: 1.23,
  addComunalePct: 0.8,
  tfrInBusta: true,
  fixedMonthlyDeductions: [{ id: '1', label: 'Quota', amount: 12.81 }],
};

// Voci del cedolino:
//   RETRIBUZIONE ORDINARIA  81,00 h × 9,43022 = 763,85
//   LAVORO DOMENICALE 15%    9,50 h × 1,41453 =  13,44
const LORDO = 763.85 + 13.44; // 777,29
const GIORNI = 31;

// Reddito annuo di riferimento: la busta lo colloca fra 8.500 e 15.000 € (il
// cuneo è liquidato al 5,3%, la detrazione piena 1.955 €/anno c'è capienza).
// Con il CCNL selezionato l'imponibile fiscale annualizzato dai turni ci
// cade dentro da solo; qui si fissa un valore in quella fascia per isolare
// il resto della catena, come già fatto per giugno.
const PROIEZIONE = 10192;

let failures = 0;

function check(label, actual, expected, tol) {
  const delta = Math.abs(actual - expected);
  const ok = delta <= tol;
  if (!ok) failures += 1;
  const fmt = (n) => n.toFixed(2).padStart(9);
  console.log(
    `${ok ? '  ok  ' : '  XX  '} ${label.padEnd(38)} ${fmt(actual)}  atteso ${fmt(expected)}  Δ ${delta.toFixed(2)}`,
  );
}

console.log(`\nBusta luglio 2026 — servizi fiduciari, intermittente (lordo ${LORDO.toFixed(2)})\n`);

const n = calcNetMonthly(LORDO, PROIEZIONE, SETTINGS, GIORNI);

check('Contributo IVS', n.contributiRighe.find(r => r.label === 'Contributi IVS')?.importo, 71.41, 0.1);
// FIS e CIGS non sono più una riga scritta a mano nel CCNL: sono contributi di
// LEGGE, calcolati sulla fascia dimensionale dell'azienda (qui oltre 15
// dipendenti, perché la busta paga entrambi), quindi il motore li espone
// separati invece che raggruppati.
//
// La busta li stampa insieme sotto «Altri» per 4,43, che corrisponde a un FIS
// arrotondato a 0,27% tondo dal gestionale paghe. La legge dice 0,80 ÷ 3 =
// 0,2667%, da cui 4,40. I 3 centesimi sono l'arrotondamento di QUEL software,
// non una regola diversa: la busta Turismo verificata calcola lo stesso
// contributo a 0,2667% esatti (3,13 su imponibile 1.173). Si tiene la legge.
const ammortizzatori = n.contributiRighe
  .filter(r => r.label === 'FIS D.Lgs. 148/2015' || r.label === 'Contributo CIGS')
  .reduce((s, r) => s + r.importo, 0);
check('FIS + CIGS (busta: 0,57% = 4,43)', ammortizzatori, 4.43, 0.1);
check('Imponibile fiscale', n.imponibile, 701.45, 0.5);
check('IRPEF lorda (23%)', n.irpefLorda, 161.33, 0.3);
check('IRPEF netta (incapienza)', n.irpefNetta, 0, 0.01);
check('Trattamento integrativo', n.trattamentoIntegrativo, 101.92, 0.1);
check('Indennità L.207/2024 (5,3%)', n.bonusCuneo, 37.18, 0.3);
check('Cuneo: aliquota di fascia', n.cuneoPct, 0.053, 0.0001);
// Scarto noto (già visto a giugno): la formula 1/13,5 − 0,50% è
// un'approssimazione standard, il valore esatto varia con dettagli di CCNL
// che la busta non sempre stampa.
check('TFR netto (quota mese)', n.tfr, 40.58, 1);
check('Trattenuta fissa (quota)', n.trattenuteFisse, 12.81, 0.01);

console.log('\nscarto noto: addizionali a percentuale (~14,24) invece che a rata reale (15,66)\n');
check('Addizionali reg./com. (stima)', n.addRegionale + n.addComunale, 14.24, 0.5);

console.log('\nrisultato finale\n');
check('Netto del mese', n.net, 852.06, 3);

console.log(failures === 0
  ? '\n✓ tutti i riscontri superati: CCNL selezionato + trattenuta fissa tornano entro il residuo noto\n'
  : `\n✗ ${failures} riscontri falliti\n`);
process.exit(failures === 0 ? 0 : 1);
