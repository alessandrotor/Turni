import { useState, useRef, useMemo } from 'react';
import { formatDate, formatDayShort, parseDate, minutesDiff, formatMinutes } from '../utils/dates';
import { proponiPeriodo, totalePeriodo } from '../utils/periodo-assenza';
import useModalDismiss from '../hooks/useModalDismiss';
import { TIPO, ETICHETTA, ICONA, tipoTurno, isAssenza, minutiGiornoAssenza } from '../utils/assenze';
import { maggiorazioneDaChiedere } from '../utils/configurazione';

const TIPI = [TIPO.LAVORO, TIPO.FERIE, TIPO.PERMESSO, TIPO.MALATTIA, TIPO.FESTIVITA];

const BREAK_PRESETS = [
  { label: 'Nessuna', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 ora', value: 60 },
];

const SURCHARGE_PRESETS = [
  { label: 'Nessuna', value: 0 },
  { label: '10%', value: 10 },
  { label: '15%', value: 15 },
  { label: '30%', value: 30 },
  { label: '50%', value: 50 },
];

// Ore di una giornata di assenza: nascono da una divisione (40 h ÷ 6 giorni),
// quindi si portano dietro la coda binaria — «6.666666666666667» finiva dritto
// dentro il campo e dentro l'hint. Due decimali bastano al mezzo quarto d'ora,
// e `Number(...)` toglie gli zeri inutili così 4 resta 4 e non «4,00».
function oreArrotondate(ore) {
  return Number(ore.toFixed(2));
}

function getInitialState(modal, settings) {
  const oreAssenza = oreArrotondate(minutiGiornoAssenza(settings) / 60);
  if (modal.type === 'edit') {
    const s = modal.shift;
    return {
      kind: tipoTurno(s),
      date: s.date,
      startTime: s.startTime ?? '08:00',
      endTime: s.endTime ?? '16:00',
      breakMinutes: s.breakMinutes ?? 0,
      surchargePct: s.surchargePct ?? 0,
      // Un'assenza salvata porta la propria durata; un turno di lavoro no, e
      // se lo si converte in assenza parte dalle ore da contratto.
      absenceHours: s.durationMinutes != null
        ? String(oreArrotondate(s.durationMinutes / 60))
        : String(oreAssenza),
      // In modifica il periodo non esiste: si sta cambiando UNA giornata già
      // salvata, e trasformarla in molte sarebbe una sorpresa, non una comodità.
      dateTo: '',
      note: s.note ?? '',
    };
  }
  return {
    kind: TIPO.LAVORO,
    date: modal.date ?? formatDate(new Date()),
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 0,
    surchargePct: 0,
    absenceHours: String(oreAssenza),
    // Estremo finale del periodo. Vuoto = una giornata sola, cioè il
    // comportamento di sempre: chi segna un giorno non vede nulla di nuovo.
    dateTo: '',
    note: '',
  };
}

export default function ShiftForm({ modal, settings = {}, turni = [], onSave, onDelete, onClose, onUpdateSettings }) {
  // Stato iniziale calcolato una volta sola e condiviso dai due useState:
  // ricostruirlo per il secondo era lavoro sprecato a ogni mount del modale.
  const initial = useRef(null);
  if (initial.current === null) initial.current = getInitialState(modal, settings);

  const [form, setForm] = useState(initial.current);
  const [customBreak, setCustomBreak] = useState(false);
  const [customSurcharge, setCustomSurcharge] = useState(
    () => !SURCHARGE_PRESETS.some(p => p.value === Number(initial.current.surchargePct)),
  );

  const dialogRef = useRef(null);
  useModalDismiss(dialogRef, onClose);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const assenzaSelezionata = isAssenza({ type: form.kind });
  const isEdit = modal.type === 'edit';

  // ── Periodo ───────────────────────────────────────────────────────────────
  // Le righe si RIGENERANO quando cambiano le date: tenere le spunte di un
  // periodo precedente le farebbe riferire a giorni diversi da quelli che si
  // stanno guardando. Le correzioni fatte a mano vivono in `modifiche`, che si
  // azzera insieme alla proposta.
  const periodoAttivo = assenzaSelezionata && !isEdit && !!form.dateTo;
  const [modifiche, setModifiche] = useState({});
  const chiaveProposta = `${form.date}|${form.dateTo}`;
  const chiavePrecedente = useRef(chiaveProposta);
  if (chiavePrecedente.current !== chiaveProposta) {
    chiavePrecedente.current = chiaveProposta;
    if (Object.keys(modifiche).length) setModifiche({});
  }

  const righe = useMemo(() => {
    if (!periodoAttivo) return [];
    return proponiPeriodo({ dal: form.date, al: form.dateTo, turni, settings })
      .map(r => ({ ...r, ...(modifiche[r.data] || {}) }));
  }, [periodoAttivo, form.date, form.dateTo, turni, settings, modifiche]);

  const totale = totalePeriodo(righe);
  const cambiaRiga = (data, patch) =>
    setModifiche(m => ({ ...m, [data]: { ...(m[data] || {}), ...patch } }));

  // Maggiorazione e note vivono sotto «Altro», chiuso di default: la finestra
  // resta corta per il caso comune, che è segnare un turno e basta. Se però il
  // turno in modifica ha già uno dei due valori la sezione parte aperta —
  // nascondere un dato che c'è è peggio di una riga in più.
  //
  // Calcolato UNA volta dallo stato iniziale, non da `form`: `open` è un
  // attributo normale, e ricalcolarlo a ogni render richiuderebbe la sezione
  // mentre ci si sta scrivendo dentro.
  const apriAvanzate = Number(initial.current.surchargePct) > 0
    || initial.current.note !== '';

  // minutesDiff ritorna 0 su orari non validi (campo svuotato), quindi qui non
  // serve più intercettare nulla: la preview non può mostrare NaN.
  const workedMins = Math.max(0, minutesDiff(form.startTime, form.endTime) - (Number(form.breakMinutes) || 0));

  const handleBreakPreset = (val) => {
    setCustomBreak(false);
    setForm(f => ({ ...f, breakMinutes: val }));
  };

  const handleSurchargePreset = (val) => {
    setCustomSurcharge(false);
    setForm(f => ({ ...f, surchargePct: val }));
  };

  // ── La maggiorazione chiesta sul turno che la attiva ──────────────────────
  //
  // Non è un controllo nuovo: `maggiorazioneDaChiedere` usa le stesse funzioni
  // con cui il motore decide di pagarla (isSunday, isHoliday,
  // toccaFasciaNotturna). Una regola scritta a parte finirebbe per comparire
  // quando il motore non è d'accordo, che è peggio del non chiedere.
  //
  // NON blocca il salvataggio: il turno si salva comunque, e l'avviso dice cosa
  // succede se si rimanda. Chi risponde «non ne ho» chiude la domanda per
  // sempre — la scelta sta nei settings, come tutto il resto.
  const [pctMagg, setPctMagg] = useState('');
  const maggMancante = useMemo(
    () => (onUpdateSettings ? maggiorazioneDaChiedere(
      { date: form.date, startTime: form.startTime, endTime: form.endTime, type: form.kind },
      settings,
    ) : null),
    [onUpdateSettings, form.date, form.startTime, form.endTime, form.kind, settings],
  );

  const impostaMagg = () => {
    const v = Number(String(pctMagg).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    onUpdateSettings({ [maggMancante.chiave]: v });
    setPctMagg('');
  };

  const nonNeHo = () => {
    const gia = Array.isArray(settings.maggiorazioniNonDovute) ? settings.maggiorazioniNonDovute : [];
    onUpdateSettings({ maggiorazioniNonDovute: [...gia, maggMancante.tipo] });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Periodo: una giornata per ogni riga spuntata, e via i turni che quelle
    // giornate coprono — non si può lavorare ed essere in ferie lo stesso
    // giorno. Il caso di sempre (una data sola) prosegue più sotto invariato.
    if (periodoAttivo) {
      const scelte = righe.filter(r => r.selezionato);
      if (!scelte.length) return;
      onSave(
        scelte.map(r => ({
          date: r.data,
          type: form.kind,
          durationMinutes: Math.max(0, Math.round(Number(r.minuti) || 0)),
          note: form.note.trim(),
        })),
        scelte.filter(r => r.turnoEsistente).map(r => r.turnoEsistente.id),
      );
      return;
    }

    const base = {
      ...(modal.type === 'edit' ? { id: modal.shift.id } : {}),
      date: form.date,
      note: form.note.trim(),
    };
    // Un'assenza non ha orari né pausa né maggiorazione: porta solo una durata.
    // Salvare anche i campi del lavoro lascerebbe in giro dati che non
    // significano niente e che il motore dovrebbe imparare a ignorare.
    const shift = assenzaSelezionata
      ? {
          ...base,
          type: form.kind,
          durationMinutes: Math.max(0, Math.round((Number(form.absenceHours) || 0) * 60)),
        }
      : {
          ...base,
          startTime: form.startTime,
          endTime: form.endTime,
          breakMinutes: Number(form.breakMinutes) || 0,
          surchargePct: Number(form.surchargePct) || 0,
        };
    onSave(shift);
  };

  // «Nuovo turno» su una giornata di ferie sarebbe fuorviante: titolo e
  // pulsanti seguono il tipo scelto. Nomi scritti per esteso invece che
  // costruiti a pezzi, altrimenti esce «Nuovo malattia».
  const NOME = {
    [TIPO.LAVORO]: 'turno',
    [TIPO.FERIE]: 'giorno di ferie',
    [TIPO.PERMESSO]: 'permesso',
    [TIPO.MALATTIA]: 'giorno di malattia',
    [TIPO.FESTIVITA]: 'giorno di festività',
  };
  const nomeTipo = NOME[form.kind];
  const titolo = `${isEdit ? 'Modifica' : 'Nuovo'} ${nomeTipo}`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="modal-header">
          <h2 className="modal-title">{titolo}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Giornata</label>
            <div className="break-presets">
              {TIPI.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`break-preset-btn ${form.kind === t ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, kind: t }))}
                >
                  {ICONA[t] && `${ICONA[t]} `}{ETICHETTA[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="shift-date">Data</label>
            <input
              id="shift-date"
              type="date"
              className="form-input"
              value={form.date}
              onChange={set('date')}
              required
            />
          </div>

          {assenzaSelezionata && !isEdit && (
            <div className="form-group">
              <label className="form-label" htmlFor="shift-date-to">
                Fino al <span className="form-label-hint">(vuoto = un giorno solo)</span>
              </label>
              <input
                id="shift-date-to"
                type="date"
                className="form-input"
                min={form.date}
                value={form.dateTo}
                onChange={set('dateTo')}
              />
            </div>
          )}

          {periodoAttivo && (
            <div className="form-group">
              <label className="form-label">Giornate da creare</label>
              {righe.length === 0 ? (
                <p className="form-hint">La data finale precede quella iniziale.</p>
              ) : (
                <>
                  <ul className="periodo-giorni">
                    {righe.map(r => {
                      const d = parseDate(r.data);
                      return (
                        <li key={r.data} className={`periodo-giorno${r.selezionato ? '' : ' periodo-giorno--off'}`}>
                          <label className="periodo-giorno-scelta">
                            <input
                              type="checkbox"
                              checked={r.selezionato}
                              onChange={(e) => cambiaRiga(r.data, { selezionato: e.target.checked })}
                            />
                            <span className="periodo-giorno-data">
                              {formatDayShort(d)} {d.getDate()}
                            </span>
                          </label>
                          <input
                            type="number"
                            className="form-input periodo-giorno-ore"
                            min="0"
                            max="24"
                            step="0.5"
                            aria-label={`Ore del ${d.getDate()}`}
                            disabled={!r.selezionato}
                            value={oreArrotondate(r.minuti / 60)}
                            onChange={(e) => cambiaRiga(r.data, { minuti: Math.round((Number(e.target.value) || 0) * 60) })}
                          />
                          <span className="periodo-giorno-nota">
                            {r.turnoEsistente
                              ? `sostituisce ${r.turnoEsistente.startTime ?? ''}${r.turnoEsistente.startTime ? '–' : ''}${r.turnoEsistente.endTime ?? 'turno'}`
                              : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Il totale è la difesa vera contro l'errore: una settimana di
                      ferie deve valere l'orario settimanale, non uno in più. */}
                  <div className="periodo-totale">
                    <strong>{totale.giorni}</strong> {totale.giorni === 1 ? 'giornata' : 'giornate'}
                    {' · '}<strong>{formatMinutes(totale.minuti)}</strong>
                  </div>

                  <p className="form-hint">
                    {form.kind === TIPO.MALATTIA
                      ? 'La malattia copre giorni consecutivi, riposi compresi: se ne togli uno l\'app vede due eventi separati e ricomincia a contare i giorni iniziali, sbagliando la paga.'
                      : `Sono proposti tutti i giorni, con le ore da contratto. Togli i tuoi riposi: non si consumano come ${ETICHETTA[form.kind].toLowerCase()}, e lasciarli gonfierebbe le ore del mese.`}
                  </p>
                </>
              )}
            </div>
          )}

          {assenzaSelezionata ? (
            !periodoAttivo && (
            <div className="form-group">
              <label className="form-label" htmlFor="absence-hours">Ore contate per questa giornata</label>
              <input
                id="absence-hours"
                type="number"
                className="form-input"
                min="0"
                max="24"
                step="0.5"
                value={form.absenceHours}
                onChange={set('absenceHours')}
                required
              />
              <p className="form-hint">
                Proposte dal contratto ({String(oreArrotondate(minutiGiornoAssenza(settings) / 60)).replace('.', ',')} h
                al giorno). Se il tuo cedolino ne conta altre, cambiale qui o in Impostazioni.
              </p>
            </div>
            )
          ) : (
          <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="shift-start">Inizio</label>
              <input
                id="shift-start"
                type="time"
                className="form-input"
                value={form.startTime}
                onChange={set('startTime')}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="shift-end">Fine</label>
              <input
                id="shift-end"
                type="time"
                className="form-input"
                value={form.endTime}
                onChange={set('endTime')}
                required
              />
            </div>
          </div>

          {/* Preview ore lavorate */}
          <div className="worked-preview">
            <span className="worked-preview-label">Ore lavorate:</span>
            <span className="worked-preview-value">{formatMinutes(workedMins)}</span>
            {minutesDiff(form.startTime, form.endTime) > 12 * 60 && (
              <span className="worked-preview-note">(turno notturno)</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Pausa</label>
            <div className="break-presets">
              {BREAK_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`break-preset-btn ${!customBreak && form.breakMinutes === p.value ? 'active' : ''}`}
                  onClick={() => handleBreakPreset(p.value)}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className={`break-preset-btn ${customBreak ? 'active' : ''}`}
                onClick={() => setCustomBreak(true)}
              >
                Altra
              </button>
            </div>
            {customBreak && (
              <div className="form-row form-row--compact">
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="480"
                  step="5"
                  placeholder="Minuti di pausa"
                  value={form.breakMinutes}
                  onChange={(e) => setForm(f => ({ ...f, breakMinutes: Number(e.target.value) }))}
                />
              </div>
            )}
          </div>

          </>
          )}

          <details className="form-advanced" open={apriAvanzate}>
            <summary className="form-advanced-title">
              Altro — {assenzaSelezionata ? 'note' : 'maggiorazione e note'}
            </summary>

            {!assenzaSelezionata && (
              <div className="form-group">
                <label className="form-label">Maggiorazione (%)</label>
                <div className="break-presets">
                  {SURCHARGE_PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      className={`break-preset-btn ${!customSurcharge && Number(form.surchargePct) === p.value ? 'active' : ''}`}
                      onClick={() => handleSurchargePreset(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`break-preset-btn ${customSurcharge ? 'active' : ''}`}
                    onClick={() => setCustomSurcharge(true)}
                  >
                    Altra
                  </button>
                </div>
                {customSurcharge && (
                  <div className="form-row form-row--compact">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="200"
                      step="0.5"
                      placeholder="% maggiorazione"
                      value={form.surchargePct}
                      onChange={(e) => setForm(f => ({ ...f, surchargePct: e.target.value }))}
                    />
                  </div>
                )}
                <p className="form-hint">
                  La maggiorazione domenicale e festiva delle Impostazioni si applica
                  da sé e si somma a questa.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="shift-note">Note (opzionale)</label>
              <input
                id="shift-note"
                type="text"
                className="form-input"
                placeholder="es. straordinario, sostituzione..."
                value={form.note}
                onChange={set('note')}
                maxLength={100}
              />
            </div>
          </details>

          {maggMancante && (
            <div className="magg-avviso">
              <strong>{maggMancante.titolo}</strong>
              <p>{maggMancante.costo}</p>
              <div className="magg-avviso-riga">
                <div className="input-with-symbol">
                  <input
                    className="form-input form-input--with-symbol"
                    type="text"
                    inputMode="decimal"
                    value={pctMagg}
                    onChange={(e) => setPctMagg(e.target.value)}
                    placeholder={String(maggMancante.tipico)}
                    aria-label="Percentuale di maggiorazione"
                  />
                  <span className="input-symbol">%</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={impostaMagg}>
                  Imposta
                </button>
              </div>
              <button type="button" className="linklike" onClick={nonNeHo}>
                Non ne ho — non chiedermelo più
              </button>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? 'Salva modifiche' : `Aggiungi ${nomeTipo}`}
            </button>
          </div>

          {isEdit && onDelete && (
            <button
              type="button"
              className="btn btn-danger-ghost btn--full"
              onClick={() => onDelete(modal.shift.id)}
            >
              🗑 Elimina {nomeTipo}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
