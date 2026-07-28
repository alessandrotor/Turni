/**
 * Turni — raccoglitore telemetria import (token consumati).
 *
 * SETUP (una volta):
 *  1. Crea un nuovo Foglio Google.
 *  2. Estensioni → Apps Script.
 *  3. Incolla questo codice, salva.
 *  4. Deploy → Nuova distribuzione → tipo "App web".
 *     - Esegui come: Me
 *     - Chi ha accesso: Chiunque
 *  5. Copia l'URL che finisce con /exec e forniscilo per l'app (VITE_TELEMETRY_URL).
 *
 * Ogni import dell'app aggiunge una riga al Foglio. Dati anonimi (nessuna
 * immagine, nessun turno, nessun dato personale).
 */

const HEADERS = [
  'ts', 'installId', 'appVersion', 'model', 'resolution',
  'prompt', 'output', 'thinking', 'total', 'finishReason',
  'shifts', 'named', 'imageBytes', 'imageType', 'ok', 'error',
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    sheet.appendRow(HEADERS.map(h => (data[h] !== undefined && data[h] !== null ? data[h] : '')));

    // (Opzionale) email a ogni import: decommenta e metti la tua mail.
    // MailApp.sendEmail('tuamail@example.com', 'Turni · import token', JSON.stringify(data, null, 2));

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('err: ' + err);
  }
}
