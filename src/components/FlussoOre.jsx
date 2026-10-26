// «Dove vanno le ore»: un tasto nel riepilogo apre il mese in quattro viste.
//  - Flussi (la prima): dalle giornate segnate alle voci della busta, col
//    colore della voce in cui finiscono e gli euro in grande;
//  - Ore/€: quanto pesa ogni voce nelle ore e quanto nei soldi;
//  - Settimane: il PERCHÉ, cioè la linea delle ore del contratto oltre la
//    quale ogni settimana diventa supplementare (nascosta a chi lavora a
//    chiamata, che una soglia settimanale non ce l'ha);
//  - Mosaico: riquadri grandi quanto gli euro.
// Prova, ottobre 2026.
//
// Qui non si calcola niente: i numeri sono quelli di `flussoOre` (motore), che
// riaffetta `computePayByShift` e somma al totale del mese al centesimo
// (check-flusso-ore.mjs). Il disegno è SVG a mano: per una decina di forme
// una libreria pesa più del grafico. Le forme entrano sfumando, una dopo
// l'altra; con «meno animazioni» del sistema compaiono e basta.

import { useEffect, useMemo, useRef, useState } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import { formatCurrency } from '../motore/pay';
import { flussoOre } from '../motore/flusso-ore';

const COLORE = {
  retribuzione: '#2563eb', supplementare: '#d97706', straordinario: '#b45309', festivo: '#dc2626',
  malattia: '#64748b', giaNelMonte: '#cbd5e1', maggiorazioni: '#9333ea',
  ferie: '#0d9488', permesso: '#0891b2', festivita: '#db2777', altroMese: '#94a3b8',
};
const VISTE = [['flussi', 'Flussi'], ['oreuro', 'Ore/€'], ['settimane', 'Settimane'], ['mosaico', 'Mosaico']];
const SPIEGA = {
  monte: 'Monte ore: la busta paga comunque le ore del contratto, anche quelle già andate in supplementare.',
  // «0 €» da solo non si capiva (ottobre 2026): si dice il monte e perché.
  // Né «0 €» né «oltre il monte ore» si capivano (ottobre 2026: «sono ore di
  // un altro mese?»). Il perché vero è la lunghezza del mese: lo stipendio
  // paga la media di 4,3 settimane, e i mesi lunghi si pareggiano coi corti.
  giaNelMonte: (min, monte, sett, mese) => `Stipendio fisso: paga sempre ${ore(monte)}, cioè ${ore(sett * 60)} × ${(monte / (sett * 60)).toLocaleString('it-IT', { maximumFractionDigits: 2 })} settimane, la media di un mese. ${mese} ne ha di più: ${ore(min)} entro le ${ore(sett * 60)} settimanali restano dentro quella cifra. Nei mesi corti, come febbraio, è il contrario: stessa paga con meno ore.`,
  // Come la busta di settembre 2026: le ore oltre la soglia sono le ULTIME
  // della settimana, e la settimana finisce di domenica. È la prassi più
  // comune, ma nessuna norma la impone: un datore può contarle altrimenti.
  domenica: (min) => `Domenica: ${ore(min)} oltre il contratto. La settimana finisce di domenica: le ore in più cadono lì e il +30% sostituisce il domenicale. Il tuo datore potrebbe contarle diversamente.`,
};
// Ore di domenica finite oltre il contratto (supplementare o straordinario).
const domenicaOltre = (f) => f.flussi
  .filter((x) => x.da === 'domeniche' && (x.a === 'supplementare' || x.a === 'straordinario'))
  .reduce((t, x) => t + x.minuti, 0);
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const L = 358;                  // larghezza dei disegni
const RIGHE = 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 3px, transparent 3px 6px)';

const ore = (min) => `${(Math.round((min / 60) * 100) / 100).toLocaleString('it-IT')} h`;
const pocoMovimento = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
const testo = { fontSize: 11, fill: 'var(--c-text-2)' };

export default function FlussoOre({ turni, tutti, byShift, settings, titolo }) {
  const [aperto, setAperto] = useState(false);
  return (
    <>
      <button type="button" className="linklike" onClick={() => setAperto(true)}>Dove vanno le ore →</button>
      {aperto && <Finestra turni={turni} tutti={tutti} byShift={byShift} settings={settings} titolo={titolo} onChiudi={() => setAperto(false)} />}
    </>
  );
}

