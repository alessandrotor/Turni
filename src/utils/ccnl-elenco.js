// L'elenco dei contratti per il selettore: tutti quelli dell'archivio CNEL,
// coi nomi, più le regole che il motore conosce (`motore/contratti/`).
//
// L'archivio sta all'app e non al motore: sono 1.163 nomi, firmatari e date
// di vigenza, che servono a scegliere un contratto, non a calcolare. Si
// rigenera con `npm run ccnl:aggiorna` (scripts/scarica-ccnl.mjs).

// L'attributo `with { type: 'json' }` serve a Node puro (i riscontri).
import archivio from '../data/ccnl.json' with { type: 'json' };
import { getCcnl } from '../motore/ccnl.js';

const unisci = (voce) => ({ ...voce, ...getCcnl(voce.codice), label: voce.nome || '' });

export const CCNL_LIST = archivio.map(unisci);
const PER_CODICE = Object.fromEntries(CCNL_LIST.map((c) => [c.codice, c]));

/** Il contratto `codice` col suo nome; un codice sconosciuto vale la legge, senza nome. */
export function getContratto(codice) {
  return PER_CODICE[codice] || PER_CODICE[''] || unisci({ codice: codice || '' });
}
