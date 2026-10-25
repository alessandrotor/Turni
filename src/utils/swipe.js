// Quando un gesto sul calendario vuol dire «cambia mese». Le frecce stanno in alto, dove il pollice
// non arriva, e lo scorrimento orizzontale è il gesto che ogni calendario ha già insegnato. Il
// rischio è cambiare mese a chi voleva fare altro, da qui tre soglie, tutte necessarie: abbastanza
// lungo, nettamente più orizzontale che verticale, e rapido (un dito che scivola piano sta leggendo).
//
// Modulo puro: `node scripts/check-swipe.mjs`.

export const SWIPE_MIN_PX = 60;
export const SWIPE_RAPPORTO = 2;     // |dx| almeno il doppio di |dy|
export const SWIPE_MAX_MS = 700;

/**
 * @param {object} gesto
 * @param {number} gesto.dx spostamento orizzontale in px (positivo = verso destra)
 * @param {number} gesto.dy spostamento verticale in px
 * @param {number} gesto.ms durata del gesto
 * @returns {-1|0|1} -1 mese precedente, 1 mese successivo, 0 niente
 */
export function direzioneSwipe({ dx = 0, dy = 0, ms = 0 } = {}) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(ms)) return 0;
  if (ms > SWIPE_MAX_MS) return 0;
  if (Math.abs(dx) < SWIPE_MIN_PX) return 0;
  if (Math.abs(dx) < SWIPE_RAPPORTO * Math.abs(dy)) return 0;
  // Il dito va verso sinistra per vedere quello che viene DOPO, come si
  // sfoglia una pagina.
  return dx < 0 ? 1 : -1;
}
