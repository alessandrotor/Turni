import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { CCNL_LIST, getCcnl } from '../utils/ccnl';

// Scelta del contratto, con la tendina di ricerca.
//
// PERCHÉ È UN COMPONENTE E NON PIÙ CODICE DENTRO IMPOSTAZIONI
// Serve in due posti: nella pagina Impostazioni e nell'avviso che compare sotto
// il primo totale in euro. Due copie della stessa tendina divergerebbero, e
// questa in particolare ha un comportamento che è facile sbagliare (la scelta
// deve scattare PRIMA del blur, o la lista si chiude senza registrare niente).
//
// La tendina è opaca di proposito: la `<datalist>` nativa è illeggibile nella
// WebView di Android, ed è il motivo per cui esiste tutto questo codice invece
// di tre righe di HTML.
//
// DUE DIFETTI CORRETTI NELL'ESTRARLA — vedi COSE-NUOVE.md §D6 e §D7
//
// 1. IL CONTRATTO SCRITTO MA NON SCELTO. Si digitava «commercio», non si
//    cliccava la voce, si salvava: a schermo restava scritto il contratto, ma il
//    dato salvato era `''`. L'utente credeva di avere il contratto impostato e
//    stava usando le regole generiche — quelle che valgono 45 € al mese in più
//    del vero. Mentiva in silenzio, e proprio sul parametro che pesa di più.
//    Ora, uscendo dal campo, il testo torna a dire la verità: o il contratto
//    scelto, o vuoto.
//
// 2. NON SI USAVA DA TASTIERA. `onKeyDown` intercettava solo Escape: le frecce
//    non scorrevano l'elenco e, essendo un input dentro un form, **Invio
//    inviava l'intero modulo** invece di scegliere la voce. Chi non usa il dito
//    non poteva selezionare un contratto. Ora ci sono ↓ ↑ Invio, e Invio non
//    esce più dal componente.

const MAX_VOCI = 50; // l'elenco CNEL ne ha oltre mille

export default function CcnlPicker({ value, onChange, id, autoFocus = false }) {
  const generato = useId();
  const idCampo = id || generato;
  const idLista = `${idCampo}-lista`;

  const [testo, setTesto] = useState(() => getCcnl(value || '').label);
  const [aperta, setAperta] = useState(false);
  const [evidenziata, setEvidenziata] = useState(-1);
  const timerBlur = useRef(null);

  useEffect(() => () => clearTimeout(timerBlur.current), []);

  // Se il contratto cambia da fuori (ripristino di un backup, reset), il testo
  // deve seguirlo: mostrare un nome che non corrisponde al dato salvato è
  // esattamente il difetto che questo componente esiste per chiudere.
  useEffect(() => {
    setTesto(getCcnl(value || '').label);
  }, [value]);

  const voci = useMemo(() => {
    const q = testo.trim().toLowerCase();
    const scelto = getCcnl(value).label.toLowerCase();
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

  // D6: uscendo dal campo, il testo deve tornare a dire la verità. Se c'è un
  // contratto scelto si rimette il suo nome; se non c'è, si svuota. Quello che
  // NON può restare è un nome scritto a mano che non corrisponde a niente.
  const chiudi = () => {
    setAperta(false);
    setEvidenziata(-1);
    setTesto(value ? getCcnl(value).label : '');
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
