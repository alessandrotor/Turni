// Fondo pensione e cassa sanitaria trattenuti in busta, riscontrati sulla norma:
//
//   node scripts/check-previdenza.mjs
//
// DA DOVE VIENE
// Nessun cedolino del progetto ha queste voci, quindi il riscontro è sulla
// NORMA, non su una busta, e l'interfaccia lo dice («non ancora riscontrato»).
//   - art. 51 c. 2 lett. h TUIR: i contributi alla previdenza complementare
//     trattenuti dal datore non concorrono al reddito di lavoro dipendente,
//     entro 5.300 € l'anno dal 2026 (L. 199/2025; prima 5.164,57);
//   - art. 51 c. 2 lett. a TUIR: idem per le casse sanitarie di contratto
//     (Fondo Est, FASI...), entro 3.615,20 € l'anno.
// Quindi stanno nel REDDITO dei 15.000 come i contributi INPS
// (check-cu-2025.mjs): chi li versa ha una soglia lorda più alta.
//
// COSA SI VERIFICA
// Che senza i due campi non cambi niente; che il reddito scenda esattamente
// della trattenuta; che la soglia lorda salga e resti l'ultimo euro entro i
// 15.000; che i tetti annui valgano anche spezzati per mese; che il netto
// scenda MENO della trattenuta, perché l'IRPEF cala con lei.

import { redditoComplessivo, calcContributi, calcNetMonthly, monthlyBaseGross } from '../src/utils/net.js';
import { lordoPerReddito } from '../src/utils/soglia-lorda.js';
import { TETTO_FONDO_PENSIONE, TETTO_CASSA_SANITARIA } from '../src/utils/previdenza.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const vicino = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;

const BASE = { hourlyRate: 9.21802, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo' };
const FONDO = { ...BASE, fondoPensionePct: 1.5 };
const CASSA = { ...BASE, cassaSanitariaEuro: 2 };
const LORDO = 16000;

console.log('\nSenza i due campi non cambia niente\n');
esito(redditoComplessivo(LORDO, BASE) === redditoComplessivo(LORDO, { ...BASE, fondoPensionePct: 0, cassaSanitariaEuro: '' }),
  'reddito identico con i campi vuoti');
esito(calcContributi(LORDO, BASE, 0, 12).righe.every((r) => !/Fondo|Cassa/.test(r.label)), 'nessuna riga in più');

console.log('\nIl reddito scende esattamente della trattenuta\n');
const giu = redditoComplessivo(LORDO, BASE) - redditoComplessivo(LORDO, FONDO);
esito(vicino(giu, LORDO * 0.015), 'fondo 1,5% su 16.000 → −240 € di reddito', giu.toFixed(2));
const giuCassa = redditoComplessivo(LORDO, BASE) - redditoComplessivo(LORDO, CASSA);
esito(vicino(giuCassa, 24), 'cassa 2 €/mese → −24 € l\'anno', giuCassa.toFixed(2));

console.log('\nLa soglia lorda dei 15.000 sale\n');
const prima = lordoPerReddito(15000, BASE);
const dopo = lordoPerReddito(15000, FONDO);
esito(dopo > prima, 'col fondo la soglia lorda è più alta', `${prima} → ${dopo}`);
esito(redditoComplessivo(dopo, FONDO) <= 15000 && redditoComplessivo(dopo + 1, FONDO) > 15000,
  'ed è ancora l\'ultimo euro entro i 15.000 di reddito');

console.log('\nI tetti sono annui, anche spezzati per mese\n');
const ricco = { ...BASE, fondoPensionePct: 50, cassaSanitariaEuro: 1000 };
const anno = calcContributi(100000, ricco, 0, 12).righe;
esito(anno.find((r) => r.label === 'Fondo pensione').importo === TETTO_FONDO_PENSIONE, 'fondo: al massimo 5.300 € l\'anno');
esito(vicino(anno.find((r) => r.label === 'Cassa sanitaria').importo, TETTO_CASSA_SANITARIA), 'cassa: al massimo 3.615,20 € l\'anno');
const mese = calcContributi(100000 / 12, ricco, 0, 1).righe.find((r) => r.label === 'Fondo pensione').importo;
esito(vicino(mese, TETTO_FONDO_PENSIONE / 12), 'fondo: al massimo 1/12 nella busta del mese', mese.toFixed(2));
const m = calcContributi(LORDO / 12, FONDO, 0, 1).righe.find((r) => r.label === 'Fondo pensione').importo;
const a = calcContributi(LORDO, FONDO, 0, 12).righe.find((r) => r.label === 'Fondo pensione').importo;
esito(vicino(m * 12, a, 0.07), 'dodici buste fanno l\'anno', `${m} × 12 vs ${a}`);

console.log('\nIn busta: imponibile giù della trattenuta, netto giù di meno\n');
const giorni = 30;
const rif = LORDO;
const senza = calcNetMonthly(LORDO / 12, rif, BASE, giorni);
const con = calcNetMonthly(LORDO / 12, rif, FONDO, giorni);
const trattenuta = con.contributiRighe.find((r) => r.label === 'Fondo pensione')?.importo ?? 0;
esito(trattenuta > 0, 'la riga «Fondo pensione» c\'è', String(trattenuta));
esito(vicino(senza.imponibile - con.imponibile, trattenuta), 'imponibile − trattenuta',
  (senza.imponibile - con.imponibile).toFixed(2));
const perso = senza.net - con.net;
esito(perso > 0 && perso < trattenuta, 'il netto scende meno della trattenuta (l\'IRPEF cala)',
  `${perso.toFixed(2)} su ${trattenuta}`);
esito(monthlyBaseGross(FONDO) === monthlyBaseGross(BASE), 'la paga del contratto non cambia');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