function Finestra({ turni, tutti, byShift, settings, titolo, onChiudi }) {
  const ref = useRef(null);
  useModalDismiss(ref, onChiudi, true);
  const f = useMemo(() => flussoOre(turni, byShift, settings, tutti), [turni, byShift, settings, tutti]);
  const viste = VISTE.filter(([id]) => id !== 'settimane' || !settings.onCall);
  const [vista, setVista] = useState('flussi');
  // Ogni vista entra sfumando quando la si sceglie.
  const [visto, setVisto] = useState(pocoMovimento());
  useEffect(() => {
    if (pocoMovimento()) return undefined;
    setVisto(false);
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisto(true)));
    return () => cancelAnimationFrame(r);
  }, [vista]);
  const entra = (i) => ({ opacity: visto ? 1 : 0, transition: `opacity 450ms ease ${Math.min(i, 12) * 50}ms` });

  const vuoto = f.origini.length === 0;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label="Dove vanno le ore">
        <div className="modal-header">
          <h2 className="modal-title">Dove vanno le ore · {titolo}</h2>
        </div>
        <div className="modal-form">
          {vuoto ? <p className="form-hint">Nessuna ora segnata in questo mese.</p> : (
            <>
              <span className="periodo-toggle" role="tablist" style={{ marginBottom: '.6rem' }}>
                {viste.map(([id, nome]) => (
                  <button key={id} type="button" role="tab" aria-selected={vista === id}
                    className={`periodo-btn${vista === id ? ' active' : ''}`} onClick={() => setVista(id)}>{nome}</button>
                ))}
              </span>
              {vista === 'flussi' && <Flussi f={f} entra={entra} sett={Number(settings.expectedWeeklyHours) || 0} mese={titolo.split(' ')[0]} />}
              {vista === 'oreuro' && <OreEuro f={f} entra={entra} />}
              {vista === 'settimane' && <Settimane f={f} settings={settings} entra={entra} />}
              {vista === 'mosaico' && <Mosaico f={f} entra={entra} />}
              <p style={{ margin: '.5rem 0 .2rem', fontWeight: 800 }}>= {formatCurrency(f.totale)} lordi dai turni</p>
            </>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onChiudi}>Ho capito</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legenda({ voci }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.15rem .7rem', fontSize: '.75rem', color: 'var(--c-text-2)', marginTop: '.4rem' }}>
      {voci.map(([id, nome]) => (
        <span key={id}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4, verticalAlign: -1, background: COLORE[id] }} />{nome}</span>
      ))}
    </div>
  );
}

// ── Flussi ──────────────────────────────────────────────────────────────
// Colonna: altezza proporzionale alle ore, ma mai meno della riga
// dell'etichetta (la barra resta proporzionale, è lo SPAZIO che cresce).
function colonna(nodi, scala) {
  let y = 2;
  return nodi.map((n) => {
    const h = Math.max(1.5, n.minuti * scala);
    const pos = { ...n, y, h };
    y += Math.max(30, h) + 8;
    return pos;
  });
}

