// Il versamento diretto al fondo pensione, dedotto col 730, riscontrato sulla norma:
//
//   node src/motore/riscontri/check-fondo-pensione.mjs
//
// DA DOVE VIENE
// Il 730 non passa dal cedolino, quindi nessuna busta lo può confermare: il
// riscontro è sulla NORMA, e l'interfaccia deve dirlo.
//   - art. 10 c. 1 lett. e-bis TUIR e art. 8 D.Lgs. 252/2005: i contributi alla
//     previdenza complementare si deducono dal reddito complessivo, entro
//     5.300 € l'anno dal 2026 (L. 199/2025), sommando quelli trattenuti in busta;
//   - art. 13 TUIR: la detrazione da lavoro guarda il reddito complessivo, non
//     l'imponibile dopo le deduzioni; le addizionali invece l'imponibile;
//   - art. 1 DL 3/2020: il trattamento integrativo guarda il reddito
//     complessivo per la soglia e l'imposta LORDA per la capienza. L'imposta
//     lorda è quella sull'imponibile, quindi dopo la deduzione.
//
// COSA SI VERIFICA
// Che senza versamento non cambi niente; che la soglia dei 15.000 non si muova;
// che il risparmio sia l'aliquota marginale; che sotto i 15.000 una deduzione
// troppo grande tolga il trattamento integrativo (e che il versamento migliore
// si fermi prima); che fra 15.000 e 28.000 la deduzione lo faccia crescere;
// che il tetto conti anche il fondo trattenuto in busta.

import { calcNetAnnual } from '../net.js';
import { TETTO_FONDO_PENSIONE } from '../previdenza.js';
import { effettoVersamento, versamentoMigliore, spazioDeducibile } from '../fondo-pensione.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const S = { ccnl: 'turismo' };

console.log('\nSenza versamento, il motore di sempre\n');
for (const g of [8000, 14000, 16600, 25000]) {
  const a = calcNetAnnual(g, S), b = calcNetAnnual(g, S, { deduzioni: 0 });
  esito(a.net === b.net && a.trattamentoIntegrativo === b.trattamentoIntegrativo, `${g} € lordi: identico`);
}

console.log('\nLa deduzione tocca l\'imposta, non il reddito\n');
const a = calcNetAnnual(16000, S), b = calcNetAnnual(16000, S, { deduzioni: 2000 });
esito(a.imponibile === b.imponibile, 'il reddito complessivo (soglia dei 15.000) resta quello');
esito(a.detrazioneLavoro === b.detrazioneLavoro, 'la detrazione da lavoro resta quella');
esito(a.bonusCuneo === b.bonusCuneo, 'l\'Indennità L. 207/24 resta quella');
esito(b.irpefLorda < a.irpefLorda, 'l\'imposta lorda scende');

console.log('\nIl risparmio è l\'aliquota marginale (23% + addizionali)\n');
const e = effettoVersamento(15500, S, 1000);
esito(e.voci.irpef === 230, '1.000 € a 15.500 lordi: 230 € di IRPEF', String(e.voci.irpef));
esito(e.voci.addizionali > 0 && e.voci.trattamentoIntegrativo === 0, 'più le addizionali, tratt. integrativo intatto', JSON.stringify(e.voci));
esito(e.risparmio === e.voci.irpef + e.voci.addizionali + e.voci.trattamentoIntegrativo, 'le voci sommano al risparmio');

console.log('\nSotto i 15.000: troppo versamento toglie il tratt. integrativo\n');
const basso = versamentoMigliore(12000, S);
esito(basso.perdeTiDa !== null && basso.perdeTiDa < basso.massimo, '12.000 € lordi: oltre un certo versamento lo si perde', String(basso.perdeTiDa));
esito(basso.migliore < basso.perdeTiDa, 'il versamento migliore si ferma prima', `${basso.migliore} < ${basso.perdeTiDa}`);
esito(effettoVersamento(12000, S, basso.perdeTiDa).risparmio < effettoVersamento(12000, S, basso.migliore).risparmio,
  'versare di più fa risparmiare di meno');
const sottoNoTax = versamentoMigliore(9000, S);
esito(sottoNoTax.migliore === 0 && sottoNoTax.risparmioMigliore === 0, 'sotto la no tax area non c\'è niente da dedurre');

console.log('\nFra 15.000 e 28.000: la deduzione fa crescere il tratt. integrativo\n');
const medio = effettoVersamento(18000, S, 5000);
esito(medio.voci.trattamentoIntegrativo > 0, '18.000 € lordi, 5.000 versati', JSON.stringify(medio.voci));

console.log('\nIl tetto conta anche il fondo in busta\n');
esito(spazioDeducibile(16000, S) === TETTO_FONDO_PENSIONE, 'senza fondo in busta: tutti i 5.300 €');
const conBusta = spazioDeducibile(16000, { ...S, fondoPensionePct: 2 });
esito(conBusta === TETTO_FONDO_PENSIONE - 320, 'col 2% in busta su 16.000: 320 € in meno', String(conBusta));
esito(effettoVersamento(16000, S, 99999).versamento === TETTO_FONDO_PENSIONE, 'oltre il tetto non si deduce');

console.log(falliti ? `\n${falliti} riscontro/i FALLITO/I\n` : '\nTutto torna.\n');
process.exit(falliti ? 1 : 0);
