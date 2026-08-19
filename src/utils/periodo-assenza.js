// Assenze a periodo: da «dal … al …» alle singole giornate da creare.
//
// PERCHÉ NON BASTA CREARE N GIORNI UGUALI
// Riposo settimanale e ferie sono diritti distinti (art. 2109 c.c., D.Lgs.
// 66/2003 artt. 9 e 10): il riposo spetta comunque e NON si consuma come ferie.
// Segnare sette giorni di fila ne «spende» uno di troppo e gonfia le ore del
// mese — cioè la stima della paga.
//
// Ma quale sia il giorno di riposo, per un turnista, qui non si può sapere: la
// legge dice «di regola la domenica» ragionando sull'ufficio, mentre chi lavora
// a turni riposa in un giorno qualunque, diverso ogni settimana.
//
// Quindi NON si indovina: si propongono tutti i giorni, tutti selezionati, e i
// riposi li toglie chi sta guardando il proprio calendario. La difesa contro
// l'errore non è una regola automatica, è il totale mostrato prima di salvare:
// una settimana di ferie deve valere esattamente l'orario settimanale.
//
// QUANTO VALE UNA GIORNATA
// Le ore da contratto, uguali per ogni giorno — non le ore di un turno che
// verrebbe convertito: un turnista in ferie non ha turni segnati che diventano
// ferie, ha giornate che valgono il «tot» del cedolino. È esattamente ciò che
// calcola `minutiGiornoAssenza` (24 ore su sei giorni del part-time 60% CCNL
// Turismo → quattro ore al giorno), quindi qui non si ricalcola nulla.
//
// Riscontro: `node scripts/check-periodo-assenza.mjs`.

// Estensioni esplicite: senza, Node puro non importa il modulo e i riscontri in
// `scripts/` non partono.
import { isIsoDate, parseDate, formatDate, dayNumber } from './dates.js';
import { minutiGiornoAssenza } from './assenze.js';

// Tetto sul numero di giornate generabili in un colpo solo. Non è una regola di
// contratto: è una rete contro il refuso nell'anno (2026 scritto 2036 farebbe
// nascere migliaia di record in un colpo). Un anno abbondante copre qualunque
// uso legittimo, e un elenco di 366 righe è abbastanza assurdo da farsi notare
// prima che qualcuno prema «salva».
export const MAX_GIORNI_PERIODO = 366;

/**
 * Le date ISO comprese fra due estremi, estremi inclusi.
 *
 * Avanza di un giorno con `setDate`, che ragiona sul CALENDARIO: sommare 24 ore
 * sbaglierebbe due volte l'anno, quando l'ora legale rende un giorno lungo 23 o
 * 25 ore (in Italia il 29 marzo e il 25 ottobre 2026).
 *
 * @returns {string[]} vuoto se le date non sono valide o se `al` precede `dal`
 */
export function giorniPeriodo(dal, al) {
  if (!isIsoDate(dal) || !isIsoDate(al)) return [];
  const quanti = dayNumber(al) - dayNumber(dal) + 1;
  if (quanti < 1) return [];

  const out = [];
  const cursore = parseDate(dal);
  for (let i = 0; i < Math.min(quanti, MAX_GIORNI_PERIODO); i++) {
    out.push(formatDate(cursore));
    cursore.setDate(cursore.getDate() + 1);
  }
  return out;
}

/**
 * Le giornate proposte per un periodo di assenza, da mostrare e correggere
 * prima di salvare.
 *
 * NON prende il tipo di assenza di proposito: ferie, permesso e malattia
 * producono la stessa proposta, e a cambiare è solo ciò che l'utente toglie.
 * Un parametro `tipo` inutilizzato lascerebbe credere a una differenza che non
 * c'è. L'unica cosa che dipende dal tipo — l'avviso sui giorni consecutivi
 * della malattia, che la carenza pretende — è testo, e vive nell'interfaccia.
 *
 * @returns {Array<{data:string, minuti:number, turnoEsistente:object|null, selezionato:boolean}>}
 */
export function proponiPeriodo({ dal, al, turni = [], settings = {} } = {}) {
  const minuti = minutiGiornoAssenza(settings);

  // Primo turno per data: se un giorno ne ha più d'uno, quello sostituito è il
  // primo — ed è comunque un caso che l'elenco mostra, non nasconde.
  const perData = new Map();
  for (const t of turni || []) {
    if (t?.date && !perData.has(t.date)) perData.set(t.date, t);
  }

  return giorniPeriodo(dal, al).map(data => ({
    data,
    minuti,
    turnoEsistente: perData.get(data) || null,
    selezionato: true,
  }));
}

/** Quante giornate e quanti minuti valgono le righe spuntate. */
export function totalePeriodo(righe) {
  const scelte = (righe || []).filter(r => r?.selezionato);
  return {
    giorni: scelte.length,
    minuti: scelte.reduce((somma, r) => somma + (Number(r.minuti) || 0), 0),
  };
}
