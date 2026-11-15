import { useRef, useState } from 'react';
import useOccupato from './useOccupato';

// Più giorni, un orario (novembre 2026): una pressione lunga su un giorno vuoto
// accende la scelta, i tocchi successivi aggiungono o tolgono giorni, la barra
// in basso (BarraSelezione.jsx) li riempie tutti con un orario. Si scelgono solo
// giorni vuoti: su un giorno con un turno il secondo si segna dal modulo, come
// sempre. Le proprietà si spargono sulla cella del calendario; il clic si ferma
// in fase di cattura, così il modulo del turno non si apre sotto.

const LUNGA_MS = 450;
const TOLLERANZA_PX = 10; // oltre, è uno scorrimento e non una pressione

export default function useSelezioneGiorni() {
  const [scelti, setScelti] = useState(/** @type {Set<string>|null} */ (null));
  const timer = useRef(/** @type {any} */ (null));
  const lunga = useRef(false);
  const da = useRef({ x: 0, y: 0 });
  useOccupato('selezioneGiorni', !!scelti);

  const tocca = (data) => setScelti((prima) => {
    const n = new Set(prima || []);
    if (n.has(data)) n.delete(data); else n.add(data);
    return n.size ? n : null;
  });
  const ferma = () => clearTimeout(timer.current);

  /** @param {string} data @param {boolean} libera giorno senza turni */
  const props = (data, libera) => ({
    onPointerDown: (e) => {
      if (!libera) return;
      lunga.current = false;
      da.current = { x: e.clientX, y: e.clientY };
      ferma();
      timer.current = setTimeout(() => {
        lunga.current = true;
        navigator.vibrate?.(15);
        setScelti((prima) => new Set([...(prima || []), data]));
      }, LUNGA_MS);
    },
    onPointerMove: (e) => {
      if (Math.abs(e.clientX - da.current.x) + Math.abs(e.clientY - da.current.y) > TOLLERANZA_PX) ferma();
    },
    onPointerUp: ferma,
    onPointerCancel: ferma,
    onPointerLeave: ferma,
    onContextMenu: (e) => { if (libera) e.preventDefault(); },
    onClickCapture: (e) => {
      if (lunga.current) { lunga.current = false; e.stopPropagation(); e.preventDefault(); return; }
      if (!scelti) return;
      e.stopPropagation(); e.preventDefault();
      if (libera) tocca(data);
    },
    style: scelti?.has(data) ? { outline: '2px solid #2563eb', outlineOffset: -2, background: '#dbeafe' } : undefined,
  });

  return { scelti, props, chiudi: () => setScelti(null) };
}
