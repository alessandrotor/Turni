// Il file .xlsx dell'export, scritto con `write-excel-file`.
//
// Prima c'era `xlsx` (SheetJS) 0.18.5: abbandonato su npm, con due difetti di sicurezza noti
// e nessuna versione a cui aggiornare (COSE-NUOVE F7). L'app lo usava solo per SCRIVERE un
// foglio di valori semplici, e per questo basta una libreria che sa fare solo quello.
//
// Il modulo non tocca il DOM e importa con l'estensione: così il riscontro lo prova in Node
// (`check-foglio-excel.mjs`) esattamente com'è nel browser.
import writeXlsxFile from 'write-excel-file/universal';

/**
 * @param {Array<Array<string|number|null>>} righe  una riga vuota (`[]`) resta vuota nel foglio
 * @param {{ foglio?: string, larghezze?: number[] }} [opzioni]  larghezze in caratteri
 * @returns {Promise<Uint8Array>} i byte del file .xlsx
 */
export async function creaFoglioExcel(righe, { foglio = 'Turni', larghezze = [] } = {}) {
  // La libreria vuole almeno una cella per riga: una riga vuota diventa una cella vuota.
  const dati = righe.map(r => (r.length ? r.map(v => (v === '' ? null : v)) : [null]));
  const blob = await writeXlsxFile(dati, {
    sheet: foglio,
    columns: larghezze.map(width => ({ width })),
  }).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export function inBase64(byte) {
  let bin = '';
  const PASSO = 0x8000; // a blocchi: String.fromCharCode con troppi argomenti sfonda lo stack
  for (let i = 0; i < byte.length; i += PASSO) bin += String.fromCharCode(...byte.subarray(i, i + PASSO));
  return btoa(bin);
}
