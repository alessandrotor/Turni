import { useRef, useEffect } from 'react';
import {
  formatDate, formatDayShort, isToday, isWeekend, minutesDiff, formatMinutes,
} from '../utils/dates';
import { calcShiftMinutes, getShiftSurchargePct } from '../utils/pay';
import { TIPO, ETICHETTA, ICONA, tipoTurno } from '../utils/assenze';
import { isHoliday } from '../utils/holidays';

function isNightShift(startTime, endTime) {
  if (!startTime || !endTime) return false;
  const [sh] = startTime.split(':').map(Number);
  const [eh] = endTime.split(':').map(Number);
  // Se finisce la mattina dopo (es. 22:00 -> 06:00) o inizia/finisce in orari notturni
  return eh < sh || sh >= 21 || sh < 5 || eh <= 7;
}

export default function TimelineView({
  daysInMonth,
  year,
  month,
  byDate,
  onAddShift,
  onEditShift,
  settings,
  focusDate = null,
}) {
  const todayRef = useRef(null);
  const focusRef = useRef(null);

  // Scorri sul giorno focus (o su oggi al primo caricamento del mese corrente)
  useEffect(() => {
    if (focusRef.current) {
      focusRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [focusDate, month, year]);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const date = new Date(year, month, dayNum);
    const dateStr = formatDate(date);
    const dayShifts = byDate[dateStr] || [];
    const today = isToday(date);
    const weekend = isWeekend(date);
    const holiday = isHoliday(dateStr, settings);

    return {
      dayNum,
      date,
      dateStr,
      dayName: formatDayShort(date),
      dayShifts,
      today,
      weekend,
      holiday,
    };
  });

  return (
    <div className="timeline-view" role="feed" aria-label="Agenda dei turni">
      {days.map((d) => {
        const hasShifts = d.dayShifts.length > 0;
        const isFocus = d.dateStr === focusDate;

        return (
          <div
            key={d.dateStr}
            ref={isFocus ? focusRef : d.today ? todayRef : null}
            className={[
              'timeline-item',
              d.today ? 'timeline-item--today' : '',
              d.weekend ? 'timeline-item--weekend' : '',
              d.holiday ? 'timeline-item--holiday' : '',
              isFocus ? 'timeline-item--focus' : '',
            ].filter(Boolean).join(' ')}
          >
            {/* Colonna Data & Spine */}
            <div className="timeline-date-col">
              <span className="timeline-day-name">{d.dayName}</span>
              <span className={`timeline-day-num ${d.today ? 'timeline-day-num--today' : ''}`}>
                {d.dayNum}
              </span>
              {d.today && <span className="timeline-badge-today">Oggi</span>}
              {d.holiday && !d.today && (
                <span className="timeline-badge-holiday" title="Festivo">Festivo</span>
              )}
            </div>

            {/* Linea verticale guida */}
            <div className="timeline-spine">
              <div className={`timeline-node ${d.today ? 'timeline-node--today' : hasShifts ? 'timeline-node--active' : ''}`} />
              <div className="timeline-line" />
            </div>

            {/* Colonna Contenuto (Turni o Riposo) */}
            <div className="timeline-content">
              {hasShifts ? (
                <div className="timeline-shifts-group">
                  {d.dayShifts.map((shift) => {
                    const tipo = tipoTurno(shift);
                    const isAssenza = tipo !== TIPO.LAVORO;
                    const mins = calcShiftMinutes(shift);
                    const night = !isAssenza && isNightShift(shift.startTime, shift.endTime);
                    const surchargePct = getShiftSurchargePct(shift, settings);

                    return (
                      <div
                        key={shift.id}
                        className={`timeline-card ${isAssenza ? `timeline-card--${tipo}` : ''} ${night ? 'timeline-card--night' : ''}`}
                        onClick={() => onEditShift(shift)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEditShift(shift); }}
                        aria-label={`Modifica turno del ${d.dayNum}/${month + 1}`}
                      >
                        <div className="timeline-card-header">
                          {isAssenza ? (
                            <div className="timeline-card-title">
                              <span className="timeline-icon">{ICONA[tipo]}</span>
                              <strong>{ETICHETTA[tipo]}</strong>
                            </div>
                          ) : (
                            <div className="timeline-card-title">
                              <span className="timeline-time">
                                {shift.startTime} – {shift.endTime}
                              </span>
                              <span className="timeline-duration">
                                ({formatMinutes(mins)})
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            className="timeline-card-edit-btn"
                            aria-label="Modifica"
                            onClick={(e) => { e.stopPropagation(); onEditShift(shift); }}
                          >
                            ✎
                          </button>
                        </div>

                        {/* Badge e Metadati del Turno */}
                        <div className="timeline-card-badges">
                          {night && (
                            <span className="timeline-badge timeline-badge--night">
                              🌙 Notte
                            </span>
                          )}

                          {!isAssenza && shift.breakMinutes > 0 && (
                            <span className="timeline-badge timeline-badge--break">
                              ☕ Pausa {shift.breakMinutes}m
                            </span>
                          )}

                          {!isAssenza && surchargePct > 0 && (
                            <span className="timeline-badge timeline-badge--surcharge">
                              +{surchargePct}% maggiorazione
                            </span>
                          )}

                          {shift.note && (
                            <span className="timeline-badge timeline-badge--note" title={shift.note}>
                              💬 {shift.note}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pulsante per aggiungere un secondo turno nello stesso giorno */}
                  <button
                    type="button"
                    className="timeline-add-extra-btn"
                    onClick={() => onAddShift(d.dateStr)}
                  >
                    + Aggiungi un altro turno
                  </button>
                </div>
              ) : (
                /* Card Giorno Libero / Riposo */
                <div
                  className="timeline-rest-card"
                  onClick={() => onAddShift(d.dateStr)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAddShift(d.dateStr); }}
                  aria-label={`Giorno di riposo. Clicca per aggiungere un turno il ${d.dayNum}/${month + 1}`}
                >
                  <div className="timeline-rest-content">
                    <span className="timeline-rest-label">🌿 Riposo</span>
                    <span className="timeline-rest-action">+ Aggiungi turno</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
