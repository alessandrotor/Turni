import {
  getWeekDays, formatDate, formatDayShort, formatDayNumber,
  formatWeekRange, formatMinutes, isToday, isWeekend, isCurrentWeek,
} from '../utils/dates';
import { calcShiftMinutes, calcWeekTotals, calcTotalPay, formatCurrency } from '../utils/pay';

export default function WeekView({
  currentWeek, onWeekPrev, onWeekNext, onWeekReset,
  shifts, onAddShift, onEditShift, onDeleteShift, settings,
}) {
  const days = getWeekDays(currentWeek);
  const { workedMinutes } = calcWeekTotals(shifts);
  const expectedMinutes = (settings.expectedWeeklyHours || 0) * 60;
  const diffMinutes = workedMinutes - expectedMinutes;
  const pay = calcTotalPay(shifts, settings);
  const isThisWeek = isCurrentWeek(currentWeek);

  const shiftsByDate = {};
  shifts.forEach(s => {
    if (!shiftsByDate[s.date]) shiftsByDate[s.date] = [];
    shiftsByDate[s.date].push(s);
  });

  return (
    <div className="week-view">
      {/* Navigazione settimana */}
      <div className="week-header">
        <button className="week-nav-btn" onClick={onWeekPrev} aria-label="Settimana precedente">‹</button>
        <div className="week-header-center">
          <div className="week-range">{formatWeekRange(currentWeek)}</div>
          {!isThisWeek && (
            <button className="week-today-btn" onClick={onWeekReset}>Questa settimana</button>
          )}
        </div>
        <button className="week-nav-btn" onClick={onWeekNext} aria-label="Settimana successiva">›</button>
      </div>

      {/* Lista giorni */}
      <div className="days-list">
        {days.map(day => {
          const dateStr = formatDate(day);
          const dayShifts = shiftsByDate[dateStr] || [];
          const today = isToday(day);
          const weekend = isWeekend(day);

          return (
            <div
              key={dateStr}
              className={`day-row ${today ? 'day-today' : ''} ${weekend ? 'day-weekend' : ''}`}
            >
              <div className="day-label">
                <span className="day-name">{formatDayShort(day)}</span>
                <span className="day-date">{formatDayNumber(day)}</span>
              </div>

              <div className="day-shifts">
                {dayShifts.length === 0 ? (
                  <button
                    className="add-shift-btn"
                    onClick={() => onAddShift(dateStr)}
                    aria-label={`Aggiungi turno per ${formatDayShort(day)} ${formatDayNumber(day)}`}
                  >
                    + Aggiungi turno
                  </button>
                ) : (
                  <div className="shift-list">
                    {dayShifts.map(shift => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        onEdit={() => onEditShift(shift)}
                        onDelete={() => onDeleteShift(shift.id)}
                      />
                    ))}
                    <button
                      className="add-shift-btn add-shift-btn--secondary"
                      onClick={() => onAddShift(dateStr)}
                      aria-label="Aggiungi altro turno"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Riepilogo settimana */}
      <WeekSummary
        workedMinutes={workedMinutes}
        expectedMinutes={expectedMinutes}
        diffMinutes={diffMinutes}
        pay={pay}
        hourlyRate={settings.hourlyRate}
      />
    </div>
  );
}

function ShiftCard({ shift, onEdit, onDelete }) {
  const workedMins = calcShiftMinutes(shift);

  return (
    <div className="shift-card">
      <div className="shift-times">
        <span className="shift-time-range">{shift.startTime} – {shift.endTime}</span>
        {shift.breakMinutes > 0 && (
          <span className="shift-break">pausa {shift.breakMinutes}min</span>
        )}
      </div>
      <div className="shift-right">
        <span className="shift-hours">{formatMinutes(workedMins)}</span>
        {shift.note && <span className="shift-note" title={shift.note}>📝</span>}
        <button className="shift-action-btn" onClick={onEdit} aria-label="Modifica turno">✎</button>
        <button className="shift-action-btn shift-action-btn--danger" onClick={onDelete} aria-label="Elimina turno">✕</button>
      </div>
    </div>
  );
}

function WeekSummary({ workedMinutes, expectedMinutes, diffMinutes, pay, hourlyRate }) {
  const hasExpected = expectedMinutes > 0;
  const isOver = diffMinutes >= 0;
  const diffClass = hasExpected ? (isOver ? 'diff-positive' : 'diff-negative') : '';

  return (
    <div className="week-summary">
      <div className="summary-row">
        <div className="summary-item">
          <span className="summary-label">Ore lavorate</span>
          <span className="summary-value">{formatMinutes(workedMinutes)}</span>
        </div>
        {hasExpected && (
          <div className="summary-item">
            <span className="summary-label">Ore previste</span>
            <span className="summary-value">{formatMinutes(expectedMinutes)}</span>
          </div>
        )}
        {hasExpected && (
          <div className="summary-item">
            <span className="summary-label">Differenza</span>
            <span className={`summary-value ${diffClass}`}>
              {diffMinutes >= 0 ? '+' : ''}{formatMinutes(Math.abs(diffMinutes))}
              {diffMinutes < 0 ? ' mancanti' : diffMinutes > 0 ? ' extra' : ''}
            </span>
          </div>
        )}
      </div>

      {pay !== null ? (
        <div className="summary-pay">
          <span className="summary-pay-label">Paga stimata</span>
          <span className="summary-pay-value">{formatCurrency(pay.total)}</span>
          <span className="summary-pay-rate">@ {formatCurrency(hourlyRate)}/h</span>
          {pay.surcharge > 0 && (
            <span className="summary-pay-rate">di cui maggiorazioni {formatCurrency(pay.surcharge)}</span>
          )}
        </div>
      ) : (
        <div className="summary-pay summary-pay--empty">
          <span>Imposta la paga oraria nelle ⚙️ Impostazioni per calcolare la paga</span>
        </div>
      )}
    </div>
  );
}
