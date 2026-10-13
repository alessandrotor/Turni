import { ENABLE_DEBUG } from '../config/features';

// I token dell'ultimo import da foto, solo in modalità debug.
export default function DebugUso({ uso }) {
  if (!ENABLE_DEBUG || !uso) return null;
  return (
    <div className="debug-usage">
      <span className="debug-usage-tag">🐛 DEBUG token</span>
      <span>prompt <strong>{uso.prompt ?? '—'}</strong></span>
      <span>output <strong>{uso.output ?? '—'}</strong></span>
      <span>thinking <strong>{uso.thinking ?? '—'}</strong></span>
      <span>totale <strong>{uso.total ?? '—'}</strong></span>
      <span className="debug-usage-meta">{uso.model} · {uso.finishReason || 'STOP'}</span>
    </div>
  );
}
