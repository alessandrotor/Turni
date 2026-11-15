// L'archivio persistente si chiede al momento giusto, e una volta sola:
//
//   node scripts/check-archivio-persistente.mjs
//
// DA DOVE VIENE: novembre 2026. L'archivio di Turni è il localStorage, e
// Safari può cancellare i dati di un sito non usato per sette giorni se non è
// stato aggiunto alla Home (WebKit, 2020). `navigator.storage.persist()`
// chiede al browser di non farlo. Qui non si misura il browser: si misura la
// regola di QUANDO chiederlo, che è una regola del frictionless — mai
// all'apertura, mai a chi non ha turni, mai due volte.

import { vaChiesta, proteggiArchivio } from '../src/utils/archivio-persistente.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio ? '  — ' + dettaglio : ''}`);
};
const base = { haTurni: true, supportato: true, giaPersistente: false, giaChiesto: false };

esito(vaChiesta(base) === true, 'con un turno salvato e un archivio non protetto, si chiede');
esito(vaChiesta({ ...base, haTurni: false }) === false, 'senza turni non si chiede: all\'apertura non si chiede niente');
esito(vaChiesta({ ...base, giaPersistente: true }) === false, 'se è già persistente non si chiede');
esito(vaChiesta({ ...base, giaChiesto: true }) === false, 'non si chiede due volte nella sessione');
esito(vaChiesta({ ...base, supportato: false }) === false, 'un browser che non lo sa fare non riceve la chiamata');

// Il giro completo, con un browser finto che conta le chiamate.
const finto = (concede) => {
  const s = { chiamate: 0, persistente: false,
    persisted: async () => s.persistente,
    persist: async () => { s.chiamate += 1; s.persistente = concede; return concede; } };
  return s;
};
const vuoto = finto(true);
esito(await proteggiArchivio(false, vuoto) === false && vuoto.chiamate === 0, 'senza turni il browser non viene nemmeno interpellato');
const rifiuta = finto(false);
esito(await proteggiArchivio(true, rifiuta) === false && rifiuta.chiamate === 1, 'col primo turno parte una richiesta');
esito(await proteggiArchivio(true, rifiuta) === false && rifiuta.chiamate === 1, 'dopo un rifiuto non si insiste', String(rifiuta.chiamate));
esito(await proteggiArchivio(true, undefined) === false, 'senza `navigator.storage` non si rompe niente');
const rotto = { persisted: async () => { throw new Error('no'); }, persist: async () => true };
esito(await proteggiArchivio(true, rotto) === false, 'un browser che lancia un errore non rompe l\'app');

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nL\'archivio si protegge dopo il primo turno, una volta.\n');
process.exit(falliti ? 1 : 0);
