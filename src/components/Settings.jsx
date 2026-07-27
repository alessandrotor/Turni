import { useState } from 'react';
import { formatCurrency, parseNum } from '../utils/pay';
import { ENABLE_NET_CALC } from '../config/features';

// Mostra un numero salvato come stringa con la virgola (vuoto se 0/assente).
const toInput = (n) => {
  if (n === '' || n == null) return '';
  const num = Number(n);
  if (!num) return '';
  return String(num).replace('.', ',');
};

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export default function Settings({ settings, onSave }) {
  const [form, setForm] = useState({
    hourlyRate: toInput(settings.hourlyRate),
    expectedWeeklyHours: settings.expectedWeeklyHours ?? 40,
    sundaySurchargePct: settings.sundaySurchargePct ?? 0,
    overtimeSurchargePct: settings.overtimeSurchargePct ?? 0,
    priorTaxableIncome: toInput(settings.priorTaxableIncome),
    workerName: settings.workerName ?? '',
    onCall: !!settings.onCall,
    annualGrossManual: toInput(settings.annualGrossManual),
    dailyOvertimeThreshold: settings.dailyOvertimeThreshold ?? '',
    hasTredicesima: !!settings.hasTredicesima,
    hasQuattordicesima: !!settings.hasQuattordicesima,
    tfrInBusta: !!settings.tfrInBusta,
    previousRates: (Array.isArray(settings.previousRates) ? settings.previousRates : []).map(c => ({
      id: c.id ?? genId(),
      until: c.until ?? '',
      rate: toInput(c.rate),
    })),
    addRegionalePct: toInput(settings.addRegionalePct),
    addComunalePct: toInput(settings.addComunalePct),
  });
  const [saved, setSaved] = useState(false);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSaved(false);
  };

  const setCheck = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.checked }));
    setSaved(false);
  };

  const addPreviousRate = () => {
    setForm(f => ({ ...f, previousRates: [...f.previousRates, { id: genId(), until: '', rate: '' }] }));
    setSaved(false);
  };

  const updatePreviousRate = (id, field) => (e) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      previousRates: f.previousRates.map(c => (c.id === id ? { ...c, [field]: value } : c)),
    }));
    setSaved(false);
  };

  const removePreviousRate = (id) => {
    setForm(f => ({ ...f, previousRates: f.previousRates.filter(c => c.id !== id) }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const previousRates = form.previousRates
      .filter(c => c.until && parseNum(c.rate) > 0)
      .map(c => ({ id: c.id, until: c.until, rate: parseNum(c.rate) }))
      .sort((a, b) => a.until.localeCompare(b.until));

    onSave({
      hourlyRate: parseNum(form.hourlyRate),
      expectedWeeklyHours: parseNum(form.expectedWeeklyHours),
      sundaySurchargePct: parseNum(form.sundaySurchargePct),
      overtimeSurchargePct: parseNum(form.overtimeSurchargePct),
      priorTaxableIncome: parseNum(form.priorTaxableIncome),
      workerName: form.workerName.trim(),
      onCall: form.onCall,
      annualGrossManual: parseNum(form.annualGrossManual),
      dailyOvertimeThreshold: parseNum(form.dailyOvertimeThreshold),
      hasTredicesima: form.hasTredicesima,
      hasQuattordicesima: form.hasQuattordicesima,
      tfrInBusta: form.tfrInBusta,
      previousRates,
      addRegionalePct: parseNum(form.addRegionalePct),
      addComunalePct: parseNum(form.addComunalePct),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hourlyRate = parseNum(form.hourlyRate);
  const weeklyHours = parseNum(form.expectedWeeklyHours);
  const weeklyPay = hourlyRate * weeklyHours;
  const monthlyPay = weeklyPay * 4.33;

  return (
    <div className="settings-page">
      <h1 className="page-title">Impostazioni</h1>

      <form onSubmit={handleSubmit} className="settings-form">

        {/* Paga oraria attuale */}
        <section className="settings-section">
          <h2 className="settings-section-title">💰 Paga oraria</h2>
          <p className="settings-section-desc">
            Inserisci la tua paga oraria lorda <strong>attuale</strong>. È quella usata per i
            turni di oggi e futuri. Se durante l'anno hai avuto un aumento, registra le paghe
            precedenti nella sezione qui sotto. Puoi usare la virgola per i decimali (es. 9,3542).
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="hourly-rate">Paga oraria attuale (€/ora)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="hourly-rate"
                type="text"
                inputMode="decimal"
                className="form-input form-input--with-symbol"
                placeholder="0,00"
                value={form.hourlyRate}
                onChange={set('hourlyRate')}
              />
            </div>
          </div>

          {hourlyRate > 0 && (
            <div className="pay-preview">
              <div className="pay-preview-row">
                <span>Per {weeklyHours}h/settimana:</span>
                <strong>{formatCurrency(weeklyPay)}</strong>
              </div>
              <div className="pay-preview-row">
                <span>Stima mensile (×4,33):</span>
                <strong>{formatCurrency(monthlyPay)}</strong>
              </div>
              <p className="pay-preview-note">
                * Importi lordi stimati. Non include straordinari, indennità, detrazioni fiscali o contributi.
              </p>
            </div>
          )}
        </section>

        {/* Paghe precedenti (aumenti) */}
        <section className="settings-section">
          <h2 className="settings-section-title">🔄 Paghe precedenti (aumenti)</h2>
          <p className="settings-section-desc">
            Hai avuto un aumento durante l'anno? Elenca qui le paghe che avevi <strong>prima</strong>,
            indicando fino a quale giorno erano in vigore. I turni <strong>fino a</strong> quella data
            useranno la paga indicata; tutti gli altri usano la paga attuale qui sopra.
          </p>

          {form.previousRates.length > 0 && (
            <div className="rate-changes">
              {form.previousRates.map(c => (
                <div key={c.id} className="rate-change-row">
                  <div className="rate-change-fields">
                    <div className="form-group">
                      <label className="form-label form-label--sm">Fino al giorno</label>
                      <input
                        type="date"
                        className="form-input"
                        value={c.until}
                        onChange={updatePreviousRate(c.id, 'until')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label form-label--sm">Paga di allora (€/ora)</label>
                      <div className="input-with-symbol">
                        <span className="input-symbol">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input form-input--with-symbol"
                          placeholder="0,00"
                          value={c.rate}
                          onChange={updatePreviousRate(c.id, 'rate')}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rate-change-remove"
                    onClick={() => removePreviousRate(c.id)}
                    aria-label="Rimuovi paga precedente"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-secondary btn--full" onClick={addPreviousRate}>
            + Aggiungi paga precedente
          </button>
        </section>

        {/* Ore previste / lavoro a chiamata */}
        <section className="settings-section">
          <h2 className="settings-section-title">📋 Orario di lavoro</h2>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.onCall}
              onChange={setCheck('onCall')}
            />
            <span>Lavoratore a chiamata (senza ore settimanali fisse)</span>
          </label>

          {!form.onCall ? (
            <>
              <p className="settings-section-desc">
                Quante ore dovresti lavorare ogni settimana secondo il tuo contratto.
                Le ore oltre questa soglia vengono conteggiate come straordinari.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="expected-hours">Ore settimanali</label>
                <input
                  id="expected-hours"
                  type="number"
                  className="form-input"
                  min="0"
                  max="84"
                  step="0.5"
                  value={form.expectedWeeklyHours || ''}
                  onChange={set('expectedWeeklyHours')}
                />
              </div>
            </>
          ) : (
            <>
              <p className="settings-section-desc">
                Senza ore fisse, lo straordinario e il reddito annuo vanno impostati a mano.
                Lo straordinario scatta per le ore che superano la soglia <strong>giornaliera</strong>.
                Il reddito annuo serve solo a stimare l'aliquota fiscale; se lo lasci vuoto viene
                stimato annualizzando i turni che hai inserito.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="daily-ot">Soglia straordinario giornaliera (ore)</label>
                <input
                  id="daily-ot"
                  type="number"
                  className="form-input"
                  min="0"
                  max="24"
                  step="0.5"
                  placeholder="es. 8"
                  value={form.dailyOvertimeThreshold || ''}
                  onChange={set('dailyOvertimeThreshold')}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="annual-manual">Reddito annuo lordo stimato (opzionale)</label>
                <div className="input-with-symbol">
                  <span className="input-symbol">€</span>
                  <input
                    id="annual-manual"
                    type="text"
                    inputMode="decimal"
                    className="form-input form-input--with-symbol"
                    placeholder="es. 14000"
                    value={form.annualGrossManual}
                    onChange={set('annualGrossManual')}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Maggiorazioni */}
        <section className="settings-section">
          <h2 className="settings-section-title">📈 Maggiorazioni</h2>
          <p className="settings-section-desc">
            La maggiorazione domenicale viene applicata automaticamente ai turni di domenica.
            La maggiorazione straordinari si applica automaticamente alle ore oltre la soglia
            {form.onCall ? ' giornaliera' : ' settimanale da contratto'}. Per altre maggiorazioni
            (festivi, notturni) puoi indicare una percentuale manuale sul singolo turno.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="sunday-surcharge">Maggiorazione domenicale (%)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                id="sunday-surcharge"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="200"
                step="0.5"
                placeholder="es. 30"
                value={form.sundaySurchargePct || ''}
                onChange={set('sundaySurchargePct')}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="overtime-surcharge">
              Maggiorazione straordinari (%)
            </label>
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                id="overtime-surcharge"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="200"
                step="0.5"
                placeholder="es. 15"
                value={form.overtimeSurchargePct || ''}
                onChange={set('overtimeSurchargePct')}
              />
            </div>
            <p className="form-hint">
              {form.onCall
                ? `Applicata alle ore oltre le ${parseNum(form.dailyOvertimeThreshold) || 0}h giornaliere.`
                : `Applicata alle ore oltre le ${weeklyHours || 0}h settimanali da contratto.`}
            </p>
          </div>
        </section>

        {/* Reddito e bonus Renzi */}
        <section className="settings-section">
          <h2 className="settings-section-title">💶 Reddito e bonus Renzi</h2>
          <p className="settings-section-desc">
            Nel calendario vedi il tuo <strong>reddito totale</strong> dell'anno (calcolato dai
            turni) e quanto puoi ancora guadagnare prima di superare le soglie del trattamento
            integrativo (ex bonus Renzi), che nel 2026 si calcola proprio sul reddito complessivo.
            Se hai iniziato a inserire i turni a metà anno, indica qui il reddito lordo già
            maturato prima, così il totale resta corretto.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="prior-income">Reddito lordo già maturato da inizio anno</label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="prior-income"
                type="text"
                inputMode="decimal"
                className="form-input form-input--with-symbol"
                placeholder="0,00"
                value={form.priorTaxableIncome}
                onChange={set('priorTaxableIncome')}
              />
            </div>
          </div>
        </section>

        {/* Tredicesima e quattordicesima */}
        <section className="settings-section">
          <h2 className="settings-section-title">🎁 Tredicesima e quattordicesima</h2>
          <p className="settings-section-desc">
            Attiva le mensilità aggiuntive previste dal tuo CCNL. La <strong>tredicesima</strong>
            arriva a dicembre, la <strong>quattordicesima</strong> a giugno; ciascuna vale circa una
            mensilità (ore settimanali × paga oraria). Vengono incluse nel reddito annuo (quindi
            nell'aliquota fiscale) e mostrate nel mese in cui arrivano.
          </p>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.hasTredicesima}
              onChange={setCheck('hasTredicesima')}
            />
            <span>Tredicesima (dicembre)</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.hasQuattordicesima}
              onChange={setCheck('hasQuattordicesima')}
            />
            <span>Quattordicesima (giugno)</span>
          </label>
        </section>

        {/* TFR in busta */}
        <section className="settings-section">
          <h2 className="settings-section-title">💼 TFR in busta (anticipo)</h2>
          <p className="settings-section-desc">
            Se hai scelto di ricevere il TFR mensilmente in busta invece di accantonarlo,
            attiva questa opzione. Viene aggiunta al netto una quota di circa il
            <strong> 6,91%</strong> del lordo (1/13,5 meno lo 0,50% del Fondo di garanzia).
            Il TFR ha tassazione separata: è una stima indicativa.
          </p>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.tfrInBusta}
              onChange={setCheck('tfrInBusta')}
            />
            <span>Aggiungi la quota TFR in busta (anticipo sul netto)</span>
          </label>
        </section>

        {/* Addizionali IRPEF — beta netto (gated dal feature flag) */}
        {ENABLE_NET_CALC && (
          <section className="settings-section settings-section--beta">
            <h2 className="settings-section-title">🧪 Addizionali IRPEF (beta)</h2>
            <p className="settings-section-desc">
              Usate per la stima del netto. Variano in base alla tua residenza:
              l'addizionale regionale va da ~1,23% a ~3,33%, la comunale da 0% a ~0,9%.
              Imposta le aliquote del tuo Comune/Regione per una stima più precisa.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="add-reg">Addizionale regionale (%)</label>
                <div className="input-with-symbol">
                  <span className="input-symbol">%</span>
                  <input
                    id="add-reg"
                    type="text"
                    inputMode="decimal"
                    className="form-input form-input--with-symbol"
                    placeholder="1,23"
                    value={form.addRegionalePct}
                    onChange={set('addRegionalePct')}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-com">Addizionale comunale (%)</label>
                <div className="input-with-symbol">
                  <span className="input-symbol">%</span>
                  <input
                    id="add-com"
                    type="text"
                    inputMode="decimal"
                    className="form-input form-input--with-symbol"
                    placeholder="0,00"
                    value={form.addComunalePct}
                    onChange={set('addComunalePct')}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Import turni da foto (AI) */}
        <section className="settings-section">
          <h2 className="settings-section-title">🤖 Import turni da foto</h2>
          <p className="settings-section-desc">
            Quando importi i turni da una foto, il foglio può contenere più persone.
            Indica il tuo nome così l'AI estrae <strong>solo i tuoi</strong> turni. Lascia
            vuoto per importare tutti i turni presenti nell'immagine.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="worker-name">Il tuo nome sul foglio turni</label>
            <input
              id="worker-name"
              type="text"
              className="form-input"
              placeholder="Es. Mario Rossi"
              value={form.workerName}
              onChange={set('workerName')}
            />
          </div>
        </section>

        {/* CCNL - placeholder futuro */}
        <section className="settings-section settings-section--future">
          <h2 className="settings-section-title">📜 CCNL (prossimamente)</h2>
          <p className="settings-section-desc">
            In futuro sarà possibile selezionare il Contratto Collettivo Nazionale di Lavoro
            per calcolare automaticamente la paga con le relative indennità (notturno, festivo, straordinario).
          </p>
          <div className="form-group">
            <label className="form-label">Contratto</label>
            <select className="form-input" disabled>
              <option>— Non disponibile —</option>
            </select>
          </div>
        </section>

        <div className="settings-footer">
          <button type="submit" className="btn btn-primary btn--full">
            {saved ? '✓ Salvato!' : 'Salva impostazioni'}
          </button>
        </div>
      </form>
    </div>
  );
}
