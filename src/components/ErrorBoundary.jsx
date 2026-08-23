import { Component } from 'react';
import { esportaBackup, costruisciBackup, contaTurniSalvati } from '../services/backup';

// Rete di sicurezza attorno all'app.
//
// Senza, un'eccezione durante il render smonta TUTTO: React lascia il div
// radice vuoto e chi usa l'app si trova uno schermo bianco, senza messaggi e
// senza vie d'uscita. Non è teorico — basta un turno con un campo inatteso o
// un NaN finito dove serve un numero.
//
// Il punto non è mostrare un messaggio gentile: è che i turni vivono SOLO nel
// localStorage di quel telefono. Se l'app non si apre, mesi di lavoro
// diventano irraggiungibili, e la prima cosa che verrebbe in mente a chiunque
// — disinstallare e reinstallare — li cancella per sempre. Quindi da questa
// schermata si deve poter portare via i propri dati.
//
// Funziona perché `costruisciBackup()` legge direttamente da localStorage e
// non tocca lo stato di React: continua a valere anche quando l'interfaccia è
// morta. È questa la ragione per cui il salvagente regge proprio nel momento
// in cui serve.
//
// ATTENZIONE a cosa NON copre: gli error boundary intercettano gli errori di
// RENDER, non quelli dentro i gestori di eventi né quelli asincroni. Copre il
// caso che porta allo schermo bianco, non tutto.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null, esito: null, testoGrezzo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || null });
    // Resta in console per chi apre gli strumenti di sviluppo. Non si manda a
    // nessuno: l'app non ha telemetria degli errori, e uno stack può contenere
    // dati dei turni.
    console.error('Errore non gestito, app fermata:', error, info);
  }

  scarica = async () => {
    this.setState({ esito: { attesa: true } });
    try {
      const { turni } = await esportaBackup();
      this.setState({ esito: { testo: `Backup scaricato: ${turni} turni al sicuro.` } });
    } catch (err) {
      // Ultimo salvagente. `esportaBackup` passa da `deliver`, che su Android
      // carica i plugin Capacitor con import dinamici: in uno stato già rotto
      // anche quelli possono fallire. Qui si scende al minimo indispensabile —
      // leggere localStorage e trasformarlo in testo — che non dipende da
      // niente e non può rompersi a sua volta.
      try {
        this.setState({
          esito: {
            errore: true,
            testo: 'Il download non è riuscito. Copia il testo qui sotto e incollalo in una nota o in una mail: è il tuo backup completo.',
          },
          testoGrezzo: JSON.stringify(costruisciBackup(), null, 2),
        });
      } catch {
        this.setState({
          esito: { errore: true, testo: `Impossibile leggere i dati salvati: ${err?.message || 'errore sconosciuto'}` },
        });
      }
    }
  };

  copiaDettaglio = async () => {
    const { error, componentStack } = this.state;
    const testo = [error?.message, error?.stack, componentStack].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(testo);
      this.setState({ esito: { testo: 'Dettaglio copiato.' } });
    } catch {
      this.setState({ esito: { errore: true, testo: 'Copia non riuscita: seleziona il testo a mano.' } });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, componentStack, esito, testoGrezzo } = this.state;
    // Anche questo conteggio è protetto: se localStorage è inaccessibile
    // (Safari coi cookie bloccati) non deve far cadere la schermata che
    // esiste apposta per non cadere.
    let turni = null;
    try { turni = contaTurniSalvati(); } catch { turni = null; }

    return (
      <div className="crash">
        <div className="crash-card">
          <h1 className="crash-title">L'app si è fermata</h1>
          <p className="crash-text">
            Qualcosa è andato storto e la schermata non si è potuta caricare.
            {turni != null && turni > 0 && (
              <> <strong>I tuoi {turni} turni sono ancora salvati su questo telefono</strong> e non sono stati toccati.</>
            )}
          </p>
          <p className="crash-text">
            Prima di qualsiasi altra cosa, scarica una copia dei tuoi dati.
            Non disinstallare l'app: cancellerebbe i turni.
          </p>

          <button
            type="button"
            className="btn btn-primary btn--full"
            onClick={this.scarica}
            disabled={esito?.attesa}
          >
            {esito?.attesa ? 'Creo il backup…' : '⬇ Scarica i miei dati'}
          </button>

          {esito?.testo && (
            <p className={`crash-esito${esito.errore ? ' crash-esito--errore' : ''}`}>{esito.testo}</p>
          )}

          {testoGrezzo && (
            <textarea
              className="crash-grezzo"
              readOnly
              value={testoGrezzo}
              onFocus={(e) => e.target.select()}
              aria-label="Backup in formato testo, da copiare"
            />
          )}

          <button
            type="button"
            className="btn btn-secondary btn--full"
            onClick={() => window.location.reload()}
          >
            Ricarica l'app
          </button>

          <details className="crash-dettaglio">
            <summary>Dettaglio tecnico</summary>
            <pre className="crash-stack">
              {[error?.message, error?.stack, componentStack].filter(Boolean).join('\n\n')}
            </pre>
            <button type="button" className="linklike" onClick={this.copiaDettaglio}>
              Copia il dettaglio
            </button>
          </details>
        </div>
      </div>
    );
  }
}
