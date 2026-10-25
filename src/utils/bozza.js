// «C'è qualcosa da perdere?»: la domanda che il modulo del turno si fa prima di lasciarsi
// chiudere da un tocco sull'area scura attorno.
//
// Non una conferma «annulla modifiche?» (costa un tocco a tutti per un errore che capita a
// uno), e un annulla DOPO non esiste: una bozza chiusa non è mai stata scritta da nessuna
// parte. Finché non c'è niente da perdere il tocco fuori chiude; appena c'è, smette e la
// finestra si muove indicando la ✕. Il caso che conta è il PERIODO DI ASSENZA (venti
// giornate corrette riga per riga).
//
// Modulo puro: un campo nuovo nel modulo che nessuno elenca qui resterebbe scoperto in
// silenzio, per questo `scripts/check-bozza.mjs` confronta l'elenco con i campi che
// `ShiftForm.jsx` modifica davvero.

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

// I campi passano dagli `<input>`, che restituiscono stringhe: `30` e `'30'` sono lo stesso
// valore anche qui, altrimenti rimettere un preset com'era lascerebbe la finestra bloccata.
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
