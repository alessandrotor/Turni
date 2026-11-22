// I permessi (ROL ed ex festività) nel riepilogo (novembre 2026, mockup B): una
// riga con le ore rimaste e, soprattutto, ENTRO QUANDO usarle. Nel Turismo
// quelli non goduti entro settembre dell'anno dopo si pagano: chi vuole il
// riposo e non i soldi deve sapere quali ore scadono prima. Le ore si dividono
// per anno di maturazione, e ogni anno ha la sua data (`lottiPermessi()`).
//
// Il punto di partenza è la riga «Permessi» della busta, come il montante: si
// legge dal PDF (lo stesso lettore di «Confronta con la busta», sul telefono)
// o si copia a mano. Senza busta la riga lo chiede, senza finestre né avvisi.

import { useMemo, useRef, useState } from 'react';
import { lottiPermessi, regolePermessi, valorePermessi } from '../motore/permessi';
import { euroCella } from '../utils/formato';
import useModalDismiss from '../hooks/useModalDismiss';
import useOccupato from '../hooks/useOccupato';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const ore = (n) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;
const data = (iso) => { const [a, m, g] = iso.split('-').map(Number); return `${g} ${MESI[m - 1].slice(0, 3)} ${a}`; };
const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

function Busta({ busta, onSalva }) {
  const [riga, setRiga] = useState({
    mese: busta ? `${busta.anno}-${String(busta.mese).padStart(2, '0')}` : '',
    residuo: busta?.residuo ?? '', maturato: busta?.maturato ?? '', goduto: busta?.goduto ?? '', saldo: busta?.saldo ?? '',
  });
  const [errore, setErrore] = useState('');
  const file = useRef(null);
  const leggi = async (f) => {
    setErrore('');
    try {
      const [{ righeDaByte, inflateBrowser }, { leggiCedolinoDaRighe }] = await Promise.all([import('../utils/cedolino'), import('../utils/leggi-cedolino')]);
      const fx = leggiCedolinoDaRighe(await righeDaByte(new Uint8Array(await f.arrayBuffer()), inflateBrowser));
      const p = fx.ratei?.permessi;
      if (!p || !fx.periodo) { setErrore('In questo PDF non trovo la riga dei permessi: scrivila qui sotto.'); return; }
      onSalva({ anno: fx.periodo.anno, mese: fx.periodo.mese, ...p });
    } catch { setErrore('Non riesco a leggere questo PDF: scrivi la riga qui sotto.'); }
  };
  const salva = () => {
    const [a, m] = riga.mese.split('-').map(Number);
    const r = { residuo: num(riga.residuo), maturato: num(riga.maturato), goduto: num(riga.goduto), saldo: num(riga.saldo) };
    if (!(a > 0) || !(r.saldo > 0)) { setErrore('Servono almeno il saldo e il mese della busta.'); return; }
    const completa = riga.maturato !== '' && Math.abs(r.residuo + r.maturato - r.goduto - r.saldo) <= 0.011;
    onSalva(completa ? { anno: a, mese: m, ...r } : { anno: a, mese: m, saldo: r.saldo });
  };
  const campo = (k, etichetta) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="form-label" htmlFor={`pr-${k}`} style={{ fontSize: '.68rem' }}>{etichetta}</label>
      <input id={`pr-${k}`} className="form-input" inputMode="decimal" value={riga[k]} onChange={(e) => setRiga({ ...riga, [k]: e.target.value })} />
    </div>
  );
  return (
    <>
      <p className="form-hint" style={{ marginTop: 0 }}>In busta, riquadro <b>Ratei</b>, riga <b>Permessi</b>.</p>
      <input ref={file} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && leggi(e.target.files[0])} />
      <button type="button" className="btn btn-primary btn--full" onClick={() => file.current?.click()}>Leggila dal PDF della busta</button>
      <p className="form-hint" style={{ textAlign: 'center' }}>oppure copiala (basta il saldo)</p>
      <div style={{ display: 'flex', gap: '.35rem' }}>{campo('residuo', 'Residuo AP')}{campo('maturato', 'Maturato')}{campo('goduto', 'Goduto')}{campo('saldo', 'Saldo')}</div>
      <label className="form-label" htmlFor="pr-mese" style={{ marginTop: '.5rem' }}>Della busta di</label>
      <input id="pr-mese" type="month" className="form-input" value={riga.mese} onChange={(e) => setRiga({ ...riga, mese: e.target.value })} />
      {errore && <p className="form-hint" style={{ color: '#dc2626' }}>{errore}</p>}
      <button type="button" className="btn btn-secondary btn--full" style={{ marginTop: '.6rem' }} onClick={salva}>Usa questi numeri</button>
    </>
  );
}

