import { useRef, useState } from 'react';

// Il righello: quando in una FOTO la griglia non si trova (lo schermo di un
// gestionale, un foglio storto), la riga la indica chi la guarda. Una fascia
// sopra l'immagine: si trascina sulla propria riga, i bordi la allargano, la
// rotella la inclina. Le colonne le trova il lettore (utils/tabellone.js); il
// giorno della prima colonna no, perché in una foto le date spesso non ci
// sono: lo dice un tocco, ed è già sul lunedì.
//
// Niente testo da leggere oltre a una riga: la fascia si vede, e si capisce
// toccandola.

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const NOMI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export default function Righello({ src, larghezza, altezza, iniziale, onLeggi }) {
  const [rotta, setRotta] = useState(false);
  const [fascia, setFascia] = useState(iniziale || { centro: 0.5, alta: 0.09, gradi: 0, primo: 0 });
  const quadro = useRef(null);
  const presa = useRef(null);

  // Trascinare: la fascia intera (si sposta) o un bordo (si allarga).
  const inizia = (modo) => (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    presa.current = { modo, y: e.clientY, da: fascia };
  };
  const muovi = (e) => {
    const p = presa.current;
    if (!p || !quadro.current) return;
    const d = (e.clientY - p.y) / quadro.current.getBoundingClientRect().height;
    const lim = (v, a, b) => Math.min(b, Math.max(a, v));
    if (p.modo === 'sposta') setFascia({ ...p.da, centro: lim(p.da.centro + d, 0, 1) });
    else {
      const segno = p.modo === 'basso' ? 1 : -1;
      const alta = lim(p.da.alta + segno * d, 0.02, 0.5);
      setFascia({ ...p.da, alta, centro: lim(p.da.centro + segno * (alta - p.da.alta) / 2, 0, 1) });
    }
  };
  const lascia = () => { presa.current = null; };

  const leggi = () => onLeggi(fascia, {
    y0: (fascia.centro - fascia.alta / 2) * altezza,
    y1: (fascia.centro + fascia.alta / 2) * altezza,
    gradi: fascia.gradi,
  });

  const bordo = (modo) => (
    <div onPointerDown={inizia(modo)} aria-hidden="true"
      style={{ position: 'absolute', left: '40%', right: '40%', height: 14, [modo === 'alto' ? 'top' : 'bottom']: -8,
        background: 'var(--c-primary, #2563eb)', borderRadius: 7, cursor: 'ns-resize', touchAction: 'none' }} />
  );

  return (
    <div>
      <p className="import-match" style={{ marginBottom: '.4rem' }}>Trascina la fascia sulla tua riga.</p>
      <div ref={quadro} onPointerMove={muovi} onPointerUp={lascia} onPointerCancel={lascia}
        style={{ position: 'relative', width: '100%', maxWidth: `calc(40vh * ${larghezza / altezza})`, margin: '0 auto', touchAction: 'none', userSelect: 'none', overflow: 'hidden', borderRadius: 6 }}>
        {/* Senza immagine la fascia si posa lo stesso: lo spazio resta nelle proporzioni della foto. */}
        {rotta ? <div style={{ aspectRatio: `${larghezza} / ${altezza}`, background: 'var(--c-bg)' }} />
          : <img src={src} alt="" draggable={false} onError={() => setRotta(true)} style={{ display: 'block', width: '100%' }} />}
        <div onPointerDown={inizia('sposta')} role="slider" aria-label="La tua riga" tabIndex={0}
          aria-valuenow={Math.round(fascia.centro * 100)} aria-valuemin={0} aria-valuemax={100}
          onKeyDown={(e) => {
            const passo = e.key === 'ArrowDown' ? 0.01 : e.key === 'ArrowUp' ? -0.01 : 0;
            if (passo) { e.preventDefault(); setFascia((f) => ({ ...f, centro: Math.min(1, Math.max(0, f.centro + passo)) })); }
          }}
          style={{ position: 'absolute', left: '-2%', right: '-2%', top: `${(fascia.centro - fascia.alta / 2) * 100}%`, height: `${fascia.alta * 100}%`,
            transform: `rotate(${fascia.gradi}deg)`, background: 'rgba(37, 99, 235, .16)', border: '2px solid var(--c-primary, #2563eb)',
            borderRadius: 4, cursor: 'grab', touchAction: 'none', boxShadow: '0 0 0 9999px rgba(15, 23, 42, .35)' }}>
          {bordo('alto')}
          {bordo('basso')}
        </div>
      </div>
      <div role="group" aria-label="Il giorno della prima colonna" style={{ display: 'flex', gap: '.25rem', alignItems: 'center', margin: '.5rem 0' }}>
        <span className="import-match" style={{ margin: 0, whiteSpace: 'nowrap' }}>1ª col.</span>
        {GIORNI.map((g, i) => (
          <button key={NOMI[i]} type="button" className="btn-import" aria-pressed={fascia.primo === i} aria-label={NOMI[i]}
            onClick={() => setFascia({ ...fascia, primo: i })}
            style={{ padding: '.25rem .5rem', ...(fascia.primo === i ? { background: 'var(--c-primary, #2563eb)', color: '#fff' } : {}) }}>
            {g}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <span aria-hidden="true" title="Inclina">↻</span>
        <input type="range" min={-10} max={10} step={0.5} value={fascia.gradi} aria-label="Inclinazione della fascia"
          onChange={(e) => setFascia({ ...fascia, gradi: Number(e.target.value) })} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="btn btn-primary" onClick={leggi} style={{ whiteSpace: 'nowrap' }}>✓ Leggi la riga</button>
      </div>
    </div>
  );
}
