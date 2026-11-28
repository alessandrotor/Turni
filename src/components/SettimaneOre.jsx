// LA COLONNA «ORE» del calendario: il totale di ogni settimana e, sotto in
// arancio, le ore oltre il contratto (novembre 2026, «vorrei vedere la somma
// delle ore della settimana»). Il supplementare si conta proprio a settimana,
// quindi il «+15» dice perché quella settimana ha pagato di più. Le cifre sono
// di `settimaneDelMese()`; qui si disegna e basta.
//
// Le celle sono messe alla colonna 8 con la riga esplicita: la griglia piazza
// prima loro e poi fa scorrere i giorni nelle colonne 1–7, quindi il resto del
// calendario non va toccato.

import { useMemo } from 'react';
import { settimaneDelMese } from '../motore/settimane';

const ore = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
const giorno = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/**
 * @param {{ anno: number, mese: number, turni: Array<any>, mappa: Record<string, any>|null }} props
 */
export default function SettimaneOre({ anno, mese, turni, mappa }) {
  const settimane = useMemo(() => settimaneDelMese(anno, mese, turni, mappa), [anno, mese, turni, mappa]);
  return (
    <>
      <div className="cal-day-header cal-settimana-testa" style={{ gridColumn: 8, gridRow: 1 }}>ore</div>
      {settimane.map((s, r) => (
        <div
          key={s.dal}
          className="cal-settimana"
          style={{ gridColumn: 8, gridRow: r + 2 }}
          title={s.minuti
            ? `Settimana ${giorno(s.dal)}–${giorno(s.al)}: ${ore(s.minuti)}${s.oltreMinuti ? `, di cui ${ore(s.oltreMinuti)} oltre le ore del contratto` : ''}`
            : undefined}
        >
          {s.minuti > 0 && <b>{ore(s.minuti)}</b>}
          {s.oltreMinuti > 0 && <span className="cal-settimana-oltre">+{ore(s.oltreMinuti).replace(/h$/, '')}</span>}
        </div>
      ))}
    </>
  );
}
