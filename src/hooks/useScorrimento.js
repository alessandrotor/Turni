import { useEffect, useState } from 'react';

// Vero quando la pagina è scorsa oltre `entra` pixel, e resta vero finché non si
// torna sotto `esce`. Serve alla fascia del totale del mese: in cima è grande
// come un titolo, scorrendo si riduce a una riga e resta agganciata in alto.
// Le due soglie sono il punto: ridursi accorcia la pagina di ~100 px, e con una
// soglia sola lo scorrimento la riattraversava subito — la fascia sfarfallava
// (novembre 2026). Il divario deve restare più largo di quanto la fascia cala.
export default function useScorrimento(entra = 160, esce = 40) {
  const [oltre, setOltre] = useState(false);
  useEffect(() => {
    let atteso = false;
    const guarda = () => {
      if (atteso) return;
      atteso = true;
      requestAnimationFrame(() => {
        atteso = false;
        const y = window.scrollY;
        setOltre((prima) => (prima ? y > esce : y > entra));
      });
    };
    window.addEventListener('scroll', guarda, { passive: true });
    guarda();
    return () => window.removeEventListener('scroll', guarda);
  }, [entra, esce]);
  return oltre;
}
