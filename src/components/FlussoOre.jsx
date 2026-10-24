// «Dove vanno le ore»: un tasto nel riepilogo apre il diagramma a flussi del
// mese. A sinistra le ore segnate per tipo di giornata, a destra le voci della
// busta in cui finiscono, con gli euro; sotto, le maggiorazioni che stanno
// SOPRA ore già contate. Prova, ottobre 2026.
//
// Qui non si calcola niente: i numeri sono quelli di `flussoOre` (motore), che
// riaffetta `computePayByShift` e somma al totale del mese al centesimo
// (check-flusso-ore.mjs). Il disegno è SVG a mano: per due colonne e una
// decina di flussi una libreria pesa più del diagramma.
//
// Sobrio come la cifra che scorre: i flussi entrano sfumando, uno dopo
// l'altro; con «meno animazioni» del sistema compaiono e basta.

import { useEffect, useMemo, useRef, useState } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import { formatCurrency } from '../motore/pay';
import { flussoOre } from '../motore/flusso-ore';

const COLORE = {
  feriali: '#2563eb', domeniche: '#d97706', festivi: '#dc2626', ferie: '#0d9488',
  permesso: '#0891b2', festivita: '#7c3aed', malattia: '#64748b', monte: '#94a3b8',
};
// Una riga per ogni flusso che non è ovvio, solo quando c'è.
const SPIEGA = {
  monte: 'Monte ore: la busta paga comunque le ore del contratto, anche quelle già andate in supplementare.',
  giaNelMonte: 'Già nel monte ore: il mese ha le sue ore ordinarie, queste non aggiungono euro.',
};

const L = 360;           // larghezza del disegno
const XS = 112;          // colonna di sinistra
const XD = 222;          // colonna di destra
const BARRA = 9;
const SPAZIO = 8;        // fra due nodi
const RIGA = 30;         // spazio minimo per l'etichetta di un nodo
const ALTO = 300;        // altezza utile per le ore

const ore = (min) => `${(Math.round((min / 60) * 100) / 100).toLocaleString('it-IT')} h`;
const pocoMovimento = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// Mette in colonna i nodi: altezza proporzionale alle ore, ma mai meno della
// riga dell'etichetta (la barra resta proporzionale, è lo SPAZIO che cresce).
function colonna(nodi, scala) {
  let y = 0;
  return nodi.map((n) => {
    const h = Math.max(1.5, n.minuti * scala);
    const pos = { ...n, y, h };
    y += Math.max(RIGA, h) + SPAZIO;
    return pos;
  });
}

export default function FlussoOre({ turni, byShift, settings, titolo }) {
  const [aperto, setAperto] = useState(false);
  return (
    <>
      <button type="button" className="linklike" onClick={() => setAperto(true)}>Dove vanno le ore →</button>
      {aperto && <Finestra turni={turni} byShift={byShift} settings={settings} titolo={titolo} onChiudi={() => setAperto(false)} />}
    </>
  );
}

