import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { CCNL_LIST, getContratto } from '../utils/ccnl-elenco';

// Scelta del contratto, con la tendina di ricerca. È un componente perché serve in due posti
// (Impostazioni e l'avviso sotto il primo totale in euro). La tendina è opaca di proposito: la
// `<datalist>` nativa è illeggibile nella WebView di Android.
//
// Due difetti corretti nell'estrarla (COSE-NUOVE.md §D6 e §D7):
// 1. un contratto scritto ma non scelto restava `''` nel dato, e l'app usava regole generiche
//    (+45 € al mese): uscendo dal campo il testo torna a dire la verità;
// 2. da tastiera Invio inviava l'intero modulo: ora ↓ ↑ Invio scelgono la voce.

const MAX_VOCI = 50; // l'elenco CNEL ne ha oltre mille

export default function CcnlPicker({ value, onChange, id, autoFocus = false }) {
  const generato = useId();
  const idCampo = id || generato;
  const idLista = `${idCampo}-lista`;

  const [testo, setTesto] = useState(() => getContratto(value || '').label);
  const [aperta, setAperta] = useState(false);
  const [evidenziata, setEvidenziata] = useState(-1);
  const timerBlur = useRef(null);

  useEffect(() => () => clearTimeout(timerBlur.current), []);

  // Se il contratto cambia da fuori (ripristino, reset) il testo deve seguirlo.
  useEffect(() => {
    setTesto(getContratto(value || '').label);
  }, [value]);

  const voci = useMemo(() => {
    const q = testo.trim().toLowerCase();
    const scelto = getContratto(value).label.toLowerCase();
    // Testo uguale al contratto già scelto = l'utente sta riaprendo per
    // cambiarlo: si mostra tutto invece di filtrare su sé stesso.
    const src = (!q || q === scelto)
      ? CCNL_LIST
      : CCNL_LIST.filter((c) => c.label.toLowerCase().includes(q));
    return src.slice(0, MAX_VOCI);
  }, [testo, value]);

  const scegli = (c) => {
    onChange(c.codice);
    setTesto(c.label);
    setAperta(false);
    setEvidenziata(-1);
  };

  const scrivi = (e) => {
    setTesto(e.target.value);
    setAperta(true);
    setEvidenziata(-1);
    // Campo svuotato = nessun contratto. È l'unico caso in cui scrivere azzera
    // la scelta: per tutti gli altri decide `chiudi`.
    if (e.target.value.trim() === '') onChange('');
  };

  // D6: uscendo dal campo il testo torna a dire la verità (il contratto scelto, o vuoto).
  const chiudi = () => {
    setAperta(false);
    setEvidenziata(-1);
    setTesto(value ? getContratto(value).label : '');
  };

  // D7: le frecce scorrono, Invio sceglie, e soprattutto Invio NON invia il
  // modulo che contiene il campo.
  const daTastiera = (e) => {
    if (e.key === 'Escape') { chiudi(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aperta) { setAperta(true); return; }
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setEvidenziata((i) => {
        const prossima = i + passo;
        if (prossima < 0) return voci.length - 1;
        if (prossima >= voci.length) return 0;
        return prossima;
      });
      return;
    }
    if (e.key === 'Enter') {
      if (aperta && evidenziata >= 0 && voci[evidenziata]) {
        e.preventDefault();
        scegli(voci[evidenziata]);
      } else if (aperta) {
        // Tendina aperta senza nessuna voce evidenziata: si chiude e basta.
        // Lasciar passare l'Invio salverebbe il modulo mentre l'utente sta
        // ancora cercando.
        e.preventDefault();
        chiudi();
      }
    }
  };

  return (
    <div className="combobox">
      <input
        id={idCampo}
        className="form-input"
        type="text"
        role="combobox"
        aria-expanded={aperta}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={evidenziata >= 0 && voci[evidenziata] ? `${idLista}-${evidenziata}` : undefined}
        value={testo}
        onChange={scrivi}
        onFocus={() => setAperta(true)}
        onBlur={() => { timerBlur.current = setTimeout(chiudi, 150); }}
        onKeyDown={daTastiera}
        placeholder="Cerca il tuo contratto per nome…"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {aperta && voci.length > 0 && (
        <ul className="combobox-list" role="listbox" id={idLista}>
          {voci.map((c, i) => (
            <li key={c.codice} role="presentation">
              <button
                type="button"
                role="option"
                id={`${idLista}-${i}`}
                aria-selected={c.codice === value}
                className={'combobox-option'
                  + (c.codice === value ? ' is-active' : '')
                  + (i === evidenziata ? ' is-evidenziata' : '')}
                // onMouseDown e non onClick: scatta prima del blur, che
                // altrimenti chiuderebbe la lista senza registrare la scelta.
                onMouseDown={(e) => { e.preventDefault(); scegli(c); }}
              >
                {c.label}{c.verificato ? ' ✓' : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
