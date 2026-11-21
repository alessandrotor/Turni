// I permessi (ROL ed ex festività) maturati, sulle buste vere:
//
//   node scripts/check-busta-permessi-2026.mjs
//
// DA DOVE VIENE: buste di settembre e ottobre 2026, LUL Zucchetti, CCNL
// Turismo pubblici esercizi, part-time 60% (24 h su 40), assunzione a fine
// dicembre 2025. Il riquadro RATEI stampa per i permessi:
//   settembre  Maturato 14,40   Goduto 4,50   Saldo  9,90
//   ottobre    Maturato 16,00   Goduto 4,50   Saldo 11,50
// e «Residuo AP» vuoto.
//
// IL RAGIONAMENTO: 16,00 − 14,40 = 1,60 ore al mese, cioè 19,2 l'anno. Il CCNL
// (art. 114) dà 104 ore a tempo pieno, ma agli assunti dal 2018 nei primi 24
// mesi solo 32 (le ex festività). 32 × 24/40 = 19,2: il part-time le
// riproporziona sulle ore settimanali, ed è il dato che il testo del contratto
// non diceva. Dicembre 2025 non matura (in forza meno di 15 giorni): gennaio–
// settembre sono 9 mesi, 9 × 1,60 = 14,40. Quando si passerà al 25° mese
// (gennaio 2028) ci si aspetta 68 × 0,6 = 40,8 l'anno: da verificare allora.

import { maturatoPermessi, scadenzePermessi } from '../src/motore/permessi.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const S = { ccnl: 'turismo', hireDate: '2025-12-29', expectedWeeklyHours: 24, fullTimeWeeklyHours: 40 };

esito(maturatoPermessi(2026, 9, S) === 14.4, 'settembre 2026: maturato 14,40 ore', String(maturatoPermessi(2026, 9, S)));
esito(maturatoPermessi(2026, 10, S) === 16, 'ottobre 2026: maturato 16,00 ore', String(maturatoPermessi(2026, 10, S)));
esito(Math.round((16 - 4.5) * 100) / 100 === 11.5, 'saldo di ottobre = maturato − goduto (11,50)');
esito(maturatoPermessi(2025, 12, S) === 0, 'dicembre 2025, tre giorni in forza: niente');
esito(maturatoPermessi(2026, 12, S) === 19.2, 'l\'anno intero: 19,2 ore (32 × 60%)');
esito(maturatoPermessi(2028, 12, S) === 40.8, 'dal 25° mese, 68 × 60% = 40,8 (dalla norma, da riscontrare nel 2028)');
esito(maturatoPermessi(2026, 12, { ...S, hireDate: '2015-03-01' }) === 62.4, 'assunto prima del 2018: 104 × 60% = 62,4 (dalla norma)');
esito(maturatoPermessi(2026, 12, { ...S, ccnl: '' }) === null, 'senza contratto: nessun permesso da contare');
const sc = scadenzePermessi(2026, S);
esito(sc.godereEntro === '2027-06-30' && sc.pagatiEntro === '2027-09-30', 'quelli del 2026: goderli entro il 30/6/2027, pagati entro settembre 2027');

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nI permessi maturati tornano con le buste.\n');
process.exit(falliti ? 1 : 0);
