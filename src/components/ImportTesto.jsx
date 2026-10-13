import { useMemo, useRef, useState } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import useOccupato from '../hooks/useOccupato';
import { leggiTestoTurni } from '../utils/testo-turni';
import { turniDaImportare } from '../utils/import-turni';
import { minutesDiff, formatMinutes } from '../utils/dates';
import { ShiftPreviewRow } from './ImportModal';

// «Incolla i turni da un messaggio»: il testo si legge sul telefono, non va a
// nessun servizio (utils/testo-turni.js). Per questo non ha l'avviso della foto.
//
// Il modulo è uno solo: si incolla, e sotto compare subito cosa è stato capito.
// Niente passaggio intermedio, niente domande: l'unica cosa che si può toccare
// è «Parti da», e compare solo quando le date sono state dedotte dal nome del
// giorno («Lun» non dice quale lunedì).
export default function ImportTesto({ esistenti = [], onConfirm }) {
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const [inizio, setInizio] = useState('');
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  const chiudi = () => { setAperto(false); setTesto(''); setInizio(''); };
  // Con del testo incollato un tocco fuori o Esc non lo buttano: si chiude
  // dalla ✕ o da «Annulla». Senza testo non c'è niente da perdere.
  const tentaChiudi = () => { if (!testo.trim()) chiudi(); };
  useModalDismiss(dialogRef, tentaChiudi, aperto);
  useOccupato('importTesto', aperto && !!testo.trim());

  const letto = useMemo(
    () => (aperto && testo.trim() ? leggiTestoTurni(testo, { oggi: new Date(), inizio }) : null),
    [aperto, testo, inizio],
  );

  const { daSalvare, suAssenza, doppioni } = letto
    ? turniDaImportare(letto.turni, esistenti)
    : { daSalvare: [], suAssenza: [], doppioni: 0 };
  const totale = letto
    ? letto.turni.reduce((s, t) => s + Math.max(0, minutesDiff(t.startTime, t.endTime) - (t.breakMinutes || 0)), 0)
    : 0;
  const saltatiGiorni = [
    suAssenza.length > 0 && `${suAssenza.length} su giorni di ferie o malattia`,
    doppioni > 0 && `${doppioni} già segnat${doppioni === 1 ? 'o' : 'i'}`,
  ].filter(Boolean);

  const conferma = () => {
    onConfirm(letto.turni);
    chiudi();
  };

  return (
    <>
      <button className="btn-import" onClick={() => setAperto(true)}>
        📋 Incolla turni da un messaggio
      </button>

      {aperto && (
        <div className="modal-overlay" ref={overlayRef}
          onClick={(e) => e.target === overlayRef.current && tentaChiudi()}>
          <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Incolla i turni">
            <div className="modal-header">
              <span className="modal-title">Incolla i turni</span>
              <button className="modal-close" onClick={chiudi}>✕</button>
            </div>

            <div className="import-body">
              <textarea
                autoFocus
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder={'Incolla qui il messaggio, per esempio:\nLun 8-16, Mar 10-18, Mer riposo\noppure 05/10 8:00-16:00'}
                aria-label="Testo con i turni"
                style={{ width: '100%', minHeight: '4.5rem', font: 'inherit', padding: '.6rem', borderRadius: '8px',
                  border: '1px solid var(--border, #cfd4dc)', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <p className="import-intro" style={{ marginTop: '.4rem', fontSize: '.8rem', opacity: .8 }}>
                Il testo resta sul telefono: non viene inviato a nessun servizio.
              </p>

              {letto && (
                <>
                  {letto.turni.length > 0 && (
                    <p className="import-intro">
                      Trovati <strong>{letto.turni.length} turn{letto.turni.length === 1 ? 'o' : 'i'}</strong> · totale{' '}
                      <strong>{formatMinutes(totale)}</strong>. Controlla le date.
                    </p>
                  )}

                  {letto.serveInizio && (
                    <p className="import-match" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Date dedotte dai nomi dei giorni. Parti da</span>
                      <input
                        type="date"
                        value={inizio || letto.inizioUsato || ''}
                        onChange={(e) => setInizio(e.target.value)}
                        aria-label="Primo giorno"
                      />
                    </p>
                  )}

                  {letto.avvisi.map((a) => <p key={a} className="import-match import-match--warn">⚠️ {a}</p>)}
                  {saltatiGiorni.length > 0 && (
                    <p className="import-match import-match--warn">Salto {saltatiGiorni.join(' e ')}.</p>
                  )}
                  {letto.saltati.length > 0 && (
                    <p className="import-match">
                      Non sono turni: {letto.saltati.map((s) => `${s.etichetta} ${s.motivo}`).join(', ')}.
                    </p>
                  )}
                  {letto.nonCapite.length > 0 && (
                    <p className="import-match import-match--warn">
                      Non ho capito: {letto.nonCapite.map((n) => `«${n.testo}»`).join(', ')}.
                    </p>
                  )}

                  <div className="import-list">
                    {letto.turni
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                      .map((t) => <ShiftPreviewRow key={`${t.date}|${t.startTime}|${t.endTime}`} shift={t} />)}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '0 1.25rem 1.25rem' }}>
              <button className="btn btn-secondary" onClick={chiudi}>Annulla</button>
              <button className="btn btn-primary" onClick={conferma} disabled={daSalvare.length === 0}>
                ✓ Importa {daSalvare.length} turn{daSalvare.length === 1 ? 'o' : 'i'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
