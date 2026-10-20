import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../motore/pay';

// La cifra del mese, e di quanto è appena cambiata. Chi segna un turno deve
// VEDERE i soldi muoversi: un totale che cambia di 55 € in silenzio sembra
// fermo, e uno fermo sembra un guasto.
//
// Due movimenti, sobri: la cifra scorre dal valore di prima a quello nuovo in
// poco più di mezzo secondo, rallentando alla fine; accanto la differenza
// compare sfumando, resta qualche secondo e se ne va sfumando. Cambiare mese
// non è un cambiamento: la cifra si sostituisce e basta. Chi ha chiesto al
// sistema meno animazioni vede solo il risultato.
//
// `segnale` cambia quando cambiano i turni del mese (le ore segnate): un turno
// che non sposta il lordo — il mese ha già il suo monte ore — mostra lo
// stesso la sua differenza, «+0,00 €» in grigio. Ogni gesto sui turni ha il
// suo riscontro: niente vuol dire «l'app non ha sentito».

const DURATA = 650;      // lo scorrimento della cifra
const VISIBILE = 2800;   // quanto resta la differenza
const SFUMA = 400;       // entrata e uscita della differenza

const pocoMovimento = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export default function CifraCheCambia({ valore, chiave, segnale, className, title }) {
  const [mostrato, setMostrato] = useState(valore);
  const [delta, setDelta] = useState(null);
  const ora = useRef(valore);       // la cifra a schermo in questo istante
  const prima = useRef({ chiave, valore, segnale });

  useEffect(() => {
    const p = prima.current;
    prima.current = { chiave, valore, segnale };
    if (p.chiave !== chiave || pocoMovimento()) {
      ora.current = valore; setMostrato(valore);
      if (p.chiave !== chiave) { setDelta(null); return undefined; }
    }
    if (Math.abs(valore - p.valore) < 0.005) {
      if (p.segnale !== segnale) setDelta({ v: 0, n: Date.now(), visibile: false });
      return undefined;
    }
    setDelta({ v: valore - p.valore, n: Date.now(), visibile: false });
    if (pocoMovimento()) return undefined;

    const da = ora.current, t0 = performance.now();
    let rif;
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / DURATA);
      const v = da + (valore - da) * (1 - (1 - k) ** 3);   // rallenta alla fine
      ora.current = v; setMostrato(v);
      if (k < 1) rif = requestAnimationFrame(passo);
    };
    rif = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(rif);
  }, [valore, chiave, segnale]);

  // La differenza: entra al fotogramma dopo (così la transizione parte), resta, sfuma via.
  useEffect(() => {
    if (!delta) return undefined;
    if (!delta.visibile && !delta.uscita) {
      const r = requestAnimationFrame(() => setDelta((d) => d && d.n === delta.n ? { ...d, visibile: true } : d));
      return () => cancelAnimationFrame(r);
    }
    if (delta.visibile) {
      const t = setTimeout(() => setDelta((d) => d && d.n === delta.n ? { ...d, visibile: false, uscita: true } : d), VISIBILE);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDelta((d) => (d && d.n === delta.n ? null : d)), SFUMA);
    return () => clearTimeout(t);
  }, [delta]);

  return (
    <span className={className} title={title} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatCurrency(mostrato)}
      {delta && (
        <span role="status"
          style={{ marginLeft: '.45rem', fontSize: '.55em', fontWeight: 700, verticalAlign: 'middle', display: 'inline-block',
            color: delta.v > 0 ? 'var(--c-success, #059669)' : delta.v < 0 ? 'var(--c-danger, #dc2626)' : 'var(--c-text-2, #64748b)',
            opacity: delta.visibile ? 1 : 0,
            transform: `translateY(${delta.visibile ? 0 : delta.uscita ? -4 : 4}px)`,
            transition: `opacity ${SFUMA}ms ease, transform ${SFUMA}ms ease` }}>
          {delta.v < 0 ? '−' : '+'}{formatCurrency(Math.abs(delta.v))}
        </span>
      )}
    </span>
  );
}