function Finestra({ turni, byShift, settings, titolo, onChiudi }) {
  const ref = useRef(null);
  useModalDismiss(ref, onChiudi, true);
  const f = useMemo(() => flussoOre(turni, byShift, settings), [turni, byShift, settings]);
  const [visto, setVisto] = useState(pocoMovimento());
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisto(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const disegno = useMemo(() => {
    const tot = Math.max(1, f.origini.reduce((t, o) => t + o.minuti, 0));
    const scala = ALTO / tot;
    const sx = colonna(f.origini, scala);
    const dx = colonna(f.voci, scala);
    // Ogni flusso occupa una fetta della barra da cui parte e di quella in cui
    // arriva, nell'ordine delle colonne: così i nastri non si incrociano più
    // del necessario.
    const uscita = Object.fromEntries(sx.map((n) => [n.id, n.y]));
    const entrata = Object.fromEntries(dx.map((n) => [n.id, n.y]));
    const ordineD = Object.fromEntries(dx.map((n, i) => [n.id, i]));
    const ordineS = Object.fromEntries(sx.map((n, i) => [n.id, i]));
    const nastri = [...f.flussi]
      .sort((a, b) => ordineS[a.da] - ordineS[b.da] || ordineD[a.a] - ordineD[b.a])
      .map((x) => {
        const h = Math.max(1, x.minuti * scala);
        const y0 = uscita[x.da]; uscita[x.da] += h;
        return { ...x, h, y0 };
      });
    for (const n of [...nastri].sort((a, b) => ordineD[a.a] - ordineD[b.a] || ordineS[a.da] - ordineS[b.da])) {
      n.y1 = entrata[n.a]; entrata[n.a] += n.h;
    }
    const fondo = Math.max(...[...sx, ...dx].map((n) => n.y + Math.max(RIGA, n.h)), 0);
    return { sx, dx, nastri, alto: fondo + 4 };
  }, [f]);

  const spiegazioni = [
    f.origini.some((o) => o.id === 'monte') && SPIEGA.monte,
    f.voci.some((v) => v.id === 'giaNelMonte') && SPIEGA.giaNelMonte,
  ].filter(Boolean);
  const transizione = (i) => ({
    opacity: visto ? 1 : 0,
    transition: `opacity 450ms ease ${Math.min(i, 12) * 60}ms`,
  });
  const etichetta = { fontSize: 11.5, fill: 'var(--c-text)', fontWeight: 600 };
  const sotto = { fontSize: 10.5, fill: 'var(--c-text-2)' };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label="Dove vanno le ore">
        <div className="modal-header">
          <h2 className="modal-title">Dove vanno le ore · {titolo}</h2>
        </div>
        <div className="modal-form">
          {f.origini.length === 0 ? <p className="form-hint">Nessuna ora segnata in questo mese.</p> : (
            <svg viewBox={`0 0 ${L} ${disegno.alto}`} width="100%" role="img"
              aria-label={f.voci.map((v) => `${v.nome} ${ore(v.minuti)}, ${formatCurrency(v.euro)}`).join('; ')}>
              {disegno.nastri.map((n, i) => {
                const x0 = XS + BARRA, x1 = XD, mx = (x0 + x1) / 2;
                const d = `M${x0},${n.y0} C${mx},${n.y0} ${mx},${n.y1} ${x1},${n.y1}`
                  + ` L${x1},${n.y1 + n.h} C${mx},${n.y1 + n.h} ${mx},${n.y0 + n.h} ${x0},${n.y0 + n.h} Z`;
                return <path key={`${n.da}>${n.a}`} d={d} fill={COLORE[n.da]} fillOpacity={0.3} style={transizione(i)} />;
              })}
              {disegno.sx.map((n) => (
                <g key={n.id}>
                  <rect x={XS} y={n.y} width={BARRA} height={n.h} rx={2} fill={COLORE[n.id]} />
                  <text x={XS - 6} y={n.y + 11} textAnchor="end" style={etichetta}>{n.nome}</text>
                  <text x={XS - 6} y={n.y + 24} textAnchor="end" style={sotto}>{ore(n.minuti)}</text>
                </g>
              ))}
              {disegno.dx.map((n) => {
                const vuota = n.id === 'giaNelMonte';
                return (
                  <g key={n.id}>
                    <rect x={XD} y={n.y} width={BARRA} height={n.h} rx={2}
                      fill={vuota ? 'var(--c-muted)' : 'var(--c-text)'} fillOpacity={vuota ? 0.5 : 0.85} />
                    <text x={XD + BARRA + 6} y={n.y + 11} style={etichetta}>{n.nome}</text>
                    <text x={XD + BARRA + 6} y={n.y + 24} style={sotto}>
                      {ore(n.minuti)} · {vuota ? '0 €' : formatCurrency(n.euro)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          {f.maggiorazioni.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', margin: '.4rem 0' }}>
              {f.maggiorazioni.map((m) => (
                <span key={m.id} style={{ fontSize: '.8rem', padding: '.2rem .55rem', borderRadius: 999, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                  + {m.nome}{m.minuti > 0 ? ` su ${ore(m.minuti)}` : ''} · <strong>{formatCurrency(m.euro)}</strong>
                </span>
              ))}
            </div>
          )}
          {f.voci.length > 0 && (
            <p style={{ margin: '.3rem 0', fontWeight: 700 }}>= {formatCurrency(f.totale)} lordi dai turni</p>
          )}
          {spiegazioni.map((t) => <p key={t} className="form-hint" style={{ margin: '.2rem 0' }}>{t}</p>)}
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onChiudi}>Ho capito</button>
          </div>
        </div>
      </div>
    </div>
  );
}
