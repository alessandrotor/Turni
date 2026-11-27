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

import { maturatoPermessi, scadenzePermessi, lottiPermessi } from '../src/motore/permessi.js';
import { leggiCedolinoDaRighe } from '../src/utils/leggi-cedolino.js';

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

// Il lettore del cedolino prende il riquadro RATEI com'è stampato (le righe
// come le restituisce il PDF di ottobre; senza residuo dell'anno prima).
const riga = (testo) => ({ testo, pezzi: [] });
const fx = leggiCedolinoDaRighe([
  riga('Ottobre 2026'),
  riga('Residuo AP Maturato Goduto Saldo'),
  riga('Permessi 16,00000 4,50000 11,50000 ORE ARROTONDAMENTO'),
]);
esito(JSON.stringify(fx.ratei?.permessi) === JSON.stringify({ residuo: 0, maturato: 16, goduto: 4.5, saldo: 11.5 }),
  'il lettore prende Permessi: maturato, goduto, saldo', JSON.stringify(fx.ratei));
const storto = leggiCedolinoDaRighe([riga('Residuo AP Maturato Goduto Saldo'), riga('Permessi 16,00000 4,50000 12,00000 ORE')]);
esito(!storto.ratei && storto.avvisi.some((a) => /permessi scartati/.test(a)), 'se il saldo non torna, non lo prende e lo dice');

// I lotti: quali ore usare, ed entro quando, per non farsele liquidare.
const busta = { anno: 2026, mese: 10, residuo: 0, maturato: 16, goduto: 4.5, saldo: 11.5 };
const g = (iso) => new Date(`${iso}T12:00:00`);
const nov = lottiPermessi({ busta, settings: S, oggi: g('2026-11-22') });
esito(nov.lotti.length === 1 && nov.lotti[0].anno === 2026 && nov.totale === 13.1 && nov.lotti[0].pagatiEntro === '2027-09-30',
  'a novembre: 11,50 della busta + il rateo di novembre, da usare entro settembre 2027', JSON.stringify(nov));
const perm = (date, s, e) => ({ date, type: 'permesso', startTime: s, endTime: e });
const conUsati = lottiPermessi({ busta, settings: S, oggi: g('2026-11-22'), turni: [perm('2026-11-10', '09:00', '13:00'), perm('2026-10-05', '09:00', '13:00')] });
esito(conUsati.totale === 9.1, 'un permesso di 4 ore dopo la busta si toglie; quello di ottobre è già nel Goduto', String(conUsati.totale));
const mag = lottiPermessi({ busta, settings: S, oggi: g('2027-05-15') });
esito(mag.lotti.map((l) => l.anno).join() === '2026,2027' && mag.lotti[0].ore === 14.7 && mag.lotti[1].ore === 8,
  'a maggio 2027: 14,7 h del 2026 (entro settembre 2027) e 8 h del 2027 (entro settembre 2028)', JSON.stringify(mag.lotti));
const usaVecchi = lottiPermessi({ busta, settings: S, oggi: g('2027-05-15'), turni: [perm('2027-03-02', '08:00', '18:00')] });
esito(usaVecchi.lotti[0].ore === 4.7 && usaVecchi.lotti[1].ore === 8, 'un permesso si prende dalle ore più vecchie');
const ott = lottiPermessi({ busta, settings: S, oggi: g('2027-10-10') });
esito(ott.pagati.length === 1 && ott.pagati[0].anno === 2026 && ott.lotti[0].anno === 2027, 'a ottobre 2027 quelle del 2026 non godute risultano pagate');
const conAP = lottiPermessi({ busta: { anno: 2027, mese: 3, residuo: 10, maturato: 4.8, goduto: 4, saldo: 10.8 }, settings: S, oggi: g('2027-03-20') });
esito(conAP.lotti[0].anno === 2026 && conAP.lotti[0].ore === 6 && conAP.lotti[1].ore === 4.8, 'col residuo dell\'anno prima il goduto consuma prima quello');

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nI permessi maturati tornano con le buste.\n');
process.exit(falliti ? 1 : 0);
