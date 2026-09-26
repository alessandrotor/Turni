import { useEffect, useRef } from 'react';

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
  // `onClose` arriva quasi sempre scritto al volo (`() => setModal(null)`),
  // quindi è una funzione nuova a ogni render del genitore. Tenerlo fra le
  // dipendenze rifaceva l'effetto a ogni render: la pulizia rimetteva il fuoco
  // sulla cella del calendario dietro il modale, e sul telefono la tastiera si
  // chiudeva a metà nota — bastava lo scadere degli 8 secondi dell'annulla.
  // Si legge l'ultimo `onClose` da una ref, e l'effetto vive quanto il modale.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    const previouslyFocused = document.activeElement;

    // Il fuoco ENTRA nel dialogo, altrimenti il blocco del Tab qui sotto non
    // scatta mai: restava sulla cella che l'aveva aperto, e il Tab successivo
    // andava alla cella accanto, dietro il velo. Sul contenitore e non sul
    // primo campo: un campo a fuoco sul telefono apre la tastiera, e chi apre
    // il modulo per toccare una sagoma non l'ha chiesta.
    if (node && !node.contains(document.activeElement)) {
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
      node.focus({ preventScroll: true });
    }

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;

      const items = [...node.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
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
      // Riporta il focus dov'era prima dell'apertura, se esiste ancora.
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [ref, active]);
}
