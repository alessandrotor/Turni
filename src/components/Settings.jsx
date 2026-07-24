import { useState } from 'react';
import { formatCurrency, parseNum } from '../utils/pay';

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
    priorTaxableIncome: toInput(settings.priorTaxableIncome),
    rateChanges: (Array.isArray(settings.rateChanges) ? settings.rateChanges : []).map(c => ({
      id: c.id ?? genId(),
      date: c.date ?? '',
      rate: toInput(c.rate),
    })),
  });
  const [saved, setSaved] = useState(false);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSaved(false);
  };

  const addRateChange = () => {
    setForm(f => ({ ...f, rateChanges: [...f.rateChanges, { id: genId(), date: '', rate: '' }] }));
    setSaved(false);
  };

  const updateRateChange = (id, field) => (e) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      rateChanges: f.rateChanges.map(c => (c.id === id ? { ...c, [field]: value } : c)),
    }));
    setSaved(false);
  };

  const removeRateChange = (id) => {
    setForm(f => ({ ...f, rateChanges: f.rateChanges.filter(c => c.id !== id) }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rateChanges = form.rateChanges
      .filter(c => c.date && parseNum(c.rate) > 0)
      .map(c => ({ id: c.id, date: c.date, rate: parseNum(c.rate) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    onSave({
      hourlyRate: parseNum(form.hourlyRate),
      expectedWeeklyHours: parseNum(form.expectedWeeklyHours),
      sundaySurchargePct: parseNum(form.sundaySurchargePct),
      priorTaxableIncome: parseNum(form.priorTaxableIncome),
      rateChanges,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hourlyRate = parseNum(form.hourlyRate);
  const weeklyPay = hourlyRate * parseNum(form.expectedWeeklyHours);
  const monthlyPay = weeklyPay * 4.33;

  return (
    <div className="settings-page">
      <h1 className="page-title">Impostazioni</h1>

      <form onSubmit={handleSubmit} className="settings-form">

        {/* Paga */}
        <section className="settings-section">
          <h2 className="settings-section-title">💰 Paga oraria</h2>
          <p className="settings-section-desc">
            Inserisci la tua paga oraria lorda iniziale per calcolare la retribuzione stimata.
            Puoi usare la virgola per i decimali (es. 9,3542).
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="hourly-rate">Paga oraria (€/ora)</label>
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
                <span>Per {parseNum(form.expectedWeeklyHours)}h/settimana:</span>
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

        {/* Aumenti di paga durante l'anno */}
        <section className="settings-section">
          <h2 className="settings-section-title">📈 Aumenti di paga</h2>
          <p className="settings-section-desc">
            Hai avuto un aumento durante l'anno? Aggiungilo qui indicando la data di
            decorrenza e la nuova paga oraria. I turni <strong>prima</strong> di quella data
            mantengono la paga precedente, quelli <strong>dal</strong> giorno indicato usano la
            nuova. La paga qui sopra è quella valida all'inizio.
          </p>

          {form.rateChanges.length > 0 && (
            <div className="rate-changes">
              {form.rateChanges.map(c => (
                <div key={c.id} className="rate-change-row">
                  <div className="rate-change-fields">
                    <div className="form-group">
                      <label className="form-label form-label--sm">Dal giorno</label>
                      <input
                        type="date"
                        className="form-input"
                        value={c.date}
                        onChange={updateRateChange(c.id, 'date')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label form-label--sm">Nuova paga (€/ora)</label>
                      <div className="input-with-symbol">
                        <span className="input-symbol">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input form-input--with-symbol"
                          placeholder="0,00"
                          value={c.rate}
                          onChange={updateRateChange(c.id, 'rate')}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rate-change-remove"
                    onClick={() => removeRateChange(c.id)}
                    aria-label="Rimuovi aumento"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-secondary btn--full" onClick={addRateChange}>
            + Aggiungi aumento
          </button>
        </section>

        {/* Ore previste */}
        <section className="settings-section">
          <h2 className="settings-section-title">📋 Ore settimanali previste</h2>
          <p className="settings-section-desc">
            Quante ore dovresti lavorare ogni settimana secondo il tuo contratto.
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
        </section>

        {/* Maggiorazioni */}
        <section className="settings-section">
          <h2 className="settings-section-title">📈 Maggiorazioni</h2>
          <p className="settings-section-desc">
            La maggiorazione domenicale viene applicata automaticamente ai turni di domenica.
            Per altre maggiorazioni (festivi, notturni, straordinari) puoi indicare una
            percentuale manuale direttamente sul singolo turno.
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
