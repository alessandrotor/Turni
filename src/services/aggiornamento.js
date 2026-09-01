// L'aggiornamento dell'app: scaricato subito, applicato quando dice l'utente.
//
// COSA SUCCEDEVA PRIMA
// Il service worker era in modalità `autoUpdate`: appena trovava una versione
// nuova prendeva il posto di quello vecchio e RICARICAVA LA PAGINA da solo.
// Non subito — prima doveva scaricare 2,3 MB di precache — quindi il
// ricaricamento arrivava qualche secondo dopo l'apertura, cioè quando si stava
// già facendo qualcosa. Chi aveva un modulo turno aperto a metà se lo vedeva
// sparire senza aver chiesto niente.
//
// COSA SUCCEDE ADESSO
// La versione nuova si scarica lo stesso, in silenzio e senza chiedere niente:
// quella parte va bene com'era. Ma resta IN ATTESA invece di entrare in
// servizio. Da lì due strade, e nessuna delle due interrompe:
//   · l'utente preme «Aggiorna» sull'avviso, e allora sì che si ricarica —
//     l'ha deciso lui, e il modulo del turno in quel momento è chiuso;
//   · non fa niente, e la versione nuova parte alla prossima apertura dell'app.
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

let applica = null; // updateSW(reloadPage) fornita da registerSW
let pronto = false;
const ascoltatori = new Set();

function avvisa() {
  for (const fn of ascoltatori) {
    try { fn(pronto); } catch { /* un ascoltatore rotto non deve fermare gli altri */ }
  }
}

/**
 * Registra il service worker. Da chiamare una volta sola, e SOLO sul web:
 * nella WebView dell'APK Capacitor un SW servirebbe asset vecchi dalla cache
 * dopo un aggiornamento del pacchetto.
 */
export function avviaAggiornamenti() {
  if (applica) return; // già registrato
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      applica = registerSW({
        immediate: true,
        // Scatta quando la versione nuova è scaricata e pronta, ferma in
        // attesa. Da qui in poi decide l'utente.
        onNeedRefresh() {
          pronto = true;
          avvisa();
        },
      });
    })
    .catch(() => { /* niente service worker: l'app funziona lo stesso */ });
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
 * Il ricaricamento qui è chiesto, non subito: è il senso del pulsante. Senza
 * `true` il service worker nuovo prenderebbe il posto del vecchio mentre la
 * pagina continua a girare con il codice di prima — due versioni nello stesso
 * momento, che è il modo più silenzioso di rompere le cose.
 */
export function applicaAggiornamento() {
  if (applica) applica(true);
}
