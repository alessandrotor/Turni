import { useState } from 'react';

// La domanda sulle maggiorazioni, fatta DOPO e senza fermare nessuno: una striscia in fondo allo
// schermo che arriva a turno già salvato. Non è un modale (nessuno sfondo scuro, nessun fuoco della
// tastiera): si può continuare a usare l'app e sparisce alla prossima cosa che si fa.
//
// Due passi, e il primo ha solo due pulsanti (sì/no): il campo col numero compare solo dopo un «sì».
// Il «no» chiude la domanda per sempre (`maggiorazioniNonDovute` nei settings). `tipico` finisce nel
// placeholder, non nel valore: le percentuali tipiche vengono da UN contratto, e il valore lo mette
// l'utente leggendo la propria busta.
export default function AvvisoMaggiorazione({ avviso, onImposta, onNonNeHo, onChiudi }) {
  const [passo, setPasso] = useState('domanda'); // domanda | percentuale | fatto
  const [pct, setPct] = useState('');

  if (!avviso) return null;

  const conferma = () => {
    const v = Number(String(pct).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    onImposta(avviso.chiave, v);
    // `dopo` esiste solo quando resta qualcosa di vero da dire (oggi la fascia notturna non
    // dichiarata); senza, si chiude e basta.
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
