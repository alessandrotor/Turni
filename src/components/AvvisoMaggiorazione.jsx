import { useState } from 'react';

// La domanda sulle maggiorazioni, fatta DOPO e senza fermare nessuno.
//
// COS'ERA PRIMA
// Un riquadro dentro il modulo del turno: compariva mentre si compilavano gli
// orari e chiedeva la percentuale lì, in mezzo. Non bloccava il salvataggio, ma
// stava fra l'utente e la cosa che stava facendo — ed è attrito anche quando lo
// si può ignorare, perché va comunque letto per decidere di ignorarlo.
//
// COS'È ADESSO
// Una striscia in fondo allo schermo che arriva a turno già salvato. Non copre
// l'app, non ha uno sfondo scuro dietro, non prende il fuoco della tastiera e
// non ha un pulsante «annulla»: si può semplicemente continuare a usare l'app e
// sparisce alla prossima cosa che si fa. Non è un modale, e non deve diventarlo.
//
// DUE PASSI, E IL PRIMO HA SOLO DUE PULSANTI
// La domanda vera è «ti pagano di più?», e le risposte sono sì e no: nessuna
// delle due richiede di sapere cos'è una maggiorazione o di andare a cercare una
// percentuale. Il campo con il numero compare solo dopo un «sì» — cioè solo a
// chi ha detto di avere qualcosa da scriverci. Chi risponde «no» chiude la
// domanda per sempre (sta nei settings, come tutto il resto: `maggiorazioniNonDovute`).
//
// PERCHÉ IL NUMERO NON È PRECOMPILATO
// `tipico` finisce nel placeholder, non nel valore. Le percentuali tipiche
// vengono dai cedolini di UN contratto: scriverle dentro il campo pronte da
// confermare significherebbe far entrare nel motore un numero che nessuno ha
// letto sulla propria busta. Il segnaposto suggerisce, il valore lo mette
// l'utente.
export default function AvvisoMaggiorazione({ avviso, onImposta, onNonNeHo, onChiudi }) {
  const [passo, setPasso] = useState('domanda'); // domanda | percentuale | fatto
  const [pct, setPct] = useState('');

  if (!avviso) return null;

  const conferma = () => {
    const v = Number(String(pct).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    onImposta(avviso.chiave, v);
    // `dopo` esiste solo quando resta qualcosa di vero da dire — oggi il caso
    // della fascia notturna che nessun contratto ha dichiarato. Senza, si chiude
    // e basta: una schermata di conferma per dire «fatto» è un tocco regalato.
    if (avviso.dopo) setPasso('fatto');
    else onChiudi();
  };

  return (
    <div className="avviso-magg" role="status" aria-live="polite">
      <button
        type="button"
        className="avviso-magg-chiudi"
        onClick={onChiudi}
        aria-label="Chiudi l'avviso"
      >
        ×
      </button>

      {passo === 'domanda' && (
        <>
          <strong className="avviso-magg-titolo">{avviso.titolo}</strong>
          <p className="avviso-magg-testo">{avviso.domanda}</p>
          <div className="avviso-magg-azioni">
            <button type="button" className="btn btn-primary" onClick={() => setPasso('percentuale')}>
              Sì
            </button>
            <button type="button" className="btn btn-secondary" onClick={onNonNeHo}>
              No
            </button>
          </div>
        </>
      )}

      {passo === 'percentuale' && (
        <>
          <strong className="avviso-magg-titolo">Quanto in più?</strong>
          <p className="avviso-magg-testo">{avviso.costo}</p>
          <div className="avviso-magg-azioni">
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                className="form-input form-input--with-symbol"
                type="text"
                inputMode="decimal"
                autoFocus
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') conferma(); }}
                placeholder={String(avviso.tipico)}
                aria-label="Percentuale di maggiorazione"
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={conferma}>
              Imposta
            </button>
          </div>
          <p className="avviso-magg-nota">
            È la percentuale in più rispetto all'ora normale: la trovi in busta.
          </p>
        </>
      )}

      {passo === 'fatto' && (
        <>
          <strong className="avviso-magg-titolo">Fatto</strong>
          <p className="avviso-magg-testo">{avviso.dopo}</p>
          <div className="avviso-magg-azioni">
            <button type="button" className="btn btn-secondary" onClick={onChiudi}>
              Ho capito
            </button>
          </div>
        </>
      )}
    </div>
  );
}
