// «C'è una versione nuova»: un'informazione, non una domanda.
//
// Prima non c'era perché non serviva: l'app si aggiornava da sola, ricaricando
// la pagina addosso a chi la stava usando. Tolto quel ricaricamento
// (services/aggiornamento.js), resta da dire che la versione nuova è pronta —
// altrimenti si aspetterebbe la prossima apertura senza saperlo.
//
// PERCHÉ È PIÙ SOTTOTONO DELL'AVVISO SULLE MAGGIORAZIONI
// Quello riguarda soldi contati male e ha un fondo ambrato che chiama
// l'attenzione. Questo non ha nessuna urgenza: se lo si ignora, alla prossima
// apertura l'aggiornamento c'è comunque. Quindi una riga sola, tinta neutra,
// e la × grande quanto il pulsante — perché «dopo» è una risposta legittima
// tanto quanto «adesso».
export default function AvvisoAggiornamento({ onAggiorna, onChiudi }) {
  return (
    <div className="avviso-agg" role="status" aria-live="polite">
      <span className="avviso-agg-testo">C'è una versione nuova di Turni.</span>
      <div className="avviso-agg-azioni">
        <button type="button" className="btn btn-primary" onClick={onAggiorna}>
          Aggiorna
        </button>
        <button
          type="button"
          className="avviso-agg-chiudi"
          onClick={onChiudi}
          aria-label="Non adesso"
        >
          ×
        </button>
      </div>
    </div>
  );
}
