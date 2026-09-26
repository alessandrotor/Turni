// Lettura dei cedolini PDF da disco, per gli script Node.
//
// La logica sta in `src/utils/cedolino.js`, condivisa con la pagina «Confronta
// con la busta» dell'app: qui c'è solo come si leggono i byte (`fs`) e come si
// decomprime un flusso (`zlib`). Un lettore solo, così la convalida di
// `leggi-cedolini.mjs` prova anche quello che gira sul telefono dei tester.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { flussiCompressi, righeDaFlussi, comeLatin1 } from '../../src/utils/cedolino.js';

export { numeroIt, numeriDi } from '../../src/utils/cedolino.js';

/** I flussi decompressi di un PDF su disco, come testo latin1. */
export function flussiDiFile(percorso) {
  const out = [];
  for (const f of flussiCompressi(new Uint8Array(readFileSync(percorso)))) {
    try { out.push(comeLatin1(inflateSync(f))); } catch { /* non compresso: non ci serve */ }
  }
  return out;
}

/** Le righe di un PDF su disco. Vedi `righeDaFlussi`. */
export function righeDi(percorso, tolleranza = 2.5) {
  return righeDaFlussi(flussiDiFile(percorso), tolleranza);
}
