// Backup e ripristino di tutti i dati dell'app in un file JSON.
//
// Turni e impostazioni vivono solo in localStorage: niente account, niente
// sincronizzazione, nessuna copia. Basta disinstallare l'app — cosa che Android
// impone ogni volta che cambia la firma del pacchetto — per perdere mesi di
// turni inseriti a mano. Gli export Excel/PDF non coprono il caso: sono report
// di un mese, pensati per essere letti, e non contengono le impostazioni.

import { deliver } from './export';

// Chiavi di localStorage che compongono il backup. `turni_install_id` resta
// FUORI di proposito: è l'identità dell'installazione ai fini della telemetria,
// e ripristinarla su un secondo dispositivo mescolerebbe le statistiche di due
// installazioni distinte.
const KEY_SHIFTS = 'turni_shifts';
const KEY_SETTINGS = 'turni_settings';
const KEY_TELEMETRY_OFF = 'turni_telemetry_off';

// Marcatori del formato. `formato` va incrementato solo se cambia la struttura
// in modo non retrocompatibile: serve a rifiutare un file di una versione futura
// invece di interpretarlo a caso e corrompere i dati.
const APP_TAG = 'turni';
const FORMATO = 1;

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
  await deliver(`Turni_backup_${giorno}.json`, base64, 'application/json');
  return { turni: Object.keys(backup.turni).length };
}

// Controlla che il file sia davvero un backup di questa app prima di toccare
// qualsiasi cosa: un JSON qualunque non deve poter sovrascrivere mesi di lavoro.
export function validaBackup(dati) {
  if (!dati || typeof dati !== 'object' || Array.isArray(dati)) {
    return 'Il file non contiene un backup valido.';
  }
  if (dati.app !== APP_TAG) {
    return "Questo file non è un backup di Turni.";
  }
  if (dati.formato > FORMATO) {
    return `Backup creato da una versione più recente dell'app (formato ${dati.formato}). Aggiorna Turni e riprova.`;
  }
  if (typeof dati.turni !== 'object' || dati.turni === null || Array.isArray(dati.turni)) {
    return 'Il backup è danneggiato: manca l\'elenco dei turni.';
  }
  return null;
}

/**
 * Ripristina un backup da file. SOSTITUISCE i dati presenti.
 * Chi chiama deve aver già chiesto conferma.
 *
 * @param {File} file il .json scelto dall'utente
 * @returns {Promise<{turni:number}>} quanti turni sono stati ripristinati
 */
export async function importaBackup(file) {
  const testo = await file.text();

  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new Error('Il file non è leggibile: assicurati di aver scelto il .json del backup.');
  }

  const errore = validaBackup(dati);
  if (errore) throw new Error(errore);

  // Da qui in poi si scrive: la validazione è passata.
  localStorage.setItem(KEY_SHIFTS, JSON.stringify(dati.turni));
  if (dati.impostazioni && typeof dati.impostazioni === 'object') {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(dati.impostazioni));
  }
  if (dati.telemetriaDisattivata) localStorage.setItem(KEY_TELEMETRY_OFF, '1');
  else localStorage.removeItem(KEY_TELEMETRY_OFF);

  return { turni: Object.keys(dati.turni).length };
}
