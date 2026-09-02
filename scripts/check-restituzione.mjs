// Il rischio di restituzione del trattamento integrativo, riscontrato con:
//
//   node scripts/check-restituzione.mjs
//
// PERCHÉ ESISTE
// È l'unico numero dell'app che dice a qualcuno «ti riprendono dei soldi». Se è
// sbagliato per eccesso spaventa senza motivo; se è sbagliato per difetto lascia
// tranquillo chi non dovrebbe esserlo. Le due proprietà che lo tengono onesto e
// che qui si verificano una per una:
//
//   · non è MAI negativo — l'app non deve poter dire «ti restituiscono», che è
//     tutta un'altra cosa e non è mai vera in questo verso;
//   · non supera MAI quello che si presume accreditato — nessuno può doverne
//     ridare più di quanti ne ha presi.
//
// LE CIFRE DI LEGGE, con la fonte
//  · TI massimo 1.200 €/anno, pieno fino a 15.000 € di reddito complessivo;
//    fra 15.000 e 28.000 spetta solo se le detrazioni superano l'imposta lorda,
//    e vale la differenza; oltre 28.000 non spetta.
//  · Erogazione in quote giornaliere: 1.200 ÷ 365 × giorni. Sono i 101,92 € dei
//    mesi da 31 giorni e i 98,63 € di quelli da 30 che si leggono in busta —
//    ed è l'unica parte di questo file riscontrabile su un cedolino vero.
//  · Sopra i 60 € il recupero viene rateizzato dal datore invece che trattenuto
//    tutto insieme.

import {
  rischioRestituzione, giorniTrascorsi, SOGLIA_RATEIZZAZIONE, CAUSA,
} from '../src/utils/restituzione.js';
import { TAX_2026, taxableToGross } from '../src/utils/net.js';

let falliti = 0;
let totale = 0;

function verifica(titolo, avuto, atteso, perche = '') {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  totale++;
  if (!ok) falliti++;
  console.log(`${ok ? '  ok' : 'FAIL'}  ${titolo.padEnd(46)} ${JSON.stringify(atteso)} → ${JSON.stringify(avuto)}  ${perche}`);
}

// Part-time del progetto: CCNL Turismo, contributi standard.
const BASE = {
  ccnl: 'turismo-pubblici-esercizi',
  addRegionalePct: 1.23,
  addComunalePct: 0,
  aziendaDipendenti: 'oltre15',
};
const FINE_ANNO = new Date('2026-12-31T12:00:00');
const META = new Date('2026-06-30T12:00:00');

const r = (opts) => rischioRestituzione({ oggi: FINE_ANNO, settings: BASE, ...opts });

// ── 1. I giorni, che sono la base di tutto ─────────────────────────────────
console.log('\nI giorni trascorsi dell\'anno\n');

verifica('1° gennaio', giorniTrascorsi(new Date('2026-01-01T12:00:00')), 1, 'il primo giorno conta');
verifica('31 gennaio', giorniTrascorsi(new Date('2026-01-31T12:00:00')), 31, '');
verifica('30 giugno', giorniTrascorsi(META), 181, '');
verifica('31 dicembre', giorniTrascorsi(FINE_ANNO), 365, 'l\'anno intero');
verifica('data assurda', giorniTrascorsi('non-una-data'), 0, 'nessuna eccezione');

// La quota di legge: è la cifra che si legge in busta, ed è l'unica parte di
// questo modulo che un cedolino può confermare.
const quota = (giorni) => Math.trunc((TAX_2026.TI_MASSIMO * giorni / 365) * 100) / 100;
verifica('quota di un mese da 31 giorni', quota(31), 101.91, '1.200 × 31/365, troncato come in busta');
verifica('quota di un mese da 30 giorni', quota(30), 98.63, '');
verifica('quota dell\'anno intero', quota(365), 1200, 'il tetto');

// ── 2. Chi non rischia niente ──────────────────────────────────────────────
console.log('\nQuando non c\'è niente da restituire\n');

