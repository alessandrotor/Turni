import { useState, useEffect } from 'react';

// «Oggi» per i conti memorizzati. Un `new Date()` scritto dentro un `useMemo` e
// lasciato fuori dalle dipendenze si congela al primo render: chi lascia l'app
// aperta oltre la mezzanotte, o a cavallo di fine mese, continua a vedere i
// numeri di ieri finché non tocca un turno. Qui la data cambia solo quando
// cambia il giorno, quindi i memo che la dichiarano non si rifanno a ogni render.
export default function useOggi() {
  const [oggi, setOggi] = useState(() => new Date());
  useEffect(() => {
    const aggiorna = () => setOggi((prev) => {
      const ora = new Date();
      return prev.toDateString() === ora.toDateString() ? prev : ora;
    });
    const timer = setInterval(aggiorna, 60000);
    document.addEventListener('visibilitychange', aggiorna);
    window.addEventListener('focus', aggiorna);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aggiorna);
      window.removeEventListener('focus', aggiorna);
    };
  }, []);
  return oggi;
}