function Flussi({ f, entra, sett, mese }) {
  const XS = 92, XD = 214, B = 9;
  const d = useMemo(() => {
    const tot = Math.max(1, f.origini.reduce((t, o) => t + o.minuti, 0));
    const scala = 230 / tot;
    const sx = colonna(f.origini, scala);
    const dx = colonna(f.voci, scala);
    // Ogni flusso occupa una fetta della barra da cui parte e di quella in cui
    // arriva, nell'ordine delle colonne: i nastri si incrociano il meno possibile.
    const uscita = Object.fromEntries(sx.map((n) => [n.id, n.y]));
    const entrata = Object.fromEntries(dx.map((n) => [n.id, n.y]));
    const oD = Object.fromEntries(dx.map((n, i) => [n.id, i]));
    const oS = Object.fromEntries(sx.map((n, i) => [n.id, i]));
    const nastri = [...f.flussi].sort((a, b) => oS[a.da] - oS[b.da] || oD[a.a] - oD[b.a]).map((x) => {
      const h = Math.max(1, x.minuti * scala);
      const y0 = uscita[x.da]; uscita[x.da] += h;
      return { ...x, h, y0 };
    });
    for (const n of [...nastri].sort((a, b) => oD[a.a] - oD[b.a] || oS[a.da] - oS[b.da])) {
      n.y1 = entrata[n.a]; entrata[n.a] += n.h;
    }
    const alto = Math.max(...[...sx, ...dx].map((n) => n.y + Math.max(30, n.h))) + 2;
    return { sx, dx, nastri, alto };
  }, [f]);
  const spiegazioni = [
    f.origini.some((o) => o.id === 'monte') && SPIEGA.monte,
    f.voci.some((v) => v.id === 'giaNelMonte') && f.monte && sett > 0
      && SPIEGA.giaNelMonte(f.voci.find((v) => v.id === 'giaNelMonte').minuti, f.monte.monte, sett, mese),
    domenicaOltre(f) >= 0.5 && SPIEGA.domenica(domenicaOltre(f)),
  ].filter(Boolean);
  return (
    <>
      <svg viewBox={`0 0 ${L} ${d.alto}`} width="100%" role="img"
        aria-label={f.voci.map((v) => `${v.nome} ${ore(v.minuti)}, ${formatCurrency(v.euro)}`).join('; ')}>
        {d.nastri.map((n, i) => {
          const x0 = XS + B, x1 = XD, mx = (x0 + x1) / 2;
          const p = `M${x0},${n.y0} C${mx},${n.y0} ${mx},${n.y1} ${x1},${n.y1} L${x1},${n.y1 + n.h}`
            + ` C${mx},${n.y1 + n.h} ${mx},${n.y0 + n.h} ${x0},${n.y0 + n.h} Z`;
          return <path key={`${n.da}>${n.a}`} d={p} fill={COLORE[n.a]} fillOpacity={0.32} style={entra(i)} />;
        })}
        {d.sx.map((n) => (
          <g key={n.id}>
            <rect x={XS} y={n.y} width={B} height={n.h} rx={2} fill={n.id === 'monte' ? 'var(--c-border)' : 'var(--c-muted)'} />
            <text x={XS - 6} y={n.y + 11} textAnchor="end" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--c-text)' }}>{n.nome}</text>
            <text x={XS - 6} y={n.y + 24} textAnchor="end" style={testo}>{ore(n.minuti)}</text>
          </g>
        ))}
        {d.dx.map((n) => (
          <g key={n.id}>
            <rect x={XD} y={n.y} width={B} height={n.h} rx={2} fill={COLORE[n.id]} />
            <text x={XD + B + 6} y={n.y + 12} style={{ fontSize: 14, fontWeight: 800, fill: 'var(--c-text)' }}>
              {n.id === 'giaNelMonte' ? `${ore(n.minuti)} · 0 €` : formatCurrency(n.euro)}
            </text>
            <text x={XD + B + 6} y={n.y + 25} style={testo}>{n.id === 'giaNelMonte' ? n.nome : `${n.nome} · ${ore(n.minuti)}`}</text>
          </g>
        ))}
      </svg>
      {f.maggiorazioni.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', margin: '.4rem 0 0' }}>
          {f.maggiorazioni.map((m) => (
            <span key={m.id} style={{ fontSize: '.8rem', padding: '.2rem .55rem', borderRadius: 999, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
              + {m.nome}{m.minuti > 0 ? ` su ${ore(m.minuti)}` : ''} · <strong>{formatCurrency(m.euro)}</strong>
            </span>
          ))}
        </div>
      )}
      {spiegazioni.map((t) => <p key={t} className="form-hint" style={{ margin: '.35rem 0 0' }}>{t}</p>)}
    </>
  );
}

// ── Ore contro euro ─────────────────────────────────────────────────────
function OreEuro({ f, entra }) {
  const magg = f.maggiorazioni.reduce((t, m) => t + m.euro, 0);
  const voci = [...f.voci.map((v) => ({ ...v, euro: v.id === 'giaNelMonte' ? 0 : v.euro })),
    ...(magg >= 0.005 ? [{ id: 'maggiorazioni', nome: 'Maggiorazioni', minuti: 0, euro: magg }] : [])];
  const totOre = Math.max(1, voci.reduce((t, v) => t + v.minuti, 0));
  const totEuro = Math.max(0.01, f.totale);
  const H = 34, Y1 = 22, Y2 = 136;
  let a = 0, b = 0;
  const pezzi = voci.map((v) => {
    const wa = (v.minuti / totOre) * L, wb = (v.euro / totEuro) * L;
    const p = { ...v, a, b, wa, wb };
    a += wa; b += wb;
    return p;
  });
  const sup = f.voci.find((v) => v.id === 'supplementare');
  return (
    <>
      <svg viewBox={`0 0 ${L} ${Y2 + H + 22}`} width="100%" role="img" aria-label="Ore e euro per voce">
        <text x={0} y={14} style={{ fontSize: 12.5, fontWeight: 700, fill: 'var(--c-text)' }}>Ore · {ore(totOre)}</text>
        {pezzi.map((p, i) => (
          <g key={p.id} style={entra(i)}>
            {(p.wa > 0 || p.wb > 0) && <path d={`M${p.a},${Y1 + H} L${p.a + p.wa},${Y1 + H} L${p.b + p.wb},${Y2} L${p.b},${Y2} Z`} fill={COLORE[p.id]} fillOpacity={0.14} />}
            {p.wa > 0 && <rect x={p.a} y={Y1} width={Math.max(1, p.wa - 1.5)} height={H} fill={COLORE[p.id]} />}
            {p.wb > 0 && <rect x={p.b} y={Y2} width={Math.max(1, p.wb - 1.5)} height={H} fill={COLORE[p.id]} />}
            {p.wa > 46 && <text x={p.a + 6} y={Y1 + 22} style={{ fontSize: 12, fontWeight: 700, fill: '#fff' }}>{ore(p.minuti)}</text>}
            {p.wb > 70 && <text x={p.b + 6} y={Y2 + 22} style={{ fontSize: 12, fontWeight: 700, fill: '#fff' }}>{formatCurrency(p.euro)}</text>}
          </g>
        ))}
        <text x={0} y={Y2 + H + 18} style={{ fontSize: 12.5, fontWeight: 700, fill: 'var(--c-text)' }}>Euro · {formatCurrency(f.totale)}</text>
      </svg>
      <Legenda voci={voci.map((v) => [v.id, v.nome])} />
      {sup && sup.minuti > 0 && (
        <p className="form-hint" style={{ margin: '.5rem 0 0' }}>
          {sup.nome}: il <b>{Math.round((sup.minuti / totOre) * 100)}%</b> delle ore, il <b>{Math.round((sup.euro / totEuro) * 100)}%</b> dei soldi
          · {formatCurrency(sup.euro / (sup.minuti / 60))} l'ora.
        </p>
      )}
    </>
  );
}

