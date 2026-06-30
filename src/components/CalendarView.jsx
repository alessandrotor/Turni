import { useState } from 'react';
import {
  formatDate, formatMonthYear, isToday, isWeekend,
  addMonths, getMonthStart, getDaysInMonth, isCurrentMonth,
} from '../utils/dates';
import { calcShiftMinutes, calcPay, formatCurrency } from '../utils/pay';
import { generateMonthlySummary } from '../services/ai';

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function formatMinutesShort(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function CalendarView({
  currentMonth,
  onMonthChange,
  shifts,
  onAddShift,
  onEditShift,
  settings,
}) {
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  // Monday-first offset
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = Math.ceil((firstOffset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstOffset + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  // Group shifts by date
  const byDate = {};
  shifts.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  // Monthly totals
  const totalMins = shifts.reduce((sum, s) => sum + calcShiftMinutes(s), 0);
  const totalHours = totalMins / 60;
  const pay = calcPay(totalHours, settings.hourlyRate);

  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY;

  async function handleAISummary() {
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    try {
      const text = await generateMonthlySummary(shifts, currentMonth, settings);
      setAiSummary(text);
    } catch (e) {
      setAiError(e.message || 'Errore durante la generazione del riepilogo');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="calendar-view">
      {/* Month navigation */}
      <div className="cal-header">
        <button
          className="week-nav-btn"
          onClick={() => { onMonthChange(addMonths(currentMonth, -1)); setAiSummary(null); }}
          aria-label="Mese precedente"
        >
          ‹
        </button>
        <div className="cal-header-center">
          <span className="cal-month-name">{formatMonthYear(currentMonth)}</span>
          {!isCurrentMonth(currentMonth) && (
            <button
              className="week-today-btn"
              onClick={() => { onMonthChange(getMonthStart(new Date())); setAiSummary(null); }}
            >
              Oggi
            </button>
          )}
        </div>
        <button
          className="week-nav-btn"
          onClick={() => { onMonthChange(addMonths(currentMonth, 1)); setAiSummary(null); }}
          aria-label="Mese successivo"
        >
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {DAY_HEADERS.map(d => (
          <div key={d} className="cal-day-header">{d}</div>
        ))}

        {cells.map((dayNum, i) => {
          if (!dayNum) return <div key={`e${i}`} className="cal-cell cal-cell--empty" />;

          const date = new Date(year, month, dayNum);
          const dateStr = formatDate(date);
          const dayShifts = byDate[dateStr] || [];
          const today = isToday(date);
          const weekend = isWeekend(date);

          return (
            <div
              key={dateStr}
              className={[
                'cal-cell',
                today ? 'cal-cell--today' : '',
                weekend ? 'cal-cell--weekend' : '',
              ].join(' ')}
              onClick={() => onAddShift(dateStr)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onAddShift(dateStr)}
            >
              <span className={`cal-day-num${today ? ' cal-day-num--today' : ''}`}>
                {dayNum}
              </span>
              <div className="cal-shifts">
                {dayShifts.map(s => (
                  <div
                    key={s.id}
                    className="cal-shift-pill"
                    onClick={e => { e.stopPropagation(); onEditShift(s); }}
                    title={`${s.startTime}–${s.endTime}${s.note ? ` | ${s.note}` : ''}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onEditShift(s); } }}
                  >
                    {s.startTime}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly summary */}
      <div className="cal-summary">
        <div className="cal-summary-row">
          <div className="summary-item">
            <span className="summary-label">Turni</span>
            <span className="summary-value">{shifts.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Ore lavorate</span>
            <span className="summary-value">{formatMinutesShort(totalMins)}</span>
          </div>
          {pay !== null && (
            <div className="summary-item">
              <span className="summary-label">Retribuzione stimata</span>
              <span className="summary-value diff-positive">{formatCurrency(pay)}</span>
            </div>
          )}
        </div>

        {/* AI section */}
        <div className="ai-panel">
          {hasApiKey ? (
            <button
              className="btn-ai"
              onClick={handleAISummary}
              disabled={aiLoading || shifts.length === 0}
            >
              {aiLoading ? '⏳ Elaborazione…' : '✦ Riepilogo AI'}
            </button>
          ) : (
            <p className="ai-hint">
              Aggiungi <code>VITE_ANTHROPIC_API_KEY</code> in <code>.env.local</code> per il riepilogo AI con Claude Opus.
            </p>
          )}
          {aiError && <p className="ai-error">{aiError}</p>}
          {aiSummary && <p className="ai-summary-text">{aiSummary}</p>}
        </div>
      </div>
    </div>
  );
}
