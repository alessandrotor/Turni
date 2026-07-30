import { useState, useRef } from 'react';
import { formatDate, minutesDiff, formatMinutes } from '../utils/dates';
import useModalDismiss from '../hooks/useModalDismiss';

const BREAK_PRESETS = [
  { label: 'Nessuna', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 ora', value: 60 },
];

const SURCHARGE_PRESETS = [
  { label: 'Nessuna', value: 0 },
  { label: '10%', value: 10 },
  { label: '15%', value: 15 },
  { label: '30%', value: 30 },
  { label: '50%', value: 50 },
];

function getInitialState(modal) {
  if (modal.type === 'edit') {
    const s = modal.shift;
    return {
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes ?? 0,
      surchargePct: s.surchargePct ?? 0,
      note: s.note ?? '',
    };
  }
  return {
    date: modal.date ?? formatDate(new Date()),
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 0,
    surchargePct: 0,
    note: '',
  };
}

export default function ShiftForm({ modal, onSave, onDelete, onClose }) {
  // Stato iniziale calcolato una volta sola e condiviso dai due useState:
  // ricostruirlo per il secondo era lavoro sprecato a ogni mount del modale.
  const initial = useRef(null);
  if (initial.current === null) initial.current = getInitialState(modal);

  const [form, setForm] = useState(initial.current);
  const [customBreak, setCustomBreak] = useState(false);
  const [customSurcharge, setCustomSurcharge] = useState(
    () => !SURCHARGE_PRESETS.some(p => p.value === Number(initial.current.surchargePct)),
  );

  const dialogRef = useRef(null);
  useModalDismiss(dialogRef, onClose);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // minutesDiff ritorna 0 su orari non validi (campo svuotato), quindi qui non
  // serve più intercettare nulla: la preview non può mostrare NaN.
  const workedMins = Math.max(0, minutesDiff(form.startTime, form.endTime) - (Number(form.breakMinutes) || 0));

  const handleBreakPreset = (val) => {
    setCustomBreak(false);
    setForm(f => ({ ...f, breakMinutes: val }));
  };

  const handleSurchargePreset = (val) => {
    setCustomSurcharge(false);
    setForm(f => ({ ...f, surchargePct: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const shift = {
      ...(modal.type === 'edit' ? { id: modal.shift.id } : {}),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes) || 0,
      surchargePct: Number(form.surchargePct) || 0,
      note: form.note.trim(),
    };
    onSave(shift);
  };

  const isEdit = modal.type === 'edit';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={isEdit ? 'Modifica turno' : 'Nuovo turno'}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Modifica turno' : 'Nuovo turno'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="shift-date">Data</label>
            <input
              id="shift-date"
              type="date"
              className="form-input"
              value={form.date}
              onChange={set('date')}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="shift-start">Inizio</label>
              <input
                id="shift-start"
                type="time"
                className="form-input"
                value={form.startTime}
                onChange={set('startTime')}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="shift-end">Fine</label>
              <input
                id="shift-end"
                type="time"
                className="form-input"
                value={form.endTime}
                onChange={set('endTime')}
                required
              />
            </div>
          </div>

          {/* Preview ore lavorate */}
          <div className="worked-preview">
            <span className="worked-preview-label">Ore lavorate:</span>
            <span className="worked-preview-value">{formatMinutes(workedMins)}</span>
            {minutesDiff(form.startTime, form.endTime) > 12 * 60 && (
              <span className="worked-preview-note">(turno notturno)</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Pausa</label>
            <div className="break-presets">
              {BREAK_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`break-preset-btn ${!customBreak && form.breakMinutes === p.value ? 'active' : ''}`}
                  onClick={() => handleBreakPreset(p.value)}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className={`break-preset-btn ${customBreak ? 'active' : ''}`}
                onClick={() => setCustomBreak(true)}
              >
                Altra
              </button>
            </div>
            {customBreak && (
              <div className="form-row form-row--compact">
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="480"
                  step="5"
                  placeholder="Minuti di pausa"
                  value={form.breakMinutes}
                  onChange={(e) => setForm(f => ({ ...f, breakMinutes: Number(e.target.value) }))}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Maggiorazione (%)</label>
            <div className="break-presets">
              {SURCHARGE_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`break-preset-btn ${!customSurcharge && Number(form.surchargePct) === p.value ? 'active' : ''}`}
                  onClick={() => handleSurchargePreset(p.value)}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className={`break-preset-btn ${customSurcharge ? 'active' : ''}`}
                onClick={() => setCustomSurcharge(true)}
              >
                Altra
              </button>
            </div>
            {customSurcharge && (
              <div className="form-row form-row--compact">
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="200"
                  step="0.5"
                  placeholder="% maggiorazione"
                  value={form.surchargePct}
                  onChange={(e) => setForm(f => ({ ...f, surchargePct: e.target.value }))}
                />
              </div>
            )}
            <p className="form-hint">
              Per festivi, notturni, straordinari… La maggiorazione domenicale delle
              Impostazioni si applica automaticamente e si somma a questa.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="shift-note">Note (opzionale)</label>
            <input
              id="shift-note"
              type="text"
              className="form-input"
              placeholder="es. straordinario, sostituzione..."
              value={form.note}
              onChange={set('note')}
              maxLength={100}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? 'Salva modifiche' : 'Aggiungi turno'}
            </button>
          </div>

          {isEdit && onDelete && (
            <button
              type="button"
              className="btn btn-danger-ghost btn--full"
              onClick={() => onDelete(modal.shift.id)}
            >
              🗑 Elimina turno
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
