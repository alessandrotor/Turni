import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { avviaAggiornamenti } from './services/aggiornamento.js';

// L'ErrorBoundary sta FUORI da App e non dentro: deve sopravvivere alla caduta
// di qualunque cosa ci sia sotto, App compresa. Messo più in basso, un errore
// nella radice dell'app porterebbe via anche il salvagente.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Lo storage persistente NON si chiede più qui: la richiesta fa comparire il
// permesso di Firefox al primo avvio, su un'app ancora vuota, prima che si
// capisca cosa si sta autorizzando. Ora la chiede App quando c'è il primo turno
// da proteggere (src/App.jsx).
//
// L'aggiornamento non ricarica più la pagina da solo: si scarica in silenzio e
// aspetta. Il perché, e cosa succedeva prima, stanno in services/aggiornamento.js.
avviaAggiornamenti();
