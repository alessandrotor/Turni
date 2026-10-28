// Le icone dell'app, al posto degli emoji (ottobre 2026). Gli emoji cambiano
// disegno da un telefono all'altro, sono piccoli dove servono e tutti uguali di
// peso: il 🌡 della malattia quasi non si vedeva, e l'insieme dava all'app
// l'aria di un modello fatto in fretta.
//
// Due vesti, scelte con chi mantiene il progetto sui mockup:
//  - duotone (default): contorno colorato e interno dello stesso colore,
//    tenue. Per menu, bottoni, avvisi, titoli delle sezioni;
//  - piastrella: quadratino pieno col disegno bianco. Solo per le giornate
//    senza turno (ferie, permesso, malattia, festività), che nel calendario
//    devono saltare all'occhio fra i turni.
//
// I disegni sono fatti qui, a tratto su una griglia 24×24: nessuna libreria
// (le icone Lucide sono uno dei segni più riconoscibili di un sito «fatto
// con l'IA»). L'icona è decorativa: il testo accanto dice già cosa è.

const DISEGNI = {
  avviso: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  allarme: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3v.1"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.5 7.2L4 20.5l1.2-4.3A8 8 0 1 1 20 12z"/>',
  appunti: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h5"/>',
  euro: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
  documento: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  impostazioni: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.3 2.7-.7.6 2.7 2.7.6-.7 2.7 2.3 1.6-2.3 1.6.7 2.7-2.7.6-.6 2.7-2.7-.7L12 21.2l-1.6-2.3-2.7.7-.6-2.7-2.7-.6.7-2.7L2.8 12l2.3-1.6-.7-2.7 2.7-.6.6-2.7 2.7.7z"/>',
  fotocamera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  riposo: '<path d="M5 19C5 10 11 5 19 5c0 8-5 14-14 14z"/><path d="M5 19 13 11"/>',
  statistiche: '<path d="M4 20V10M10 20V4M16 20v-7M2.5 20.5h19"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  ferie: '<path d="M12 21V11"/><path d="M3.5 11a8.5 8.5 0 0 1 17 0z"/><path d="M2.5 21h19"/>',
  attrezzi: '<path d="M14.5 4.5a4 4 0 0 0 5 5l-9.5 9.5a2.1 2.1 0 0 1-3-3z"/>',
  debug: '<rect x="7.5" y="7" width="9" height="13" rx="4.5"/><path d="M12 7V4M4 11h3.5M16.5 11H20M4 16h3.5M16.5 16H20"/>',
  cestino: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  carica: '<path d="M12 15V3M7 8l5-5 5 5M4 14v6h16v-6"/>',
  orologio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  attesa: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
  soldi: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  crescita: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  contratto: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 11h6M9 15h6"/>',
  salva: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  regalo: '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M12 9v11M3.5 13h17M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 .5 6-1.5S14 5 12 9"/>',
  valigetta: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
  ricevuta: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  aggiorna: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 13a8 8 0 0 0 14.5 4.5L20 16M4 3v5h5M20 21v-5h-5"/>',
  piu: '<path d="M12 5v14M5 12h14"/>',
  meno: '<path d="M5 12h14"/>',
  banca: '<path d="M3 10h18L12 4zM5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
  luna: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  pausa: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
  righello: '<rect x="2.5" y="8" width="19" height="8" rx="1"/><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4"/>',
  lucchetto: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  malattia: '<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/>',
  festivita: '<path d="M12 3.5l2.5 5.2 5.6.8-4 4 1 5.6-5.1-2.7-5 2.7 1-5.6-4-4 5.5-.8z"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
};

// Un colore per cosa, così la stessa cosa ha lo stesso colore ovunque.
const COLORI = {
  avviso: '#d97706', allarme: '#dc2626', chat: '#059669', appunti: '#d97706', euro: '#059669',
  documento: '#0891b2', impostazioni: '#64748b', fotocamera: '#db2777', riposo: '#16a34a',
  statistiche: '#0891b2', calendario: '#2563eb', ferie: '#0d9488', attrezzi: '#64748b',
  debug: '#64748b', cestino: '#dc2626', carica: '#2563eb', orologio: '#2563eb', attesa: '#64748b',
  soldi: '#ca8a04', crescita: '#059669', contratto: '#7c3aed', salva: '#2563eb', regalo: '#db2777',
  valigetta: '#92400e', ricevuta: '#0891b2', aggiorna: '#2563eb', piu: '#059669', meno: '#dc2626',
  banca: '#475569', luna: '#4f46e5', pausa: '#92400e', righello: '#d97706', lucchetto: '#475569',
  malattia: '#dc2626', festivita: '#ca8a04', ok: '#059669', permesso: '#0891b2',
};

// Disegni aperti (linee, frecce): un riempimento tenue li impasterebbe.
const SENZA_FONDO = new Set(['crescita', 'aggiorna', 'carica', 'piu', 'meno', 'attesa', 'statistiche', 'attrezzi', 'riposo']);

// Le giornate senza turno, coi tipi di motore/assenze.js.
export const ICONA_TIPO = { ferie: 'ferie', permesso: 'documento', malattia: 'malattia', festivita: 'festivita' };

/**
 * @param {{ nome: string, piastrella?: boolean, colore?: string, style?: import('react').CSSProperties }} p
 */
export default function Icona({ nome, piastrella = false, colore, style }) {
  const d = DISEGNI[nome];
  if (!d) return null;
  const c = colore || COLORI[nome] || 'currentColor';
  if (piastrella) {
    return (
      <span aria-hidden="true" style={{ display: 'inline-flex', width: '1.45em', height: '1.45em', padding: '.22em', borderRadius: '.42em',
        background: c, verticalAlign: '-0.38em', boxSizing: 'border-box', flex: 'none', ...style }}>
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#fff" strokeWidth={2.3}
          strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
      </span>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill={SENZA_FONDO.has(nome) ? 'none' : c} fillOpacity={0.2} stroke={c} strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-0.2em', flex: 'none', ...style }}
      dangerouslySetInnerHTML={{ __html: d }} />
  );
}
