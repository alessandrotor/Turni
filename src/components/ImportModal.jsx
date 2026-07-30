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

export default function ImportModal({ shifts, onConfirm, onClose }) {
  const ref = useRef(null);
  const dialogRef = useRef(null);
  useModalDismiss(dialogRef, onClose);

  return (
    <div className="modal-overlay" onClick={e => e.target === ref.current && onClose()} ref={ref}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Conferma importazione">
        <div className="modal-header">
          <span className="modal-title">Conferma importazione</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="import-body">
          <p className="import-intro">
            Trovati <strong>{shifts.length} turni</strong>. Controlla e conferma.
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
