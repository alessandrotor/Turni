// L'aggiornamento dell'app: scaricato quando torni, applicato quando la metti via.
//
//   torni sull'app  → controlla se c'è una versione nuova, e la scarica
//   la metti via    → dopo un minuto in secondo piano, entra in servizio
//   torni di nuovo  → è già pronta
//
// Mai se c'è del lavoro in sospeso (utils/occupato.js), e mai prima di un minuto.
// La REGOLA di quando fare cosa è in utils/aggiornamento.js (pura, riscontrabile da
// Node); qui ci sono solo gli ascolti e l'obbedienza.
//
// È un modulo e non un hook perché la registrazione deve avvenire una volta sola per
// pagina, fuori dal ciclo di vita di React (in StrictMode gli effetti girano due volte).
// `virtual:pwa-register` esiste solo nella build di Vite: l'import è dinamico e in un
// try, così il file resta importabile dove quel modulo non c'è.

import { decidiAggiornamento, ATTESA_SECONDO_PIANO } from '../utils/aggiornamento';
import { eOccupato } from '../utils/occupato';

let applica = null;        // updateSW(reloadPage) fornita da registerSW
let registrazione = null;  // ServiceWorkerRegistration, per chiedere `update()`
let pronto = false;
let nascostaDa = 0;        // timestamp di quando è passata in secondo piano
let ultimoControllo = 0;   // 0 = mai: il primo rientro controlla sempre
let timer = null;
const ascoltatori = new Set();
// Chi vuole salvare qualcosa un istante prima che la pagina se ne vada.
const primaDelRicarico = new Set();

function avvisa() {
  for (const fn of ascoltatori) {
    try { fn(pronto); } catch { /* un ascoltatore rotto non deve fermare gli altri */ }
  }
}

// Lo stato che la regola vuole, letto dal browser nel momento in cui serve.
function statoOra() {
  const visibile = typeof document === 'undefined' || document.visibilityState === 'visible';
  return {
    pronto,
    occupato: eOccupato(),
    visibile,
    msNascosta: visibile || !nascostaDa ? 0 : Date.now() - nascostaDa,
    msDallUltimoControllo: ultimoControllo ? Date.now() - ultimoControllo : Number.POSITIVE_INFINITY,
  };
}

function agisci() {
  const { azione } = decidiAggiornamento(statoOra());
  if (azione === 'applica') {
    // Il ricaricamento qui non lo vede nessuno: l'app è in secondo piano da un
    // minuto e non ha niente in sospeso. Al ritorno la versione nuova c'è già.
    applicaAggiornamento();
  } else if (azione === 'controlla' && registrazione) {
    ultimoControllo = Date.now();
    // Se la rete non c'è, `update()` fallisce e basta: si riproverà al rientro
    // successivo. Non c'è niente da dire all'utente.
    registrazione.update().catch(() => {});
  }
}

function annullaTimer() {
  if (timer) { clearTimeout(timer); timer = null; }
}

// Un solo ascoltatore, e l'ordine conta. Al RIENTRO si decide PRIMA di azzerare
// `nascostaDa`: è l'unica cosa che dice da quanto l'app è stata via (il telefono può
// aver congelato la pagina prima del timer). USCENDO si arma un solo timer.
function alCambioVisibilita() {
  annullaTimer();
  if (document.visibilityState === 'visible') {
    agisci();
    nascostaDa = 0;
    return;
  }
  nascostaDa = Date.now();
  timer = setTimeout(() => { timer = null; agisci(); }, ATTESA_SECONDO_PIANO + 250);
}

/**
 * Registra il service worker e mette in ascolto. Da chiamare una volta sola.
 */
export function avviaAggiornamenti() {
  if (applica) return; // già registrato
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      applica = registerSW({
        immediate: true,
        // Scatta quando la versione nuova è scaricata e pronta, ferma in
        // attesa. Da qui in poi decide il momento, non l'urgenza.
        onNeedRefresh() {
          pronto = true;
          avvisa();
          // Può arrivare mentre l'app è già in secondo piano (si è messo via il
          // telefono durante il download): in quel caso il momento buono è
          // adesso, e nessun evento di visibilità verrebbe più a dirlo.
          agisci();
        },
        onRegisteredSW(_url, reg) {
          registrazione = reg;
          ultimoControllo = Date.now(); // registrarsi È un controllo
        },
      });
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', alCambioVisibilita);
      }
    })
    .catch(() => { /* niente service worker: l'app funziona lo stesso */ });
}

/**
 * Registra una funzione da eseguire un istante PRIMA del ricaricamento.
 *
 * Serve a rendere invisibile l'aggiornamento in secondo piano: App ci mette da parte la
 * schermata aperta e il mese guardato, e al ritorno li rimette.
 */
/** @returns {() => void} */
export function primaDiRicaricare(fn) {
  primaDelRicarico.add(fn);
  return () => primaDelRicarico.delete(fn);
}

/** Iscrive una funzione allo stato «c'è una versione pronta». Restituisce la disiscrizione. */
/** @returns {() => void} */
export function iscrivitiAggiornamenti(fn) {
  ascoltatori.add(fn);
  // Se la versione era già pronta prima dell'iscrizione, lo si sa subito:
  // senza questo, chi si iscrive tardi non lo scoprirebbe mai.
  if (pronto) fn(true);
  return () => ascoltatori.delete(fn);
}

/**
 * Mette in servizio la versione in attesa e ricarica.
 *
 * Il ricaricamento è voluto: l'ha chiesto l'utente o l'app è in secondo piano senza
 * niente in sospeso. Senza `true` il service worker nuovo prenderebbe il posto del
 * vecchio mentre la pagina gira col codice di prima: due versioni insieme.
 */
export function applicaAggiornamento() {
  if (!applica) return;
  for (const fn of primaDelRicarico) {
    try { fn(); } catch { /* un salvataggio fallito non deve impedire l'aggiornamento */ }
  }
  applica(true);
}
