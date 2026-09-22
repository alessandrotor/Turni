// Cosa entra davvero nell'archivio da un import da foto.
//
//   node scripts/check-import-turni.mjs
//
// Il modello legge un foglio e restituisce turni; tra la sua risposta e
// l'archivio stanno tre regole, qui in un posto solo perché l'anteprima e il
// salvataggio non possano raccontare due cose diverse.
//
//  · L'ANNO. Un foglio turni scrive «Lun 5», quasi mai l'anno, e il modello
//    mette quello in corso. Il 28 dicembre, importando gennaio, i turni finivano
//    undici mesi indietro — e l'anteprima mostrava solo «05/01». Una data a più
//    di sei mesi da oggi si porta all'anno che la mette più vicina: nessuno
//    importa da foto un foglio di un anno fa.
//  · I GIORNI GIÀ PRESI da ferie, permessi, malattia. `addShifts` toglie il
//    lavoro dai giorni di assenza, perché non si può lavorare ed essere in
//    ferie lo stesso giorno; l'import invece li sommava, e quel giorno contava
//    due volte nel monte ore e nel lordo.
//  · I CAMPI. La risposta porta con sé testo grezzo, codice, riga e colonna
//    abbinate — servono all'anteprima, non all'archivio. Salvati con lo spread
//    finivano per sempre in localStorage e in ogni backup, e la riga abbinata
//    può contenere il nome di un collega.

import { isIsoDate, parseDate, formatDate } from './dates.js';
import { isAssenza } from './assenze.js';

const GIORNO_MS = 86400000;
const MEZZO_ANNO = 183;

/** La stessa data nell'anno che la mette più vicina a `oggi`, se è lontana più di sei mesi. */
export function avvicinaAnno(iso, oggi = new Date()) {
  if (!isIsoDate(iso)) return iso;
  const base = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  const distanza = (d) => Math.abs(d - base) / GIORNO_MS;
  const data = parseDate(iso);
  if (distanza(data) <= MEZZO_ANNO) return iso;
  let migliore = data;
  for (const anno of [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1]) {
    const candidata = new Date(anno, data.getMonth(), data.getDate());
    // Il 29 febbraio in un anno che non ce l'ha scivola a marzo: non è la stessa data.
    if (candidata.getMonth() !== data.getMonth()) continue;
    if (distanza(candidata) < distanza(migliore)) migliore = candidata;
  }
  return formatDate(migliore);
}

/**
 * Divide i turni riconosciuti fra quelli da salvare e quelli da saltare.
 *
 * @param {Array} riconosciuti turni come li restituisce il servizio di import
 * @param {Array} esistenti tutti i turni già in archivio
 * @returns {{ daSalvare: Array, suAssenza: Array, doppioni: number }}
 *   `daSalvare` ha i soli campi del turno, senza id.
 */
export function turniDaImportare(riconosciuti, esistenti) {
  const visti = new Set((esistenti || []).map(s => `${s.date}|${s.startTime}|${s.endTime}`));
  const giorniAssenza = new Set((esistenti || []).filter(isAssenza).map(s => s.date));
  const daSalvare = [];
  const suAssenza = [];
  let doppioni = 0;
  for (const t of riconosciuti || []) {
    const chiave = `${t.date}|${t.startTime}|${t.endTime}`;
    if (giorniAssenza.has(t.date)) { suAssenza.push(t); continue; }
    if (visti.has(chiave)) { doppioni += 1; continue; }
    visti.add(chiave);
    daSalvare.push({
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      breakMinutes: Number(t.breakMinutes) || 0,
      note: typeof t.note === 'string' ? t.note : '',
    });
  }
  return { daSalvare, suAssenza, doppioni };
}
