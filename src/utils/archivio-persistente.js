// L'archivio è il localStorage, e il browser può svuotarlo da solo: Safari
// cancella i dati di un sito non usato per sette giorni se non è in Home, e
// qualunque browser lo fa quando il telefono è a corto di spazio. Si chiede
// quindi al browser di tenerli in modo PERSISTENTE (`navigator.storage.persist`).
//
// Quando: mai all'apertura, e non a chi non ha ancora niente da perdere. La
// richiesta parte dopo il primo turno salvato, una volta per sessione, e solo
// se l'archivio non è già persistente. Chrome e Safari decidono da soli senza
// mostrare niente; Firefox mostra una sua domanda, che così arriva dopo
// l'azione e non durante. Un rifiuto lo ricorda il browser: non si insiste.
// Non è una garanzia: il backup resta la sola copia fuori dal telefono.
// → scripts/check-archivio-persistente.mjs

/**
 * La regola, pura: si chiede adesso?
 * @param {{ haTurni: boolean, supportato: boolean, giaPersistente: boolean, giaChiesto: boolean }} p
 */
export function vaChiesta({ haTurni, supportato, giaPersistente, giaChiesto }) {
  return haTurni && supportato && !giaPersistente && !giaChiesto;
}

let giaChiesto = false; // una volta per sessione

/**
 * Chiede al browser l'archiviazione persistente, se è il momento.
 * @param {boolean} haTurni
 * @param {any} [storage] `navigator.storage`; passato a mano nei riscontri
 * @returns {Promise<boolean>} se alla fine l'archivio è persistente
 */
export async function proteggiArchivio(haTurni, storage = globalThis.navigator?.storage) {
  const supportato = typeof storage?.persist === 'function' && typeof storage?.persisted === 'function';
  if (!supportato) return false;
  try {
    // Il segno si mette PRIMA di attendere: due chiamate vicine passavano tutte e due.
    const prima = giaChiesto;
    if (haTurni) giaChiesto = true;
    const giaPersistente = await storage.persisted();
    if (!vaChiesta({ haTurni, supportato, giaPersistente, giaChiesto: prima })) return giaPersistente;
    return await storage.persist();
  } catch {
    return false; // un browser che rifiuta la chiamata non deve rompere l'app
  }
}
