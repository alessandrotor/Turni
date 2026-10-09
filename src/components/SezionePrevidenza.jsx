// Impostazioni: fondo pensione e cassa sanitaria trattenuti in busta.
//
// Sta in un file a sé perché Settings.jsx è congelato alla sua misura
// (check-dimensioni). Il conto lo fa il motore (utils/previdenza.js): qui si
// leggono e si salvano due numeri, e si dice cosa cambiano.

import { parseNum } from '../utils/pay';
import { TETTO_FONDO_PENSIONE } from '../utils/previdenza';

const comeTesto = (n) => (Number(n) ? String(Number(n)).replace('.', ',') : '');

export const formPrevidenza = (settings) => ({
  fondoPensionePct: comeTesto(settings.fondoPensionePct),
  cassaSanitariaEuro: comeTesto(settings.cassaSanitariaEuro),
  bonusPremioRisultato: !!settings.bonusPremioRisultato,
});

export const salvaPrevidenza = (form) => ({
  fondoPensionePct: parseNum(form.fondoPensionePct),
  cassaSanitariaEuro: parseNum(form.cassaSanitariaEuro),
  bonusPremioRisultato: !!form.bonusPremioRisultato,
});

// Il bonus come premio di risultato (utils/premio-risultato.js): sta qui per
// la stessa ragione della sezione sotto, Settings.jsx non può crescere.
export function PremioRisultato({ form, setCheck }) {
  return (
    <label className="check-row" htmlFor="premio-risultato">
      <input id="premio-risultato" type="checkbox" checked={!!form.bonusPremioRisultato} onChange={setCheck('bonusPremioRisultato')} />
      <span>
        È un <strong>premio di risultato</strong> (tassato all&apos;1% invece che con l&apos;IRPEF). Solo se la
        busta lo scrive così; non ancora riscontrato su una busta.
      </span>
    </label>
  );
}

export default function SezionePrevidenza({ form, set }) {
  return (
    <details className="settings-section">
      <summary className="settings-section-title">🏦 Fondo pensione e cassa sanitaria</summary>
      <p className="settings-section-desc">
        Solo se te li <strong>trattengono in busta</strong>. Escono dal reddito come i contributi
        INPS: paghi meno IRPEF e la tua soglia lorda dei 15.000 € sale. Non metterli fra le
        trattenute fisse, che non toccano le tasse.
      </p>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="fondo-pensione">Fondo pensione, quota tua</label>
          <div className="input-with-symbol">
            <span className="input-symbol">%</span>
            <input
              id="fondo-pensione"
              type="text"
              inputMode="decimal"
              className="form-input form-input--with-symbol"
              placeholder="0"
              value={form.fondoPensionePct}
              onChange={set('fondoPensionePct')}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cassa-sanitaria">Cassa sanitaria, quota tua</label>
          <div className="input-with-symbol">
            <span className="input-symbol">€</span>
            <input
              id="cassa-sanitaria"
              type="text"
              inputMode="decimal"
              className="form-input form-input--with-symbol"
              placeholder="0"
              value={form.cassaSanitariaEuro}
              onChange={set('cassaSanitariaEuro')}
            />
          </div>
        </div>
      </div>
      <p className="form-hint">
        Fondo pensione: la percentuale a tuo carico (la trovi nel modulo di adesione o in busta),
        fino a {TETTO_FONDO_PENSIONE.toLocaleString('it-IT')} € l'anno. Il TFR versato al fondo
        non conta. Cassa sanitaria (es. Fondo Est): la quota al mese.
      </p>
      <p className="form-hint">
        ⚠️ Dalla norma (art. 51 TUIR), <strong>non ancora riscontrato su una busta</strong>.
      </p>
    </details>
  );
}
