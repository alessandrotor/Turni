// La detrazione mese per mese: il grafico di «Perché ogni mese è diverso».
//
//   node src/motore/riscontri/check-mese-per-mese.mjs
//
// DA DOVE VIENE
// Busta Zucchetti di ottobre 2026, CCNL Turismo, part-time 60%: «Detrazioni
// lav.dip. 251,79», nessuna riga di trattamento integrativo. Chi la leggeva
// era convinto che sopra i 15.000 la detrazione fosse più bassa, e non capiva
// perché cambiasse ogni mese. La busta lo dice da sola:
//   - il reddito presunto è il progressivo «Imp. IRPEF» prima di ottobre
//     (11.994,27 − 1.494,95 = 10.499,32) più l'imponibile del mese per i tre
//     mesi che restano e per la 13ª: 10.499,32 + 1.494,95 × 4 = 16.479;
//   - la detrazione annua a quel reddito (art. 13 TUIR, fascia 15–28.000),
//     per i 31 giorni di ottobre su 365, fa 251,79 al centesimo.
// Un dodicesimo a ~15.858 tornava per caso: lo si è creduto per un giorno.
//
// COSA DEVE REGGERE IL GRAFICO
// - un mese vale almeno la paga da contratto, e lo dice (`fonte`);
// - la stima di ogni mese è quella del programma paghe, non una ricostruita;
// - un mese pesante porta la stima sopra i 15.000: più detrazione, niente
//   tratt. integrativo; il mese dopo, tornato normale, scende di nuovo;
// - il premio in tutti i mesi alza la stima di ogni mese.

import { detrazioneMesePerMese } from '../mese-per-mese.js';
import { detrazioneLavoro, monthlyBaseGross } from '../net.js';
import { lordoPresuntoAnno } from '../capienza.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const S = {
  ccnl: 'turismo', expectedWeeklyHours: 24, hourlyRate: 9.21802, overtimeSurchargePct: 30,
  hasTredicesima: true, hireDate: '2025-12-29', aziendaDipendenti: 'oltre15', addizionaliAltrove: true,
  monthlyBonusAmount: 120,
};
const OGGI = new Date(2026, 10, 25);

console.log('\nLa busta di ottobre 2026\n');
const presunto = lordoPresuntoAnno(1494.95, S, { lordo: 10499.32, mesi: 9, mese: 9 });
esito(Math.round(presunto) === 16479, 'stima del datore: 10.499,32 + 1.494,95 × 4', Math.round(presunto));
const ottobre = Math.round(detrazioneLavoro(presunto) * 31 / 365 * 100) / 100;
esito(ottobre === 251.79, 'detrazione di ottobre: annua × 31/365 = 251,79', ottobre.toFixed(2));
esito(detrazioneLavoro(15001) > detrazioneLavoro(15000) + 1000, 'il gradino ai 15.000 va in su',
  `${Math.round(detrazioneLavoro(15000))} → ${Math.round(detrazioneLavoro(15001))}`);

console.log('\nIl grafico\n');
const vuoto = detrazioneMesePerMese({ anno: 2026, settings: S, oggi: OGGI });
esito(vuoto.length === 12 && vuoto.every((m) => m && m.fonte === 'contratto'), 'senza turni: dodici mesi da contratto');
esito(vuoto.every((m) => Math.abs(m.lordo - monthlyBaseGross(S) - (m.mese === 11 ? monthlyBaseGross(S) : 0)) < 0.01),
  'ogni mese vale la mensilità (dicembre con la 13ª)');
esito(vuoto.slice(0, 11).every((m) => !m.sopra && m.ti > 0), 'col solo contratto sotto i 15.000: c\'è il tratt. integrativo');

// Ottobre pesante: 27 giorni da 8 ore, oltre le 24 settimanali.
const turni = [];
for (let d = 1; d <= 31; d += 1) {
  const g = new Date(2026, 9, d).getDay();
  if (g !== 0) turni.push({ id: `o${d}`, date: `2026-10-${String(d).padStart(2, '0')}`, startTime: '09:00', endTime: '17:00', breakMinutes: 0 });
}
turni.push({ id: 'a1', date: '2026-04-07', startTime: '10:00', endTime: '14:00', breakMinutes: 0 });
const mesi = detrazioneMesePerMese({ anno: 2026, allShifts: turni, settings: S, oggi: OGGI });
const [apr, set, ott, nov] = [mesi[3], mesi[8], mesi[9], mesi[10]];
esito(apr.fonte === 'contratto' && Math.abs(apr.lordo - monthlyBaseGross(S)) < 0.01,
  'un turno solo ad aprile: il mese vale il contratto', apr.lordo.toFixed(2));
esito(ott.fonte === 'turni' && ott.sopra && ott.ti === 0, 'ottobre pesante: sopra i 15.000, niente tratt. integrativo',
  `stima ${ott.stima}`);
esito(ott.detrazione > set.detrazione, 'e la detrazione del mese SALE', `${set.detrazione.toFixed(2)} → ${ott.detrazione.toFixed(2)}`);
esito(Math.abs(ott.detrazione - ott.detrazioneAnnua * 31 / 365) < 0.02, 'la detrazione del mese è l\'annua per 31/365');
esito(Math.abs(ott.finora - mesi.slice(0, 9).reduce((t, m) => t + m.lordo, 0)) < 0.01, '«finora» è la somma dei mesi prima');
esito(!nov.sopra && nov.ti > 0, 'novembre torna normale: di nuovo sotto', `stima ${nov.stima}`);

const conPremio = detrazioneMesePerMese({ anno: 2026, allShifts: turni, settings: S, oggi: OGGI, premioOgniMese: true });
esito(conPremio.every((m, i) => m.stima > mesi[i].stima), 'col premio tutti i mesi ogni stima sale');

console.log();
if (falliti) { console.error(`${falliti} casi non tornano.`); process.exit(1); }
console.log('La detrazione mese per mese torna.');
