import { useEffect, useState } from 'react';

// Vero quando la pagina è scorsa oltre `soglia` pixel. Serve alla fascia del
// totale del mese: in cima è grande come un titolo, scorrendo si riduce a una
// riga ma resta agganciata in alto (novembre 2026, stile della vetrina).
export default function useScorrimento(soglia = 140) {
  const [oltre, setOltre] = useState(() => typeof window !== 'undefined' && window.scrollY > soglia);
  useEffect(() => {
    let atteso = false;
    const guarda = () => {
      if (atteso) return;
      atteso = true;
      requestAnimationFrame(() => { atteso = false; setOltre(window.scrollY > soglia); });
    };
    window.addEventListener('scroll', guarda, { passive: true });
    guarda();
    return () => window.removeEventListener('scroll', guarda);
  }, [soglia]);
  return oltre;
}
