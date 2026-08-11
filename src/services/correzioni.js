// Correzione una tantum degli orari a :50 sui turni salvati.
//
// La regola sta in `utils/orari.js`; qui c'è solo il contatto con i dati veri.
//
// Non è una migrazione automatica: gira soltanto quando l'utente la lancia, con
// l'elenco delle modifiche davanti. Chi usa l'app potrebbe avere turni davvero
// a :50, e cambiargli i dati in silenzio non si fa.

import { leggiTurni, salvaTurni } from './backup';
import { trovaOrariDaCorreggere, correggiOrari } from '../utils/orari';

export function elencoOrariDaCorreggere() {
  return trovaOrariDaCorreggere(leggiTurni());
}

/** Scrive la correzione su localStorage. @returns {number} turni corretti */
export function applicaCorrezioneOrari() {
  const turni = leggiTurni();
  const daCorreggere = trovaOrariDaCorreggere(turni);
  if (daCorreggere.length === 0) return 0;
  salvaTurni(correggiOrari(turni, daCorreggere.map(t => t.id)));
  return daCorreggere.length;
}
