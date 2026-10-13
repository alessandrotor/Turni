// RISCONTRO: un JSON salvato che non si legge non viene perso.
//
// Il difetto era A3 di COSE-NUOVE.md: `JSON.parse` falliva, lo stato partiva da
// `initialValue`, e al primo salvataggio la chiave veniva riscritta — i byte
// corrotti, in parte recuperabili a mano, sparivano. Oggi `leggiSalvato` li
// copia in una chiave a parte PRIMA di restituire il valore di partenza.
//
// Verifica: (1) la chiave corrotta torna `initialValue` e la copia esiste
// identica; (2) una seconda lettura non sovrascrive la prima copia; (3) un JSON
// valido passa e non crea copie; (4) uno storage che rifiuta la scrittura della
// copia non fa saltare la lettura.
import { leggiSalvato, SUFFISSO_ILLEGGIBILE } from '../src/hooks/useLocalStorage.js';

let falliti = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK     ' : 'FALLITO'} ${msg}`); if (!cond) falliti += 1; };
const finto = (init = {}, rifiutaScritture = false) => {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (rifiutaScritture) throw new DOMException('QuotaExceeded'); m.set(k, v); },
  };
};
const K = 'turni_shifts';

const s1 = finto({ [K]: '[{"date":"2026-10-01","start' });
ok(JSON.stringify(leggiSalvato(s1, K, [])) === '[]', 'chiave corrotta: parte da initialValue');
ok(s1.m.get(K + SUFFISSO_ILLEGGIBILE) === '[{"date":"2026-10-01","start', 'chiave corrotta: i byte sono in salvo, identici');
s1.m.set(K, '[]'); // l'app riscrive la chiave
ok(s1.m.get(K + SUFFISSO_ILLEGGIBILE) === '[{"date":"2026-10-01","start', 'dopo la riscrittura la copia c\'è ancora');

const s2 = finto({ [K]: '{rotto', [K + SUFFISSO_ILLEGGIBILE]: 'prima copia' });
leggiSalvato(s2, K, []);
ok(s2.m.get(K + SUFFISSO_ILLEGGIBILE) === 'prima copia', 'la prima copia non viene sovrascritta');

const s3 = finto({ [K]: '[{"a":1}]' });
ok(leggiSalvato(s3, K, []).length === 1, 'JSON valido: letto');
ok(!s3.m.has(K + SUFFISSO_ILLEGGIBILE), 'JSON valido: nessuna copia');
ok(leggiSalvato(finto(), K, 'x') === 'x', 'chiave assente: initialValue, nessuna copia');

const s4 = finto({ [K]: '{rotto' }, true);
ok(leggiSalvato(s4, K, 7) === 7, 'storage che rifiuta la copia: la lettura non salta');

process.exit(falliti ? 1 : 0);
