import { useRef } from 'react';
import { direzioneSwipe } from '../utils/swipe';

// Lo sfoglio dei mesi col pollice, e l'animazione che lo accompagna.
//
// Prima il mese cambiava solo al rilascio: il dito scorreva su una griglia
// ferma e poi, di colpo, entrava il mese nuovo. Ora la griglia segue il dito
// (frenata, a metà della corsa) e, se il gesto non vale come sfoglio, torna al
// suo posto con una molla. Se vale, il mese nuovo entra dal lato verso cui si
// va. Se cambiare mese o no lo decide sempre e solo `direzioneSwipe`: qui c'è
// soltanto quello che si vede.
//
// Lo spostamento si scrive direttamente sullo stile, senza passare da React:
// un render per ogni movimento del dito è proprio lo scatto da evitare.

const SOGLIA_ASSE = 8;      // px prima di decidere se il gesto è orizzontale
const FRENO = 0.45;         // la griglia fa meno strada del dito
const RITORNO = 'transform .22s cubic-bezier(.2, .7, .3, 1), opacity .22s ease-out';

export default function useSfoglio(meseChiave, onSfoglia) {
  // Da che parte è arrivato il mese che si sta guardando. Aggiornato solo
  // quando il mese cambia: un render qualsiasi a metà animazione non deve
  // interromperla. Vale anche per le frecce e «Oggi».
  const mesePrecedente = useRef(meseChiave);
  const versoMese = useRef(0);
  if (mesePrecedente.current !== meseChiave) {
    versoMese.current = meseChiave > mesePrecedente.current ? 1 : -1;
    mesePrecedente.current = meseChiave;
  }
  const classeEntrata = versoMese.current === 0 ? ''
    : versoMese.current > 0 ? 'cal-mese--avanti' : 'cal-mese--indietro';

  const contenuto = useRef(null);
  const gesto = useRef(null);
  const frame = useRef(0);

  const sposta = (dx) => {
    const el = contenuto.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = dx ? `translateX(${dx * FRENO}px)` : '';
      el.style.opacity = dx ? String(1 - Math.min(Math.abs(dx) / 900, 0.25)) : '';
    });
  };
  const torna = () => {
    const el = contenuto.current;
    cancelAnimationFrame(frame.current);
    if (!el || !el.style.transform) return;
    el.style.transition = RITORNO;
    el.style.transform = '';
    el.style.opacity = '';
  };

  // Un dito solo: con due si sta zoomando.
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) { gesto.current = null; torna(); return; }
    const t = e.touches[0];
    gesto.current = { x: t.clientX, y: t.clientY, ms: Date.now(), asse: null };
    if (contenuto.current) contenuto.current.style.transition = '';
  };
  const onTouchMove = (e) => {
    const g = gesto.current;
    const t = e.touches[0];
    if (!g || !t || e.touches.length !== 1) return;
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    // L'asse si decide una volta: chi sta scorrendo la pagina in verticale
    // non deve vedere la griglia ballare di lato.
    if (!g.asse) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SOGLIA_ASSE) return;
      g.asse = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.asse === 'x') sposta(dx);
  };
  const onTouchEnd = (e) => {
    const g = gesto.current;
    gesto.current = null;
    const t = e.changedTouches?.[0];
    if (!g || !t) { torna(); return; }
    const verso = direzioneSwipe({ dx: t.clientX - g.x, dy: t.clientY - g.y, ms: Date.now() - g.ms });
    if (verso !== 0) { cancelAnimationFrame(frame.current); onSfoglia(verso); } else torna();
  };
  const onTouchCancel = () => { gesto.current = null; torna(); };

  return { classeEntrata, contenuto, gestori: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } };
}
