import { useState, useRef } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import { parseNum } from '../utils/pay';
import { consigliatiMancanti } from '../utils/configurazione';

// I campi che mancano, compilabili qui.
//
// Prima «Sistemale» portava in Impostazioni e lasciava l'utente davanti a
// sedici sezioni chiuse, a cercare da solo le cose che gli erano appena state
// nominate. Chiedere e poi non far compilare è il modo migliore per far
// abbandonare a metà.
//
// Chi vuole il resto trova comunque il collegamento in fondo.

export default function SistemaMancanti({ settings, onSalva, onChiudi, onVaiAImpostazioni }) {
  const dialogRef = useRef(null);
  useModalDismiss(dialogRef, onChiudi);

  const voci = consigliatiMancanti(settings);
  const [valori, setValori] = useState({});

  const scrivi = (chiave, v) => setValori((p) => ({ ...p, [chiave]: v }));

  const salva = (e) => {
    e.preventDefault();
    const patch = {};
    for (const v of voci) {
      const n = parseNum(valori[v.chiave]);
      // Solo i campi compilati: lasciarne uno vuoto è una risposta legittima
      // («non ce l'ho»), e scriverci zero sarebbe la stessa cosa di prima.
      if (n > 0) patch[v.chiave] = n;
    }
    onSalva(patch);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sm-titolo" ref={dialogRef}>
        <div className="modal-header">
          <h2 className="modal-title" id="sm-titolo">Quello che manca</h2>
          <button type="button" className="modal-close" onClick={onChiudi} aria-label="Chiudi">✕</button>
        </div>

        <form className="modal-form" onSubmit={salva} noValidate>
          <p className="modal-desc">
            Li trovi in busta paga. Quelli che non hai, lasciali vuoti.
          </p>

          {voci.map((v) => (
            <div className="form-group" key={v.chiave}>
              <label className="form-label" htmlFor={`sm-${v.chiave}`}>{v.etichetta}</label>
              <div className="input-with-symbol">
                <span className="input-symbol">%</span>
                <input
                  id={`sm-${v.chiave}`}
                  className="form-input form-input--with-symbol"
                  type="text"
                  inputMode="decimal"
                  value={valori[v.chiave] ?? ''}
                  onChange={(e) => scrivi(v.chiave, e.target.value)}
                  placeholder={String(v.tipico ?? '')}
                />
              </div>
              <p className="form-hint">{v.perche}</p>
            </div>
          ))}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onVaiAImpostazioni}>
              Tutte le impostazioni
            </button>
            <button type="submit" className="btn btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  );
}
