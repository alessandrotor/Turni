import { useState, useMemo } from 'react';
import {
  formatDate, formatDayShort, addMonths,
  getWeekStart, formatMinutes, MONTH_NAMES,
} from '../utils/dates';
import { calcShiftMinutes } from '../utils/pay';
import { TIPO, ETICHETTA, tipoTurno } from '../utils/assenze';
import useModalDismiss from '../hooks/useModalDismiss';

function nomeFascia(shift, tipo) {
  if (tipo !== TIPO.LAVORO) return ETICHETTA[tipo];
  const [h] = (shift.startTime || '').split(':').map(Number);
  if (!Number.isNaN(h)) {
    if (h >= 5 && h < 12) return 'Mattina';
    if (h >= 12 && h < 18) return 'Pomeriggio';
    if (h >= 18 && h < 22) return 'Sera';
    return 'Notturno';
  }
  return '';
}

export default function ShareWeekModal({
  shifts,
  initialDate = new Date(),
  onClose,
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const modalRef = useModalDismiss(onClose);

  // Calcola i 7 giorni della settimana selezionata
  const weekData = useMemo(() => {
    const base = new Date(initialDate);
    base.setDate(base.getDate() + weekOffset * 7);
    const start = getWeekStart(base);

    // Mappa per data 'YYYY-MM-DD'
    const byDate = {};
    for (const s of shifts) {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    }

    const days = [];
    let totalMins = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);
      const dayShifts = byDate[dateStr] || [];

      const dayMins = dayShifts.reduce((acc, s) => acc + calcShiftMinutes(s), 0);
      totalMins += dayMins;

      days.push({
        date: d,
        dateStr,
        dayNum: d.getDate(),
        dayName: formatDayShort(d),
        monthName: MONTH_NAMES[d.getMonth()],
        shifts: dayShifts,
        mins: dayMins,
      });
    }

    const startStr = `${days[0].dayNum} ${days[0].monthName}`;
    const endStr = `${days[6].dayNum} ${days[6].monthName}`;
    const rangeLabel = `${startStr} – ${endStr}`;

    return { days, totalMins, rangeLabel };
  }, [shifts, initialDate, weekOffset]);

  // Costruisce il testo leggibile per WhatsApp
  const shareText = useMemo(() => {
    const lines = [`📅 I miei turni (${weekData.rangeLabel}):`];
    for (const d of weekData.days) {
      if (d.shifts.length === 0) {
        lines.push(`• ${d.dayName} ${d.dayNum}: 🌿 Riposo`);
      } else {
        const parts = d.shifts.map((s) => {
          const t = tipoTurno(s);
          if (t !== TIPO.LAVORO) return ETICHETTA[t];
          const fascia = nomeFascia(s, t);
          return `${s.startTime}–${s.endTime}${fascia ? ` (${fascia})` : ''}`;
        });
        lines.push(`• ${d.dayName} ${d.dayNum}: ${parts.join(', ')}`);
      }
    }
    const h = Math.floor(weekData.totalMins / 60);
    const m = weekData.totalMins % 60;
    const durStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
    lines.push(`⏱️ Totale: ${durStr}`);
    return lines.join('\n');
  }, [weekData]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `I miei turni (${weekData.rangeLabel})`,
          text: shareText,
        });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    // Fallback: copia negli appunti
    handleCopy();
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // Ignora errori appunti
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Condividi i turni della settimana"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Condividi settimana</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Navigatore settimana */}
        <div className="share-week-nav">
          <button
            type="button"
            className="week-nav-btn"
            onClick={() => setWeekOffset(w => w - 1)}
            aria-label="Settimana precedente"
          >
            ‹
          </button>
          <span className="share-week-label">{weekData.rangeLabel}</span>
          <button
            type="button"
            className="week-nav-btn"
            onClick={() => setWeekOffset(w => w + 1)}
            aria-label="Settimana successiva"
          >
            ›
          </button>
        </div>

        {/* Card grafica settimana */}
        <div className="share-card">
          <div className="share-week-list">
            {weekData.days.map((d) => (
              <div key={d.dateStr} className="share-day-row">
                <span className="share-day-date">
                  <strong>{d.dayName}</strong> {d.dayNum}
                </span>
                <div className="share-day-info">
                  {d.shifts.length === 0 ? (
                    <span className="share-day-rest">🌿 Riposo</span>
                  ) : (
                    d.shifts.map((s) => {
                      const t = tipoTurno(s);
                      const isAssenza = t !== TIPO.LAVORO;
                      const fascia = nomeFascia(s, t);
                      return (
                        <span key={s.id} className="share-day-shift">
                          {isAssenza ? ETICHETTA[t] : `${s.startTime}–${s.endTime}`}
                          {fascia && !isAssenza && <small> {fascia}</small>}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="share-card-total">
            Totale settimana: <strong>{formatMinutes(weekData.totalMins)}</strong>
          </div>
        </div>

        {copied && (
          <div className="share-copied-toast" role="status">
            ✓ Testo copiato negli appunti!
          </div>
        )}

        {/* Azioni di condivisione */}
        <div className="share-actions">
          <button
            type="button"
            className="btn btn-primary share-btn-main"
            onClick={handleShare}
          >
            💬 Invia su WhatsApp / Condividi
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
          >
            📋 Copia testo
          </button>
        </div>
      </div>
    </div>
  );
}
