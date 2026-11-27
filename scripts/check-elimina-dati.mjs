// RISCONTRO: «Elimina tutti i dati» lascia il telefono come la prima volta.
//
//   node scripts/check-elimina-dati.mjs
//
// È l'opzione nucleare, e l'unica azione dell'app con la conferma PRIMA
// (components/EliminaDati.jsx): chi la usa vuole il pieno controllo dei suoi
// dati, e una cancellazione che lascia indietro qualcosa senza dirlo è peggio
// di nessuna. Qui gli strumenti del browser sono finti, così si può guardare
// cosa resta, e cosa succede quando uno di loro si rifiuta.
import { eliminaTuttoIlLocale, KEY_SHIFTS, KEY_SETTINGS } from '../src/utils/backup-contenuto.js';

let falliti = 0;
const esito = (ok, etichetta, dettaglio = '') => {
  if (!ok) falliti += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALLITO'} ${etichetta}${dettaglio && !ok ? '  — ' + dettaglio : ''}`);
};

function memoria(voci, rotta = false) {
  const m = new Map(Object.entries(voci));
  return {
    get length() { return m.size; },
    clear() { if (rotta) throw new Error('quota'); m.clear(); },
    chiavi: () => [...m.keys()],
  };
}
function cache(nomi) {
  const s = new Set(nomi);
  return { delete: async (n) => s.delete(n), nomi: () => [...s] };
}
function idb(nomi) {
  const s = new Set(nomi);
  return {
    databases: async () => [...s].map((name) => ({ name })),
    deleteDatabase(n) { const r = {}; setTimeout(() => { s.delete(n); r.onsuccess?.(); }); return r; },
    nomi: () => [...s],
  };
}

console.log('\nTutto via\n');
const ls = memoria({ [KEY_SHIFTS]: '{}', [KEY_SETTINGS]: '{}', turni_calendario: 'griglia', turni_invio_foto: '1' });
const ss = memoria({ turni_ripresa: '{}' });
const cc = cache(['turni-condivisi', 'workbox-precache-v2']);
const db = idb(['keyval-store']);
let r = await eliminaTuttoIlLocale({ localStorage: ls, sessionStorage: ss, caches: cc, indexedDB: db });
esito(r.ok && ls.chiavi().length === 0 && ss.chiavi().length === 0, 'turni, impostazioni, preferenze e ripresa', JSON.stringify(r));
esito(!cc.nomi().includes('turni-condivisi'), 'l\'immagine condivisa in attesa');
esito(db.nomi().length === 0, 'le copie del lettore di immagini');
esito(cc.nomi().includes('workbox-precache-v2'), 'il codice dell\'app resta: senza, offline non si aprirebbe');

console.log('\nQuando qualcosa si rifiuta, lo dice\n');
const rotta = memoria({ [KEY_SHIFTS]: '{}' }, true);
const cc2 = cache(['turni-condivisi']);
r = await eliminaTuttoIlLocale({ localStorage: rotta, sessionStorage: memoria({}), caches: cc2, indexedDB: idb([]) });
esito(!r.ok && r.errori.includes('memoria del browser') && !cc2.nomi().length,
  'la memoria che non si svuota è dichiarata, e il resto si cancella lo stesso', JSON.stringify(r));
r = await eliminaTuttoIlLocale({ localStorage: memoria({ a: 1 }) });
esito(r.ok, 'senza cache né IndexedDB (browser vecchi) non è un errore', JSON.stringify(r));

console.log(falliti ? `\n${falliti} problema/i.\n` : '\nNiente resta indietro senza che lo si dica.\n');
process.exit(falliti ? 1 : 0);