// ── Settimane ───────────────────────────────────────────────────────────
const PEZZI = ['altroMese', 'ferie', 'permesso', 'malattia', 'ordinarie', 'supplementare', 'straordinario', 'festivo', 'festivita'];
const NOMI = { altroMese: 'Altro mese', ferie: 'Ferie', permesso: 'Permesso', malattia: 'Malattia', ordinarie: 'Ordinarie',
  supplementare: 'Supplementare', straordinario: 'Straordinario', festivo: 'Festivo', festivita: 'Festività' };
const tinta = (k) => (k === 'ordinarie' ? COLORE.retribuzione : COLORE[k]);

function intervallo(inizio) {
  const [a, m, g] = inizio.split('-').map(Number);
  const d = new Date(a, m - 1, g), e = new Date(a, m - 1, g + 6);
  return d.getMonth() === e.getMonth() ? `${d.getDate()}–${e.getDate()} ${MESI[e.getMonth()]}`
    : `${d.getDate()} ${MESI[d.getMonth()]}–${e.getDate()} ${MESI[e.getMonth()]}`;
}

function Settimane({ f, settings, entra }) {
  const soglia = (Number(settings.expectedWeeklyHours) || 0) * 60;
  const pieno = (Number(settings.fullTimeWeeklyHours) || 40) * 60;
  const massimo = Math.max(pieno, ...f.settimane.map((w) => PEZZI.reduce((t, k) => t + w[k], 0)));
  const pc = (min) => `${(min / massimo) * 100}%`;
  const usati = PEZZI.filter((k) => f.settimane.some((w) => w[k] >= 0.5));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '4.6rem 1fr', columnGap: '.4rem', rowGap: '.15rem', alignItems: 'center', fontSize: '.75rem' }}>
        <span />
        <div style={{ position: 'relative', height: 14, color: 'var(--c-text-2)', whiteSpace: 'nowrap' }}>
          {soglia > 0 && <span style={{ position: 'absolute', left: pc(soglia), transform: 'translateX(-50%)' }}>{ore(soglia)}</span>}
          <span style={{ position: 'absolute', left: pc(pieno), transform: 'translateX(-100%)' }}>{ore(pieno)}</span>
        </div>
        {f.settimane.map((w, i) => {
          const extra = w.supplementare + w.straordinario;
          const euro = w.euroSupplementare + w.euroStraordinario;
          return [
            <span key={`n${w.inizio}`} style={{ color: 'var(--c-text-2)', alignSelf: 'start', paddingTop: 4 }}>{intervallo(w.inizio)}</span>,
            <div key={w.inizio} style={entra(i)}>
              <div style={{ position: 'relative', height: 20, display: 'flex', borderRadius: 4 }}>
                {PEZZI.filter((k) => w[k] >= 0.5).map((k) => (
                  <span key={k} title={`${NOMI[k]} ${ore(w[k])}`} style={{ width: pc(w[k]), height: '100%', backgroundColor: tinta(k),
                    backgroundImage: ['altroMese', 'ferie', 'permesso', 'malattia', 'festivita'].includes(k) ? RIGHE : 'none' }} />
                ))}
                {soglia > 0 && <i style={{ position: 'absolute', top: -4, bottom: -4, left: pc(soglia), borderLeft: '2px dashed var(--c-text)' }} />}
              </div>
              <div style={{ fontWeight: 600, margin: '2px 0 4px', color: extra > 0 ? COLORE.supplementare : 'var(--c-text-2)' }}>
                {extra > 0 ? `+${ore(extra)} oltre il contratto · ${formatCurrency(euro)}` : ore(PEZZI.reduce((t, k) => t + (k === 'altroMese' ? 0 : w[k]), 0))}
              </div>
            </div>,
          ];
        })}
      </div>
      <Legenda voci={usati.map((k) => [k === 'ordinarie' ? 'retribuzione' : k, NOMI[k]])} />
      {domenicaOltre(f) >= 0.5 && <p className="form-hint" style={{ margin: '.4rem 0 0' }}>{SPIEGA.domenica(domenicaOltre(f))}</p>}
      {f.monte && (
        <>
          <p className="form-hint" style={{ margin: '.6rem 0 .2rem' }}>
            <b>Monte ore del mese</b> · {ore(Math.min(f.monte.pagate, f.monte.monte))} su {ore(f.monte.monte)}
          </p>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--c-bg)', overflow: 'hidden' }}>
            <i style={{ display: 'block', height: '100%', width: `${Math.min(100, (f.monte.pagate / f.monte.monte) * 100)}%`, background: COLORE.retribuzione }} />
          </div>
        </>
      )}
    </>
  );
}

