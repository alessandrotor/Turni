import { ETICHETTA, TIPO, tipoTurno } from '../motore/assenze';

// «L'ho cancellato per sbaglio»: la via di ritorno, invece della domanda prima.
//
// PERCHÉ NON UNA CONFERMA
// La strada ovvia sarebbe «sei sicuro?» prima di cancellare. Costa un tocco a
// TUTTI, ogni volta, per un errore che capita di rado — e chi impara a chiudere
// una domanda a riflesso poi chiude anche quelle che contavano. Qui la
// cancellazione avviene subito, come prima, e chi sbaglia ha qualche secondo
// per tornare indietro. Nessuno paga per l'errore di qualcun altro.
//
// PERCHÉ NOMINA IL TURNO
// Lo slot è uno solo: una seconda cancellazione sostituisce la prima. Se la
// striscia dicesse «Eliminato» e basta, dopo due tocchi rapidi non ci sarebbe
// modo di sapere quale turno si sta per far tornare. Dicendo giorno e orari,
// «Annulla» è una scelta invece di una scommessa.
//
// SOSTITUZIONE: ferie salvate dove c'era lavoro, o viceversa, lo tolgono
// (`utils/sostituzioni.js`). Stessa striscia; «Annulla» rimette com'era.
export default function AvvisoAnnulla({ descritti = [], sostituiti = false, onAnnulla, onChiudi }) {
  const turno = descritti[0];
  const tipo = tipoTurno(turno);
  const giorno = Number(String(turno?.date ?? '').slice(8, 10)) || '';
  const che = tipo === TIPO.LAVORO
    ? `Turno del ${giorno}, ${turno?.startTime}–${turno?.endTime}`
    : `${ETICHETTA[tipo]} del ${giorno}`;
  const testo = !sostituiti ? `${che} — eliminato.`
    : descritti.length > 1 ? `Sostituite ${descritti.length} giornate.` : `Sostituito: ${che}.`;

  return (
    <div className="avviso-agg avviso-annulla" role="status" aria-live="polite">
      <span className="avviso-agg-testo">{testo}</span>
      <div className="avviso-agg-azioni">
        <button type="button" className="btn btn-primary" onClick={onAnnulla}>
          Annulla
        </button>
        <button
          type="button"
          className="avviso-agg-chiudi"
          onClick={onChiudi}
          aria-label="Va bene così"
        >
          ×
        </button>
      </div>
    </div>
  );
}
