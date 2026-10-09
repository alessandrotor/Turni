// Il bonus come premio di risultato, tassato a parte:
//
//   node scripts/check-premio-risultato.mjs
//
// DA DOVE VIENE: dalla norma, non da una busta. L. 30 dicembre 2025 n. 199,
// art. 1 c. 9: imposta sostitutiva all'1% sui premi di risultato nel 2026 e nel
// 2027 (5% prima), fino a 5.000 € l'anno. I contributi restano, l'imposta si
// paga sul premio al netto di quelli, e il premio non entra nel reddito
// complessivo (IRPEF, detrazioni, soglia del trattamento integrativo).
// Il bonus della busta di riferimento NON è un premio di risultato: è
// un'indennità nell'imponibile normale (agosto 2026). Per questo il default è
// spento, e il primo controllo dice che spento non cambia niente.

import { nettoDelMese, lordoDelMese } from '../src/utils/net.js';
import { nettoDelMeseConPremio, aliquotaPremio } from '../src/utils/premio-risultato.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const vicino = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;

const S = { hourlyRate: 9.21802, expectedWeeklyHours: 24, fullTimeWeeklyHours: 40, ccnl: 'turismo',
  monthlyBonusAmount: 120, monthlyBonus: { '2026-09': true, '2025-09': true } };
const P = { ...S, bonusPremioRisultato: true };

console.log('\nSpento non cambia niente\n');
const spento = lordoDelMese(890.46, 2026, 8, S);
esito(spento.premioMese === 0 && vicino(spento.lordo, 1010.46), 'il bonus resta nel lordo normale');
esito(JSON.stringify(nettoDelMeseConPremio(spento, S, 30, 2026)) === JSON.stringify(nettoDelMese(spento.lordo, S, 30, 0)),
  'netto identico a nettoDelMese');

console.log('\nAcceso: il premio fuori dall\'IRPEF, dentro i contributi\n');
const acceso = lordoDelMese(890.46, 2026, 8, P);
esito(acceso.premioMese === 120 && vicino(acceso.lordo, 1010.46), 'lordo uguale, 120 € di premio dichiarati');
const n = nettoDelMeseConPremio(acceso, P, 30, 2026);
const senza = nettoDelMese(890.46, P, 30, 0);
esito(n.irpefNetta === senza.irpefNetta && n.imponibile === senza.imponibile, 'IRPEF e imponibile come senza premio',
  `${n.irpefNetta} €`);
esito(n.contributiPremio > 11 && n.contributiPremio < 12.5, 'contributi sul premio, ~9,85%', `${n.contributiPremio} €`);
esito(vicino(n.impostaSostitutiva, (120 - n.contributiPremio) * 0.01), 'imposta 1% sul premio meno contributi',
  `${n.impostaSostitutiva} €`);
esito(vicino(n.net, senza.net + 120 - n.contributiPremio - n.impostaSostitutiva), 'netto = senza premio + premio netto');
const ordinario = nettoDelMese(1010.46, S, 30, 0);
esito(n.net > ordinario.net, 'conviene rispetto all\'IRPEF', `${n.net} contro ${ordinario.net}`);

console.log('\nLa soglia dei 1.250 € si misura senza il premio\n');
const alto = nettoDelMeseConPremio({ lordo: 1300, extraMese: 0, premioMese: 120 }, P, 30, 2026);
esito(alto.esitoTi.spetta && alto.trattamentoIntegrativo > 0, '1.300 € con 120 di premio: 1.180 × 12 sotto i 15.000');

console.log('\nL\'aliquota dell\'anno\n');
esito(aliquotaPremio(2026) === 0.01 && aliquotaPremio(2027) === 0.01, '1% nel 2026 e nel 2027');
esito(aliquotaPremio(2025) === 0.05 && aliquotaPremio(2028) === 0.05, '5% prima e dopo');
const v25 = nettoDelMeseConPremio(lordoDelMese(890.46, 2025, 8, P), P, 30, 2025);
esito(vicino(v25.impostaSostitutiva, (120 - v25.contributiPremio) * 0.05), 'settembre 2025: 5%', `${v25.impostaSostitutiva} €`);
esito(120 * 12 < 5000, 'il tetto annuo non si sfiora con un premio mensile da 120 €', '1.440 € su 5.000');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
