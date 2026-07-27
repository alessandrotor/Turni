import { useState, useRef } from 'react';
import {
  formatDate, formatMonthYear, isToday, isWeekend,
  addMonths, getMonthStart, getDaysInMonth, isCurrentMonth,
} from '../utils/dates';
import { calcShiftMinutes, calcTotalPay, formatCurrency, isSunday } from '../utils/pay';
import { calcBonusMargin, BONUS_CONST, BONUS_STATUS } from '../utils/bonus';
import { calcNetMonthly, projectAnnualGross, monthlyBaseGross, EXTRA_MONTHS, TAX_2026 } from '../utils/net';
import { ENABLE_NET_CALC } from '../config/features';
import { generateMonthlySummary } from '../services/ai';
import { parseShiftsFromImage } from '../services/gemini';
import { exportShiftsExcel, exportShiftsPDF } from '../services/export';
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
  onUpdateSettings,
  allShifts,
  annualGross,
}) {
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [importParsed, setImportParsed] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [showNetDetail, setShowNetDetail] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [importUsage, setImportUsage] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);
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

  // Montante + confine automatico (granularità MESE): composizione del reddito e avviso.
  const montante = Number(settings.priorTaxableIncome) || 0;
  const priorDate = settings.priorIncomeDate || '';
  const priorMonth = priorDate.slice(0, 7); // 'YYYY-MM'
  const priorMonthLabel = priorMonth
    ? formatMonthYear(new Date(Number(priorMonth.slice(0, 4)), Number(priorMonth.slice(5, 7)) - 1, 1))
    : '';
  let shiftsCovered = 0;
  if (montante > 0 && priorMonth && priorMonth.slice(0, 4) === String(year)) {
    const covered = (allShifts || []).filter(s => s.date.slice(0, 4) === String(year) && s.date.slice(0, 7) <= priorMonth);
    const yearAll = (allShifts || []).filter(s => s.date.slice(0, 4) === String(year));
    const p = calcTotalPay(covered, settings, yearAll);
    shiftsCovered = p ? p.total : 0;
  }
  const montanteMismatch = montante > 0 && shiftsCovered > 0
    && Math.abs(montante - shiftsCovered) > Math.max(500, 0.30 * shiftsCovered);

  // Netto stimato del mese (beta): calcolato PARTENDO DAL MESE, come una busta
  // paga. Trattenute (contributi + IRPEF + addizionali) e bonus (trattamento
  // integrativo + cuneo) sono voci separate: il bonus non abbatte le trattenute.
  // L'IRPEF, progressiva e annuale, usa come riferimento il reddito annuo pieno
  // (proiezione da contratto + 13ª/14ª); se il contratto non è impostato si
  // ripiega sul reddito maturato.
  // Reddito annuo di riferimento per l'aliquota fiscale:
  //  - a chiamata: reddito annuo manuale se impostato, altrimenti annualizzato dai turni;
  //  - contratto: proiezione da ore settimanali × paga (+13ª/14ª), con fallback al maturato.
  let netBasis;
  if (settings.onCall) {
    const manual = Number(settings.annualGrossManual) || 0;
    if (manual > 0) {
      netBasis = manual;
    } else {
      // Annualizza il reddito maturato (montante + turni, già in annualGross) sui
      // mesi trascorsi dell'anno corrente. Include il montante e non gonfia il
      // reddito annualizzando un singolo mese.
      const now = new Date();
      const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12;
      netBasis = monthsElapsed > 0 ? (annualGross * 12) / monthsElapsed : annualGross;
    }
  } else {
    const projectedAnnual = ENABLE_NET_CALC ? projectAnnualGross(settings) : 0;
    netBasis = projectedAnnual > 0 ? projectedAnnual : annualGross;
  }
  // Mensilità aggiuntiva che cade in questo mese (quattordicesima a giu, tredicesima a dic).
  const extraThisMonth = ENABLE_NET_CALC
    ? monthlyBaseGross(settings) * (
        (settings.hasQuattordicesima && month === EXTRA_MONTHS.quattordicesima ? 1 : 0)
        + (settings.hasTredicesima && month === EXTRA_MONTHS.tredicesima ? 1 : 0)
      )
    : 0;
  const monthGross = (pay ? pay.total : 0) + extraThisMonth;
  const netMonth = ENABLE_NET_CALC ? calcNetMonthly(monthGross, netBasis, settings, daysInMonth) : null;
  const monthNet = netMonth ? netMonth.net : 0;
  const monthTrattenute = netMonth ? netMonth.trattenute : 0;
  const monthBonus = netMonth ? netMonth.bonus : 0;
  const monthTfr = netMonth ? netMonth.tfr : 0;
  const effectiveRatePct = monthGross > 0 ? (monthTrattenute / monthGross) * 100 : 0;
  const addRegPct = Number.isFinite(Number(settings.addRegionalePct)) ? Number(settings.addRegionalePct) : TAX_2026.ADD_REGIONALE_DEFAULT;
  const addComPct = Number.isFinite(Number(settings.addComunalePct)) ? Number(settings.addComunalePct) : TAX_2026.ADD_COMUNALE_DEFAULT;
  const addizionaliPct = (addRegPct + addComPct).toFixed(2).replace('.', ',');
  const showNetPanel = ENABLE_NET_CALC && pay !== null && netBasis > 0 && monthGross > 0;

  // Contesto numerico per il riepilogo AI (cose utili al lavoratore).
  const workedDays = new Set(shifts.map(s => s.date)).size;
  const dayNums = [...new Set(shifts.map(s => Number(s.date.slice(8, 10))))].sort((a, b) => a - b);
  let maxConsecutive = 0, run = 0, prevDay = null;
  for (const d of dayNums) {
    run = (prevDay !== null && d === prevDay + 1) ? run + 1 : 1;
    if (run > maxConsecutive) maxConsecutive = run;
    prevDay = d;
  }
  const summaryContext = {
    totalHours: totalMins / 60,
    shiftsCount: shifts.length,
    overtimeHours: pay?.overtimeMinutes ? pay.overtimeMinutes / 60 : 0,
    sundaysWorked: shifts.filter(s => isSunday(s.date)).length,
    shiftsWithSurcharge: shifts.filter(s =>
      (isSunday(s.date) && (Number(settings.sundaySurchargePct) || 0) > 0) || (Number(s.surchargePct) || 0) > 0
    ).length,
    workedDays,
    restDays: daysInMonth - workedDays,
    maxConsecutive,
    bonusRenzi: {
      status: bonus.status,
      marginToFull: bonus.marginToFull,
      marginToMax: bonus.marginToMax,
      income: bonus.income,
    },
    ...(pay ? { gross: monthGross, surcharge: pay.surcharge } : {}),
    ...(netMonth ? { net: monthNet, trattenute: monthTrattenute, bonus: monthBonus } : {}),
  };

  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  const hasApiKey = hasGeminiKey || !!import.meta.env.VITE_ANTHROPIC_API_KEY;

  async function runImport(file, name) {
    setImportLoading(true);
    setImportError(null);
    try {
      const { shifts: parsed, usage } = await parseShiftsFromImage(file, name);
      setImportUsage(usage);
      setImportParsed(parsed);
    } catch (err) {
      setImportError(err.message || 'Errore durante l\'analisi dell\'immagine');
    } finally {
      setImportLoading(false);
    }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    // Prima volta: chiedi il nome sul foglio e salvalo. Dopo, usa quello salvato.
    if (!settings.workerName) {
      setPendingImportFile(file);
      setNameInput('');
      return;
    }
    runImport(file, settings.workerName);
  }

  function handleNameSubmit() {
    const name = nameInput.trim();
    if (name && onUpdateSettings) onUpdateSettings({ workerName: name });
    const file = pendingImportFile;
    setPendingImportFile(null);
    if (file) runImport(file, name);
  }

  function handleImportConfirm(parsedShifts) {
    onImportShifts(parsedShifts);
    setImportParsed(null);
  }

  async function handleExport(format) {
    setExportBusy(true);
    setExportError(null);
    try {
      if (format === 'xlsx') await exportShiftsExcel(shifts, currentMonth);
      else await exportShiftsPDF(shifts, currentMonth);
    } catch (e) {
      setExportError(e.message || 'Errore durante l\'esportazione');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleAISummary() {
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    try {
      const text = await generateMonthlySummary(shifts, currentMonth, settings, summaryContext);
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
          {importUsage && (
            <div className="debug-usage">
              <span className="debug-usage-tag">🐛 DEBUG token</span>
              <span>prompt <strong>{importUsage.prompt ?? '—'}</strong></span>
              <span>output <strong>{importUsage.output ?? '—'}</strong></span>
              <span>thinking <strong>{importUsage.thinking ?? '—'}</strong></span>
              <span>totale <strong>{importUsage.total ?? '—'}</strong></span>
              <span className="debug-usage-meta">{importUsage.model} · {importUsage.finishReason || 'STOP'}</span>
            </div>
          )}
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

        {/* Esporta i turni del mese */}
        <div className="export-bar">
          <span className="export-label">Esporta il mese:</span>
          <button
            type="button"
            className="btn-export"
            disabled={shifts.length === 0 || exportBusy}
            onClick={() => handleExport('xlsx')}
          >
            📊 Excel
          </button>
          <button
            type="button"
            className="btn-export"
            disabled={shifts.length === 0 || exportBusy}
            onClick={() => handleExport('pdf')}
          >
            📄 PDF
          </button>
        </div>
        {exportError && <p className="import-error">{exportError}</p>}

        {/* Netto stimato del mese — beta (gated dal feature flag) */}
        {showNetPanel && (
          <div className="net-strip">
            <div className="bonus-strip-head">
              <span className="bonus-strip-title">🧪 Netto stimato del mese <span className="beta-tag">beta</span></span>
              <span className="bonus-strip-income">
                Lordo del mese: <strong>{fmt0(monthGross)}</strong>
              </span>
            </div>

            <div className="net-strip-body">
              <span className="bonus-strip-label">Netto stimato del mese</span>
              <span className="net-strip-value">{fmt0(monthNet)}</span>
              <span className="bonus-strip-note">
                trattenute {fmt0(monthTrattenute)} ({effectiveRatePct.toFixed(1)}% del lordo)
                {monthBonus > 0 && <> · bonus +{fmt0(monthBonus)}</>}
                {monthTfr > 0 && <> · TFR +{fmt0(monthTfr)}</>}
              </span>
              {extraThisMonth > 0 && (
                <span className="bonus-strip-note">
                  include {month === EXTRA_MONTHS.tredicesima ? 'tredicesima' : 'quattordicesima'} (+{fmt0(extraThisMonth)} lordi)
                </span>
              )}
            </div>

            <button
              type="button"
              className="net-toggle"
              onClick={() => setShowNetDetail(v => !v)}
              aria-expanded={showNetDetail}
            >
              {showNetDetail ? 'Nascondi dettaglio ▲' : 'Come è calcolato? ▼'}
            </button>

            {showNetDetail && (
              <div className="net-detail">
                {/* Stile busta paga: un solo lordo in cima */}
                <div className="net-line net-line--head">
                  <span>Lordo del mese</span><span>{fmt0(netMonth.gross)}</span>
                </div>

                <div className="net-group-label">Trattenute</div>
                <div className="net-line net-line--ded">
                  <span>Contributi IVS ({(TAX_2026.ALIQUOTA_IVS * 100).toFixed(2).replace('.', ',')}%)</span>
                  <span>−{fmt0(netMonth.contributi)}</span>
                </div>
                <div className="net-line net-line--info">
                  <span>Imponibile fiscale</span><span>{fmt0(netMonth.imponibile)}</span>
                </div>

                {/* IRPEF come in busta paga: lorda, detrazioni, netta */}
                <div className="net-irpef-label">IRPEF</div>
                <div className="net-line net-line--calc">
                  <span>Lorda ({netMonth.imponibile > 0 ? (netMonth.irpefLorda / netMonth.imponibile * 100).toFixed(0) : 0}% dell'imponibile)</span>
                  <span>{fmt0(netMonth.irpefLorda)}</span>
                </div>
                <div className="net-line net-line--calc">
                  <span>− Detrazioni lavoro dip.</span><span className="pos">−{fmt0(netMonth.detrazioni)}</span>
                </div>
                <div className="net-line net-line--calc net-line--calc-strong">
                  <span>= Netta (trattenuta)</span><span>−{fmt0(netMonth.irpefNetta)}</span>
                </div>

                {(netMonth.addRegionale + netMonth.addComunale) > 0 && (
                  <div className="net-line net-line--ded">
                    <span>Addizionali reg./com. ({addizionaliPct}%)</span>
                    <span>−{fmt0(netMonth.addRegionale + netMonth.addComunale)}</span>
                  </div>
                )}
                <div className="net-line net-line--subtotal">
                  <span>Totale trattenute ({(netMonth.trattenute / netMonth.gross * 100).toFixed(1)}%)</span>
                  <span>−{fmt0(netMonth.trattenute)}</span>
                </div>

                {/* Competenze aggiuntive (quote mensili) */}
                {(netMonth.bonus > 0 || netMonth.tfr > 0) && (
                  <>
                    <div className="net-group-label">Competenze in busta (a parte)</div>
                    {netMonth.trattamentoIntegrativo > 0 && (
                      <div className="net-line net-line--bonus"><span>Trattamento integrativo (quota mese)</span><span>+{fmt0(netMonth.trattamentoIntegrativo)}</span></div>
                    )}
                    {netMonth.bonusCuneo > 0 && (
                      <div className="net-line net-line--bonus"><span>Indennità 207/2024 (quota mese)</span><span>+{fmt0(netMonth.bonusCuneo)}</span></div>
                    )}
                    {netMonth.tfr > 0 && (
                      <div className="net-line net-line--bonus"><span>Anticipo TFR (quota mese)</span><span>+{fmt0(netMonth.tfr)}</span></div>
                    )}
                  </>
                )}

                <div className="net-line net-line--total"><span>Netto del mese</span><span>{fmt0(netMonth.net)}</span></div>
                <p className="net-disclaimer">
                  Stima indicativa (fiscalità 2026). Le trattenute sono quelle vere della busta paga
                  (contributi + IRPEF netta + addizionali). Trattamento integrativo (€1.200/anno) e
                  Indennità 207/2024 sono importi annui rapportati ai giorni del mese (÷365).
                  {netMonth.tfr > 0 && ' L\'anticipo TFR è ~6,91% del lordo (tassazione separata).'}
                  {' '}Non sostituisce la busta paga né il conguaglio.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bonus busta paga: quanto manca alla soglia (sotto al netto mensile) */}
        {bonus.status !== BONUS_STATUS.ATTESA && (
          <div className="bonus-strip">
            <div className="bonus-strip-head">
              <span className="bonus-strip-title">💶 Reddito e bonus Renzi</span>
              <span className="bonus-strip-income">
                Reddito totale {currentMonth.getFullYear()}: <strong>{fmt0(bonus.income)}</strong>
              </span>
            </div>

            {montante > 0 && (
              <span className="bonus-strip-note">
                = montante {fmt0(montante)}{priorMonthLabel && ` (fino a ${priorMonthLabel})`} + turni {fmt0(bonus.income - montante)}
              </span>
            )}
            {montanteMismatch && (
              <span className="bonus-strip-note bonus-strip-note--warn">
                ⚠️ Montante dichiarato {fmt0(montante)} diverso dai turni fino a {priorMonthLabel} ({fmt0(shiftsCovered)}). Normale se include altri redditi o paghe diverse.
              </span>
            )}

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

        {/* AI section — Riepilogo AI temporaneamente disattivato (test import da immagine).
            Per riattivarlo, togliere il commento a questo blocco.
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
              Aggiungi <code>VITE_GEMINI_API_KEY</code> in <code>.env.local</code> per il riepilogo AI con Google Gemini (gratuito).
            </p>
          )}
          {aiError && <p className="ai-error">{aiError}</p>}
          {aiSummary && <p className="ai-summary-text">{aiSummary}</p>}
        </div>
        */}
      </div>

      {importParsed && (
        <ImportModal
          shifts={importParsed}
          onConfirm={handleImportConfirm}
          onClose={() => setImportParsed(null)}
        />
      )}

      {pendingImportFile && (
        <div className="modal-overlay" onClick={() => setPendingImportFile(null)}>
          <div className="modal name-modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Il tuo nome sul foglio</h2>
            <p className="modal-desc">
              Il foglio turni può contenere più persone. Indica il tuo nome così l'AI
              estrae solo i tuoi turni. Lo salviamo nelle impostazioni (potrai cambiarlo lì).
            </p>
            <input
              type="text"
              className="form-input"
              placeholder="Es. Mario Rossi"
              value={nameInput}
              autoFocus
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNameSubmit(); }}
            />
            <div className="name-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingImportFile(null)}>
                Annulla
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNameSubmit}>
                {nameInput.trim() ? 'Salva e continua' : 'Importa tutti'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
