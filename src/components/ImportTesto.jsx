import { useEffect, useMemo, useRef, useState } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import useOccupato from '../hooks/useOccupato';
import { leggiTestoTurni } from '../utils/testo-turni';
import { trovaPersona } from '../utils/tabellone';
import { turniDaImportare } from '../utils/import-turni';
import { minutesDiff, formatMinutes } from '../utils/dates';
import { ShiftPreviewRow } from './ImportModal';
import Righello from './Righello';

// «Incolla i turni da un messaggio»: il testo si legge sul telefono, non va a nessun servizio
// (utils/testo-turni.js), per questo non ha l'avviso della foto. Il modulo è uno solo: si incolla e
// sotto compare cosa è stato capito; l'unica cosa da toccare è «Parti da», solo quando le date sono
// dedotte dal nome del giorno.
//
// Il testo può arrivare da «Condividi → Turni» (share_target nel manifest, vite.config.js): il
// modulo si apre pieno, letto una volta e tolto dall'indirizzo come la scorciatoia in App.jsx. Un'
// IMMAGINE condivisa la lascia il service worker in una cache (public/condividi-sw.js) e qui arriva
// solo `?immagine_condivisa`.
let immagineCondivisa = false;
let condiviso = (() => {
  try {
    const q = new URLSearchParams(window.location.search);
    immagineCondivisa = q.has('immagine_condivisa');
    const parti = ['titolo_condiviso', 'testo_condiviso', 'link_condiviso'].map((k) => q.get(k)).filter(Boolean);
    if (!parti.length && !immagineCondivisa) return null;
    window.history.replaceState({}, '', window.location.pathname);
    return parti.join('\n');
  } catch {
    return null;
  }
})();

const FASI = {
  scarico: 'Preparo il lettore: ~4,5 MB, solo la prima volta',
  nomi: 'Leggo i nomi',
  colonne: 'Cerco le colonne',
  turni: 'Leggo i tuoi turni',
};

