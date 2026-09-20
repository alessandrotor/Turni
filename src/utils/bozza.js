// «C'è qualcosa da perdere?»: la domanda che il modulo del turno si fa prima di
// lasciarsi chiudere da un tocco.
//
// COS'ERA PRIMA
// `ShiftForm.jsx` chiudeva la finestra al primo tocco sull'area scura attorno:
// `onClick={(e) => e.target === e.currentTarget && onClose()}`. Su un telefono
// quell'area è la parte più grande dello schermo, e il tocco accidentale è
// banale — il pollice che scivola, il dito appoggiato mentre si legge.
//
// Il caso peggiore non è il turno da otto tocchi: è il PERIODO DI ASSENZA. Si
// imposta il primo e l'ultimo giorno, si tolgono i riposi, si corregge riga per
// riga chi ha orari diversi — venti giornate, il lavoro manuale più lungo che
// l'app chieda — e un tocco fuori bersaglio azzerava tutto senza un segnale.
//
// PERCHÉ NON UNA CONFERMA «ANNULLA MODIFICHE?»
// Perché è la domanda che il progetto ha già deciso di non fare: costa un tocco
// a TUTTI, ogni volta, per un errore che capita a uno — ed è esattamente il
// genere di avviso che si impara a chiudere a riflesso, portandosi dietro anche
// quelli che contavano (vedi `AvvisoAnnulla.jsx`, stessa ragione).
//
// E perché qui non si può nemmeno fare l'altra metà della regola, l'annulla
// DOPO: un turno cancellato esiste ancora per otto secondi, una bozza chiusa no
// — non è mai stata scritta da nessuna parte.
//
// COSA SI FA INVECE
// Niente domande e nessun tocco in più. Finché non c'è niente da perdere il
// tocco fuori chiude come sempre; appena c'è, quel tocco smette di chiudere e
// la finestra risponde con un movimento che indica la ✕. Le due vie d'uscita
// volute — la ✕ e «Annulla» — restano quelle di prima, perché si toccano
// apposta e non per sbaglio.
//
// PERCHÉ UN MODULO A PARTE, PURO
// Il difetto che questa funzione può avere è silenzioso in tutte e due le
// direzioni: se dicesse sempre «sì» la finestra non si chiuderebbe più col
// tocco fuori, se dicesse sempre «no» la protezione sparirebbe senza che niente
// lo dica. E ne ha un terzo, peggiore: basta aggiungere un campo al modulo e
// scordarsi di elencarlo qui perché quel campo resti scoperto — di nuovo in
// silenzio. Da qui `scripts/check-bozza.mjs`, che l'elenco non lo dà per buono:
// lo confronta con i campi che `ShiftForm.jsx` modifica davvero.

/**
 * I campi del modulo che l'utente può toccare.
 *
 * NON c'è `fonteOrari`: non è un dato inserito, è l'etichetta di dove viene la
 * proposta degli orari. Tenerlo qui dentro farebbe risultare «da salvare» una
 * finestra appena aperta in cui nessuno ha fatto niente.
 */
export const CAMPI_BOZZA = [
  'kind',
  'date',
  'startTime',
  'endTime',
  'breakMinutes',
  'surchargePct',
  'absenceHours',
  'dateTo',
  'note',
];

// I campi passano dagli `<input>`, che restituiscono sempre stringhe: `30` e
// `'30'` sono lo stesso valore per chi guarda lo schermo, e devono esserlo
// anche qui. Senza questo, toccare un preset della pausa e rimetterlo com'era
// lascerebbe la finestra bloccata per un numero che non è cambiato.
function normalizza(valore) {
  if (valore === null || valore === undefined) return '';
  return String(valore).trim();
}

/**
 * C'è lavoro non salvato dentro il modulo del turno?
 *
 * @param {object} arg
 * @param {object} arg.iniziale lo stato con cui la finestra si è aperta
 * @param {object} arg.form lo stato adesso
 * @param {object} arg.modifiche correzioni riga per riga del periodo di assenza
 * @returns {boolean}
 */
export function bozzaDaSalvare({ iniziale, form, modifiche } = {}) {
  // Le righe corrette a mano bastano da sole: sono il lavoro più lungo e più
  // caro da rifare di tutta l'app.
  if (modifiche && Object.keys(modifiche).length > 0) return true;
  if (!iniziale || !form) return false;

  // Chi cambia idea e rimette tutto com'era non resta chiuso dentro: si
  // confrontano i valori, non il fatto che qualcuno abbia digitato.
  return CAMPI_BOZZA.some(
    (campo) => normalizza(form[campo]) !== normalizza(iniziale[campo]),
  );
}
