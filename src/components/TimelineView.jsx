import { useRef, useEffect, useMemo } from 'react';
import {
  formatDate, formatDayShort, isToday, isWeekend, formatMinutes, MONTH_NAMES,
} from '../utils/dates';
import { calcShiftMinutes, getShiftSurchargePct, formatCurrency, lordoTurno } from '../utils/pay';
import { minutiNotturniPagati, pctNotturno, fasciaNotturna } from '../utils/notturno';
import { TIPO, ETICHETTA, ICONA, tipoTurno } from '../utils/assenze';
import { isHoliday } from '../utils/holidays';

function spiegaNotturno(minuti, settings) {
  const { inizio, durata } = fasciaNotturna(settings);
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const fascia = `${hhmm(inizio)}–${hhmm(inizio + durata)}`;
  const pct = pctNotturno(settings);
  return pct > 0
    ? `${formatMinutes(minuti)} nella fascia ${fascia}: sono le sole ore su cui si applica la maggiorazione notturna del ${String(pct).replace('.', ',')}%.`
    : `${formatMinutes(minuti)} nella fascia ${fascia}. Non hai impostato una maggiorazione notturna, quindi non cambia la stima: puoi aggiungerla in Impostazioni.`;
}

function scomponi(voce) {
  if (!voce) return '';
  const eur = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pezzi = [`base ${eur(voce.base)}`];
  if (voce.surchargeNight > 0) pezzi.push(`notturno ${eur(voce.surchargeNight)}`);
  if (voce.surchargeSunday > 0) pezzi.push(`domenicale ${eur(voce.surchargeSunday)}`);
  if (voce.surchargeHoliday > 0) pezzi.push(`festivo ${eur(voce.surchargeHoliday)}`);
  if (voce.surchargeOvertime > 0) pezzi.push(`supplementare ${eur(voce.surchargeOvertime)}`);
  if (voce.surchargeStraordinario > 0) pezzi.push(`straordinario ${eur(voce.surchargeStraordinario)}`);
  if (voce.surchargeManual > 0) pezzi.push(`maggiorazione ${eur(voce.surchargeManual)}`);
  return pezzi.length > 1 ? pezzi.join(' + ') : '';
}

