// Gli orari che il modulo del turno propone da solo, dallo storico dei turni.
//
// Vince la coppia inizio–fine che ricorre di più (la moda), non l'ultimo turno (una
// sostituzione isolata avvelena la proposta) né la media (proporrebbe `08:37`, che non è
// mai esistito). Proprietà che il riscontro verifica su cento storie generate: **la
// coppia proposta esiste letteralmente nello storico, oppure è ORARI_DEFAULT.** L'app
// non inventa un orario.
//
// La moda si calcola in una finestra centrata sulla DATA DEL TURNO che si sta segnando,
// non su oggi: chi cambia fascia a settembre non si vede riproporre quella di giugno, e
// chi recupera i turni di giugno riceve quella di giugno (`FINESTRA_GIORNI = Infinity`
// per guardare tutto).
//
// Cosa non copia: la MAGGIORAZIONE (cambia i soldi fuori dagli occhi di chi salva), la
// NOTA (riguarda un giorno solo) e la PAUSA salvo che sia unanime fra i turni di quella
// sagoma (una pausa a caso toglie minuti pagati in silenzio).
//
// Modulo puro, senza React e senza browser: `node scripts/check-orari-proposti.mjs`.
// Estensioni `.js` esplicite negli import, altrimenti Node non risolve.

import { parseDate } from './dates.js';
import { TIPO, tipoTurno } from '../motore/assenze.js';

/** Quello che si propone quando non c'è storico: il comportamento di sempre. */
export const ORARI_DEFAULT = { startTime: '08:00', endTime: '16:00', breakMinutes: 0 };

/**
 * Ampiezza della finestra, in giorni, PRIMA E DOPO la data del turno: due mesi di
 * busta, abbastanza per un campione e pochi per accorgersi di un cambio di orario.
 */
export const FINESTRA_GIORNI = 60;

/** Quante sagome mostrare come scorciatoia nel modulo. */
export const MAX_SAGOME = 3;

const GIORNO_MS = 24 * 60 * 60 * 1000;

// Dev'essere un orario che `<input type="time">` sa MOSTRARE (00:00–23:59): un `24:00`
// lascia il campo vuoto e, essendo `required`, blocca il salvataggio. Serve perché
// questa è la prima funzione che riprende un valore salvato (backup vecchio o a mano)
// e lo rimette in un campo.
const oraValida = (v) => {
  if (typeof v !== 'string') return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
};

// `parseDate` di dates.js esplode su un `date` nullo, e qui i turni arrivano dallo
// storico di chiunque (anche un record rotto da un import): il modulo non deve aprirsi
// in bianco.
const quandoE = (v) => {
  if (typeof v !== 'string' || !v) return null;
  const d = parseDate(v);
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

// Un turno come intervallo in minuti dalla mezzanotte del suo giorno. Se la
// fine non viene dopo l'inizio il turno scavalca la mezzanotte: 20:00–02:00
// finisce alle 26:00, non alle 2 del mattino dello stesso giorno.
const minuti = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function intervallo(inizio, fine) {
  const a = minuti(inizio);
  let b = minuti(fine);
  if (b <= a) b += 24 * 60;
  return [a, b];
}
// Si toccano senza accavallarsi, 10–15 e 15–18, non è una sovrapposizione.
const siSovrappongono = ([a1, a2], [b1, b2]) => Math.max(a1, b1) < Math.min(a2, b2);

/**
 * Le sagome di turno ricorrenti attorno a una data, dalla più frequente.
 *
 * Ordinamento TOTALE: senza l'ultimo criterio il risultato dipenderebbe dall'ordine
 * dei turni nell'array e il riscontro non sarebbe ripetibile.
 *   0. chi NON si accavalla a un turno già segnato quel giorno;
 *   1. chi ricorre di più;
 *   2. a pari conteggio, chi è stato usato più vicino alla data bersaglio;
 *   3. a pari distanza, ordine alfabetico della chiave «inizio|fine».
 *
 * @param {Array<object>} turni tutti i turni salvati
 * @param {string} data data ISO del turno che si sta segnando
 * @returns {Array<{startTime, endTime, breakMinutes, quante, distanza}>}
 */
export function sagomeFrequenti(turni, data) {
  const bersaglio = quandoE(data);
  if (!bersaglio) return [];

  const gruppi = new Map();
  for (const t of Array.isArray(turni) ? turni : []) {
    // Le assenze non hanno orari: una giornata di ferie non dice niente su
    // quando si entra al lavoro.
    if (tipoTurno(t) !== TIPO.LAVORO) continue;
    if (!oraValida(t?.startTime) || !oraValida(t?.endTime)) continue;

    const quando = quandoE(t.date);
    if (!quando) continue;
    const distanza = Math.abs(quando - bersaglio) / GIORNO_MS;
    if (distanza > FINESTRA_GIORNI) continue;

    const chiave = `${t.startTime}|${t.endTime}`;
    const g = gruppi.get(chiave) || {
      startTime: t.startTime, endTime: t.endTime, chiave,
      quante: 0, distanza: Infinity, pause: new Set(),
    };
    g.quante += 1;
    g.distanza = Math.min(g.distanza, distanza);
    g.pause.add(Number(t.breakMinutes) || 0);
    gruppi.set(chiave, g);
  }

  // IL SECONDO TURNO DI UNO SPEZZATO: chi fa 10–15 + 18–23:30 si vedeva riproporre
  // 10–15 sulla sera. Le sagome che si accavallano a un turno già segnato quel giorno
  // passano in fondo, non spariscono: l'ordine resta totale.
  const giaNelGiorno = (Array.isArray(turni) ? turni : [])
    .filter(t => t?.date === data && tipoTurno(t) === TIPO.LAVORO
      && oraValida(t?.startTime) && oraValida(t?.endTime))
    .map(t => intervallo(t.startTime, t.endTime));
  const occupa = (g) => giaNelGiorno.some(i => siSovrappongono(i, intervallo(g.startTime, g.endTime)));

  return [...gruppi.values()]
    .sort((a, b) => occupa(a) - occupa(b)
      || b.quante - a.quante
      || a.distanza - b.distanza
      || a.chiave.localeCompare(b.chiave))
    .map(({ startTime, endTime, quante, distanza, pause }) => ({
      startTime,
      endTime,
      // Unanime o niente: vedi «COSA NON COPIA» in testa al file.
      breakMinutes: pause.size === 1 ? [...pause][0] : 0,
      quante,
      distanza,
    }));
}

/**
 * Gli orari da scrivere nei campi all'apertura del modulo.
 *
 * Soglia UNO: anche un solo turno nello storico vale più di `08:00–16:00`.
 *
 * `fonte` regge l'avviso sotto i campi, che dice da dove viene la proposta.
 *
 * @returns {{startTime, endTime, breakMinutes, fonte: 'storico'|'default'}}
 */
export function proponiOrari(turni, data) {
  const [prima] = sagomeFrequenti(turni, data);
  if (!prima) return { ...ORARI_DEFAULT, fonte: 'default' };
  return {
    startTime: prima.startTime,
    endTime: prima.endTime,
    breakMinutes: prima.breakMinutes,
    fonte: 'storico',
  };
}
