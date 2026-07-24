import { useState, useRef } from 'react';
import {
  formatDate, formatMonthYear, isToday, isWeekend,
  addMonths, getMonthStart, getDaysInMonth, isCurrentMonth,
} from '../utils/dates';
import { calcShiftMinutes, calcTotalPay, formatCurrency } from '../utils/pay';
import { calcBonusMargin, BONUS_CONST, BONUS_STATUS } from '../utils/bonus';
import { generateMonthlySummary } from '../services/ai';
import { parseShiftsFromImage } from '../services/gemini';
import ImportModal from './ImportModal';

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
  onImportShifts,
  settings,
  allShifts,
  annualGross,
}) {
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [importParsed, setImportParsed] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef();

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
  const pay = calcTotalPay(shifts, settings, allShifts || shifts);

  // Bonus busta paga: quanto manca alla soglia (reddito annuo dai turni)
  const bonus = calcBonusMargin(annualGross);
  const fmt0 = (n) => formatCurrency(Math.round(n));

  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY;
  const hasGeminiKey = !!import.meta.env.VITE_GROQ_API_KEY;

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportLoading(true);
    setImportError(null);
    try {
      const parsed = await parseShiftsFromImage(file);
      setImportParsed(parsed);
    } catch (err) {
      setImportError(err.message || 'Errore durante l\'analisi dell\'immagine');
    } finally {
      setImportLoading(false);
    }
  }

  function handleImportConfirm(parsedShifts) {
    onImportShifts(parsedShifts);
    setImportParsed(null);
  }

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

      {/* Import bar */}
      {hasGeminiKey && (
        <div className="import-bar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="btn-import"
            onClick={() => fileInputRef.current.click()}
            disabled={importLoading}
          >
            {importLoading ? '⏳ Analisi in corso…' : '📤 Importa turni da immagine'}
          </button>
          {importError && <span className="import-error">{importError}</span>}
        </div>
      )}

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
              <span className="summary-value diff-positive">{formatCurrency(pay.total)}</span>
              {pay.surcharge > 0 && (
                <span className="summary-sublabel">
                  di cui maggiorazioni {formatCurrency(pay.surcharge)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bonus busta paga: quanto manca alla soglia */}
        {bonus.status !== BONUS_STATUS.ATTESA && (
          <div className="bonus-strip">
            <div className="bonus-strip-head">
              <span className="bonus-strip-title">💶 Reddito e bonus Renzi</span>
              <span className="bonus-strip-income">
                Reddito totale {currentMonth.getFullYear()}: <strong>{fmt0(bonus.income)}</strong>
              </span>
            </div>

            {bonus.status === BONUS_STATUS.PIENO && (
              <div className={`bonus-strip-body ${bonus.nearThreshold ? 'bonus-strip-body--warn' : ''}`}>
                <span className="bonus-strip-label">
                  {bonus.nearThreshold ? '⚠️ Sei vicino alla soglia' : 'Puoi ancora guadagnare'}
                </span>
                <span className="bonus-strip-value">{fmt0(bonus.marginToFull)}</span>
                <span className="bonus-strip-note">
                  prima di superare i {formatCurrency(BONUS_CONST.SOGLIA_BONUS_PIENO)} e uscire dal bonus pieno
                </span>
              </div>
            )}

            {bonus.status === BONUS_STATUS.PARZIALE && (
              <div className={`bonus-strip-body ${bonus.nearThreshold ? 'bonus-strip-body--warn' : ''}`}>
                <span className="bonus-strip-label">Puoi ancora guadagnare</span>
                <span className="bonus-strip-value">{fmt0(bonus.marginToMax)}</span>
                <span className="bonus-strip-note">
                  prima di superare i {formatCurrency(BONUS_CONST.SOGLIA_BONUS_MAX)} e perdere del tutto il bonus
                </span>
              </div>
            )}

            {bonus.status === BONUS_STATUS.OLTRE && (
              <div className="bonus-strip-body bonus-strip-body--danger">
                <span className="bonus-strip-note">
                  🚨 Reddito oltre i {formatCurrency(BONUS_CONST.SOGLIA_BONUS_MAX)}: il bonus non spetta.
                </span>
              </div>
            )}
          </div>
        )}

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

      {importParsed && (
        <ImportModal
          shifts={importParsed}
          onConfirm={handleImportConfirm}
          onClose={() => setImportParsed(null)}
        />
      )}
    </div>
  );
}
