// La riga «Copia la settimana scorsa», sopra il calendario: compare solo quando
// c'è una settimana da oggi in avanti vuota e la precedente ha lavoro
// (utils/copia-settimana.js). Un tocco copia; si torna indietro con «Annulla».

import { useMemo } from 'react';
import { settimanaDaCopiare } from '../utils/copia-settimana';
import { isHoliday } from '../motore/holidays';
import useOggi from '../hooks/useOggi';
import Icona from './Icona';

const giorno = (iso) => Number(iso.slice(8, 10));

export default function CopiaSettimana({ turni, mese, settings, onCopia }) {
  const oggi = useOggi();
  const da = useMemo(() => settimanaDaCopiare(turni, mese, oggi, (iso) => isHoliday(iso, settings)),
    [turni, mese, oggi, settings]);
  if (!da || !onCopia) return null;
  return (
    <p className="cal-vuoto" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      <span>Settimana {giorno(da.lunedi)}–{giorno(da.fine)} vuota.</span>
      <button type="button" className="linklike" onClick={() => onCopia(da.turni)}>
        <Icona nome="calendario" /> Copia la settimana scorsa ({da.turni.length} {da.turni.length === 1 ? 'turno' : 'turni'})
      </button>
    </p>
  );
}
