// «Copia la settimana scorsa»: per chi ha orari fissi la settimana nuova è la
// vecchia, e segnarla turno per turno costava un modulo per giorno.
//
// Quale settimana: quella di oggi o la prossima, se è nel mese che si sta
// guardando, VUOTA mentre la precedente ha turni di lavoro. Le settimane passate
// no: ricopiarle scriverebbe turni che non ci sono stati. E non più avanti: dopo
// una copia la settimana dopo sarebbe di nuovo «vuota con la precedente piena»,
// e la riga ricomparirebbe subito, a catena, per mesi.
//
// Cosa si copia: solo il lavoro (ferie, malattia e festività sono di quei giorni,
// non della settimana tipo), con orari e pausa. Non si copiano maggiorazione e
// nota, per la stessa ragione di `orari-proposti.js`: cambierebbero i soldi o
// direbbero cose di un altro giorno. Un turno su una festività la salta: non si
// inventa lavoro in un giorno festivo.
//
// Niente conferma prima: si copia al tocco e si offre «Annulla» (useAnnulla).
// Modulo puro. → check-copia-settimana.mjs

import { formatDate, getWeekStart, parseDate } from '../motore/date.js';
import { TIPO, tipoTurno } from '../motore/assenze.js';

const piuGiorni = (data, n) => { const d = new Date(data); d.setDate(d.getDate() + n); return d; };

/**
 * @param {Array<any>} turni tutti i turni
 * @param {Date} inizioMese il primo del mese guardato
 * @param {Date} oggi
 * @param {(iso: string) => boolean} [festivo] giorni da non riempire
 * @returns {{ lunedi: string, fine: string, turni: Array<any> } | null}
 */
export function settimanaDaCopiare(turni, inizioMese, oggi, festivo = () => false) {
  const perGiorno = new Map();
  for (const t of turni) {
    if (!perGiorno.has(t.date)) perGiorno.set(t.date, []);
    perGiorno.get(t.date).push(t);
  }
  const settimana = (lunedi) => Array.from({ length: 7 }, (_, i) => formatDate(piuGiorni(lunedi, i)));
  const fineMese = new Date(inizioMese.getFullYear(), inizioMese.getMonth() + 1, 0);
  let lunedi = getWeekStart(inizioMese);
  const questa = getWeekStart(oggi);
  if (lunedi < questa) lunedi = questa;
  const ultimo = piuGiorni(questa, 7);
  for (; lunedi <= fineMese && lunedi <= ultimo; lunedi = piuGiorni(lunedi, 7)) {
    const giorni = settimana(lunedi);
    if (giorni.some((g) => perGiorno.has(g))) continue;
    const prima = settimana(piuGiorni(lunedi, -7)).flatMap((g) => perGiorno.get(g) || [])
      .filter((t) => tipoTurno(t) === TIPO.LAVORO && t.startTime && t.endTime);
    if (!prima.length) return null; // la prima settimana vuota decide: niente da copiare, niente riga
    const copiati = prima
      .map((t) => ({
        date: formatDate(piuGiorni(parseDate(t.date), 7)),
        startTime: t.startTime, endTime: t.endTime, breakMinutes: t.breakMinutes || 0,
      }))
      .filter((t) => !festivo(t.date))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    return copiati.length ? { lunedi: giorni[0], fine: giorni[6], turni: copiati } : null;
  }
  return null;
}
