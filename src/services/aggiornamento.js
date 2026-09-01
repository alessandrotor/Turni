// L'aggiornamento dell'app: scaricato quando torni, applicato quando la metti via.
//
// COSA SUCCEDEVA ALL'INIZIO
// Il service worker era in modalità `autoUpdate`: appena trovava una versione
// nuova prendeva il posto di quello vecchio e RICARICAVA LA PAGINA da solo.
// Non subito — prima doveva scaricare oltre 2 MB di precache — quindi il
// ricaricamento arrivava qualche secondo dopo l'apertura, cioè quando si stava
// già facendo qualcosa. Chi aveva un modulo turno aperto a metà se lo vedeva
// sparire senza aver chiesto niente.
//
// E COSA SUCCEDEVA DOPO AVERLO TOLTO, CHE ERA PEGGIO
// Con `registerType: 'prompt'` la versione nuova non si impone più. Ma da sola
// quella modifica lasciava l'app tenuta aperta a lungo ferma per sempre: non
// controllava (il service worker guarda solo al caricamento della pagina) e non
// applicava (chi chiudeva l'avviso restava sulla versione vecchia).
//
// COME STA ADESSO
// Non c'è un compromesso fra i due fastidi, c'è un momento in cui ricaricare non
// dà fastidio a nessuno: quando l'app non è sotto gli occhi.
//
//   torni sull'app  → controlla se c'è una versione nuova, e la scarica
//   la metti via    → dopo un minuto in secondo piano, entra in servizio
//   torni di nuovo  → è già pronta, e non hai visto niente
//
// Con due paletti: mai se c'è del lavoro in sospeso (utils/occupato.js), e mai
// prima che sia passato un minuto — tornare e trovare la pagina ripartita è
// sgradevole quanto vedersela ricaricare davanti.
//
// La REGOLA di quando fare cosa non è qui: sta in utils/aggiornamento.js, pura,
// così si riscontra da Node invece di provarla a mano in un browser. Qui ci
// sono solo gli ascolti e l'obbedienza.
//
// PERCHÉ UN MODULO E NON UN HOOK
// La registrazione deve avvenire una volta sola per pagina e fuori dal ciclo di
// vita di React (in StrictMode gli effetti girano due volte in sviluppo, e due
// registrazioni sono due controlli e due avvisi). Qui il service worker sta per
// conto suo e React si limita a iscriversi.
//
// `virtual:pwa-register` è un modulo virtuale di Vite: esiste solo dentro la
// build. Per questo l'import è dinamico e in un try — così questo file resta
// importabile anche dove quel modulo non c'è.

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

// Un solo ascoltatore, e l'ordine conta.
//
// Al RIENTRO si decide PRIMA di azzerare `nascostaDa`: quel valore è l'unica
// cosa che dice da quanto l'app è stata via, e serve nel caso in cui il
// telefono avesse congelato la pagina prima che il timer scattasse — quel che
// conta è quanto è stata via, non chi se n'è accorto.
//
// USCENDO si arma un timer solo: se scatta con l'app ancora nascosta, il minuto
// è passato e si può applicare senza che nessuno veda niente.
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
 * Registra il service worker e mette in ascolto. Da chiamare una volta sola, e
 * SOLO sul web: nella WebView dell'APK Capacitor un SW servirebbe asset vecchi
 * dalla cache dopo un aggiornamento del pacchetto.
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
 * Serve a rendere invisibile l'aggiornamento applicato in secondo piano: App ci
 * mette da parte la schermata aperta e il mese che si stava guardando, e al
 * ritorno li rimette. Senza, si tornerebbe sull'app e la si troverebbe
 * ripartita dal calendario del mese corrente — nessun dato perso, ma il segno
 * evidente che è successo qualcosa mentre non si guardava.
 */
export function primaDiRicaricare(fn) {
  primaDelRicarico.add(fn);
  return () => primaDelRicarico.delete(fn);
}

/** Iscrive una funzione allo stato «c'è una versione pronta». Restituisce la disiscrizione. */
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
 * Il ricaricamento qui è voluto: o l'ha chiesto l'utente col pulsante, o l'app
 * è in secondo piano senza niente in sospeso. Senza `true` il service worker
 * nuovo prenderebbe il posto del vecchio mentre la pagina continua a girare con
 * il codice di prima — due versioni nello stesso momento, che è il modo più
 * silenzioso di rompere le cose.
 */
export function applicaAggiornamento() {
  if (!applica) return;
  for (const fn of primaDelRicarico) {
    try { fn(); } catch { /* un salvataggio fallito non deve impedire l'aggiornamento */ }
  }
  applica(true);
}
