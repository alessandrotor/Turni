// La barra della scelta di più giorni (hooks/useSelezioneGiorni.js): quanti giorni,
// gli orari che lo storico propone per il primo, e «Fine». Un tocco su un orario
// segna tutti i giorni scelti; poi c'è «Annulla». Gli orari sono le sagome dello
// storico (utils/orari-proposti.js): la barra non inventa un orario.

import { sagomeFrequenti, proponiOrari, MAX_SAGOME } from '../utils/orari-proposti';

export default function BarraSelezione({ scelti, turni, onSalva, onChiudi }) {
  if (!scelti) return null;
  const giorni = [...scelti].sort();
  const sagome = sagomeFrequenti(turni, giorni[0]).slice(0, MAX_SAGOME);
  const orari = sagome.length ? sagome : [proponiOrari(turni, giorni[0])];
  const salva = (o) => {
    onSalva(giorni.map((date) => ({ date, startTime: o.startTime, endTime: o.endTime, breakMinutes: o.breakMinutes || 0 })),
      `Aggiunti ${giorni.length} ${giorni.length === 1 ? 'turno' : 'turni'}, ${o.startTime}–${o.endTime}.`);
    onChiudi();
  };
  return (
    <div role="toolbar" aria-label="Giorni scelti" style={{ position: 'fixed', left: 8, right: 8, bottom: 'calc(8px + env(safe-area-inset-bottom))', zIndex: 60,
      background: '#0f172a', color: '#fff', borderRadius: 14, padding: '.6rem .7rem', boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.9rem', marginBottom: '.45rem' }}>
        <span>{giorni.length} {giorni.length === 1 ? 'giorno scelto' : 'giorni scelti'} · tocca un orario</span>
        <button type="button" onClick={onChiudi} style={{ font: 'inherit', color: '#93c5fd', background: 'none', border: 'none', fontWeight: 700 }}>Fine</button>
      </div>
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
        {orari.map((o) => (
          <button key={`${o.startTime}-${o.endTime}`} type="button" onClick={() => salva(o)}
            style={{ font: 'inherit', fontWeight: 800, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 9, padding: '.45rem .7rem' }}>
            {o.startTime}–{o.endTime}
          </button>
        ))}
      </div>
    </div>
  );
}
