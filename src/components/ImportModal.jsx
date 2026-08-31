import { useRef } from 'react';
import { parseDate, formatDayShort, minutesDiff, formatMinutes } from '../utils/dates';
import useModalDismiss from '../hooks/useModalDismiss';

function ShiftPreviewRow({ shift }) {
  const mins = minutesDiff(shift.startTime, shift.endTime) - (shift.breakMinutes || 0);
  const date = parseDate(shift.date);
  const dayName = formatDayShort(date);
  const [, m, d] = shift.date.split('-');

  return (
    <div className="import-row">
      <span className="import-row-date">
        <strong>{dayName}</strong> {d}/{m}
      </span>
      <span className="import-row-times">
        {shift.startTime} – {shift.endTime}
        {shift.breakMinutes > 0 && (
          <span className="import-row-break"> · pausa {shift.breakMinutes}m</span>
        )}
      </span>
      <span className="import-row-hours">{formatMinutes(Math.max(0, mins))}</span>
      {shift.note ? <span className="import-row-note" title={shift.note}>💬</span> : <span />}
    </div>
  );
}

// Confronto tollerante (accenti/maiuscole non contano) fra il nome richiesto
// e la riga che il modello dice di aver trovato: non è una prova — il modello
// può limitarsi a ripetere il nome richiesto anche quando non trova nessuno —
// ma quando i due divergono davvero è un segnale che vale la pena mostrare a
// chi sta rivedendo, invece di lasciarlo scritto solo nei dati grezzi.
function normalizza(s) {
  return String(s || '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}
function sembraCorrispondere(riga, nome) {
  const r = normalizza(riga);
  const parole = normalizza(nome).split(/\s+/).filter(p => p.length >= 3);
  if (!r || parole.length === 0) return true; // niente da confrontare: non segnalare
  return parole.some(p => r.includes(p));
}

export default function ImportModal({ shifts, workerName, onConfirm, onClose }) {
  const ref = useRef(null);
  const dialogRef = useRef(null);
  useModalDismiss(dialogRef, onClose);

  // Totale ore di tutti i turni riconosciuti: un colpo d'occhio per accorgersi
  // subito se il conteggio non torna (orario letto male, turno di troppo...).
  const totalMinutes = shifts.reduce(
    (sum, s) => sum + Math.max(0, minutesDiff(s.startTime, s.endTime) - (s.breakMinutes || 0)),
    0,
  );

  // La riga che il modello dice di aver abbinato: di norma è la stessa per
  // tutti i turni di un singolo import (una sola persona per richiesta).
  const rigaTrovata = shifts.find(s => s._riga)?._riga || '';
  const rigaSospetta = rigaTrovata && !sembraCorrispondere(rigaTrovata, workerName);

  return (
    <div className="modal-overlay" onClick={e => e.target === ref.current && onClose()} ref={ref}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Conferma importazione">
        <div className="modal-header">
          <span className="modal-title">Conferma importazione</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="import-body">
          {rigaTrovata && (
            <p className={rigaSospetta ? 'import-match import-match--warn' : 'import-match'}>
              {rigaSospetta ? '⚠️ ' : ''}Turni trovati per: <strong>{rigaTrovata}</strong>
              {rigaSospetta && workerName && <> (avevi chiesto: <strong>{workerName}</strong>)</>}
            </p>
          )}
          <p className="import-intro">
            Trovati <strong>{shifts.length} turni</strong> · totale{' '}
            <strong>{formatMinutes(totalMinutes)}</strong>. Controlla e conferma.
          </p>

          <div className="import-list">
            {shifts
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))
              .map(s => <ShiftPreviewRow key={`${s.date}|${s.startTime}|${s.endTime}`} shift={s} />)
            }
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '0 1.25rem 1.25rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={() => onConfirm(shifts)}>
            ✓ Importa {shifts.length} turni
          </button>
        </div>
      </div>
    </div>
  );
}
