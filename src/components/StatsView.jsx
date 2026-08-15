import { useMemo, useState } from 'react';
import { MONTH_NAMES, parseDate } from '../utils/dates';
import { hasAnyRate, formatCurrency } from '../utils/pay';
import { computeAnnualGrossFromShifts, projectAnnualIncome, calcNetAnnual } from '../utils/net';
import { monthlyBreakdown, dailyBreakdown, yearSummary, monthGrid } from '../utils/stats';
import { calcBonusMargin, BONUS_STATUS } from '../utils/bonus';
import { ENABLE_NET_CALC } from '../config/features';

const fmt0 = (n) => formatCurrency(Math.round(n));
// Ore compatte: «152h» o «152h 30m». Nelle celle del calendarietto e nei
// totali di mese lo spazio è pochissimo, i decimali non servono.
const fmtH = (mins) => {
  const t = Math.round(mins);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

// Da dove arriva la proiezione annua, per dirlo all'utente — stessa etichetta
// che il pannello netto di Calendario usa per lo stesso valore.
const PROJECTION_LABEL = {
  contratto: 'da contratto',
  maturato: 'dal maturato annualizzato',
  manuale: 'inserita a mano',
};

// Intensità della cella in base alle ore del giorno. Soglie ASSOLUTE, non
// relative al massimo dell'anno: un mese leggero non deve colorarsi come uno
// pesante solo perché è il più carico che c'è.
function dayLevel(minutes) {
  if (minutes >= 7 * 60) return 3;
  if (minutes >= 4 * 60) return 2;
  return 1;
}

// La fascia che "vince" il colore del giorno è la più alta presente: un giorno
// con anche solo un'ora di straordinario va visto come giorno di straordinario.
function dayCategory(day) {
  if (day.straordinarioMinutes > 0) return 'str';
  if (day.overtimeMinutes > 0) return 'sup';
  return 'ord';
}

// Riepilogo dell'anno sui dati già inseriti: un calendarietto a colpo d'occhio
// (dodici mesi, un colore per giorno) più i totali che nessuna altra vista
// mette insieme. Le cifre economiche vengono dalle stesse funzioni che usa
// Calendario — vedi `computeAnnualGrossFromShifts`/`projectAnnualIncome` in
// utils/net.js — così le due pagine non possono divergere.
export default function StatsView({ allShifts, settings, payByShift, onNavigate, onOpenMonth }) {
  const yearsWithData = useMemo(() => {
    const set = new Set((allShifts || []).map(s => Number(s.date.slice(0, 4))));
    return Array.from(set).sort((a, b) => a - b);
  }, [allShifts]);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(
    yearsWithData.length > 0 ? yearsWithData[yearsWithData.length - 1] : currentYear,
  );
  const minYear = yearsWithData[0] ?? currentYear;
  const maxYear = yearsWithData[yearsWithData.length - 1] ?? currentYear;

  const annualGross = useMemo(
    () => computeAnnualGrossFromShifts(year, allShifts, settings, payByShift),
    [year, allShifts, settings, payByShift],
  );
  const projection = useMemo(
    () => projectAnnualIncome(annualGross.total, annualGross.extras, settings, year, {
      enableNetCalc: ENABLE_NET_CALC,
    }),
    [annualGross, settings, year],
  );
  const months = useMemo(
    () => monthlyBreakdown(year, allShifts, settings, payByShift, projection.value, ENABLE_NET_CALC),
    [year, allShifts, settings, payByShift, projection],
  );
  const byDay = useMemo(
    () => dailyBreakdown(year, allShifts, settings, payByShift),
    [year, allShifts, settings, payByShift],
  );
  const summary = useMemo(() => yearSummary(byDay), [byDay]);
  const minutesByMonth = useMemo(() => {
    const map = new Map(months.map(m => [m.monthIndex, m.totalMinutes]));
    return map;
  }, [months]);

  const netCalcOn = ENABLE_NET_CALC && hasAnyRate(settings);
  const netAnnualProjected = useMemo(
    () => (netCalcOn ? calcNetAnnual(projection.value, settings) : null),
    [netCalcOn, projection, settings],
  );
  const netSoFar = useMemo(() => months.reduce((s, m) => s + m.net, 0), [months]);
  const bonus = useMemo(() => calcBonusMargin(projection.value, settings), [projection, settings]);

  // Stessa etichetta della fascia 1 che usa il riepilogo di Calendario: chi
  // lavora a chiamata non ha una soglia part-time/full-time da distinguere,
  // resta un'unica fascia chiamata straordinario.
  const tier1Label = settings.onCall ? 'Straordinarie' : 'Supplementari';
  const hasSup = summary.overtimeMinutes > 0;
  const hasStr = summary.straordinarioMinutes > 0;

  if (yearsWithData.length === 0) {
    return (
      <div className="stats-view">
        <div className="stats-empty">
          <p>Non hai ancora inserito turni: il riepilogo compare appena ce n'è almeno uno.</p>
          <button type="button" className="linklike" onClick={() => onNavigate?.('calendar')}>
            Vai al Calendario →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-view">
      <div className="stats-year-nav">
        <button
          type="button"
          className="week-nav-btn"
          disabled={year <= minYear}
          onClick={() => setYear(y => y - 1)}
          aria-label="Anno precedente"
        >
          ‹
        </button>
        <span className="stats-year-label">{year}</span>
        <button
          type="button"
          className="week-nav-btn"
          disabled={year >= maxYear}
          onClick={() => setYear(y => y + 1)}
          aria-label="Anno successivo"
        >
          ›
        </button>
      </div>

      {months.length === 0 ? (
        <div className="stats-empty">
          <p>Nessun turno registrato nel {year}.</p>
        </div>
      ) : (
        <>
          <div className="stats-card">
            <div className="stats-card-title">Riepilogo {year}</div>
            <div className="stats-facts">
              <div className="stats-fact">
                <span className="stats-fact-value">{summary.workedDays}</span>
                <span className="stats-fact-label">giorni lavorati</span>
              </div>
              <div className="stats-fact">
                <span className="stats-fact-value">{fmtH(summary.totalMinutes)}</span>
                <span className="stats-fact-label">ore totali</span>
              </div>
              {hasSup && (
                <div className="stats-fact">
                  <span className="stats-fact-value stats-fact-value--sup">{fmtH(summary.overtimeMinutes)}</span>
                  <span className="stats-fact-label">{tier1Label.toLowerCase()}</span>
                </div>
              )}
              {hasStr && (
                <div className="stats-fact">
                  <span className="stats-fact-value stats-fact-value--str">{fmtH(summary.straordinarioMinutes)}</span>
                  <span className="stats-fact-label">straordinarie</span>
                </div>
              )}
              <div className="stats-fact">
                <span className="stats-fact-value">{summary.sundays}</span>
                <span className="stats-fact-label">domeniche</span>
              </div>
              <div className="stats-fact">
                <span className="stats-fact-value">{summary.holidays}</span>
                <span className="stats-fact-label">festivi</span>
              </div>
              <div className="stats-fact">
                <span className="stats-fact-value">{summary.longestStreak}</span>
                <span className="stats-fact-label">
                  giorni di fila
                  {summary.longestStreakEnd && (
                    <>
                      {' '}(fino al {parseDate(summary.longestStreakEnd).getDate()}
                      {' '}{MONTH_NAMES[parseDate(summary.longestStreakEnd).getMonth()]})
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card-title">L'anno a colpo d'occhio</div>
            <div className="mini-months">
              {Array.from({ length: 12 }, (_, m) => {
                const mins = minutesByMonth.get(m) || 0;
                return (
                  <div className="mini-month" key={m}>
                    <button
                      type="button"
                      className="mini-month-head"
                      onClick={() => onOpenMonth?.(year, m)}
                      title={`Apri ${MONTH_NAMES[m]} ${year} nel Calendario`}
                    >
                      {MONTH_NAMES[m]}
                    </button>
                    <div className="mini-grid">
                      {WEEKDAY_INITIALS.map((w, i) => (
                        <span className="mini-dow" key={`w${i}`}>{w}</span>
                      ))}
                      {monthGrid(year, m).map((iso, i) => {
                        if (!iso) return <span className="mini-day mini-day--pad" key={`p${i}`} />;
                        const day = byDay.get(iso);
                        if (!day) return <span className="mini-day" data-cat="off" key={iso} />;
                        const dayNum = Number(iso.slice(8, 10));
                        const parts = [`${dayNum} ${MONTH_NAMES[m]}: ${fmtH(day.totalMinutes)}`];
                        if (day.overtimeMinutes > 0) parts.push(`${tier1Label.toLowerCase()} ${fmtH(day.overtimeMinutes)}`);
                        if (day.straordinarioMinutes > 0) parts.push(`straordinarie ${fmtH(day.straordinarioMinutes)}`);
                        if (day.holiday) parts.push('festivo');
                        else if (day.sunday) parts.push('domenica');
                        return (
                          <span
                            className="mini-day"
                            data-cat={dayCategory(day)}
                            data-level={dayLevel(day.totalMinutes)}
                            key={iso}
                            title={parts.join(' · ')}
                          />
                        );
                      })}
                    </div>
                    <span className="mini-month-total">{mins > 0 ? fmtH(mins) : '—'}</span>
                  </div>
                );
              })}
            </div>
            <div className="stats-legend">
              <span className="stats-legend-item"><i className="mini-day" data-cat="ord" data-level="2" />Ordinarie</span>
              {hasSup && <span className="stats-legend-item"><i className="mini-day" data-cat="sup" data-level="2" />{tier1Label}</span>}
              {hasStr && <span className="stats-legend-item"><i className="mini-day" data-cat="str" data-level="2" />Straordinarie</span>}
              <span className="stats-legend-item stats-legend-item--hint">tinta più intensa = più ore</span>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card-title">Proiezione annua {year}</div>
            <div className="stats-projection-row">
              <div className="stats-projection-item">
                <span className="stats-projection-label">Maturato finora</span>
                <span className="stats-projection-value">{fmt0(annualGross.total)}</span>
                {netCalcOn && <span className="stats-projection-sub">netto {fmt0(netSoFar)}</span>}
              </div>
              <div className="stats-projection-arrow">→</div>
              <div className="stats-projection-item">
                <span className="stats-projection-label">Stima fine anno</span>
                <span className="stats-projection-value">{fmt0(projection.value)}</span>
                {netCalcOn && netAnnualProjected && (
                  <span className="stats-projection-sub">netto {fmt0(netAnnualProjected.net)}</span>
                )}
              </div>
            </div>
            <p className="stats-projection-source">
              proiezione {PROJECTION_LABEL[projection.source] || projection.source}
            </p>
            {ENABLE_NET_CALC && (
              <p className="net-disclaimer--prominent">
                ⚠️ Funzione beta: i calcoli possono contenere errori. Fai sempre controllare
                questi dati a un professionista prima di usarli.
              </p>
            )}
          </div>

          {bonus.status !== BONUS_STATUS.ATTESA && (
            <div className="bonus-strip">
              <div className="bonus-strip-head">
                <span className="bonus-strip-title">💶 Trattamento integrativo (ex bonus Renzi)</span>
              </div>
              <span className={`bonus-strip-note ${bonus.status === BONUS_STATUS.OLTRE ? 'bonus-strip-note--warn' : ''}`}>
                {bonus.status === BONUS_STATUS.PIENO && !bonus.nearThreshold && 'Bonus pieno: reddito entro le soglie.'}
                {bonus.status === BONUS_STATUS.PIENO && bonus.nearThreshold && '⚠️ Vicino alla soglia del bonus pieno.'}
                {bonus.status === BONUS_STATUS.PARZIALE && 'Bonus ridotto: reddito oltre i 15.000 € imponibili.'}
                {bonus.status === BONUS_STATUS.OLTRE && '🚨 Reddito oltre i 28.000 € imponibili: il bonus non spetta.'}
              </span>
              {bonus.status === BONUS_STATUS.PIENO && (
                <div className={`bonus-strip-body ${bonus.nearThreshold ? 'bonus-strip-body--warn' : ''}`}>
                  <span className="bonus-strip-label">
                    {bonus.nearThreshold ? '⚠️ Sei vicino alla soglia' : 'Puoi ancora guadagnare'}
                  </span>
                  <span className="bonus-strip-value">{fmt0(bonus.marginToFull)}</span>
                  <span className="bonus-strip-note">
                    prima di superare i {fmt0(bonus.thresholdFullGross)} lordi (proiezione annua) e uscire dal bonus pieno
                  </span>
                </div>
              )}
              {bonus.status === BONUS_STATUS.PARZIALE && (
                <div className={`bonus-strip-body ${bonus.nearThreshold ? 'bonus-strip-body--warn' : ''}`}>
                  <span className="bonus-strip-label">Puoi ancora guadagnare</span>
                  <span className="bonus-strip-value">{fmt0(bonus.marginToMax)}</span>
                  <span className="bonus-strip-note">
                    prima di superare i {fmt0(bonus.thresholdMaxGross)} lordi (proiezione annua) e perdere del tutto il bonus
                  </span>
                </div>
              )}
              {bonus.status === BONUS_STATUS.OLTRE && (
                <div className="bonus-strip-body bonus-strip-body--danger">
                  <span className="bonus-strip-note">
                    🚨 Proiezione annua oltre i {fmt0(bonus.thresholdMaxGross)} lordi: il bonus non spetta.
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
