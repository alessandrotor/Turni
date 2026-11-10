import { useState, useEffect, useCallback } from 'react';
import useOccupato from './useOccupato';
import { DURATA_ANNULLA } from '../utils/avvisi';
import { siEscludono } from '../utils/sostituzioni';

/**
 * La finestra per tornare indietro dopo una cancellazione o una sostituzione.
 * `offri({ rimossi, aggiunti, descritti, sostituiti })`: «Annulla» toglie gli
 * id di `aggiunti` e rimette i turni di `rimossi` così com'erano. `descritti`
 * sono i turni che la striscia nomina (di solito `rimossi`).
 */
export default function useAnnulla(shifts, setShifts) {
  const [annullabile, setAnnullabile] = useState(null);

  // Il timer sta in un effetto con la sua pulizia: in StrictMode un
  // `setTimeout` sparso lascerebbe due timer.
  useEffect(() => {
    if (!annullabile) return undefined;
    const t = setTimeout(() => setAnnullabile(null), DURATA_ANNULLA);
    return () => clearTimeout(t);
  }, [annullabile]);

  // Lavoro in sospeso: la chiave è legata allo stato, quindi si spegne da sé.
  useOccupato('annulla', !!annullabile);

  // Se nel frattempo un giorno ha qualcosa che non può convivere con un turno
  // da rimettere, la striscia si ritira: rimetterlo darebbe lavoro e ferie
  // nello stesso giorno.
  useEffect(() => {
    if (!annullabile) return;
    const fuori = new Set([...annullabile.aggiunti, ...annullabile.rimossi.map(t => t.id)]);
    const conflitto = Object.values(shifts).some(s => !fuori.has(s.id)
      && annullabile.rimossi.some(r => r.date === s.date && siEscludono(r, s)));
    if (conflitto) setAnnullabile(null);
  }, [shifts, annullabile]);

  const annulla = useCallback(() => {
    if (annullabile) {
      setShifts(prev => {
        const next = { ...prev };
        for (const id of annullabile.aggiunti) delete next[id];
        for (const t of annullabile.rimossi) next[t.id] = t;
        return next;
      });
    }
    setAnnullabile(null);
  }, [annullabile, setShifts]);

  const offri = useCallback(({ rimossi, aggiunti = [], descritti = rimossi, sostituiti = false }) => {
    if (rimossi.length) setAnnullabile({ rimossi, aggiunti, descritti, sostituiti });
  }, []);

  return { annullabile, offri, annulla, chiudi: useCallback(() => setAnnullabile(null), []) };
}
