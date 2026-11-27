// La bilancia del tratt. integrativo (mockup A, novembre 2026): quello che si
// perde contro quello che torna, due barre sulla stessa scala. Il pezzo a righe
// è ciò che resta scoperto. Accanto a «ti ridanno 90 €», «700 € da restituire»
// sembrava una perdita; quasi sempre non lo è, perché superata la soglia la
// detrazione sale e le tasse calano quasi altrettanto.
//
// La usano il riquadro (`RiquadroTI.jsx`, il caso peggiore della fascia) e la
// finestra «Ci perdo?» (`CiPerdo.jsx`, un lordo qualunque). Le cifre arrivano
// dal motore, qui si disegnano soltanto.

import { euroCella } from '../utils/formato';

const VERDE = '#059669', ROSSO = '#dc2626', GRIGIO = '#64748b';

/**
 * @param {{ titolo: string, perso: number, compensa: number, etichettaCompensa?: string,
 *   conclusione: string, colore: string, sotto?: string|null }} p
 */
export default function Bilancia({ titolo, perso, compensa, etichettaCompensa = 'Ma paghi meno tasse', conclusione, colore, sotto = null }) {
  const scala = Math.max(perso, compensa, 1);
  const pct = (v) => `${Math.max(0, Math.min(100, (v / scala) * 100))}%`;
  const barra = { height: '.8rem', borderRadius: 4, margin: '.15rem 0 .45rem' };
  const riga = { display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.85rem' };
  const righe = `repeating-linear-gradient(45deg, #fee2e2 0 4px, #fca5a5 4px 7px)`;
  const scoperto = Math.max(0, perso - compensa);
  return (
    <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '.55rem', marginTop: '.2rem' }}>
      <div style={{ fontSize: '.75rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: GRIGIO, marginBottom: '.3rem' }}>{titolo}</div>
      <div style={riga}><span>Trattenuta del tratt. integrativo</span><strong style={{ color: ROSSO }}>−{euroCella(perso)}</strong></div>
      <div style={{ ...barra, width: pct(perso), background: ROSSO }} />
      <div style={riga}><span>{etichettaCompensa}</span><strong style={{ color: VERDE }}>+{euroCella(compensa)}</strong></div>
      <div style={{ ...barra, display: 'flex', overflow: 'hidden', width: pct(Math.max(perso, compensa)) }}>
        <span style={{ flex: compensa, background: VERDE }} />
        {scoperto > 0 && <span style={{ flex: scoperto, background: righe, boxShadow: `inset 0 0 0 1.5px ${ROSSO}` }} />}
      </div>
      <div style={{ textAlign: 'right' }}>
        <strong style={{ color: colore, fontSize: '1.05rem' }}>{conclusione}</strong>
        {sotto && <small style={{ display: 'block', color: 'var(--c-text-2)', fontSize: '.78rem' }}>{sotto}</small>}
      </div>
    </div>
  );
}
