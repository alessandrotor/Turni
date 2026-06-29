import { useState, useEffect } from 'react';
import { formatDate } from '../utils/dates';
import { minutesDiff, formatMinutes } from '../utils/dates';

const BREAK_PRESETS = [
  { label: 'Nessuna', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 ora', value: 60 },
];

function getInitialState(modal) {
  if (modal.type === 'edit') {
    const s = modal.shift;
    return {
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes ?? 0,
      note: s.note ?? '',
    };
  }
  return {
    date: modal.date ?? formatDate(new Date()),
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 0,
    note: '',
  };
}

export default function ShiftForm({ modal, onSave, onClose }) {
  const [form, setForm] = useState(() => getInitialState(modal));
  const [customBreak, setCustomBreak] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const workedMins = (() => {
    try {
      const total = minutesDiff(form.startTime, form.endTime);
      return Math.max(0, total - (form.breakMinutes || 0));
    } catch {
      return 0;
    }
  })();

  const handleBreakPreset = (val) => {
    setCustomBreak(false);
    setForm(f => ({ ...f, breakMinutes: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const shift = {
      ...(modal.type === 'edit' ? { id: modal.shift.id } : {}),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes) || 0,
      note: form.note.trim(),
    };
    onSave(shift);
  };

  const isEdit = modal.type === 'edit';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={isEdit ? 'Modifica turno' : 'Nuovo turno'}>
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
        </form>
      </div>
    </div>
  );
}
