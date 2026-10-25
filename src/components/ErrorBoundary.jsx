import { Component } from 'react';
import { esportaBackup, costruisciBackup, contaTurniSalvati } from '../services/backup';
import { ESITO } from '../services/export';

// Rete di sicurezza attorno all'app. Senza, un'eccezione durante il render lascia lo schermo bianco,
// e poiché i turni vivono SOLO nel localStorage del telefono, disinstallare e reinstallare li
// cancella per sempre: da questa schermata si devono poter portare via i propri dati.
// Funziona perché `costruisciBackup()` legge direttamente da localStorage senza toccare lo stato di
// React. Non copre gli errori nei gestori di eventi né quelli asincroni, solo quelli di RENDER.
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
    // Resta in console: l'app non ha telemetria, e uno stack può contenere dati dei turni.
    console.error('Errore non gestito, app fermata:', error, info);
  }

  scarica = async () => {
    this.setState({ esito: { attesa: true } });
    try {
      const { turni, esito, testo } = await esportaBackup();

      // «Al sicuro» solo quando lo sappiamo: con la consegna non verificabile si mostra subito il
      // testo da copiare.
      if (esito === ESITO.SALVATO) {
        this.setState({ esito: { testo: `Backup salvato: ${turni} turni al sicuro.` } });
      } else if (esito === ESITO.ANNULLATO) {
        this.setState({ esito: { attenzione: true, testo: 'Backup annullato: non è stato salvato niente. I tuoi dati sono ancora solo qui.' } });
      } else {
        this.setState({
          esito: {
            attenzione: true,
            testo: `Backup di ${turni} turni avviato, ma il browser non conferma di averlo scaricato. Controlla fra i download; se non c'è, copia il testo qui sotto.`,
          },
          testoGrezzo: testo,
        });
      }
    } catch (err) {
      // Ultimo salvagente: `esportaBackup` passa da `deliver`, che in uno stato rotto può fallire.
      // Si scende al minimo (leggere localStorage e farne testo).
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
    // Anche questo conteggio è protetto: se localStorage è inaccessibile non deve far cadere la schermata.
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
            <p
              className={`crash-esito${esito.errore ? ' crash-esito--errore' : ''}${esito.attenzione ? ' crash-esito--attenzione' : ''}`}
              role="status"
            >
              {esito.testo}
            </p>
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