// Reddito basso: il TI spetta pieno, e quanto preso è quanto dovuto.
const basso = r({ proiezioneAnnua: 12000 });
verifica('reddito basso: niente da restituire', basso.daRestituire, 0, '12.000 lordi, sotto ogni soglia');
verifica('e la causa lo dice', basso.causa, CAUSA.NESSUNA, '');
verifica('lo spettante è il TI pieno', basso.spettante, 1200, '');

// La rinuncia: è il rimedio, e deve azzerare il rischio per COSTRUZIONE, non
// per stima. Anche con un reddito che il TI non lo prevede proprio.
const rinunciato = r({ proiezioneAnnua: 40000, settings: { ...BASE, noTrattamentoIntegrativo: true } });
verifica('chi ha rinunciato non rischia', rinunciato.daRestituire, 0, 'anche a 40.000 lordi');
verifica('erogato zero', rinunciato.erogato, 0, 'non gliel\'hanno mai accreditato');
verifica('e la causa lo dice', rinunciato.causa, CAUSA.RINUNCIATO, '');

// IL FALSO ALLARME che questo blocco esiste per impedire. Sotto la no tax area
// il TI non spetta per INCAPIENZA — non c'è imposta da compensare — ma il
// datore, che fa lo stesso conto, non l'ha mai accreditato. Il primo giro di
// questo modulo confondeva i due zeri e diceva «devi restituire 805 €» a chi
// guadagna 2.150 € l'anno. Trovato provando in Chromium, non ragionandoci sopra.
const povero = r({ proiezioneAnnua: 2150 });
verifica('reddito sotto la no tax area', povero.spettante, 0, 'nessuna imposta da compensare');
verifica('ma non c\'è NIENTE da restituire', povero.daRestituire, 0,
  'zero per incapienza non è zero per troppo reddito');
verifica('ed erogato è zero, non la quota piena', povero.erogato, 0,
  'il datore non l\'ha mai accreditato');
verifica('la causa non allarma', povero.causa, CAUSA.NESSUNA, '');

// ── 3. Chi rischia, e quanto ───────────────────────────────────────────────
console.log('\nQuando invece te li riprendono\n');

// Oltre i 28.000 imponibili il TI non spetta affatto: torna indietro tutto.
const oltre = r({ proiezioneAnnua: 40000 });
verifica('oltre soglia: torna indietro tutto', oltre.daRestituire, 1200, 'un anno intero di quota piena');
verifica('lo spettante è zero', oltre.spettante, 0, '');
verifica('causa dichiarata', oltre.causa, CAUSA.OLTRE_MAX, '');
verifica('ed è rateizzabile', oltre.rateizzabile, true, `1.200 > ${SOGLIA_RATEIZZAZIONE} €`);

// A metà anno si è preso metà quota, e metà quota è quella che torna indietro.
const oltreMeta = r({ proiezioneAnnua: 40000, oggi: META });
verifica('a metà anno, metà quota', oltreMeta.erogato, quota(181), '181 giorni');
verifica('e si restituisce quella', oltreMeta.daRestituire, quota(181), 'niente spetta, tutto torna');

// ── 4. Le due proprietà che tengono onesto il numero ───────────────────────
// Nessun caso, in tutto lo spazio dei redditi e delle date, deve poter produrre
// un numero negativo o più grande di quanto si è preso.
console.log('\nLe due proprietà che non devono cadere mai\n');

let negativi = 0;
let eccedenti = 0;
let casi = 0;
for (let reddito = 0; reddito <= 60000; reddito += 250) {
  for (const giorno of [1, 31, 90, 181, 250, 365]) {
    const d = new Date(Date.UTC(2026, 0, 1, 12));
    d.setUTCDate(giorno);
    const x = rischioRestituzione({ settings: BASE, proiezioneAnnua: reddito, oggi: d });
    casi++;
    if (x.daRestituire < 0) negativi++;
    if (x.daRestituire > x.erogato + 0.001) eccedenti++;
  }
}
verifica(`mai negativo (${casi} casi)`, negativi, 0, 'l\'app non può dire «ti restituiscono»');
verifica(`mai più di quanto preso (${casi} casi)`, eccedenti, 0, 'non si ridà quel che non si è avuto');

// ── 5. La soglia della rateizzazione ───────────────────────────────────────
console.log('\nLa soglia dei 60 €\n');