function Finestra({ busta, conti, settings, onSalva, onChiudi }) {
  const ref = useRef(null);
  useModalDismiss(ref, onChiudi, true);
  useOccupato('permessiRol', true);
  const [cambia, setCambia] = useState(!busta);
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label="Permessi">
        <div className="modal-header">
          <h2 className="modal-title">Permessi (ROL)</h2>
          <button type="button" className="modal-close" onClick={onChiudi} aria-label="Chiudi">✕</button>
        </div>
        <div className="modal-form">
          {cambia || !conti ? <Busta busta={busta} onSalva={(b) => { onSalva(b); setCambia(false); }} /> : (
            <>
              {conti.lotti.map((l) => (
                <div key={l.anno} style={{ borderTop: '1px solid var(--c-border)', padding: '.55rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '1.15rem' }}>{ore(l.ore)}</strong>
                    <span style={{ fontSize: '.8rem', color: 'var(--c-text-2)' }}>maturate nel {l.anno}</span>
                  </div>
                  <div>da usare entro il <b>{data(l.pagatiEntro)}</b> <span style={{ color: 'var(--c-text-2)', fontSize: '.8rem' }}>(di norma entro il {data(l.godereEntro)})</span></div>
                  <div style={{ fontSize: '.8rem', color: 'var(--c-text-2)' }}>Se restano, te le pagano: ~{euroCella(valorePermessi(l.ore, l.pagatiEntro, settings))} lordi.</div>
                </div>
              ))}
              {conti.pagati.map((l) => (
                <p key={l.anno} className="form-hint">{ore(l.ore)} del {l.anno} non usate entro settembre: in busta dovrebbero esserti state pagate.</p>
              ))}
              <p className="form-hint">Si usano prima le ore più vecchie. Quando, lo si concorda col datore. CCNL Turismo, art. 114.{' '}
                Dalla busta di {MESI[busta.mese - 1]} {busta.anno} · <button type="button" className="linklike" onClick={() => setCambia(true)}>cambia</button></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** La riga nel riepilogo, e la finestra che apre. Solo coi contratti che hanno i permessi. */
export default function PermessiRol({ settings, turni, oggi, onUpdateSettings }) {
  const [aperta, setAperta] = useState(false);
  const busta = settings.permessiBusta || null;
  const conti = useMemo(() => (busta ? lottiPermessi({ busta, turni, settings, oggi }) : null), [busta, turni, settings, oggi]);
  if (!regolePermessi(settings) || !onUpdateSettings) return null;
  const primo = conti?.lotti[0];
  const tutte = conti ? conti.lotti.reduce((s, l) => s + l.ore, 0) : 0;
  const quota = primo && tutte > 0 ? (primo.ore / tutte) * 100 : 0;
  return (
    <>
      <button type="button" onClick={() => setAperta(true)}
        style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none', cursor: 'pointer',
          border: '1px solid var(--c-border)', borderRadius: 10, padding: '.55rem .7rem', margin: '.7rem 0 0' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="summary-label">Permessi (ROL)</span>
          <strong style={{ fontSize: '1.05rem' }}>{conti ? ore(conti.totale) : 'dalla busta ›'}</strong>
        </span>
        {conti && conti.lotti.length > 0 && (
          <>
            <span style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', margin: '.35rem 0 .25rem', background: '#bfdbfe' }}>
              <span style={{ width: `${quota}%`, background: '#2563eb' }} />
            </span>
            <span style={{ display: 'block', fontSize: '.78rem', color: 'var(--c-text-2)' }}>
              {ore(primo.ore)} da usare entro il {data(primo.pagatiEntro)}, poi te le pagano ›
            </span>
          </>
        )}
        {!conti && <span style={{ display: 'block', fontSize: '.78rem', color: 'var(--c-text-2)' }}>Quante ore hai e entro quando usarle</span>}
      </button>
      {aperta && <Finestra busta={busta} conti={conti} settings={settings} onChiudi={() => setAperta(false)}
        onSalva={(b) => onUpdateSettings({ permessiBusta: b })} />}
    </>
  );
}
