import { useRef, useEffect, useMemo } from 'react';
import {
  formatDate, formatDayShort, isToday, isWeekend, formatMinutes,
} from '../utils/dates';
import { calcShiftMinutes, getShiftSurchargePct } from '../utils/pay';
import { minutiNotturniPagati, pctNotturno, fasciaNotturna } from '../utils/notturno';
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

// Il badge dice quante ore cadono in fascia; il suggerimento dice se quelle ore
// valgono davvero di più. Sono due cose diverse e vanno tenute distinte: la
// fascia è un fatto dell'orario, la maggiorazione è un'impostazione che l'utente
// può non aver messo — e in quel caso il badge non deve lasciar credere a un
// aumento che in busta non c'è.
function spiegaNotturno(minuti, settings) {
  const { inizio, durata } = fasciaNotturna(settings);
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const fascia = `${hhmm(inizio)}–${hhmm(inizio + durata)}`;
  const pct = pctNotturno(settings);
  return pct > 0
    ? `${formatMinutes(minuti)} nella fascia ${fascia}: sono le sole ore su cui si applica la maggiorazione notturna del ${String(pct).replace('.', ',')}%.`
    : `${formatMinutes(minuti)} nella fascia ${fascia}. Non hai impostato una maggiorazione notturna, quindi non cambia la stima: puoi aggiungerla in Impostazioni.`;
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

  // Vero solo al primo scorrimento dopo il montaggio, cioè quando si arriva
  // qui dalla griglia. Serve a scegliere fra salto e animazione, vedi sotto.
  const appenaMontato = useRef(true);

  // Porta sotto gli occhi il giorno focus, o oggi nel mese corrente.
  useEffect(() => {
    const bersaglio = focusRef.current || todayRef.current;
    if (!bersaglio) return;

    // DUE FRAME DI ATTESA, e non è scaramanzia. L'effetto parte appena React ha
    // scritto il DOM, ma il browser non ha ancora rifatto il layout: passando
    // dalla griglia all'agenda la pagina raddoppia di altezza, e lo
    // scorrimento partiva verso una posizione calcolata sulla pagina vecchia.
    // Misurato il 19 agosto: finiva a 1628 su un massimo di 1628 — in fondo al
    // documento — con «oggi» 324 pixel SOPRA il bordo dello schermo, cioè fuori
    // dalla vista, e mezzo schermo bianco. Aspettare il paint fa calcolare la
    // posizione sulla pagina vera.
    let annullato = false;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (annullato) return;

      // Già sotto gli occhi: fermarsi è meglio che spostare la pagina addosso
      // a chi sta leggendo.
      const r = bersaglio.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= window.innerHeight) {
        appenaMontato.current = false;
        return;
      }

      // Al cambio di vista il salto è istantaneo: animare millecinquecento
      // pixel facendo sfilare mezzo mese non è una cortesia, è un capogiro.
      // L'animazione resta per gli spostamenti successivi, dove il movimento
      // dice da dove a dove si è andati.
      const comportamento = appenaMontato.current ? 'auto' : comportamentoScorrimento();
      appenaMontato.current = false;
      bersaglio.scrollIntoView({ block: 'center', behavior: comportamento });
    }));

    return () => { annullato = true; cancelAnimationFrame(frame); };
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
                    // Gli stessi minuti che il motore paga, non quelli di
                    // orologio: con una pausa i due numeri differiscono, e il
                    // riepilogo del mese direbbe una cosa diversa dal turno.
                    const notteMin = isAssenza ? 0 : minutiNotturniPagati(shift, settings, mins);
                    const night = notteMin > 0;
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