// ── Mosaico ─────────────────────────────────────────────────────────────
// Ogni riquadro prende, sul lato più lungo dello spazio che resta, la sua
// quota degli euro: il più grande a sinistra, gli altri a dividersi il resto.
function affetta(voci, x, y, w, h) {
  if (!voci.length) return [];
  const tot = voci.reduce((t, v) => t + v.euro, 0);
  const [v, ...resto] = voci;
  if (!resto.length) return [{ ...v, x, y, w, h }];
  const k = v.euro / tot;
  return w >= h
    ? [{ ...v, x, y, w: w * k, h }, ...affetta(resto, x + w * k, y, w * (1 - k), h)]
    : [{ ...v, x, y, w, h: h * k }, ...affetta(resto, x, y + h * k, w, h * (1 - k))];
}

function Mosaico({ f, entra }) {
  const magg = f.maggiorazioni.reduce((t, m) => t + m.euro, 0);
  const voci = [...f.voci.filter((v) => v.id !== 'giaNelMonte' && v.euro >= 0.005),
    ...(magg >= 0.005 ? [{ id: 'maggiorazioni', nome: 'Maggiorazioni', minuti: 0, euro: magg }] : [])]
    .sort((a, b) => b.euro - a.euro);
  const H = 250;
  const blocchi = affetta(voci, 0, 0, L, H);
  const senzaEuro = f.voci.filter((v) => v.euro < 0.005 || v.id === 'giaNelMonte');
  return (
    <>
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" role="img" aria-label={voci.map((v) => `${v.nome} ${formatCurrency(v.euro)}`).join('; ')}>
        {blocchi.map((b, i) => {
          const grande = b.w > 110 && b.h > 48;
          const medio = b.w > 62 && b.h > 22;
          return (
            <g key={b.id} style={entra(i)}>
              <rect x={b.x + 1} y={b.y + 1} width={Math.max(0, b.w - 2)} height={Math.max(0, b.h - 2)} rx={6} fill={COLORE[b.id]} />
              {medio && <text x={b.x + 9} y={b.y + (grande ? 25 : 17)} style={{ fontSize: grande ? 18 : 12, fontWeight: 800, fill: '#fff' }}>{formatCurrency(b.euro)}</text>}
              {grande && <text x={b.x + 9} y={b.y + 43} style={{ fontSize: 11.5, fill: '#fff' }}>{b.nome}{b.minuti > 0 ? ` · ${ore(b.minuti)}` : ''}</text>}
            </g>
          );
        })}
      </svg>
      <Legenda voci={voci.map((v) => [v.id, v.nome])} />
      {senzaEuro.length > 0 && (
        <p className="form-hint" style={{ margin: '.4rem 0 0' }}>
          Senza euro: {senzaEuro.map((v) => `${v.nome.toLowerCase()} ${ore(v.minuti)}`).join(' · ')}.
        </p>
      )}
    </>
  );
}
