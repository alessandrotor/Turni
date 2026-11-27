// LA DETRAZIONE MESE PER MESE, disegnata (novembre 2026, dal mockup approvato).
// In alto la stima dell'anno che il datore fa ogni mese, contro la soglia dei
// 15.000; in basso detrazione e tratt. integrativo del mese. Quando la linea
// passa la soglia la barra cambia: più detrazione, niente verde. Sotto, il mese
// toccato passo per passo. Le cifre: `detrazioneMesePerMese()`; qui si disegna.

import { useMemo, useState } from 'react';
import { detrazioneMesePerMese } from '../motore/mese-per-mese';
import { numeroIt } from '../utils/formato';
import { formatCurrency } from '../motore/pay';

const INIZIALI = 'GFMAMGLASOND';
const NOMI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
  'settembre', 'ottobre', 'novembre', 'dicembre'];
const W = 350;
const X0 = 4;
const CW = (W - X0) / 12;

function Passo({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px', fontSize: '.86rem' }}>
      <span style={{
        flex: 'none', width: 22, height: 22, borderRadius: '50%', background: 'var(--c-text)', color: 'var(--c-card)',
        fontSize: '.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      >{n}</span>
      <span>{children}</span>
    </div>
  );
}

/**
 * @param {{ anno: number, meseIniziale: number, allShifts: Array<any>, settings: import('../motore/impostazioni.js').Impostazioni,
 *   payMap: object|null, oggi: Date }} props
 */
export default function GraficoMesi({ anno, meseIniziale, allShifts, settings, payMap, oggi }) {
  const [premioOgniMese, setPremioOgniMese] = useState(false);
  const [scelto, setScelto] = useState(meseIniziale);
  const mesi = useMemo(
    () => detrazioneMesePerMese({ anno, allShifts, settings, payMap, oggi, premioOgniMese }),
    [anno, allShifts, settings, payMap, oggi, premioOgniMese],
  );
  const soglia = 15000;
  const stime = mesi.filter(Boolean).map((m) => m.stima);
  const alto = Math.max(soglia + 2500, ...stime);
  const basso = Math.min(soglia - 2500, ...stime);
  const yS = (r) => 10 + ((alto - r) / (alto - basso)) * 58;
  const massimo = Math.max(1, ...mesi.filter(Boolean).map((m) => m.detrazione + m.ti));
  const yB = (v) => 176 - (v / massimo) * 84;
  const cx = (i) => X0 + CW * i + CW / 2;
  const punti = mesi.map((m, i) => (m ? `${cx(i)},${yS(m.stima)}` : null)).filter(Boolean).join(' ');
  const m = mesi[scelto] || mesi.find(Boolean);
  const premio = Number(settings.monthlyBonusAmount) || 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} 180`} width="100%" role="img" aria-label="Stima dell'anno e detrazione, mese per mese">
        <line x1="0" x2={W} y1={yS(soglia)} y2={yS(soglia)} stroke="var(--c-muted)" strokeDasharray="4 3" />
        <text x={W - 2} y={yS(soglia) - 4} fontSize="9" fill="var(--c-text-2)" textAnchor="end">{numeroIt(soglia)}</text>
        {mesi.map((x, i) => i === scelto && x && (
          <rect key="sel" x={X0 + CW * i + 1} y="2" width={CW - 2} height="176" rx="5" fill="var(--c-primary-light)" opacity=".7" />
        ))}
        <polyline fill="none" stroke="var(--c-text)" strokeWidth="1.5" points={punti} />
        {mesi.map((x, i) => x && (
          <g key={i} opacity={x.fonte === 'contratto' ? 0.45 : 1}>
            <circle cx={cx(i)} cy={yS(x.stima)} r={i === scelto ? 4.5 : 3} fill={x.sopra ? 'var(--c-text)' : 'var(--c-success)'} />
            <rect x={X0 + CW * i + 4} y={yB(x.detrazione)} width={CW - 8} height={176 - yB(x.detrazione)} rx="2" fill="var(--c-primary)" />
            {x.ti > 0 && (
              <rect x={X0 + CW * i + 4} y={yB(x.detrazione + x.ti)} width={CW - 8} height={yB(x.detrazione) - yB(x.detrazione + x.ti)} rx="2" fill="var(--c-success)" />
            )}
          </g>
        ))}
        {mesi.map((x, i) => (
          <text key={`l${i}`} x={cx(i)} y="84" fontSize="10" textAnchor="middle"
            fontWeight={i === scelto ? 700 : 500} fill={i === scelto ? 'var(--c-primary-dark)' : 'var(--c-text-2)'}
          >{INIZIALI[i]}</text>
        ))}
        {/* Il tocco su tutta la colonna, non sulla barra sottile. */}
        {mesi.map((x, i) => x && (
          <rect key={`t${i}`} x={X0 + CW * i} y="0" width={CW} height="180" fill="transparent"
            style={{ cursor: 'pointer' }} onClick={() => setScelto(i)}
          ><title>{NOMI[i]}</title></rect>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: '4px 14px', fontSize: '.75rem', color: 'var(--c-text-2)', margin: '2px 0 8px', flexWrap: 'wrap' }}>
        <span><span style={{ color: 'var(--c-text)' }}>●</span> stima dell&apos;anno</span>
        <span><span style={{ color: 'var(--c-primary)' }}>■</span> detrazione</span>
        <span><span style={{ color: 'var(--c-success)' }}>■</span> tratt. integrativo</span>
      </div>
      {premio > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem', margin: '0 0 8px' }}>
          <input type="checkbox" checked={premioOgniMese} onChange={(e) => setPremioOgniMese(e.target.checked)} />
          Con il premio di {numeroIt(premio)} € tutti i mesi
        </label>
      )}
      {m && (
        <div style={{ border: '1px solid var(--c-border)', borderRadius: 12, padding: '10px 12px', background: 'var(--c-bg)' }}>
          <div style={{ fontWeight: 600, fontSize: '.95rem', margin: '0 0 10px' }}>
            {NOMI[m.mese].replace(/^./, (c) => c.toUpperCase())}, passo per passo
            {m.fonte === 'contratto' && <span style={{ fontWeight: 400, color: 'var(--c-text-2)' }}> · da contratto (chiaro)</span>}
          </div>
          <Passo n="1">
            Finora <strong>{numeroIt(Math.round(m.finora))} €</strong> + {NOMI[m.mese]} <strong>{numeroIt(Math.round(m.lordo))} €</strong>
            {m.moltiplicatore > 1 && <> × {m.moltiplicatore}</>}
          </Passo>
          <Passo n="2">
            = <strong>{numeroIt(Math.round(m.stimaLorda))} €</strong> lordi nell&apos;anno ({numeroIt(m.stima)} di reddito),{' '}
            <strong>{m.sopra ? 'sopra' : 'sotto'} i 15.000</strong>
          </Passo>
          <Passo n="3">
            {m.sopra
              ? <>Detrazione dell&apos;anno: <strong>{numeroIt(Math.round(m.detrazioneAnnua))} €</strong></>
              : <>Detrazione <strong>{numeroIt(Math.round(m.detrazioneAnnua))} €</strong> + tratt. int.</>}
          </Passo>
          <Passo n="4">
            {m.giorni} giorni su 365: <strong>{formatCurrency(m.detrazione)}</strong>
            {m.ti > 0 && <> + <strong>{formatCurrency(m.ti)}</strong></>}
          </Passo>
        </div>
      )}
    </div>
  );
}
