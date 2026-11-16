// «Mi riprendono il tratt. integrativo: ci perdo?» dentro l'app (novembre 2026,
// mockup B1). Chi arriva senza turni — da un link, da Google, da un collega —
// ha in testa questa domanda e nessun dato inserito: una riga accanto a «Turni
// da un messaggio», niente cifre finché non la tocca. Toccata, una finestra
// chiede un dato solo (il lordo dell'anno, col contratto accanto) e risponde
// con la stessa bilancia del riquadro. Appena ci sono turni la riga sparisce:
// risponde il riquadro, coi numeri veri.
//
// Il link `?ciperdo` apre l'app con la finestra già aperta, anche a chi ha già
// i turni: è il link da mandare a un collega.
//
// La regola sul messaggio (docs/piano-per-agenti.md): accanto al tratt.
// integrativo ripreso ci sono sempre le tasse che tornano. Cifre da `ciPerdo()`
// (motore/restituzione.js); la finestra non salva niente, è una simulazione.

import { useMemo, useRef, useState } from 'react';
import { ciPerdo, POSIZIONE } from '../motore/restituzione';
import { CONTRATTI } from '../motore/contratti/index.js';
import { euroCella } from '../utils/formato';
import useModalDismiss from '../hooks/useModalDismiss';
import useOccupato from '../hooks/useOccupato';
import Icona from './Icona';
import Bilancia from './Bilancia';

const VERDE = '#059669', ROSSO = '#dc2626';
const DAL_LINK = (() => {
  try { return new URLSearchParams(window.location.search).has('ciperdo'); } catch { return false; }
})();

// «16.700», «16700,50», «16 700 €»: chi scrive una cifra in italiano mette i punti.
const leggiEuro = (testo) => {
  const pulito = String(testo).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(pulito);
  return Number.isFinite(n) ? n : 0;
};
const tondo = (n) => Math.round(Math.abs(n) / 10) * 10;

function Risposta({ lordo, impostazioni }) {
  const r = useMemo(() => ciPerdo(lordo, impostazioni), [lordo, impostazioni]);
  if (!(lordo > 0)) return null;
  const titolo = `A ${euroCella(lordo)} lordi`;
  if (r.posizione === POSIZIONE.SOTTO) {
    return r.spetta
      ? <p style={{ margin: '.8rem 0 0' }}><strong style={{ color: VERDE }}>No: non te lo riprendono.</strong>{' '}
          Prima della soglia ti restano ~{euroCella(tondo(r.margine))} lordi.</p>
      : <p style={{ margin: '.8rem 0 0' }}><strong>Con questo lordo il tratt. integrativo non spetta:</strong>{' '}
          le detrazioni azzerano già l'IRPEF, quindi non c'è niente da riprendere.</p>;
  }
  if (r.posizione === POSIZIONE.DENTRO) {
    return (
      <Bilancia titolo={titolo} perso={r.perso} compensa={r.compensa} colore={ROSSO}
        conclusione={`Alla fine ci perdi ~${euroCella(tondo(r.totale))}`}
        sotto={r.mancaPareggio > 0 ? `e bastano ~${euroCella(tondo(r.mancaPareggio))} lordi in più per tornare in pari` : null} />
    );
  }
  return (
    <Bilancia titolo={titolo} perso={r.perso} compensa={r.compensa} etichettaCompensa="Tasse in meno e lavoro in più" colore={VERDE}
      conclusione={`In tasca hai ~${euroCella(tondo(r.totale))} in più`}
      sotto="rispetto a fermarti alla soglia. La trattenuta in busta a dicembre è normale." />
  );
}

function Finestra({ settings, onChiudi }) {
  const ref = useRef(null);
  useModalDismiss(ref, onChiudi, true);
  useOccupato('ciPerdo', true);
  const [testo, setTesto] = useState('');
  const [ccnl, setCcnl] = useState(settings.ccnl || '');
  const impostazioni = useMemo(() => ({ ...settings, ccnl }), [settings, ccnl]);
  const lordo = leggiEuro(testo);
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label="Ci perdo?">
        <div className="modal-header">
          <h2 className="modal-title">Ci perdo?</h2>
          <button type="button" className="modal-close" onClick={onChiudi} aria-label="Chiudi">✕</button>
        </div>
        <div className="modal-form">
          <p className="form-hint" style={{ marginTop: 0 }}>A dicembre in busta può comparire una trattenuta del tratt. integrativo. Quanto conta davvero:</p>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" htmlFor="cp-lordo">Lordo dell'anno</label>
              <input id="cp-lordo" className="form-input" inputMode="decimal" placeholder="es. 16.000" value={testo}
                onChange={(e) => setTesto(e.target.value)} style={{ fontWeight: 700 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" htmlFor="cp-ccnl">Contratto</label>
              <select id="cp-ccnl" className="form-input" value={ccnl} onChange={(e) => setCcnl(e.target.value)}>
                <option value="">Non lo so</option>
                {Object.values(CONTRATTI).map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <Risposta lordo={lordo} impostazioni={impostazioni} />
          <p className="form-hint">Segna i turni e la stima si fa da sola, coi tuoi numeri. Stima BETA, su un solo datore di lavoro.</p>
        </div>
      </div>
    </div>
  );
}

/** La riga per chi non ha turni, e la finestra (anche dal link `?ciperdo`). */
export default function CiPerdo({ settings, riga }) {
  const [aperta, setAperta] = useState(DAL_LINK);
  const chiudi = () => {
    setAperta(false);
    if (DAL_LINK) { try { window.history.replaceState({}, '', window.location.pathname); } catch { /* niente */ } }
  };
  return (
    <>
      {riga && (
        <button type="button" className="btn-import" onClick={() => setAperta(true)}>
          <Icona nome="soldi" /> Mi riprendono il tratt. integrativo: ci perdo?
        </button>
      )}
      {aperta && <Finestra settings={settings} onChiudi={chiudi} />}
    </>
  );
}
