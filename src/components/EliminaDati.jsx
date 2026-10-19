import { useState } from 'react';
import { eliminaTuttoIlLocale } from '../utils/backup-contenuto';

// «Elimina tutti i dati»: il pieno controllo, per chi lo vuole.
//
// È l'ECCEZIONE alla regola «l'annulla dopo, la conferma prima mai», decisa da
// chi mantiene il progetto: qui l'annulla dopo non può esistere — non c'è
// nessun'altra copia da cui tornare — e il gesto non è di tutti i giorni. La
// conferma però non è un «sei sicuro?» da chiudere a riflesso: dice cosa
// sparisce e mette accanto la via per portarselo via (il backup).
export default function EliminaDati({ onEsporta, turniSalvati = 0 }) {
  const [chiedi, setChiedi] = useState(false);
  const [errore, setErrore] = useState(null);

  const elimina = async () => {
    const esito = await eliminaTuttoIlLocale({
      localStorage: window.localStorage, sessionStorage: window.sessionStorage,
      caches: window.caches, indexedDB: window.indexedDB,
    });
    if (!esito.ok) { setErrore(`Non sono riuscito a cancellare: ${esito.errori.join(', ')}.`); return; }
    // Da capo, come la prima volta: lo stato in memoria non deve riscrivere niente.
    window.location.replace('/');
  };

  if (!chiedi) {
    return (
      <div className="backup-row">
        <button type="button" className="btn btn-danger-ghost" onClick={() => setChiedi(true)}>
          🗑️ Elimina tutti i dati
        </button>
      </div>
    );
  }
  return (
    <div className="backup-row" role="alertdialog" aria-label="Eliminare tutti i dati?"
      style={{ flexDirection: 'column', alignItems: 'stretch', gap: '.5rem' }}>
      <p className="form-hint" style={{ margin: 0 }}>
        Spariscono da questo telefono {turniSalvati > 0 ? <strong>{turniSalvati} turn{turniSalvati === 1 ? 'o' : 'i'}</strong> : 'i turni'},
        le impostazioni e tutto il resto. <strong>Non si recuperano</strong>: non esiste un'altra copia.
      </p>
      {turniSalvati > 0 && (
        <button type="button" className="btn btn-secondary" onClick={onEsporta}>⬇️ Prima esporta un backup</button>
      )}
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <button type="button" className="btn btn-secondary" onClick={() => { setChiedi(false); setErrore(null); }} style={{ flex: 1 }}>
          Annulla
        </button>
        <button type="button" className="btn btn-danger-ghost" onClick={elimina} style={{ flex: 1, marginTop: 0 }}>
          🗑️ Elimina tutto
        </button>
      </div>
      {errore && <p className="form-hint" role="alert" style={{ margin: 0, color: 'var(--c-danger)' }}>{errore}</p>}
    </div>
  );
}
