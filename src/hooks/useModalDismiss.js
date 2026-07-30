import { useEffect } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento condiviso dei modali: chiusura con Escape e focus trappolato
 * dentro al dialogo (Tab non deve portare sui controlli della pagina sotto,
 * che per l'utente non sono nemmeno raggiungibili col dito).
 *
 * @param {React.RefObject<HTMLElement>} ref contenitore del modale
 * @param {() => void} onClose
 * @param {boolean} active false quando il modale non è montato
 */
export default function useModalDismiss(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    const previouslyFocused = document.activeElement;

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;

      const items = [...node.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      // Riporta il focus dov'era prima dell'apertura.
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [ref, onClose, active]);
}
