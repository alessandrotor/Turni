import { useMemo, useState } from 'react';
import { MONTH_NAMES } from '../utils/dates';
import { hasAnyRate, formatCurrency } from '../utils/pay';
import { isMensilizzato } from '../utils/ccnl';
import { computeAnnualGrossFromShifts, projectAnnualIncome, calcNetAnnual } from '../utils/net';
import { monthlyBreakdown } from '../utils/stats';
import { calcBonusMargin, BONUS_STATUS } from '../utils/bonus';
import { ENABLE_NET_CALC } from '../config/features';
import Bars from './charts/Bars';

const fmt0 = (n) => formatCurrency(Math.round(n));
const fmtHours = (h) => `${h.toFixed(1)} h`;

// Da dove arriva la proiezione annua, per dirlo all'utente — stessa etichetta
// che il pannello netto di Calendario usa per lo stesso valore.
const PROJECTION_LABEL = {
  contratto: 'da contratto',
  maturato: 'dal maturato annualizzato',
  manuale: 'inserita a mano',
};

// Proiezioni sui dati già inseriti: nessun input nuovo, solo l'anno intero
// invece di un mese alla volta. Le cifre (lordo, netto, proiezione annua)
// sono le STESSE che Calendario mostra mese per mese — vedi
// `computeAnnualGrossFromShifts`/`projectAnnualIncome` in utils/net.js e
// `monthlyBreakdown` in utils/stats.js, condivise fra le due pagine apposta.
export default function StatsView({ allShifts, settings, payByShift, onNavigate }) {
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

  const netCalcOn = ENABLE_NET_CALC && hasAnyRate(settings);
  const netAnnualProjected = useMemo(
    () => (netCalcOn ? calcNetAnnual(projection.value, settings) : null),
    [netCalcOn, projection, settings],
  );
  const netSoFar = useMemo(() => months.reduce((s, m) => s + m.net, 0), [months]);

  const bonus = useMemo(() => calcBonusMargin(projection.value, settings), [projection, settings]);

  const otLabel = !settings.onCall && isMensilizzato(settings) ? 'Supplementari' : 'Straordinari';

  const grossNetData = useMemo(() => months.map(m => {
    const label = MONTH_NAMES[m.monthIndex];
    const bars = [{ segments: [{ value: m.gross, color: 'var(--c-primary)', title: `Lordo ${label}: ${fmt0(m.gross)}` }] }];
    if (netCalcOn) {
      bars.push({ segments: [{ value: m.net, color: 'var(--c-success)', title: `Netto ${label}: ${fmt0(m.net)}` }] });
    }
    return { label, bars };
  }), [months, netCalcOn]);

  const hoursData = useMemo(() => months.map(m => {
    const label = MONTH_NAMES[m.monthIndex];
    const segments = [
      { value: m.ordinaryMinutes / 60, color: 'var(--c-primary)', title: `Ordinarie ${label}: ${fmtHours(m.ordinaryMinutes / 60)}` },
    ];
    if (m.overtimeMinutes > 0) {
      segments.push({
        value: m.overtimeMinutes / 60, color: 'var(--c-warning)',
        title: `${otLabel} ${label}: ${fmtHours(m.overtimeMinutes / 60)}`,
      });
    }
    return { label, bars: [{ segments }] };
  }), [months, otLabel]);

  if (yearsWithData.length === 0) {
    return (
      <div className="stats-view">
        <div className="stats-empty">
          <p>Non hai ancora inserito turni: le statistiche compaiono appena ce n'è almeno uno.</p>
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

          <div className="stats-card">
            <div className="stats-card-title">Retribuzione mensile</div>
            <Bars data={grossNetData} formatValue={fmt0} />
            <div className="stats-legend">
              <span className="stats-legend-item"><i style={{ background: 'var(--c-primary)' }} />Lordo</span>
              {netCalcOn && (
                <span className="stats-legend-item"><i style={{ background: 'var(--c-success)' }} />Netto</span>
              )}
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card-title">Ore lavorate al mese</div>
            <Bars data={hoursData} formatValue={fmtHours} />
            <div className="stats-legend">
              <span className="stats-legend-item"><i style={{ background: 'var(--c-primary)' }} />Ordinarie</span>
              <span className="stats-legend-item"><i style={{ background: 'var(--c-warning)' }} />{otLabel}</span>
            </div>
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
