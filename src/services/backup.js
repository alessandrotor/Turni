// Backup e ripristino di tutti i dati dell'app in un file JSON. Turni e impostazioni vivono
// solo in localStorage (niente account né copie): gli export Excel/PDF sono report di un mese e
// non contengono le impostazioni.

import { deliver } from './export';
import {
  APP_TAG, FORMATO,
  KEY_SHIFTS, KEY_SETTINGS, KEY_CAL_LAYOUT,
  controllaBusta, vagliaTurni, pianoRipristino, scriviConRitorno,
} from '../utils/backup-contenuto';

// Chiavi, marcatori di formato e regole su cosa è un turno valido stanno in
// `utils/backup-contenuto.js` (caricabile da Node, per `scripts/check-backup.mjs`). Qui restano
// i due mestieri che hanno bisogno del browser: leggere un File e consegnare un file.

// Riesportata perché la legge anche CalendarView.
export { KEY_CAL_LAYOUT };

// Lettura grezza protetta: localStorage può lanciare, non solo restituire null
// (Safari con i cookie bloccati, storage disabilitato, WebView ristrette).
function leggiGrezzo(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function leggi(key, fallback) {
  const raw = leggiGrezzo(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Turni grezzi da localStorage e ritorno, esposti perché `correzioni.js` lavora sugli stessi dati.
export function leggiTurni() {
  return leggi(KEY_SHIFTS, {});
}

export function salvaTurni(turni) {
  localStorage.setItem(KEY_SHIFTS, JSON.stringify(turni));
}

// Quanti turni finirebbero nel backup: si mostra accanto al pulsante, così si
// vede subito se c'è qualcosa da salvare.
export function contaTurniSalvati() {
  return Object.keys(leggi(KEY_SHIFTS, {})).length;
}

export function costruisciBackup() {
  return {
    app: APP_TAG,
    formato: FORMATO,
    esportatoIl: new Date().toISOString(),
    versioneApp: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
    turni: leggi(KEY_SHIFTS, {}),
    impostazioni: leggi(KEY_SETTINGS, {}),
    vistaCalendario: leggiGrezzo(KEY_CAL_LAYOUT) || null,
  };
}

export async function esportaBackup() {
  const backup = costruisciBackup();
  const testo = JSON.stringify(backup, null, 2);
  // btoa non regge i caratteri non ASCII (le note dei turni sono in italiano):
  // si passa per UTF-8 prima di codificare in base64.
  const bytes = new TextEncoder().encode(testo);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  const base64 = btoa(binario);

  const giorno = backup.esportatoIl.slice(0, 10);
  const { esito } = await deliver(`Turni_backup_${giorno}.json`, base64, 'application/json');

  // `esito` risale a chi chiama perché le parole dipendono da lì; `testo` viaggia insieme per
  // offrire la seconda via (copiarlo a mano) senza ricostruire il backup.
  return { turni: Object.keys(backup.turni).length, esito, testo };
}

/**
 * Legge il file e lo esamina, SENZA scrivere niente.
 *
 * Si guarda prima (quanti turni arrivano, quanti ce ne sono, cosa non si è potuto leggere) e
 * si decide sapendo, invece di un «sei sicuro?» che non sa dire di cosa.
 *
 * @param {File} file il .json scelto dall'utente
 * @returns {Promise<{dati: object, turni: number, scartati: Array, turniBuoni: object}>}
 * @throws {Error} con un messaggio in italiano, se il file non è un backup
 */
export async function leggiBackup(file) {
  const testo = await file.text();

  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new Error('Il file non è leggibile: assicurati di aver scelto il .json del backup.');
  }

  const errore = controllaBusta(dati);
  if (errore) throw new Error(errore);

  const { buoni, scartati } = vagliaTurni(dati.turni);
  return { dati, turniBuoni: buoni, turni: Object.keys(buoni).length, scartati };
}

/**
 * Sostituisce i dati presenti con quelli del backup già letto.
 *
 * O passa tutto, o non cambia niente: vedi `utils/backup-contenuto.js`.
 *
 * @param {{ dati: Object, turniBuoni: Array, scartati?: Array }} arg l'esito di `leggiBackup`
 * @returns {{turni: number, scartati: Array}}
 * @throws {Error} in italiano, e dicendo se i dati di prima sono ancora lì
 */
export function applicaBackup({ dati, turniBuoni, scartati = [] }) {
  const esito = scriviConRitorno(pianoRipristino(dati, turniBuoni), localStorage);

  if (!esito.ok) {
    const quota = esito.errore?.name === 'QuotaExceededError'
      || esito.errore?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || /** @type {any} */ (esito.errore)?.code === 22
      || /** @type {any} */ (esito.errore)?.code === 1014;

    // Il messaggio dice cosa non è riuscito e SE i dati di prima sono ancora al loro posto.
    const perche = quota
      ? 'Nella memoria del telefono non c\'è spazio per questo backup.'
      : 'Il browser ha rifiutato la scrittura.';

    throw new Error(esito.tornatoIndietro
      ? `${perche} I tuoi dati di prima sono rimasti al loro posto: non è cambiato niente.`
      : `${perche} E non è stato possibile rimettere i dati di prima: fai subito un backup e controlla i turni di questo mese prima di fidarti di quello che vedi.`);
  }

  return { turni: Object.keys(turniBuoni).length, scartati };
}