export default function ImportTesto({ esistenti = [], onConfirm, nome, onNome }) {
  const [aperto, setAperto] = useState(() => !!condiviso || immagineCondivisa);
  const [testo, setTesto] = useState(() => condiviso || '');
  // Il tabellone da un'immagine (prova): fase di lettura, oppure i nomi da
  // scegliere la prima volta. Il risultato diventa testo qui sopra.
  // Dopo la lettura: di chi sono i turni (tabellone), o il righello (foto).
  const [immagine, setImmagine] = useState(null);
  const [origine, setOrigine] = useState(null);
  const tabRef = useRef(null);
  const fileRef = useRef(null);
  const avanza = (fase) => setImmagine({ fase });

  const leggiTurni = async (persona) => {
    onNome?.(persona.nome);
    const { turniDi } = await import('../services/lettore-immagine');
    const t = await turniDi(tabRef.current, persona, { avanza });
    setImmagine(t ? null : { errore: 'Nella tua riga non ho trovato orari.' });
    setOrigine({ nome: persona.nome });
    if (t) setTesto(t);
  };
  const leggiFascia = async (stato, fascia) => {
    const { turniDellaFascia } = await import('../services/lettore-immagine');
    const t = await turniDellaFascia(tabRef.current, fascia, stato.primo, { avanza });
    setImmagine(t ? null : { errore: 'In quella fascia non ho trovato orari: spostala sulla tua riga.', righello: true });
    setOrigine({ righello: stato });
    if (t) setTesto(t);
  };
  const leggiImmagine = async (file) => {
    if (!file) return;
    setAperto(true);
    setOrigine(null);
    try {
      const { apriTabellone } = await import('../services/lettore-immagine');
      const tab = await apriTabellone(file, { oggi: new Date(), nome, avanza });
      if (tab.errore) { setImmagine({ errore: 'Non riconosco questa tabella: non trovo né le righe né gli orari.' }); return; }
      tabRef.current = { ...tab, file };
      if (tab.foto) { setImmagine({ righello: true }); return; }
      const io = tab.io || trovaPersona(tab.persone, nome);
      if (io) await leggiTurni(io); else setImmagine({ persone: tab.persone });
    } catch {
      setImmagine({ errore: 'Non sono riuscito a leggere l\'immagine.' });
    }
  };

  // Usato: se il calendario si rimonta (cambio scheda) non si riapre.
  useEffect(() => {
    condiviso = null;
    if (!immagineCondivisa) return;
    immagineCondivisa = false;
    (async () => {
      try {
        const cache = await caches.open('turni-condivisi');
        const r = await cache.match('/condiviso/immagine');
        await cache.delete('/condiviso/immagine');
        if (r) leggiImmagine(await r.blob());
      } catch { /* senza cache non c'è niente da leggere */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [inizio, setInizio] = useState('');
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  const chiudi = () => { setAperto(false); setTesto(''); setInizio(''); setImmagine(null); setOrigine(null); };
  // Con del testo incollato un tocco fuori o Esc non lo buttano: si chiude
  // dalla ✕ o da «Annulla». Senza testo non c'è niente da perdere.
  const tentaChiudi = () => { if (!testo.trim()) chiudi(); };
  useModalDismiss(dialogRef, tentaChiudi, aperto);
  useOccupato('importTesto', aperto && (!!testo.trim() || !!immagine?.fase));

  const letto = useMemo(
    () => (aperto && testo.trim() ? leggiTestoTurni(testo, { oggi: new Date(), inizio }) : null),
    [aperto, testo, inizio],
  );

  const { daSalvare, suAssenza, doppioni } = letto
    ? turniDaImportare(letto.turni, esistenti)
    : { daSalvare: [], suAssenza: [], doppioni: 0 };
  const totale = letto
    ? letto.turni.reduce((s, t) => s + Math.max(0, minutesDiff(t.startTime, t.endTime) - (t.breakMinutes || 0)), 0)
    : 0;
  const saltatiGiorni = [
    suAssenza.length > 0 && `${suAssenza.length} su giorni di ferie o malattia`,
    doppioni > 0 && `${doppioni} già segnat${doppioni === 1 ? 'o' : 'i'}`,
  ].filter(Boolean);

  const conferma = () => {
    onConfirm(letto.turni);
    chiudi();
  };

  const conRighello = !!(immagine?.righello && tabRef.current?.foto);

  return (
    <>
      <button className="btn-import" onClick={() => setAperto(true)}>
        📋 Turni da un messaggio o un'immagine
      </button>

      {aperto && (
        <div className="modal-overlay" ref={overlayRef}
          onClick={(e) => e.target === overlayRef.current && tentaChiudi()}>
          <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Incolla i turni">
            <div className="modal-header">
              <span className="modal-title">Incolla i turni</span>
              <button className="modal-close" onClick={chiudi}>✕</button>
            </div>

            <div className="import-body">
              {/* Prova: il tabellone da un'immagine, letto sul telefono. */}
              <input ref={fileRef} type="file" accept="image/*" hidden
                onChange={(e) => { leggiImmagine(e.target.files?.[0]); e.target.value = ''; }} />
              {!immagine?.fase && !conRighello && (
                <button type="button" className="btn-import" style={{ marginBottom: '.5rem' }} onClick={() => { import('../services/lettore-immagine').then((m) => m.preparaLettore()); fileRef.current?.click(); }}>
                  📷 Da un'immagine <span className="beta-tag">prova</span>
                </button>
              )}
              {immagine?.fase && <p className="import-match">⏳ {FASI[immagine.fase]}…</p>}
              {immagine?.errore && <p className="import-match import-match--warn">⚠️ {immagine.errore}</p>}
              {conRighello && (
                <Righello src={tabRef.current.anteprima} colonne={tabRef.current.colonneX} larghezza={tabRef.current.W} altezza={tabRef.current.H}
                  iniziale={origine?.righello} onLeggi={leggiFascia} />
              )}
              {/* Di chi sono i turni letti, e come si cambia: un tocco. */}
              {origine && !immagine && (
                <p className="import-match" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {origine.nome ? <span>Turni di <strong>{origine.nome}</strong></span> : <span>📏 Dalla fascia scelta</span>}
                  <button type="button" className="linklike"
                    onClick={async () => {
                      if (!origine.nome) { setImmagine({ righello: true }); return; }
                      setImmagine({ fase: 'nomi' });
                      const { tuttiINomi } = await import('../services/lettore-immagine');
                      tabRef.current = await tuttiINomi(tabRef.current);
                      setImmagine({ persone: tabRef.current.persone });
                    }}>
                    {origine.nome ? 'cambia' : 'sposta'}
                  </button>
                </p>
              )}
              {immagine?.persone && (
                <div role="group" aria-label="Chi sei nel tabellone?" style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.5rem' }}>
                  {immagine.persone.map((p) => (
                    <button key={p.fasce[0]} type="button" className="btn-import" onClick={() => leggiTurni(p)}>{p.nome}</button>
                  ))}
                </div>
              )}
              {/* Col righello aperto il testo non serve ancora: la finestra non deve scorrere. */}
              {!conRighello && <>
              <textarea
                autoFocus
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder={'Incolla qui il messaggio, per esempio:\nLun 8-16, Mar 10-18, Mer riposo\noppure 05/10 8:00-16:00'}
                aria-label="Testo con i turni"
                style={{ width: '100%', minHeight: '4.5rem', font: 'inherit', padding: '.6rem', borderRadius: '8px',
                  border: '1px solid var(--border, #cfd4dc)', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <p className="import-intro" style={{ marginTop: '.4rem', fontSize: '.8rem', opacity: .8 }}>
                Il testo resta sul telefono: non viene inviato a nessun servizio.
              </p>
              </>}

              {letto && (
                <>
                  {letto.turni.length > 0 && (
                    <p className="import-intro">
                      Trovati <strong>{letto.turni.length} turn{letto.turni.length === 1 ? 'o' : 'i'}</strong> · totale{' '}
                      <strong>{formatMinutes(totale)}</strong>. Controlla le date.
                    </p>
                  )}

                  {letto.serveInizio && (
                    <p className="import-match" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Date dedotte dai nomi dei giorni. Parti da</span>
                      <input
                        type="date"
                        value={inizio || letto.inizioUsato || ''}
                        onChange={(e) => setInizio(e.target.value)}
                        aria-label="Primo giorno"
                      />
                    </p>
                  )}

                  {letto.avvisi.map((a) => <p key={a} className="import-match import-match--warn">⚠️ {a}</p>)}
                  {saltatiGiorni.length > 0 && (
                    <p className="import-match import-match--warn">Salto {saltatiGiorni.join(' e ')}.</p>
                  )}
                  {letto.saltati.length > 0 && (
                    <p className="import-match">
                      Non sono turni: {letto.saltati.map((s) => `${s.etichetta} ${s.motivo}`).join(', ')}.
                    </p>
                  )}
                  {letto.nonCapite.length > 0 && (
                    <p className="import-match import-match--warn">
                      Non ho capito: {letto.nonCapite.map((n) => `«${n.testo}»`).join(', ')}.
                    </p>
                  )}

                  <div className="import-list">
                    {letto.turni
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                      .map((t) => <ShiftPreviewRow key={`${t.date}|${t.startTime}|${t.endTime}`} shift={t} />)}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '0 1.25rem 1.25rem' }}>
              <button className="btn btn-secondary" onClick={chiudi}>Annulla</button>
              <button className="btn btn-primary" onClick={conferma} disabled={daSalvare.length === 0}>
                ✓ Importa {daSalvare.length} turn{daSalvare.length === 1 ? 'o' : 'i'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
