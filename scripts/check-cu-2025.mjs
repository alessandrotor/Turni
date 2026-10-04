// Cos'è il «reddito complessivo» dei 15.000, deciso su una Certificazione Unica:
//
//   node scripts/check-cu-2025.mjs
//
// LA DOMANDA
// Il trattamento integrativo spetta a chi ha un reddito complessivo fino a
// 15.000 €. Quel reddito è il LORDO in busta, o il lordo meno i contributi?
// Fa una differenza di ~1.600 € di lordo l'anno: con la prima lettura la
// soglia sarebbe 15.000 € lordi, con la seconda ~16.600.
//
// LA RISPOSTA, dalla CU 2026 (redditi 2025) di un lavoratore dipendente,
// Turismo, 359 giorni di lavoro. Si usano solo le cifre, mai i dati personali.
//   imponibile previdenziale (il lordo)       17.360,00
//   contributi a carico del lavoratore          1.693,74
//   «Reddito pari a euro» (punto 1)            15.636,46
//   imposta lorda                               3.596,39
//   detrazione da lavoro dipendente             2.991,69
//   indennità L. 207/24                           750,55
//   imposta netta                                 604,70
//
// Il reddito certificato è il lordo MENO i contributi (art. 51, c. 2, lett. a
// TUIR: i contributi obbligatori non concorrono a formare il reddito), con
// pochi euro di differenza per le voci minori. E non è un'etichetta: imposta,
// detrazione e indennità della CU tornano calcolate su 15.636,46 e NON tornano
// su 17.360. È su questo reddito che si misura la soglia dei 15.000.
//
// Attenzione a non confonderla con la regola MENSILE del programma paghe, che
// è un'altra cosa ed è anch'essa verificata: per decidere il trattamento
// integrativo del mese guarda il lordo × 12 (1.250 € lordi al mese,
// check-ti-mensile.mjs). È una decisione provvisoria: a dicembre il conguaglio
// rifà il conto sul reddito vero, quello di qui sopra.

import { irpefLorda, detrazioneLavoro, cuneoPercent } from '../src/utils/net.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const LORDO = 17360.00;
const CONTRIBUTI = 1693.74;
const REDDITO = 15636.46;
const GIORNI = 359;
const CU = { imposta: 3596.39, detrazione: 2991.69, indennita: 750.55, netta: 604.70 };

const conto = (r) => {
  const imposta = irpefLorda(r);
  const detrazione = detrazioneLavoro(r) * GIORNI / 365;
  return { imposta, detrazione, indennita: r * cuneoPercent(r), netta: imposta - detrazione };
};
const vicino = (a, b, tol = 0.1) => Math.abs(a - b) <= tol;

console.log('\nIl reddito della CU è il lordo meno i contributi\n');
esito(vicino(REDDITO, LORDO - CONTRIBUTI, 0.02 * LORDO), 'reddito ≈ lordo − contributi',
  `${LORDO} − ${CONTRIBUTI} = ${(LORDO - CONTRIBUTI).toFixed(2)}, certificato ${REDDITO}`);
esito(REDDITO < LORDO - 1000, 'e non il lordo', `${(LORDO - REDDITO).toFixed(2)} € di differenza`);

console.log('\nLe cifre della CU tornano sul reddito, non sul lordo\n');
const sulReddito = conto(REDDITO);
const sulLordo = conto(LORDO);
for (const k of Object.keys(CU)) {
  esito(vicino(sulReddito[k], CU[k]), `${k} su ${REDDITO}`, `${sulReddito[k].toFixed(2)} contro ${CU[k]} in CU`);
  esito(!vicino(sulLordo[k], CU[k], 20), `  e non su ${LORDO}`, `verrebbe ${sulLordo[k].toFixed(2)}`);
}

console.log();
if (falliti) { console.error(`${falliti} caso/i non tornano.`); process.exit(1); }
console.log('Tutti i casi tornano.');
