import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../motore/pay';

// La cifra del mese, e di quanto è appena cambiata. Chi segna un turno deve
// VEDERE i soldi muoversi: un totale che cambia di 55 € in silenzio sembra
// fermo, e uno fermo sembra un guasto. Per qualche secondo accanto compare la
// differenza, verde o rossa; cambiare mese non conta come cambiamento.
export default function CifraCheCambia({ valore, chiave, className, title }) {
  const prima = useRef({ chiave, valore });
  const [delta, setDelta] = useState(null);

  useEffect(() => {
    const p = prima.current;
    if (p.chiave === chiave && Math.abs(valore - p.valore) >= 0.005) setDelta({ v: valore - p.valore, n: Date.now() });
    else if (p.chiave !== chiave) setDelta(null);
    prima.current = { chiave, valore };
  }, [valore, chiave]);

  useEffect(() => {
    if (!delta) return undefined;
    const t = setTimeout(() => setDelta(null), 3500);
    return () => clearTimeout(t);
  }, [delta]);

  return (
    <span className={className} title={title}>
      {formatCurrency(valore)}
      {delta && (
        <span key={delta.n} role="status"
          style={{ marginLeft: '.45rem', fontSize: '.55em', fontWeight: 700, verticalAlign: 'middle',
            color: delta.v > 0 ? 'var(--c-success, #059669)' : 'var(--c-danger, #dc2626)' }}>
          {delta.v > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta.v))}
        </span>
      )}
    </span>
  );
}
