// LE ORE DI OGNI SETTIMANA, in una riga sottile sotto la settimana del
// calendario: «settimana 39h +15 oltre il contratto» (novembre 2026, «vorrei
// vedere la somma delle ore della settimana»). Il supplementare si conta
// proprio a settimana, quindi il «+15» dice perché quella settimana ha pagato
// di più. Le cifre sono di `settimaneDelMese()`; qui si disegna e basta.
//
// Prima era una colonna a destra della griglia: sul telefono stringeva tutti i
// giorni, «troppo compatto». Ora ogni riga ha la sua fila della griglia (le
// file pari dopo l'intestazione, `gridRow` esplicito): la griglia piazza prima
// queste e poi fa scorrere i giorni nelle file rimaste, quindi i giorni non
// vanno toccati. Una settimana senza turni ha una fila vuota, alta zero.

import { useMemo } from 'react';
import { settimaneDelMese } from '../motore/settimane';

const ore = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
const giorno = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/**
 * @param {{ anno: number, mese: number, turni: Array<any>, mappa: Record<string, any>|null }} props
 */
export default function SettimaneOre({ anno, mese, turni, mappa }) {
  const settimane = useMemo(() => settimaneDelMese(anno, mese, turni, mappa), [anno, mese, turni, mappa]);
  // Ogni settimana occupa la sua fila anche vuota: senza, la griglia ci farebbe
  // scivolare dentro i giorni della settimana dopo, e le righe finivano tutte
  // sotto la settimana sbagliata.
  return settimane.map((s, r) => (s.minuti === 0
    ? <div key={s.dal} aria-hidden="true" style={{ gridColumn: '1 / -1', gridRow: 3 + r * 2 }} />
    : <div
      key={s.dal}
      className="cal-settimana"
      style={{ gridColumn: '1 / -1', gridRow: 3 + r * 2 }}
      title={`Settimana ${giorno(s.dal)}–${giorno(s.al)}`}
    >
      <span>settimana</span>
      <b>{ore(s.minuti)}</b>
      {s.oltreMinuti > 0 && <span className="cal-settimana-oltre">+{ore(s.oltreMinuti).replace(/h$/, '')} oltre il contratto</span>}
    </div>
  ));
}
