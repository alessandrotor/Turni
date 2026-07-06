import { useState } from 'react';
import { formatCurrency } from '../utils/pay';

export default function Settings({ settings, onSave }) {
  const [form, setForm] = useState({
    hourlyRate: settings.hourlyRate ?? 0,
    expectedWeeklyHours: settings.expectedWeeklyHours ?? 40,
    sundaySurchargePct: settings.sundaySurchargePct ?? 0,
  });
  const [saved, setSaved] = useState(false);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      hourlyRate: parseFloat(form.hourlyRate) || 0,
      expectedWeeklyHours: parseFloat(form.expectedWeeklyHours) || 0,
      sundaySurchargePct: parseFloat(form.sundaySurchargePct) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hourlyRate = parseFloat(form.hourlyRate) || 0;
  const weeklyPay = hourlyRate * (parseFloat(form.expectedWeeklyHours) || 0);
  const monthlyPay = weeklyPay * 4.33;

  return (
    <div className="settings-page">
      <h1 className="page-title">Impostazioni</h1>

      <form onSubmit={handleSubmit} className="settings-form">

        {/* Paga */}
        <section className="settings-section">
          <h2 className="settings-section-title">💰 Paga oraria</h2>
          <p className="settings-section-desc">
            Inserisci la tua paga oraria lorda per calcolare la retribuzione stimata.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="hourly-rate">Paga oraria (€/ora)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="hourly-rate"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="999"
                step="0.01"
                placeholder="0,00"
                value={form.hourlyRate || ''}
                onChange={set('hourlyRate')}
              />
            </div>
          </div>

          {hourlyRate > 0 && (
            <div className="pay-preview">
              <div className="pay-preview-row">
                <span>Per {form.expectedWeeklyHours}h/settimana:</span>
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
