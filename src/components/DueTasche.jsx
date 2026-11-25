// LE DUE TASCHE, disegnate: lo stesso aiuto sotto e sopra i 15.000. Sotto,
// detrazione + tratt. integrativo; sopra, una detrazione sola più lunga. Le
// barre sono lunghe quanto valgono, così il gradino IN SU si vede senza leggerlo:
// la detrazione di sopra è più alta, non più bassa. Un segno dice dove il datore
// ha messo questo mese e uno dove, di questo passo, finisce l'anno: quando non
// coincidono, è il «a dicembre si inverte». Le cifre: `dueTasche()`.

import { dueTasche } from '../motore/due-tasche';
import { numeroIt } from '../utils/formato';

const DETRAZIONE = 'var(--c-primary)';
const TI = 'var(--c-success)';

function Segno({ testo }) {
  return (
    <span style={{
      fontSize: '.72rem', fontWeight: 600, padding: '1px 7px', borderRadius: 999,
      background: 'var(--c-text)', color: 'var(--c-card)', whiteSpace: 'nowrap',
    }}
    >{testo}</span>
  );
}

function Riga({ titolo, pezzi, massimo, segni }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.85rem', fontWeight: 600 }}>{titolo}</span>
        {segni.map((s) => <Segno key={s} testo={s} />)}
      </div>
      <div style={{ display: 'flex', gap: 2, height: 26 }}>
        {pezzi.map((p) => (
          <div
            key={p.nome}
            title={p.nome}
            style={{
              width: `${(p.valore / massimo) * 100}%`, background: p.colore, borderRadius: 4,
              color: '#fff', fontSize: '.75rem', fontWeight: 600, display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
            }}
          >
            {p.breve} {numeroIt(Math.round(p.valore))} €
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{ redditoMese: number|null, redditoAnno: number|null, nomeMese: string, settings: object }} props
 */
export default function DueTasche({ redditoMese, redditoAnno, nomeMese, settings }) {
  const t = dueTasche(redditoMese, redditoAnno, settings);
  const massimo = Math.max(t.sotto.detrazione + t.sotto.ti, t.sopra.detrazione);
  const segni = (lato) => [
    t.mese === lato && `${nomeMese}, per il datore`,
    t.anno === lato && 'l’anno, di questo passo',
  ].filter(Boolean);
  return (
    <div style={{ margin: '0 0 6px' }}>
      <Riga
        titolo={`Sotto i ${numeroIt(t.soglia)} €`} massimo={massimo} segni={segni('sotto')}
        pezzi={[
          { nome: 'Detrazione', breve: 'Detraz.', valore: t.sotto.detrazione, colore: DETRAZIONE },
          { nome: 'Tratt. integrativo', breve: 'Tratt. int.', valore: t.sotto.ti, colore: TI },
        ]}
      />
      <Riga
        titolo={`Sopra i ${numeroIt(t.soglia)} €`} massimo={massimo} segni={segni('sopra')}
        pezzi={[{ nome: 'Detrazione', breve: 'Detrazione', valore: t.sopra.detrazione, colore: DETRAZIONE }]}
      />
    </div>
  );
}
