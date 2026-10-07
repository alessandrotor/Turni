// Sotto i 1.250 € al mese il trattamento integrativo NON spetta sempre:
//
//   node scripts/check-ti-capienza.mjs
//
// IL DIFETTO, ottobre 2026
// Mese a metà, 534 € di lordo: il riquadro diceva «resti sotto i 1.250 € lordi:
// c'è il tratt. integrativo», e nel netto il trattamento non c'era. Il motore
// aveva ragione, la frase no: la regola del mese (lordo × 12, check-ti-mensile)
// è una condizione, non la sola. Sotto i 15.000 il trattamento spetta solo se
// l'IRPEF lorda supera la detrazione da lavoro meno 75 € (DL 3/2020, art. 1:
// la «capienza»). 534 × 12 = 6.408 €: le detrazioni azzerano già l'imposta,
// non c'è niente da integrare. Il datore che fa i conti su lordo × 12 non lo
// eroga; a dicembre, se l'anno è capiente, lo restituisce col conguaglio.
//
// DA DOVE VIENE: dalla norma e dallo stesso motore che fa il netto. Non c'è
// una busta così bassa nel progetto: la soglia mensile si dice con la tilde.
//
// E POI, sul PROGRESSIVO (capienza.js). Chi mantiene il progetto: la capienza
// è quella costruita nell'anno fino a quel mese, non quella del solo mese; e a
// inizio anno, senza progressivo, il datore il trattamento lo dà e smette dopo
// se serve. Quindi 534 € dopo nove mesi pieni HANNO il trattamento; 534 € dopo
// nove mesi da 300 € no. Non ancora riscontrato su una busta.
//
// COSA SI VERIFICA
// Che il caso dello schermo non dica più «c'è» (`senzaCapienza`); che la soglia
// mensile che l'app scrive sia proprio il primo euro in cui il netto contiene
// il trattamento; e che torni col conto a mano sulla norma.

import { nettoDelMese, TAX_2026, deductibleContribRate } from '../src/utils/net.js';
import { lordoMeseMinimoTi } from '../src/utils/soglia-lorda.js';
import { capienzaProgressiva, nettoSimulandoTi } from '../src/utils/capienza.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const TURISMO = { hourlyRate: 9.21802, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo' };
const mese = (lordo, s = TURISMO) => nettoDelMese(lordo, s, 31);

console.log('\nIl caso dello schermo: 534 € a metà mese\n');
const basso = mese(534.04);
esito(basso.esitoTi.spetta, 'la regola del mese dice sì', `${basso.esitoTi.proiezione} € sotto i 15.000`);
esito(basso.trattamentoIntegrativo === 0, 'ma il trattamento è zero');
esito(basso.esitoTi.senzaCapienza === true, 'e il motore dice perché: senza capienza');
esito(basso.irpefNetta === 0, 'l\'IRPEF è già azzerata dalle detrazioni', String(basso.irpefNetta));

console.log('\nLa soglia mensile che l\'app scrive\n');
const minimo = lordoMeseMinimoTi(TURISMO);
esito(minimo !== null && minimo < TAX_2026.TI_SOGLIA_PIENO / 12, 'esiste ed è sotto i 1.250', String(minimo));
esito(mese(minimo).trattamentoIntegrativo > 0 && mese(minimo - 1).trattamentoIntegrativo === 0,
  'è il primo euro col trattamento nel netto');
esito(mese(minimo).esitoTi.senzaCapienza === false && mese(minimo - 1).esitoTi.senzaCapienza === true,
  'e lì cambia anche `senzaCapienza`');
// A mano: 23% × reddito > 1.955 − 75 → reddito > 8.174 €; in lordo, diviso per
// la quota che resta dopo i contributi, e per dodici.
const aMano = (TAX_2026.DETR_LAV_FISSA - TAX_2026.TI_CAPIENZA_SCONTO) / 0.23 / (1 - deductibleContribRate(TURISMO)) / 12;
esito(Math.abs(minimo - aMano) <= 15, 'torna col conto a mano sulla norma', `${minimo} vs ~${aMano.toFixed(0)}`);

console.log('\nSul progressivo dell\'anno\n');
const conProg = (lordo, prima) => nettoDelMese(lordo, TURISMO, 31, 0,
  capienzaProgressiva(lordo, TURISMO, { lordo: prima.reduce((t, v) => t + v, 0), mesi: prima.length }));
const dopoPieni = conProg(534.04, Array(9).fill(1100));
esito(dopoPieni.trattamentoIntegrativo > 0 && !dopoPieni.esitoTi.senzaCapienza,
  '534 € dopo nove mesi da 1.100: c\'è', String(dopoPieni.trattamentoIntegrativo));
esito(dopoPieni.trattamentoIntegrativo === mese(1000).trattamentoIntegrativo, 'ed è la quota piena del mese');
const dopoBassi = conProg(534.04, Array(9).fill(300));
esito(dopoBassi.trattamentoIntegrativo === 0 && dopoBassi.esitoTi.senzaCapienza,
  '534 € dopo nove mesi da 300: no', `media ${dopoBassi.esitoTi.media} €`);
esito(dopoBassi.esitoTi.media < minimo, 'e la media sta sotto la soglia che l\'app scrive', `${dopoBassi.esitoTi.media} < ${minimo}`);
const gennaio = conProg(300, []);
esito(gennaio.trattamentoIntegrativo > 0 && gennaio.esitoTi.media === null, 'primo mese dell\'anno, anche basso: lo danno');
const alSoglia = (m) => conProg(m, Array(5).fill(m)).trattamentoIntegrativo > 0;
esito(alSoglia(minimo) && !alSoglia(minimo - 1), 'media costante: la soglia è la stessa del mese da solo');

console.log('\nGli altri due casi restano com\'erano\n');
const pieno = mese(1000);
esito(pieno.trattamentoIntegrativo > 0 && !pieno.esitoTi.senzaCapienza, '1.000 €: c\'è', String(pieno.trattamentoIntegrativo));
const alto = mese(1400);
esito(!alto.esitoTi.spetta && !alto.esitoTi.senzaCapienza && alto.trattamentoIntegrativo === 0, '1.400 €: sopra la regola, niente');

console.log('\nLa simulazione del riquadro (NetPillole)\n');
// Toccare il riquadro forza il trattamento presente o assente: il netto deve
// cambiare ESATTAMENTE della sua quota, e il resto della busta restare uguale.
for (const lordo of [534.04, 1000, 1400]) {
  const con = nettoSimulandoTi(lordo, TURISMO, 31, 0, null, true);
  const senza = nettoSimulandoTi(lordo, TURISMO, 31, 0, null, false);
  const vero = mese(lordo);
  esito(con.trattamentoIntegrativo === mese(1000).trattamentoIntegrativo && senza.trattamentoIntegrativo === 0
    && Math.abs(con.net - senza.net - con.trattamentoIntegrativo) < 0.005
    && con.trattenute === vero.trattenute && senza.trattenute === vero.trattenute,
    `${lordo} €: presente o assente, il netto cambia della sola quota`, `${con.net} / ${senza.net}`);
}

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
