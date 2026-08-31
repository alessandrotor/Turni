import { useState, useRef } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import { parseNum } from '../utils/pay';
import { datiMinimiMancanti } from '../utils/configurazione';

// I due dati senza cui non ha senso segnare un turno, chiesti quando si prova a
// segnarne uno.
//
// PERCHÉ QUI E NON ALL'APERTURA
// Un questionario davanti a un'app vuota chiede il contratto a chi non ha
// ancora capito cosa ci farà, e si risponde a caso o si preme «dopo». Al primo
// salvataggio invece l'utente ha già visto a cosa serve l'app e sta chiedendo
// un numero: è il momento in cui due campi si accettano senza fatica.
//
// PERCHÉ SOLO DUE, E PERCHÉ BLOCCANO
// Sono gli unici due che non si possono rimandare senza conseguenze:
//
//  · la PAGA: senza, `calcTotalPay` non ritorna un importo sbagliato — non
//    ritorna niente. L'app non avrebbe nessun numero da mostrare.
//  · le ORE: reggono la soglia degli straordinari e quanto vale una giornata di
//    ferie. La seconda è l'unica cosa che NON si recupera dopo, perché la durata
//    di un'assenza viene scritta dentro il giorno quando lo si crea.
//
// Il CONTRATTO non sta qui di proposito, benché pesi più di entrambi: si chiede
// al primo importo in euro, dove c'è un numero da qualificare, e si può
// rimandare perché è retroattivo — sceglierlo al terzo mese ricalcola anche il
// primo.

export default function DatiMinimi({ settings, onSalva, onAnnulla }) {
  const dialogRef = useRef(null);
  useModalDismiss(dialogRef, onAnnulla);

  const manca = datiMinimiMancanti(settings);
  const chiedePaga = manca.includes('hourlyRate');
  const chiedeOre = manca.includes('expectedWeeklyHours');

  const [paga, setPaga] = useState('');
  const [ore, setOre] = useState('');
  const [onCall, setOnCall] = useState(!!settings.onCall);
  const [errore, setErrore] = useState(null);

  const pagaNum = parseNum(paga);
  const oreNum = parseNum(ore);
  const settimanale = pagaNum > 0 && oreNum > 0 ? pagaNum * oreNum : null;

  const invia = (e) => {
    e.preventDefault();

    // Validazione esplicita, non affidata agli attributi HTML: un `<input>`
    // invalido può annullare la submit SENZA mostrare niente, e chi guarda
    // conclude che il pulsante è rotto (COSE-NUOVE.md §D1).
    if (chiedePaga && pagaNum <= 0) {
      setErrore('Scrivi quanto prendi all\'ora: senza non posso contare niente.');
      return;
    }
    if (chiedeOre && !onCall && oreNum <= 0) {
      // Lo zero va rifiutato a voce alta: salvato in silenzio diventa una
      // soglia a zero, e da lì ogni ora lavorata risulta supplementare
      // (COSE-NUOVE.md §D2).
      setErrore('Scrivi quante ore fai a settimana da contratto, oppure segna che lavori a chiamata.');
      return;
    }

    const patch = {};
    if (chiedePaga) patch.hourlyRate = pagaNum;
    if (chiedeOre) {
      patch.onCall = onCall;
      if (!onCall) patch.expectedWeeklyHours = oreNum;
    }
    onSalva(patch);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dm-titolo" ref={dialogRef}>
        <div className="modal-header">
          <h2 className="modal-title" id="dm-titolo">Ancora due cose</h2>
        </div>

        <form className="modal-form" onSubmit={invia} noValidate>
          <p className="modal-desc">
            Prima di segnare il tuo primo turno mi servono questi, altrimenti non ho
            niente con cui contare.
          </p>

          {chiedePaga && (
            <div className="form-group">
              <label className="form-label" htmlFor="dm-paga">Quanto prendi all'ora?</label>
              <div className="input-with-symbol">
                <input
                  id="dm-paga"
                  className="form-input form-input--with-symbol"
                  type="text"
                  inputMode="decimal"
                  value={paga}
                  onChange={(e) => { setPaga(e.target.value); setErrore(null); }}
                  placeholder="9,50"
                  autoFocus
                />
                <span className="input-symbol">€/ora</span>
              </div>
              <p className="form-hint">
                La trovi in busta paga. Se non è precisa la cambi quando vuoi: i turni
                già segnati si aggiornano da soli.
              </p>
            </div>
          )}

          {chiedeOre && (
            <div className="form-group">
              <label className="check-row" htmlFor="dm-oncall">
                <input
                  id="dm-oncall"
                  type="checkbox"
                  checked={onCall}
                  onChange={(e) => { setOnCall(e.target.checked); setErrore(null); }}
                />
                <span>Lavoro a chiamata, senza ore fisse</span>
              </label>

              {!onCall && (
                <>
                  <label className="form-label" htmlFor="dm-ore">Quante ore fai a settimana?</label>
                  <div className="input-with-symbol">
                    <input
                      id="dm-ore"
                      className="form-input form-input--with-symbol"
                      type="text"
                      inputMode="decimal"
                      value={ore}
                      onChange={(e) => { setOre(e.target.value); setErrore(null); }}
                      placeholder="24"
                      autoFocus={!chiedePaga}
                    />
                    <span className="input-symbol">ore</span>
                  </div>
                  <p className="form-hint">
                    Quelle del contratto, non quelle che capita di fare. Servono per sapere
                    quando scattano le ore in più e quanto vale una giornata di ferie.
                  </p>
                </>
              )}
            </div>
          )}

          {settimanale != null && !onCall && (
            <div className="pay-preview">
              <div className="pay-preview-row">
                <span>In una settimana piena</span>
                <strong>{settimanale.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</strong>
              </div>
              <p className="pay-preview-note">Lordo, prima di maggiorazioni e trattenute.</p>
            </div>
          )}

          {errore && <p className="ai-error" role="alert">{errore}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onAnnulla}>
              Annulla il turno
            </button>
            <button type="submit" className="btn btn-primary">Salva e continua</button>
          </div>
        </form>
      </div>
    </div>
  );
}
