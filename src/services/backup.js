// Backup e ripristino di tutti i dati dell'app in un file JSON.
//
// Turni e impostazioni vivono solo in localStorage: niente account, niente
// sincronizzazione, nessuna copia. Basta disinstallare l'app — cosa che Android
// impone ogni volta che cambia la firma del pacchetto — per perdere mesi di
// turni inseriti a mano. Gli export Excel/PDF non coprono il caso: sono report
// di un mese, pensati per essere letti, e non contengono le impostazioni.

import { deliver } from './export';
import {
  APP_TAG, FORMATO,
  KEY_SHIFTS, KEY_SETTINGS, KEY_TELEMETRY_OFF, KEY_CAL_LAYOUT,
  controllaBusta, vagliaTurni, pianoRipristino, scriviConRitorno,
} from '../utils/backup-contenuto';

// Le chiavi, i marcatori di formato e le regole su cosa è un turno valido
// vivono in `utils/backup-contenuto.js`, che da Node si carica: è quello che
// permette a `scripts/check-backup.mjs` di rompere lo storage a metà ripristino
// e guardare se i dati tornano al loro posto. Qui restano i due mestieri che
// hanno bisogno del browser — leggere un File e consegnare un file.
//
// `turni_install_id` resta fuori dal backup di proposito: è l'identità
// dell'installazione ai fini della telemetria, e ripristinarla su un secondo
// dispositivo mescolerebbe le statistiche di due installazioni distinte.

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

// Turni grezzi da localStorage e ritorno. Esposti perché `correzioni.js` lavora
// sugli stessi dati: la chiave la possiede questo modulo, e duplicarla altrove
// vorrebbe dire doverla cambiare in due posti.
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
    telemetriaDisattivata: leggiGrezzo(KEY_TELEMETRY_OFF) === '1',
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

  // `esito` risale a chi chiama perché le parole da usare dipendono da lì: un
  // backup «salvato» e uno «avviato ma non verificabile» non si annunciano allo
  // stesso modo, ed è esattamente la distinzione che prima non esisteva.
  // `testo` viaggia insieme così l'interfaccia può offrire la seconda via
  // (copiarlo a mano) senza dover ricostruire il backup una seconda volta —
  // che oltretutto, fra i due momenti, potrebbe non essere più identico.
  return { turni: Object.keys(backup.turni).length, esito, testo };
}

/**
 * Legge il file e lo esamina, SENZA scrivere niente.
 *
 * È la metà che prima non esisteva: `importaBackup` apriva, controllava e
 * sostituiva tutto in un colpo solo, quindi l'unica cosa che si poteva mettere
 * davanti era un «sei sicuro?» che non sapeva dire di cosa. Adesso si può
 * guardare prima — quanti turni arrivano, quanti ce ne sono adesso, cosa non
 * si è potuto leggere — e decidere sapendo.
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
 * O passa tutto, o non cambia niente: la regola e il perché stanno in
 * `utils/backup-contenuto.js`, insieme al riscontro che rompe lo storage a
 * metà strada per vedere se i dati tornano davvero al loro posto.
 *
 * @param {object} arg l'esito di `leggiBackup`
 * @returns {{turni: number, scartati: Array}}
 * @throws {Error} in italiano, e dicendo se i dati di prima sono ancora lì
 */
export function applicaBackup({ dati, turniBuoni, scartati = [] }) {
  const esito = scriviConRitorno(pianoRipristino(dati, turniBuoni), localStorage);

  if (!esito.ok) {
    const quota = esito.errore?.name === 'QuotaExceededError'
      || esito.errore?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || esito.errore?.code === 22
      || esito.errore?.code === 1014;

    // Il messaggio dice due cose, e la seconda conta più della prima: cosa non
    // è riuscito, e SE i dati di prima sono ancora al loro posto. Finché la
    // risposta è sì non è successo niente di grave, e va detto subito.
    const perche = quota
      ? 'Nella memoria del telefono non c\'è spazio per questo backup.'
      : 'Il browser ha rifiutato la scrittura.';

    throw new Error(esito.tornatoIndietro
      ? `${perche} I tuoi dati di prima sono rimasti al loro posto: non è cambiato niente.`
      : `${perche} E non è stato possibile rimettere i dati di prima: fai subito un backup e controlla i turni di questo mese prima di fidarti di quello che vedi.`);
  }

  return { turni: Object.keys(turniBuoni).length, scartati };
}
