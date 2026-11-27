import { useEffect, useRef, useState } from 'react';
import useOccupato from './useOccupato';

// Due gesti con la pressione lunga sulle celle del calendario (novembre 2026).
//
// 1. Più giorni, un orario: la pressione lunga su un giorno VUOTO accende la
//    scelta, i tocchi successivi aggiungono o tolgono giorni, la barra in basso
//    (BarraSelezione.jsx) li riempie tutti con un orario.
// 2. Trascina per copiare: la pressione lunga su un TURNO (la sua pillola) lo
//    prende in mano; trascinando il dito sulle celle si scelgono i giorni, e al
//    rilascio il turno è copiato su quelli vuoti, con «Annulla». Caso tipico:
//    un giorno di ferie da stendere sul resto della settimana.
//
// Le proprietà si spargono sulla cella; il clic si ferma in fase di cattura,
// così il modulo del turno non si apre sotto. Durante il trascinamento la pagina
// non scorre (touchmove fermato), altrimenti il dito sposterebbe il calendario.

const LUNGA_MS = 450;
const TOLLERANZA_PX = 10; // oltre, è uno scorrimento e non una pressione

// Cosa del turno si copia: tutto tranne ciò che è di quel giorno solo.
const copiaDi = (turno, date) => {
  const { id, date: _d, note, ...resto } = turno;
  return { ...resto, date };
};

/** @param {(lista: Array<any>, testo: string) => void} [onCopia] */
export default function useSelezioneGiorni(onCopia) {
  const [scelti, setScelti] = useState(/** @type {Set<string>|null} */ (null));
  const [presa, setPresa] = useState(/** @type {{ turno: any, da: string, giorni: Set<string> }|null} */ (null));
  const timer = useRef(/** @type {any} */ (null));
  const lunga = useRef(false);
  const da = useRef({ x: 0, y: 0 });
  const liberi = useRef(/** @type {Record<string, boolean>} */ ({}));
  const onCopiaRef = useRef(onCopia); onCopiaRef.current = onCopia;
  useOccupato('selezioneGiorni', !!scelti || !!presa);

  const tocca = (data) => setScelti((prima) => {
    const n = new Set(prima || []);
    if (n.has(data)) n.delete(data); else n.add(data);
    return n.size ? n : null;
  });
  const ferma = () => clearTimeout(timer.current);

  // Il trascinamento vive sul documento: col dito il puntatore resta legato alla
  // pillola da cui è partito, la cella sotto il dito la dice elementFromPoint.
  const attiva = !!presa;
  useEffect(() => {
    if (!attiva) return undefined;
    const sotto = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-giorno]')?.getAttribute('data-giorno');
    const muovi = (e) => {
      const g = sotto(e);
      if (g) setPresa((p) => (p && !p.giorni.has(g) ? { ...p, giorni: new Set([...p.giorni, g]) } : p));
    };
    const fermaScorrimento = (e) => e.preventDefault();
    const lascia = () => {
      setPresa((p) => {
        if (p) {
          const date = [...p.giorni].filter((g) => g !== p.da && liberi.current[g]).sort();
          const saltati = [...p.giorni].filter((g) => g !== p.da && !liberi.current[g]).length;
          if (date.length) {
            onCopiaRef.current?.(date.map((g) => copiaDi(p.turno, g)),
              `Copiato su ${date.length} ${date.length === 1 ? 'giorno' : 'giorni'}${saltati ? ` (${saltati} già occupat${saltati === 1 ? 'o' : 'i'}, saltat${saltati === 1 ? 'o' : 'i'})` : ''}.`);
          }
        }
        return null;
      });
    };
    document.addEventListener('pointermove', muovi);
    document.addEventListener('pointerup', lascia);
    document.addEventListener('pointercancel', lascia);
    document.addEventListener('touchmove', fermaScorrimento, { passive: false });
    return () => {
      document.removeEventListener('pointermove', muovi);
      document.removeEventListener('pointerup', lascia);
      document.removeEventListener('pointercancel', lascia);
      document.removeEventListener('touchmove', fermaScorrimento);
    };
  }, [attiva]);

  /**
   * @param {string} data
   * @param {boolean} libera giorno senza turni
   * @param {Array<any>} [turni] i turni del giorno, per prenderne uno in mano
   */
  const props = (data, libera, turni = []) => {
    liberi.current[data] = libera;
    return {
      'data-giorno': data,
      onPointerDown: (e) => {
        lunga.current = false;
        da.current = { x: e.clientX, y: e.clientY };
        ferma();
        const idTurno = e.target?.closest?.('[data-turno]')?.getAttribute('data-turno');
        const turno = idTurno && turni.find((t) => String(t.id) === idTurno);
        if (!libera && !(turno && onCopiaRef.current && !scelti)) return;
        timer.current = setTimeout(() => {
          lunga.current = true;
          navigator.vibrate?.(15);
          if (libera) setScelti((prima) => new Set([...(prima || []), data]));
          else setPresa({ turno, da: data, giorni: new Set([data]) });
        }, LUNGA_MS);
      },
      onPointerMove: (e) => {
        if (Math.abs(e.clientX - da.current.x) + Math.abs(e.clientY - da.current.y) > TOLLERANZA_PX) ferma();
      },
      onPointerUp: ferma,
      onPointerCancel: ferma,
      onContextMenu: (e) => e.preventDefault(),
      onClickCapture: (e) => {
        if (lunga.current) { lunga.current = false; e.stopPropagation(); e.preventDefault(); return; }
        if (!scelti) return;
        e.stopPropagation(); e.preventDefault();
        if (libera) tocca(data);
      },
      style: presa?.giorni.has(data)
        ? (data === presa.da || liberi.current[data]
          ? { outline: '2px solid #059669', outlineOffset: -2, background: '#d1fae5' }
          : { outline: '2px dashed #94a3b8', outlineOffset: -2 })
        : scelti?.has(data) ? { outline: '2px solid #2563eb', outlineOffset: -2, background: '#dbeafe' } : undefined,
    };
  };

  return { scelti, props, chiudi: () => setScelti(null), trascinando: !!presa };
}