// Pochi giorni di erogazione: la cifra è piccola e si trattiene in una volta.
const dGen = new Date(Date.UTC(2026, 0, 1, 12));
dGen.setUTCDate(15);
const piccolo = rischioRestituzione({ settings: BASE, proiezioneAnnua: 40000, oggi: dGen });
verifica('49 € non si rateizzano', piccolo.rateizzabile, false, `${piccolo.daRestituire} € ≤ ${SOGLIA_RATEIZZAZIONE}`);
const dFeb = new Date(Date.UTC(2026, 0, 1, 12));
dFeb.setUTCDate(60);
const grande = rischioRestituzione({ settings: BASE, proiezioneAnnua: 40000, oggi: dFeb });
verifica('197 € sì', grande.rateizzabile, true, `${grande.daRestituire} € > ${SOGLIA_RATEIZZAZIONE}`);

// ── 6. La fascia 15.000–28.000, che è quella che inganna ───────────────────
// Qui il TI non è né tutto né niente: dipende dalla capienza, cioè da quanto
// l'imposta lorda mangia le detrazioni. È il caso in cui nessuno sa dire a
// occhio come andrà a finire, ed è il motivo per cui `tiDecision` esiste.
console.log('\nLa fascia di mezzo\n');

const fascia = [18000, 21000, 24000, 27000, 30000].map((lordo) => {
  const x = r({ proiezioneAnnua: lordo });
  return { lordo, spettante: x.spettante, daRestituire: x.daRestituire, causa: x.causa };
});
for (const f of fascia) {
  console.log(`        ${String(f.lordo).padStart(6)} lordi → spetta ${String(f.spettante).padStart(7)} · da restituire ${String(f.daRestituire).padStart(7)}  (${f.causa})`);
}
verifica('la somma spettante+restituito è la quota piena',
  fascia.every((f) => Math.abs(f.spettante + f.daRestituire - 1200) < 0.02), true,
  'quello che non spetta è esattamente quello che torna indietro');
verifica('più si guadagna, più se ne restituisce',
  fascia.every((f, i) => i === 0 || f.daRestituire >= fascia[i - 1].daRestituire), true,
  'monotòna: nessun salto che premia chi guadagna di più');

// Il fatto che la tabella qui sopra sia tutta a zero NON è un difetto: con la
// sola detrazione da lavoro dipendente la capienza nella fascia 15.000–28.000
// non c'è mai, e la norma dice che senza capienza il TI non spetta. È la
// risposta vera alla domanda «da quando lo perdo»: dai 15.000 in su.
// Si asserisce perché è un fatto di dominio, non un effetto collaterale: se un
// giorno cambia (perché arrivano le detrazioni per figli, o cambia la legge),
// deve cadere qui e non passare inosservato in produzione.
verifica('nella fascia di mezzo non spetta mai, con le sole detrazioni da lavoro',
  fascia.filter((f) => f.lordo <= 28000).every((f) => f.spettante === 0), true,
  'la capienza non c\'è: è la norma, non un\'approssimazione');
// La soglia è sull'IMPONIBILE, non sul lordo: 15.000 imponibili sono ~16.5k
// lordi. Confondere le due grandezze è l'errore per cui esiste `check-bonus.mjs`
// («mostrare 15.000 accanto a un lordo farebbe credere di essere sotto soglia
// quando non lo si è più»), e ci sono ricascato scrivendo questo caso.
const sogliaLorda = taxableToGross(TAX_2026.TI_SOGLIA_PIENO, BASE);
verifica('appena sotto la soglia, si tiene tutto',
  r({ proiezioneAnnua: sogliaLorda - 200 }).daRestituire, 0,
  `${Math.round(sogliaLorda)} € lordi = 15.000 imponibili`);
verifica('appena sopra, torna indietro tutto',
  r({ proiezioneAnnua: sogliaLorda + 200 }).daRestituire, 1200,
  'la fascia di mezzo non ha capienza');

console.log(falliti === 0
  ? `\n${totale} controlli: il numero che spaventa è quello giusto.\n`
  : `\n${falliti} problema/i su ${totale}.\n`);
process.exit(falliti === 0 ? 0 : 1);
