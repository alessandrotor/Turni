// Riscontro dell'avviso «aggiungila alla Home» su iOS:
//
//   node scripts/check-installazione.mjs
//
// PERCHÉ ESISTE
// Su iPhone Safari cancella lo storage dei siti non aperti per sette giorni, e
// Turni tiene i turni solo lì. L'unica esenzione è l'app aggiunta alla Home.
// L'avviso che lo dice non si può sbagliare in nessuno dei due versi:
//
//  · se tace quando serve, i dati spariscono senza che niente lo segnali —
//    al ritorno dalle ferie l'app è semplicemente vuota;
//  · se parla quando non serve — all'apertura, su un'app vuota, a chi l'ha
//    già installata — insegna a chiudere gli avvisi, e il giorno in cui conta
//    viene chiuso anche questo.
//
// E deve stare al suo posto fra gli altri: un avviso alla volta, e vince chi
// non può tornare.

import { datiARischio, chiedereInstallazioneIOS, chiParlaInAlto } from '../src/utils/installazione.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};

const SAFARI = { nativo: false, ios: true, standalone: false };

console.log('\nChi rischia di perdere i dati\n');
esito(datiARischio(SAFARI) === true, 'iPhone in Safari', 'il 7-Day Cap di WebKit lo riguarda');
esito(datiARischio({ ...SAFARI, standalone: true }) === false, 'iPhone con l\'app sulla Home', 'esente dal limite');
esito(datiARischio({ ...SAFARI, nativo: true }) === false, 'app nativa', 'lo storage lo garantisce il sistema');
esito(datiARischio({ nativo: false, ios: false, standalone: false }) === false, 'Android o desktop', 'nessuna cancellazione a tempo');

console.log('\nQuando chiederlo\n');
esito(chiedereInstallazioneIOS({ ...SAFARI, turni: 0 }) === false,
  'app vuota: niente', 'all\'apertura non si chiede niente');
esito(chiedereInstallazioneIOS({ ...SAFARI, turni: 1 }) === true,
  'primo turno segnato: sì', 'da qui c\'è qualcosa da perdere');
esito(chiedereInstallazioneIOS({ ...SAFARI, turni: 40, rifiutato: true }) === false,
  'un no dura', 'anche con molti turni');
esito(chiedereInstallazioneIOS({ ...SAFARI, standalone: true, turni: 40 }) === false,
  'già installata: niente', 'nessuno deve sentirsi chiedere ciò che ha già fatto');
esito(chiedereInstallazioneIOS({ nativo: false, ios: false, standalone: false, turni: 40 }) === false,
  'fuori da iOS: niente', 'altrove installare è una comodità, non una difesa');

console.log('\nChi parla in alto\n');
esito(chiParlaInAlto({ strisciaInBasso: true, installaIOS: true }) === null,
  'striscia in basso attiva: in alto tace tutto', 'due avvisi insieme sono un muro');
esito(chiParlaInAlto({ installaIOS: true }) === 'installa',
  'iOS batte il promemoria', 'i dati cancellati non tornano, la configurazione sì');
esito(chiParlaInAlto({ installaIOS: false }) === 'promemoria',
  'senza avviso iOS parla il promemoria', '');

// La proprietà che nessun occhio controlla, come in check-avvisi.mjs: ognuno
// dei due deve avere almeno una combinazione in cui tocca a lui. Un ordine che
// ne seppellisse uno per sempre non darebbe nessun errore a schermo.
const combinazioni = [];
for (const strisciaInBasso of [false, true]) {
  for (const installaIOS of [false, true]) combinazioni.push(chiParlaInAlto({ strisciaInBasso, installaIOS }));
}
for (const chi of ['installa', 'promemoria']) {
  esito(combinazioni.includes(chi), `«${chi}» ha almeno un caso in cui parla`, '');
}

console.log();
if (falliti) {
  console.error(`${falliti} caso/i non tornano.`);
  process.exit(1);
}
console.log('Tutti i casi tornano.');
