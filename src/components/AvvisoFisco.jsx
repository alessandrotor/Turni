// L'anno senza la sua tabella fiscale, detto accanto al netto (COSE-NUOVE.md, C1).
//
// Il motore conosce le regole di un anno solo quando ha il suo file in
// `motore/fisco/`. Dopo l'ultimo anno noto calcola con quello, e la cifra resta
// perché di solito cambia poco, ma lo si scrive: a gennaio la legge di bilancio
// è appena uscita e il file nuovo non c'è ancora. Prima del primo anno noto le
// regole erano altre (nel 2025 il netto usciva ~59 € al mese sopra la busta), e
// il netto non si mostra: al suo posto, il perché.

import { statoFisco, ANNI_FISCALI } from '../motore/fisco/index.js';

/** @param {{ anno: number }} props */
export default function AvvisoFisco({ anno }) {
  const stato = statoFisco(anno);
  if (stato === 'noto') return null;
  const ultimo = ANNI_FISCALI[ANNI_FISCALI.length - 1];
  if (stato === 'provvisorio') {
    return <span> Calcolato con le regole fiscali del {ultimo}: quelle del {anno} arrivano con la legge di bilancio.</span>;
  }
  return <span>Il netto del {anno} non si stima: l&apos;app conosce le regole fiscali dal {ANNI_FISCALI[0]}, e con quelle sbaglierebbe.</span>;
}
