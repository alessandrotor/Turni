// Gli orari che il modulo del turno propone da solo.
//
// PERCHÉ ESISTE
// Fino al 2 settembre 2026 il modulo proponeva `08:00–16:00`, scritti a mano in
// `ShiftForm.jsx`. Un numero che nessuno ha mai verificato su niente, uguale per
// sempre e per tutti: chi fa le serali pagava due giri di selettore dell'ora a
// OGNI turno, per anni, per correggere una proposta che non è mai stata giusta
// nemmeno una volta. Contato sul gesto completo — dalla cella del calendario al
// salvataggio — un turno costava dieci interazioni, e otto erano lì per questo.
//
// Lo storico dei turni sa già la risposta, ed era in mano al modulo da sempre
// (la prop `turni`, usata solo per i periodi di assenza). Qui si legge.
//
// LA REGOLA È LA MODA, E LA SCELTA CONTA
// Vince la coppia inizio–fine che ricorre di più. Le alternative scartate:
//
//  · L'ULTIMO TURNO. Reattivo, ma una sostituzione serale isolata avvelena la
//    proposta del giorno dopo, e il difetto non si vede: si vede solo quando
//    qualcuno salva un turno sbagliato senza guardare.
//  · LA MEDIA DEGLI INIZI. Proporrebbe `08:37`, un orario che non è mai
//    esistito. Da qui la proprietà che questo modulo si impegna a mantenere e
//    che il riscontro verifica su cento storie generate: **la coppia proposta
//    esiste letteralmente nello storico, oppure è ORARI_DEFAULT.** L'app non
//    inventa un orario. Mai.
//
// PERCHÉ UNA FINESTRA, E PERCHÉ CENTRATA SUL TURNO
// La moda su tutto lo storico è stabile fino a diventare sorda: chi cambia
// fascia a settembre continuerebbe a vedersi proporre quella di giugno per
// mesi, cioè l'app resta indietro proprio quando la vita cambia. La finestra è
// centrata sulla DATA DEL TURNO CHE SI STA SEGNANDO, non su oggi: chi a
// settembre recupera i turni di giugno riceve la proposta di giugno, che è
// l'unica utile. Per tornare a guardare tutto basta FINESTRA_GIORNI = Infinity.
//
// COSA NON COPIA, E PERCHÉ
//  · La MAGGIORAZIONE mai: vive dentro un `<details>` chiuso, e sarebbe un
//    numero che cambia i soldi fuori dagli occhi di chi salva.
//  · La NOTA mai: «sostituzione Mario» riguarda un giorno solo, e ricopiarla
//    significherebbe attribuire all'utente una frase scritta dall'app.
//  · La PAUSA solo se unanime fra i turni di quella sagoma. Una pausa proposta
//    a caso toglie minuti pagati in silenzio, che è il difetto peggiore che
//    questo repository conosca.
//
// Modulo puro, senza React e senza browser: si riscontra da Node con
// `node scripts/check-orari-proposti.mjs`. Estensioni `.js` esplicite negli
// import, altrimenti Node non risolve e il riscontro non parte.

import { parseDate } from './dates.js';
import { TIPO, tipoTurno } from './assenze.js';

/** Quello che si propone quando non c'è storico: il comportamento di sempre. */
export const ORARI_DEFAULT = { startTime: '08:00', endTime: '16:00', breakMinutes: 0 };

/**
 * Ampiezza della finestra, in giorni, PRIMA E DOPO la data del turno.
 * Sessanta giorni sono due mesi di busta: abbastanza da avere un campione,
 * poco abbastanza da accorgersi di un cambio di orario nel giro di poche
 * settimane invece che di stagioni.
 */
export const FINESTRA_GIORNI = 60;

/** Quante sagome mostrare come scorciatoia nel modulo. */
export const MAX_SAGOME = 3;

const GIORNO_MS = 24 * 60 * 60 * 1000;

// Non basta «somiglia a un orario»: dev'essere un orario che `<input
// type="time">` sa MOSTRARE, cioè 00:00–23:59. Un `24:00` in un campo così non
// dà errore — il campo resta VUOTO, e siccome è `required` il salvataggio si
// blocca con il popup del browser su un campo che l'utente non ha toccato.
// Oggi né il modulo né l'import da foto producono un `24:00` (`toHHMM` in
// services/gemini.js scarta le ore oltre le 23), ma un ripristino da un backup
// vecchio o un dato modificato a mano sì — e questa è la prima funzione che
// riprende un valore salvato e lo rimette dentro un campo.
const oraValida = (v) => {
  if (typeof v !== 'string') return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
};

// `parseDate` di dates.js chiama `str.split` senza rete: un `date` nullo la fa
// esplodere, e qui i turni arrivano dallo storico di chiunque — compreso chi ha
// un record rotto da un import andato male o da un backup di una versione
// vecchia. Un modulo che si apre in bianco perché un turno del 2024 non ha la
// data sarebbe un guasto molto peggiore di quello che risolve.
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
 * Ordinamento TOTALE, e non è pignoleria: senza l'ultimo criterio il risultato
 * dipenderebbe dall'ordine con cui i turni arrivano nell'array, cioè da come
 * `Object.values` decide di elencare la mappa. Un riscontro non ripetibile non
 * è un riscontro.
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

  // IL SECONDO TURNO DI UNO SPEZZATO. La moda non sa che quel giorno un turno
  // c'è già: chi fa 10–15 + 18–23:30 apriva il modulo per la sera e si vedeva
  // riproporre 10–15 — un turno sovrapposto a quello appena salvato, da
  // correggere a mano ogni volta. Le sagome che si accavallano a un turno già
  // segnato quel giorno passano in fondo, non spariscono: l'ordine resta
  // totale, e se nessuna è libera la proposta resta comunque una coppia vera.
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
 * Soglia UNO: anche un solo turno nello storico vale più di `08:00–16:00`, che
 * non è mai stato verificato su niente. Nessuna soglia più alta da giustificare,
 * nessun numero magico da difendere.
 *
 * `fonte` non è decorazione: regge l'avviso sotto i campi, che dice all'utente
 * da dove viene la proposta invece di far finta che l'app sappia le cose.
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
