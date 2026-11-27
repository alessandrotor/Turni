// Quali turni già salvati lascia fuori un salvataggio: nello stesso giorno
// ferie, malattia e festività prendono il posto del lavoro, e il lavoro il loro.
// Il permesso è a ore e convive con tutto. → check-sostituzioni.mjs
import { TIPO, tipoTurno } from '../motore/assenze.js';

const GIORNATA_INTERA = new Set([TIPO.FERIE, TIPO.MALATTIA, TIPO.FESTIVITA]);

/** Vero se `a` e `b` non possono stare nello stesso giorno. */
export function siEscludono(a, b) {
  const ta = tipoTurno(a);
  const tb = tipoTurno(b);
  return (ta === TIPO.LAVORO && GIORNATA_INTERA.has(tb))
    || (tb === TIPO.LAVORO && GIORNATA_INTERA.has(ta));
}

/**
 * I turni di `esistenti` che `nuovi` sostituiscono. Un nuovo con `id` è la
 * modifica di quel turno: non sostituisce sé stesso.
 *
 * @param {{ id?: string, date: string }[]} esistenti
 * @param {{ id?: string, date: string }[]} nuovi
 * @returns {{ id?: string, date: string }[]}
 */
export function turniSostituiti(esistenti, nuovi) {
  const idNuovi = new Set(nuovi.map(n => n.id).filter(Boolean));
  return (esistenti || []).filter(s => !idNuovi.has(s.id)
    && nuovi.some(n => n.date === s.date && siEscludono(n, s)));
}
