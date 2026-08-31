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

  // Ogni voce può portarsi dietro un campo che si legge sulla stessa riga della
  // busta: chiederne uno solo manderebbe a guardare due volte lo stesso foglio.
  const campi = consigliatiMancanti(settings).flatMap((v) => [
    { chiave: v.chiave, etichetta: v.etichettaCampo || v.etichetta, tipico: v.tipico, perche: v.perche },
    ...(v.insieme || []).map((x) => ({ ...x, perche: null })),
  ]);

  // I campi che hanno già un valore partono da quello: sono da confermare, non
  // da riscrivere a memoria.
  const [valori, setValori] = useState(() => {
    const iniziali = {};
    for (const c of campi) {
      const attuale = settings[c.chiave];
      if (Number(attuale) > 0) iniziali[c.chiave] = String(attuale).replace('.', ',');
    }
    return iniziali;
  });

  const scrivi = (chiave, v) => setValori((p) => ({ ...p, [chiave]: v }));

  const salva = (e) => {
    e.preventDefault();
    const patch = {};
    for (const c of campi) {
      const n = parseNum(valori[c.chiave]);
      // Solo i campi compilati: lasciarne uno vuoto è una risposta legittima
      // («non ce l'ho»), e scriverci zero sarebbe la stessa cosa di prima.
      if (n > 0) patch[c.chiave] = n;
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

          {campi.map((c) => (
            <div className="form-group" key={c.chiave}>
              <label className="form-label" htmlFor={`sm-${c.chiave}`}>{c.etichetta}</label>
              <div className="input-with-symbol">
                <span className="input-symbol">%</span>
                <input
                  id={`sm-${c.chiave}`}
                  className="form-input form-input--with-symbol"
                  type="text"
                  inputMode="decimal"
                  value={valori[c.chiave] ?? ''}
                  onChange={(e) => scrivi(c.chiave, e.target.value)}
                  placeholder={String(c.tipico ?? '')}
                />
              </div>
              {c.perche && <p className="form-hint">{c.perche}</p>}
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
