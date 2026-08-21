// Le percentuali di maggiorazione, misurate su tre anni di cedolini veri:
//
//   node scripts/check-busta-maggiorazioni-reali.mjs
//
// PERCHE'
// Le percentuali del motore venivano da fonti pubbliche e da ricordi. Le fonti
// sul CCNL Turismo si contraddicono (una dava il notturno al 20%, e parlava
// degli alberghi), e un ricordo non e' un riscontro. Qui la domanda si chiude
// nel modo giusto: ogni riga di maggiorazione stampa la propria TARIFFA
// ORARIA, quindi il rapporto con la paga oraria E' la percentuale applicata —
// non una deduzione, una divisione.
//
// COSA DICONO I CEDOLINI
//   notturno              0,25000 esatto su 15 righe   → 25%, e chiude la
//                         questione: non 20%.
//   supplementare         1,30000 esatto su 20 righe   → l'ORA INTERA al 130%,
//                         non una maggiorazione del 30% da aggiungere.
//   festivo lavorato      1,20000 esatto su  6 righe   → anche questo un
//                         totale: 120% dell'ora, non 120% in piu'.
//   magg. festivo 20      0,20000 esatto               → la variante del datore
//                         nuovo, che invece stampa la sola maggiorazione.
//   festivo ordinario     1,00000 esatto               → l'ora base.
//
// L'ECCEZIONE, ed e' l'unica cosa che il motore fa diversamente
// Il domenicale NON e' il 10% della paga oraria piena: e' il 10% della paga
// oraria SENZA il terzo elemento. Sul datore 2024-2025 il rapporto e' 0,99547 —
// che e' esattamente paga base / (paga base + terzo elemento) — e il conto
// torna al quinto decimale. Il datore 2026 invece usa il 10% pieno.
//
// Il motore applica il 10% pieno per tutti, quindi sul contratto vecchio
// sovrastima il domenicale dello 0,45%. Su quindici ore al mese sono sei
// centesimi: e' segnalato qui, non corretto — non si tocca il motore senza che
// sia una decisione presa.

import { fixtureOSalta, vociCome, confronto } from './lib/fixture-buste.mjs';

const TITOLO = 'Percentuali di maggiorazione dai cedolini';

// Marzo 2025 (datore vecchio: notturno, domenicale, supplementare), giugno 2026
// (datore nuovo: festivo lavorato) e febbraio 2026 (che ha il domenicale, che a
// giugno non compare). Insieme coprono tutte le maggiorazioni.
const [vecchio, nuovo, nuovoDom] = fixtureOSalta(TITOLO,
  'cedolino-marzo-25', 'cedolino-giugno-26', 'cedolino-febbraio-26');

const { check, fine } = confronto();
console.log(`\n${TITOLO}\n`);

const paga = (fx) => vociCome(fx, /^Retribuzione$/)[0].numeri[0];
const tariffa = (fx, re) => {
  const v = vociCome(fx, re)[0];
  return v ? v.numeri[0] : null;
};

// ── Le percentuali, come rapporto con la paga oraria ───────────────────────
console.log('Datore 2024–2025 (CCNL Turismo, pubblici esercizi)\n');
{
  const ph = paga(vecchio);
  check('paga oraria del cedolino', ph, 8.44942, 0.000005);
  check('notturno: tariffa / paga oraria', tariffa(vecchio, /Magg\. nott/) / ph, 0.25, 0.00001);
  check('supplementare: ora intera al 130%', tariffa(vecchio, /Supplementare 30/) / ph, 1.30, 0.00001);
}

console.log('\nDatore 2026 (stesso CCNL, voci diverse)\n');
{
  const ph = paga(nuovo);
  check('paga oraria del cedolino', ph, 9.21802, 0.000005);
  check('supplementare: ora intera al 130%', tariffa(nuovo, /Supplementare 30/) / ph, 1.30, 0.00001);
  check('magg. festivo: solo la maggiorazione', tariffa(nuovo, /Magg\. festivo 20/) / ph, 0.20, 0.00001);
  check('festivo ordinario: l’ora base', tariffa(nuovo, /Lavoro festivo ordinario/) / ph, 1.00, 0.00001);
  check('domenicale: 10% pieno (febbraio)',
    tariffa(nuovoDom, /Magg\.Lavoro Domenicale 10/) / paga(nuovoDom), 0.10, 0.00001);
}

// ── Il domenicale del contratto vecchio, e su quale base sta ───────────────
console.log('\nDomenicale 2024–2025: il 10% di che cosa\n');
{
  const ph = paga(vecchio);
  const c = vecchio.contratto;
  const totale = (c.pagaBase || 0) + (c.contingenza || 0) + (c.terzoElemento || 0);
  const senzaTerzo = c.pagaBase / totale;
  const stampata = tariffa(vecchio, /Magg\. dom/);

  check('NON e’ il 10% della paga piena', Math.abs(stampata / ph - 0.10) < 0.00001, false);
  check('paga base / totale tabellare', senzaTerzo, 0.995472, 0.000001);
  check('10% × paga base (senza 3° elem.)', ph * senzaTerzo * 0.10, stampata, 0.00001);

  // Quanto vale l'approssimazione del motore, per sapere se importa.
  const oreDomenicaliTipiche = 15;
  const scartoMese = (ph * 0.10 - stampata) * oreDomenicaliTipiche;
  check('scarto del motore su 15 ore (€)', scartoMese, 0.06, 0.01);
}

fine(TITOLO);