function etichettaFasciaOraria(shift, d, tipo) {
  if (tipo !== TIPO.LAVORO) return ETICHETTA[tipo];
  if (d.holiday) return 'Festivo';
  if (d.date.getDay() === 0) return 'Domenicale';
  const [h] = (shift.startTime || '').split(':').map(Number);
  if (!Number.isNaN(h)) {
    if (h >= 5 && h < 12) return 'Mattina';
    if (h >= 12 && h < 18) return 'Pomeriggio';
    if (h >= 18 && h < 22) return 'Sera';
    return 'Notturno';
  }
  return 'Turno';
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
  payByShift = null,
  mostraEuro = false,
  pay = null,
  totalMins = 0,
}) {
  const todayRef = useRef(null);
  const focusRef = useRef(null);

  useEffect(() => {
    const bersaglio = focusRef.current || todayRef.current;
    if (!bersaglio) return;
    bersaglio.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [focusDate, month, year]);

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
        const monthShort = MONTH_NAMES[month];
        const capMonth = monthShort ? monthShort.charAt(0).toUpperCase() + monthShort.slice(1) : '';
        const cardDateLabel = d.today ? `${d.dayName} ${d.dayNum} ${capMonth}` : `${d.dayName} ${d.dayNum}`;

        return (
          <div
            key={d.dateStr}
            role="listitem"
            ref={isFocus ? focusRef : d.today ? todayRef : null}
            className={[
              'timeline-item',
              d.today ? 'timeline-item--today' : '',
              isFocus ? 'timeline-item--focus' : '',
            ].filter(Boolean).join(' ')}
          >
            {/* Colonna Data & Spine */}
            <div className="timeline-date-col">
              <span className="timeline-day-name">{d.dayName}</span>
              <span className={`timeline-day-num ${d.today ? 'timeline-day-num--today' : ''}`}>
                {d.dayNum}
              </span>
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
                    const voce = payByShift?.[shift.id] ?? null;
                    const mins = calcShiftMinutes(shift);
                    const notteMin = isAssenza ? 0 : minutiNotturniPagati(shift, settings, mins);
                    const night = notteMin > 0;
                    const surchargePct = getShiftSurchargePct(shift, settings);
                    const fascia = etichettaFasciaOraria(shift, d, tipo);
                    const descrizione = isAssenza
                      ? `${ETICHETTA[tipo].toLowerCase()} del ${d.dayNum}/${month + 1}`
                      : `turno ${shift.startTime}–${shift.endTime} del ${d.dayNum}/${month + 1}`;

                    return (
                      <div
                        key={shift.id}
                        className={[
                          'timeline-card',
                          isAssenza ? `timeline-card--${tipo}` : '',
                          night ? 'timeline-card--night' : '',
                          (d.holiday || d.date.getDay() === 0) && !night && !isAssenza ? 'timeline-card--holiday' : '',
                          d.today ? 'timeline-card--today' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => onEditShift(shift)}
                      >
                        <div className="timeline-card-header">
                          <span className="timeline-card-date">{cardDateLabel}</span>
                          <div className="timeline-card-header-actions">
                            {d.today ? (
                              <span className="timeline-card-pill timeline-card-pill--today">Oggi</span>
                            ) : night ? (
                              <span className="timeline-card-pill timeline-card-pill--night">Notturno</span>
                            ) : (d.holiday || surchargePct > 0) ? (
                              <span className="timeline-card-pill timeline-card-pill--surcharge">
                                +{surchargePct > 0 ? surchargePct : 30}% {d.holiday ? 'Festivo' : 'Domenicale'}
                              </span>
                            ) : isAssenza ? (
                              <span className={`timeline-card-pill timeline-card-pill--${tipo}`}>
                                {ETICHETTA[tipo]}
                              </span>
                            ) : (
                              <span className="timeline-card-pill timeline-card-pill--shift">
                                {fascia}
                              </span>
                            )}

                            {mostraEuro && voce && !voce.missingRate && (
                              <span className="timeline-euro">
                                {formatCurrency(lordoTurno(voce))}
                              </span>
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
                        </div>

                        <div className="timeline-card-body">
                          {isAssenza ? (
                            <div className="timeline-card-title">
                              <span>{ICONA[tipo]}</span>
                              <strong>{ETICHETTA[tipo]}</strong>
                            </div>
                          ) : (
                            <div className="timeline-card-title">
                              <span className="timeline-time">
                                {shift.startTime} – {shift.endTime}
                              </span>
                              <span className="timeline-time-sep">·</span>
                              <span className="timeline-shift-name">{fascia}</span>
                              <span className="timeline-duration">
                                ({formatMinutes(mins)})
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Badge e Metadati del Turno */}
                        <div className="timeline-card-badges">
                          {night && (
                            <span
                              className="timeline-badge timeline-badge--night"
                              title={spiegaNotturno(notteMin, settings)}
                            >
                              🌙 {formatMinutes(notteMin)} in fascia
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

                          {mostraEuro && voce && !voce.missingRate && scomponi(voce) && (
                            <span className="timeline-scomposizione">{scomponi(voce)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {d.dayShifts.length > 1 && (
                    <div className="timeline-day-total">
                      Totale del giorno
                      <strong>
                        {formatMinutes(d.dayShifts.reduce((s, t) => s + calcShiftMinutes(t), 0))}
                      </strong>
                    </div>
                  )}

                  <button
                    type="button"
                    className="timeline-add-extra-btn"
                    onClick={() => onAddShift(d.dateStr)}
                  >
                    + Aggiungi un altro turno
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="timeline-rest-card"
                  onClick={() => onAddShift(d.dateStr)}
                  aria-label={`Giorno di riposo: aggiungi un turno il ${d.dayNum}/${month + 1}`}
                >
                  <div className="timeline-card-header">
                    <span className="timeline-card-date">{cardDateLabel}</span>
                    <span className="timeline-card-pill timeline-card-pill--rest">Riposo</span>
                  </div>
                  <div className="timeline-rest-content">
                    <span className="timeline-rest-label">🌿 Riposo</span>
                    <span className="timeline-rest-action">+ Aggiungi turno</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        );
      })}

      {pay !== null && (
        <div className="timeline-floating-bar" role="status" aria-label="Riepilogo rapido">
          <div className="timeline-floating-info">
            <span className="timeline-floating-eti">Stima lorda:</span>
            <strong className="timeline-floating-val">{formatCurrency(pay.total)}</strong>
            <span className="timeline-floating-dot">·</span>
            <span className="timeline-floating-hours">{formatMinutes(totalMins)}</span>
          </div>
          <button
            type="button"
            className="timeline-floating-add-btn"
            onClick={() => onAddShift(focusDate || formatDate(new Date()))}
            aria-label="Aggiungi turno"
            title="Aggiungi turno"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
