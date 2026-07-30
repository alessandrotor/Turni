import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import {
  formatDate, formatMonthYear, isToday, isWeekend,
  addMonths, getMonthStart, getDaysInMonth, isCurrentMonth,
} from '../utils/dates';
import { calcShiftMinutes, calcTotalPay, formatCurrency, parseNum } from '../utils/pay';
import { calcBonusMargin, BONUS_STATUS } from '../utils/bonus';
import {
  calcNetMonthly, projectAnnualGross, monthlyBaseGross,
  extraMonthsCount, EXTRA_MONTHS, TAX_2026, tiDecision,
} from '../utils/net';
import { ENABLE_NET_CALC } from '../config/features';
import { exportShiftsExcel, exportShiftsPDF } from '../services/export';
import { sendImportTelemetry } from '../services/telemetry';
import ImportModal from './ImportModal';

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function formatMinutesShort(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Importo → stringa da mostrare nell'input (vuota se 0), con la virgola.
function toAmountInput(n) {
  return n ? String(n).replace('.', ',') : '';
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
  annualExtras = 0,
}) {
  const [importParsed, setImportParsed] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [showNetDetail, setShowNetDetail] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [importUsage, setImportUsage] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);
  const fileInputRef = useRef(null);
  const nameModalRef = useRef(null);

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

  // Turni raggruppati per data e ordinati per ora di inizio: senza sort le pill
  // seguirebbero l'ordine di inserimento nell'oggetto, non quello cronologico.
  const byDate = useMemo(() => {
    const map = {};
    shifts.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    Object.values(map).forEach(list =>
      list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
    return map;
  }, [shifts]);

  // Monthly totals
  const totalMins = useMemo(
    () => shifts.reduce((sum, s) => sum + calcShiftMinutes(s), 0),
    [shifts],
  );
  const pay = useMemo(
    () => calcTotalPay(shifts, settings, allShifts || shifts),
    [shifts, settings, allShifts],
  );

  // Bonus busta paga: quanto manca alla soglia (reddito annuo dai turni)
  const bonus = useMemo(() => calcBonusMargin(annualGross), [annualGross]);
  const fmt0 = (n) => formatCurrency(Math.round(n));

  // Montante + confine automatico (granularità MESE): composizione del reddito e avviso.
  const montante = Number(settings.priorTaxableIncome) || 0;
  const priorDate = settings.priorIncomeDate || '';
  const priorMonth = priorDate.slice(0, 7); // 'YYYY-MM'
  const priorMonthLabel = priorMonth
    ? formatMonthYear(new Date(Number(priorMonth.slice(0, 4)), Number(priorMonth.slice(5, 7)) - 1, 1))
    : '';
  const shiftsCovered = useMemo(() => {
    if (!(montante > 0 && priorMonth && priorMonth.slice(0, 4) === String(year))) return 0;
    const covered = (allShifts || []).filter(
      s => s.date.slice(0, 4) === String(year) && s.date.slice(0, 7) <= priorMonth);
    // Contesto straordinari = tutti i turni (le settimane a cavallo d'anno
    // devono restare intere), come in App.annualGross.
    const p = calcTotalPay(covered, settings, allShifts || covered);
    return p ? p.total : 0;
  }, [montante, priorMonth, year, allShifts, settings]);
  const montanteMismatch = montante > 0 && shiftsCovered > 0
    && Math.abs(montante - shiftsCovered) > Math.max(500, 0.30 * shiftsCovered);

  // Netto stimato del mese (beta): calcolato PARTENDO DAL MESE, come una busta
  // paga. Trattenute (contributi + IRPEF + addizionali) e bonus (trattamento
  // integrativo + cuneo) sono voci separate: il bonus non abbatte le trattenute.
  // L'IRPEF, progressiva e annuale, usa come riferimento il reddito annuo pieno
  // (proiezione da contratto + 13ª/14ª); se il contratto non è impostato si
  // ripiega sul reddito maturato.
  // Voci fisse mensili (ricorrenti) e bonus (per singolo mese): sommati al lordo,
  // e inclusi nella proiezione annua (possono far superare le soglie del TI).
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const mm = String(month + 1).padStart(2, '0');
  const fixedMonthlyTotal = (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : [])
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const perMonthBonus = Number(settings.monthlyBonus?.[monthKey]) || 0;
  const bonusMap = settings.monthlyBonus || {};
  const bonusYearAll = Object.entries(bonusMap)
    .filter(([k]) => k.slice(0, 4) === String(year))
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  const bonusYTD = Object.entries(bonusMap)
    .filter(([k]) => k.slice(0, 4) === String(year) && k.slice(5, 7) <= mm)
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);

  // Reddito annuo di riferimento (aliquota IRPEF + decisione automatica TI):
  //  - 'stimato': stima annua (contratto/RAL/a chiamata) + voci fisse ×12 + bonus dell'anno;
  //  - 'ytd': reddito maturato (montante+turni+voci fisse+bonus finora) annualizzato sui mesi trascorsi.
  const fixedAnnual = fixedMonthlyTotal * 12;
  const netBasis = useMemo(() => {
    // 13ª/14ª sono una tantum: annualizzarle (×12/mesi trascorsi) le
    // moltiplicherebbe: a luglio la 14ª di giugno varrebbe quasi due mensilità.
    // Si annualizza solo la parte ricorrente e si riaggiungono per intero le
    // mensilità aggiuntive previste nell'anno.
    const recurring = Math.max(0, annualGross - annualExtras);
    const extrasFullYear = ENABLE_NET_CALC
      ? monthlyBaseGross(settings) * extraMonthsCount(settings)
      : 0;
    const now = new Date();
    const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const annualize = (v) => (monthsElapsed > 0 ? (v * 12) / monthsElapsed : v);

    if ((settings.tiProjectionMode || 'stimato') === 'ytd') {
      const cumulativo = recurring + fixedMonthlyTotal * monthsElapsed + bonusYTD;
      return annualize(cumulativo) + extrasFullYear;
    }

    let base;
    if (settings.onCall) {
      const manual = Number(settings.annualGrossManual) || 0;
      base = manual > 0 ? manual : annualize(recurring);
    } else {
      const projectedAnnual = ENABLE_NET_CALC ? projectAnnualGross(settings) : 0;
      base = projectedAnnual > 0 ? projectedAnnual : annualGross;
    }
    return base + fixedAnnual + bonusYearAll;
  }, [annualGross, annualExtras, settings, year, fixedMonthlyTotal, fixedAnnual, bonusYTD, bonusYearAll]);

  // Mensilità aggiuntiva che cade in questo mese (quattordicesima a giu, tredicesima a dic).
  const extraThisMonth = ENABLE_NET_CALC
    ? monthlyBaseGross(settings) * (
        (settings.hasQuattordicesima && month === EXTRA_MONTHS.quattordicesima ? 1 : 0)
        + (settings.hasTredicesima && month === EXTRA_MONTHS.tredicesima ? 1 : 0)
      )
    : 0;
  const monthGross = (pay ? pay.total : 0) + extraThisMonth + fixedMonthlyTotal + perMonthBonus;
  const netMonth = useMemo(
    () => (ENABLE_NET_CALC ? calcNetMonthly(monthGross, netBasis, settings, daysInMonth) : null),
    [monthGross, netBasis, settings, daysInMonth],
  );
  const monthNet = netMonth ? netMonth.net : 0;
  const monthTrattenute = netMonth ? netMonth.trattenute : 0;
  const monthBonus = netMonth ? netMonth.bonus : 0;
  const monthTfr = netMonth ? netMonth.tfr : 0;
  const tiInfo = useMemo(
    () => (ENABLE_NET_CALC ? tiDecision(netBasis, settings) : null),
    [netBasis, settings],
  );
  const effectiveRatePct = monthGross > 0 ? (monthTrattenute / monthGross) * 100 : 0;
  const addRegPct = Number.isFinite(Number(settings.addRegionalePct)) ? Number(settings.addRegionalePct) : TAX_2026.ADD_REGIONALE_DEFAULT;
  const addComPct = Number.isFinite(Number(settings.addComunalePct)) ? Number(settings.addComunalePct) : TAX_2026.ADD_COMUNALE_DEFAULT;
  const addizionaliPct = (addRegPct + addComPct).toFixed(2).replace('.', ',');
  const showNetPanel = ENABLE_NET_CALC && pay !== null && netBasis > 0 && monthGross > 0;

  const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  const closeNameModal = useCallback(() => setPendingImportFile(null), []);
  useModalDismiss(nameModalRef, closeNameModal, !!pendingImportFile);

  // Bonus del mese: input controllato con commit a ogni battuta. Con
  // `defaultValue` + `onBlur` il valore andava perso se l'app finiva in
  // background prima che il campo perdesse il focus (caso normale su Android).
  const [monthBonusInput, setMonthBonusInput] = useState(() => toAmountInput(perMonthBonus));
  useEffect(() => {
    setMonthBonusInput(toAmountInput(Number(settings.monthlyBonus?.[monthKey]) || 0));
    // Si risincronizza solo cambiando mese: durante la digitazione la sorgente
    // di verità è lo stato locale, altrimenti la normalizzazione mangerebbe la
    // virgola appena scritta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  async function runImport(file, name) {
    setImportLoading(true);
    setImportError(null);
    const meta = { named: !!name, imageBytes: file?.size ?? null, imageType: file?.type ?? null };
    try {
      // SDK Gemini caricato on-demand: serve solo a chi importa da immagine,
      // non deve pesare sull'avvio (stessa scelta di services/export.js).
      const { parseShiftsFromImage } = await import('../services/gemini');
      const { shifts: parsed, usage } = await parseShiftsFromImage(file, name);
      setImportUsage(usage);
      setImportParsed(parsed);
      sendImportTelemetry({ ok: true, ...usage, shifts: parsed.length, ...meta });
    } catch (err) {
      setImportError(err.message || 'Errore durante l\'analisi dell\'immagine');
      sendImportTelemetry({ ok: false, error: String(err.message || err), ...meta });
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

  function handleMonthBonusChange(e) {
    const raw = e.target.value;
    setMonthBonusInput(raw);
    if (!onUpdateSettings) return;
    const amount = parseNum(raw);
    const map = { ...(settings.monthlyBonus || {}) };
    if (amount > 0) map[monthKey] = amount;
    else delete map[monthKey];
    onUpdateSettings({ monthlyBonus: map });
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

  return (
    <div className="calendar-view">
      {/* Month navigation */}
      <div className="cal-header">
        <button
          className="week-nav-btn"
          onClick={() => onMonthChange(addMonths(currentMonth, -1))}
          aria-label="Mese precedente"
        >
          ‹
        </button>
        <div className="cal-header-center">
          <span className="cal-month-name">{formatMonthYear(currentMonth)}</span>
          {!isCurrentMonth(currentMonth) && (
            <button
              className="week-today-btn"
              onClick={() => onMonthChange(getMonthStart(new Date()))}
            >
              Oggi
            </button>
          )}
        </div>
        <button
          className="week-nav-btn"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
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

          // La cella è un contenitore cliccabile, non un pulsante: annidare
          // controlli dentro un role="button" è invalido e confonde gli screen
          // reader. I comandi veri sono i <button> qui dentro.
          return (
            <div
              key={dateStr}
              className={[
                'cal-cell',
                today ? 'cal-cell--today' : '',
                weekend ? 'cal-cell--weekend' : '',
              ].join(' ')}
              onClick={e => { if (e.target === e.currentTarget) onAddShift(dateStr); }}
            >
              <button
                type="button"
                className="cal-cell-add"
                onClick={() => onAddShift(dateStr)}
                aria-label={`Aggiungi turno il ${dayNum}/${month + 1}`}
              >
                <span className={`cal-day-num${today ? ' cal-day-num--today' : ''}`}>
                  {dayNum}
                </span>
              </button>
              <div className="cal-shifts">
                {dayShifts.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="cal-shift-pill"
                    onClick={e => { e.stopPropagation(); onEditShift(s); }}
                    title={`${s.startTime}–${s.endTime}${s.note ? ` | ${s.note}` : ''}`}
                    aria-label={`Modifica turno ${s.startTime}–${s.endTime}`}
                  >
                    {s.startTime}
                  </button>
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
              {pay.shiftsWithoutRate > 0 && (
                <span className="summary-sublabel summary-sublabel--warn">
                  ⚠️ {pay.shiftsWithoutRate} turn{pay.shiftsWithoutRate === 1 ? 'o conteggiato' : 'i conteggiati'} a 0 €:
                  nessuna paga oraria valida per quelle date
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
              {(fixedMonthlyTotal > 0 || perMonthBonus > 0) && (
                <span className="bonus-strip-note">
                  include {fixedMonthlyTotal > 0 ? `voci fisse +${fmt0(fixedMonthlyTotal)}` : ''}
                  {fixedMonthlyTotal > 0 && perMonthBonus > 0 ? ' · ' : ''}
                  {perMonthBonus > 0 ? `bonus del mese +${fmt0(perMonthBonus)}` : ''}
                </span>
              )}
            </div>

            <div className="month-bonus-row">
              <label className="month-bonus-label" htmlFor="month-bonus">
                Bonus di {formatMonthYear(currentMonth)} <span className="month-bonus-hint">(solo questo mese)</span>
              </label>
              <div className="input-with-symbol month-bonus-input">
                <span className="input-symbol">€</span>
                <input
                  id="month-bonus"
                  type="text"
                  inputMode="decimal"
                  className="form-input form-input--with-symbol"
                  placeholder="0,00"
                  value={monthBonusInput}
                  onChange={handleMonthBonusChange}
                />
              </div>
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
                      <>
                        <div className="net-line net-line--bonus"><span>Anticipo TFR (quota mese)</span><span>+{fmt0(netMonth.tfr)}</span></div>
                        <div className="net-subnote">
                          lordo {fmt0(netMonth.tfrLordo)} − imposta separata ~{(netMonth.aliqTfr * 100).toFixed(0)}% {fmt0(netMonth.tfrImposta)}
                        </div>
                      </>
                    )}
                  </>
                )}

                {tiInfo && (
                  <div className="net-subnote">
                    TI automatico: {tiInfo.motivo} · reddito annuo stimato {fmt0(tiInfo.redditoStimato)}
                  </div>
                )}

                <div className="net-line net-line--total"><span>Netto del mese</span><span>{fmt0(netMonth.net)}</span></div>
                <p className="net-disclaimer">
                  Stima indicativa (fiscalità 2026). Le trattenute sono quelle vere della busta paga
                  (contributi + IRPEF netta + addizionali). Trattamento integrativo (€1.200/anno) e
                  Indennità 207/2024 sono importi annui rapportati ai giorni del mese (÷365).
                  {netMonth.tfr > 0 && ` L'anticipo TFR è ~6,91% del lordo, tassato a parte (tassazione separata ~${(netMonth.aliqTfr * 100).toFixed(0)}%, stima).`}
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

            {(montante > 0 || annualExtras > 0) && (
              <span className="bonus-strip-note">
                ={montante > 0 ? ` montante ${fmt0(montante)}${priorMonthLabel ? ` (fino a ${priorMonthLabel})` : ''} +` : ''}
                {' '}turni {fmt0(bonus.income - montante - annualExtras)}
                {annualExtras > 0 && ` + 13ª/14ª ${fmt0(annualExtras)}`}
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
                  prima di superare i {fmt0(bonus.thresholdFullGross)} lordi e uscire dal bonus pieno
                  <span className="bonus-strip-hint"> (= 15.000 € imponibili, al netto dei contributi)</span>
                </span>
              </div>
            )}

            {bonus.status === BONUS_STATUS.PARZIALE && (
              <div className={`bonus-strip-body ${bonus.nearThreshold ? 'bonus-strip-body--warn' : ''}`}>
                <span className="bonus-strip-label">Puoi ancora guadagnare</span>
                <span className="bonus-strip-value">{fmt0(bonus.marginToMax)}</span>
                <span className="bonus-strip-note">
                  prima di superare i {fmt0(bonus.thresholdMaxGross)} lordi e perdere del tutto il bonus
                  <span className="bonus-strip-hint"> (= 28.000 € imponibili, al netto dei contributi)</span>
                </span>
              </div>
            )}

            {bonus.status === BONUS_STATUS.OLTRE && (
              <div className="bonus-strip-body bonus-strip-body--danger">
                <span className="bonus-strip-note">
                  🚨 Reddito oltre i {fmt0(bonus.thresholdMaxGross)} lordi (28.000 € imponibili): il bonus non spetta.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Riepilogo AI disattivato: il codice vive in services/ai.js, non
            referenziato (e quindi fuori dal bundle). Per riattivarlo servono
            l'import di generateMonthlySummary, lo stato aiSummary/aiLoading/
            aiError e un pulsante che li usi. */}
      </div>

      {importParsed && (
        <ImportModal
          shifts={importParsed}
          onConfirm={handleImportConfirm}
          onClose={() => setImportParsed(null)}
        />
      )}

      {pendingImportFile && (
        <div className="modal-overlay" onClick={closeNameModal}>
          <div
            ref={nameModalRef}
            className="modal name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Il tuo nome sul foglio"
            onClick={e => e.stopPropagation()}
          >
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
              <button type="button" className="btn btn-secondary" onClick={closeNameModal}>
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
