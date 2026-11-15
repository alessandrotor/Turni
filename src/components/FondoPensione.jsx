// Il fondo pensione dentro il riquadro del tratt. integrativo (novembre 2026):
// una riga «ogni 100 € versati, ~23 € tornano col 730» e al tocco una finestra
// col cursore «quanto versi, quanto torna». La riga parla per 100 € e il
// cursore parte da 500: chi guadagna 15.000 l'anno non ne versa 5.300, e
// «5.300 € → 1.219 €» era una promessa per pochi. Il massimo resta in fondo al
// cursore, coi tasselli che dicono quanto di quel che torna è tratt. integrativo.
//
// Cifre tutte dal motore (`motore/fondo-pensione.js`): la deduzione abbassa
// l'imposta, non il reddito, quindi la soglia non si sposta. Dalla norma, non
// da una busta: il 730 non passa dal cedolino, e la finestra lo dice.

import { useMemo, useRef, useState } from 'react';
import { effettoVersamento, versamentoMigliore } from '../motore/fondo-pensione';
import { euroCella } from '../utils/formato';
import useModalDismiss from '../hooks/useModalDismiss';
import useOccupato from '../hooks/useOccupato';
import Icona from './Icona';

const VERDE = '#16a34a', BLU = '#2563eb', ROSSO = '#dc2626';
const PASSO = 50;
const PARTENZA = 500; // € da cui parte il cursore: una cifra che si può versare

/** @type {import('react').CSSProperties} */
const TASSELLO = { borderRadius: 7, color: '#fff', fontSize: '.78rem', fontWeight: 700, display: 'flex', alignItems: 'center',
  padding: '0 .5rem', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0, height: '2.1rem' };

function Finestra({ lordoAnno, settings, anno, iniziale, massimo, onChiudi }) {
  const ref = useRef(null);
  useModalDismiss(ref, onChiudi, true);
  useOccupato('fondoPensione', true);
  const [versi, setVersi] = useState(iniziale);
  const e = effettoVersamento(lordoAnno, settings, versi);
  const tasse = e.voci.irpef + e.voci.addizionali, ti = e.voci.trattamentoIntegrativo;
  return (
    <div className="modal-overlay" onClick={(ev) => ev.target === ev.currentTarget && onChiudi()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label="Fondo pensione">
        <div className="modal-header">
          <h2 className="modal-title">Fondo pensione</h2>
          <button type="button" className="modal-close" onClick={onChiudi} aria-label="Chiudi">×</button>
        </div>
        <div className="modal-form">
          <p className="form-hint" style={{ marginTop: 0 }}>Bonifico al fondo entro il 31 dicembre {anno}</p>
          <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--c-text-2)' }} htmlFor="fp-versi">Se versi</label>
          <strong style={{ display: 'block', fontSize: '1.7rem' }}>{euroCella(e.versamento)}</strong>
          <input id="fp-versi" type="range" min={0} max={massimo} step={PASSO} value={versi}
            onChange={(ev) => setVersi(Number(ev.target.value))} style={{ width: '100%', accentColor: BLU, margin: '.6rem 0 .1rem' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--c-text-2)' }}>
            <span>0</span><span>massimo {euroCella(massimo)}</span>
          </div>
          <p style={{ margin: '1rem 0 0', fontSize: '.85rem', color: 'var(--c-text-2)' }}>col 730, a luglio {anno + 1}, ti tornano</p>
          <strong style={{ display: 'block', fontSize: '1.7rem', color: e.risparmio >= 0 ? VERDE : ROSSO }}>
            {e.risparmio < 0 ? '−' : '~'}{euroCella(Math.abs(e.risparmio))}
          </strong>
          {(tasse > 0 || ti !== 0) && (
            <div style={{ display: 'flex', gap: 4, marginTop: '.5rem' }}>
              {tasse > 0 && <span style={{ ...TASSELLO, flex: tasse, background: BLU }}>tasse {euroCella(tasse)}</span>}
              {ti !== 0 && (
                <span style={{ ...TASSELLO, flex: Math.abs(ti), background: ti > 0 ? VERDE : ROSSO }}>
                  tratt. int. {ti > 0 ? '+' : '−'}{euroCella(Math.abs(ti))}
                </span>
              )}
            </div>
          )}
          {ti < 0 && <p className="form-hint" style={{ color: ROSSO }}>Così l'imposta scende troppo e perdi il tratt. integrativo: versa meno.</p>}
          <p className="form-hint">
            Il reddito per la soglia dei 15.000 non cambia: scende solo l'imposta. Il fondo va dichiarato
            nel 730. Calcolato dalla norma, non da una busta.
          </p>
        </div>
      </div>
    </div>
  );
}

/** La riga nel riquadro del tratt. integrativo, e la finestra che apre. */
export default function FondoPensione({ lordoAnno, settings, anno }) {
  const [aperta, setAperta] = useState(false);
  const meglio = useMemo(() => versamentoMigliore(lordoAnno, settings), [lordoAnno, settings]);
  // Quanto torna ogni 100 €, misurato su 1.000 (la deduzione si arrotonda all'euro).
  const ogni100 = useMemo(() => Math.round(effettoVersamento(lordoAnno, settings, 1000).risparmio / 10), [lordoAnno, settings]);
  // Senza imposta da ridurre (o se 1.000 € tolgono già il tratt. integrativo) non c'è niente da consigliare.
  if (!(meglio.migliore > 0 && ogni100 > 0)) return null;
  return (
    <>
      <button type="button" onClick={() => setAperta(true)}
        style={{ display: 'flex', gap: '.6rem', alignItems: 'center', width: '100%', padding: '.55rem 0', background: 'none', border: 'none',
          borderTop: '1px solid var(--c-border)', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}><Icona nome="soldi" piastrella colore={VERDE} /></span>
        <span style={{ flex: 1 }}>Fondo pensione: ogni 100 € versati, ~{ogni100} € tornano
          <small style={{ display: 'block', color: 'var(--c-text-2)', fontSize: '.78rem' }}>
            col 730, se li versi entro il 31/12
          </small>
        </span>
        <strong style={{ color: BLU, whiteSpace: 'nowrap' }}>Come ›</strong>
      </button>
      {aperta && <Finestra lordoAnno={lordoAnno} settings={settings} anno={anno} iniziale={Math.min(PARTENZA, meglio.migliore)}
        massimo={meglio.massimo} onChiudi={() => setAperta(false)} />}
    </>
  );
}
