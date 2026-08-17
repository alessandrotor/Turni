import { useRef, useEffect, useMemo } from 'react';
import {
  formatDate, formatDayShort, isToday, isWeekend, formatMinutes, toccaFasciaNotturna,
} from '../utils/dates';
import { calcShiftMinutes, getShiftSurchargePct } from '../utils/pay';
import { TIPO, ETICHETTA, ICONA, tipoTurno } from '../utils/assenze';
import { isHoliday } from '../utils/holidays';

// Chi ha chiesto al sistema di ridurre le animazioni non deve vedere la pagina
// scorrere da sola: lo stesso salto, senza il movimento.
function comportamentoScorrimento() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  } catch {
    return 'auto';
  }
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
    const bersaglio = focusRef.current || todayRef.current;
    if (!bersaglio) return;
    bersaglio.scrollIntoView({ block: 'center', behavior: comportamentoScorrimento() });
  }, [focusDate, month, year]);

  // I giorni si ricostruiscono solo quando cambia il mese o cambiano i turni:
  // senza questo, ogni stato del calendario (menù export, modali, barra import)
  // rifaceva da capo trentun giorni di celle.
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const date = new Date(year, month, dayNum);
    const dateStr = formatDate(date);

    return {
      dayNum,
      date,
      dateStr,
      dayName: formatDayShort(date),
      dayShifts: byDate[dateStr] || [],
      today: isToday(date),
      weekend: isWeekend(date),
      holiday: isHoliday(dateStr, settings),
    };
  }), [daysInMonth, year, month, byDate, settings]);

  return (
    <div className="timeline-view" role="list" aria-label="Agenda dei turni">
      {days.map((d) => {
        const hasShifts = d.dayShifts.length > 0;
        const isFocus = d.dateStr === focusDate;

        return (
          <div
            key={d.dateStr}
            role="listitem"
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
            <div className="timeline-spine" aria-hidden="true">
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
                    const night = !isAssenza && toccaFasciaNotturna(shift.startTime, shift.endTime);
                    const surchargePct = getShiftSurchargePct(shift, settings);
                    const descrizione = isAssenza
                      ? `${ETICHETTA[tipo].toLowerCase()} del ${d.dayNum}/${month + 1}`
                      : `turno ${shift.startTime}–${shift.endTime} del ${d.dayNum}/${month + 1}`;

                    // Il riquadro resta cliccabile col mouse, ma NON è un
                    // comando per la tastiera: il comando vero è il pulsante
                    // qui sotto. Un role="button" che ne contiene un altro è
                    // invalido e regala due tabulazioni per la stessa azione —
                    // è la stessa regola che vale per le celle della griglia.
                    return (
                      <div
                        key={shift.id}
                        className={`timeline-card ${isAssenza ? `timeline-card--${tipo}` : ''} ${night ? 'timeline-card--night' : ''}`}
                        onClick={() => onEditShift(shift)}
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
                            aria-label={`Modifica ${descrizione}`}
                            onClick={(e) => { e.stopPropagation(); onEditShift(shift); }}
                          >
                            ✎
                          </button>
                        </div>

                        {/* Badge e Metadati del Turno */}
                        <div className="timeline-card-badges">
                          {night && (
                            <span
                              className="timeline-badge timeline-badge--night"
                              title="Il turno tocca la fascia 22:00–06:00. È un'indicazione sull'orario: non incide sulla stima della paga."
                            >
                              🌙 Notturno
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
                /* Giorno libero: è un pulsante vero, così la tastiera e la barra
                   spaziatrice funzionano senza doverle reimplementare a mano. */
                <button
                  type="button"
                  className="timeline-rest-card"
                  onClick={() => onAddShift(d.dateStr)}
                  aria-label={`Giorno di riposo: aggiungi un turno il ${d.dayNum}/${month + 1}`}
                >
                  <span className="timeline-rest-content">
                    <span className="timeline-rest-label">🌿 Riposo</span>
                    <span className="timeline-rest-action">+ Aggiungi turno</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
