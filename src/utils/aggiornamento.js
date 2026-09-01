// Quando entra in servizio una versione nuova, e quando andarla a cercare.
//
// IL PROBLEMA CHE QUESTA REGOLA RISOLVE
// Il ricaricamento automatico è stato tolto perché cadeva addosso a chi stava
// usando l'app. Ma tolto e basta, un'app tenuta aperta per giorni non si
// aggiornava più: non controllava (il service worker guarda solo al
// caricamento della pagina) e non applicava (chi chiudeva l'avviso restava
// sulla versione vecchia a tempo indeterminato).
//
// La via d'uscita non è un compromesso fra i due fastidi: è che ESISTE UN
// MOMENTO in cui ricaricare non dà fastidio a nessuno, ed è quando l'app non è
// sotto gli occhi. Si mette via il telefono, si cambia applicazione, si passa a
// un'altra scheda: lì la versione nuova entra, e al ritorno è già pronta.
//
// LE DUE CONDIZIONI, ENTRAMBE NECESSARIE
//  1. l'app non è in primo piano da almeno un minuto. Il minuto serve a non
//     ricaricare quando si sbircia una notifica e si torna subito: tornare e
//     trovare la pagina ripartita è sgradevole quanto vedersela ricaricare
//     davanti.
//  2. non c'è NIENTE IN SOSPESO. Non è una precauzione teorica: un turno può
//     essere in attesa dei dati minimi senza essere ancora salvato, il modulo
//     può essere compilato a metà, le impostazioni possono avere modifiche non
//     salvate, un import da foto può essere in volo. Chi lo sa non è questo
//     modulo: lo dichiarano i componenti (vedi utils/occupato.js).
//
// Il controllo invece si fa al RITORNO in primo piano, non con un timer: un
// timer che gira in sottofondo consuma per accorgersi di qualcosa che cambia
// poche volte al mese. Il ciclo si chiude da sé — si torna sull'app, controlla
// e scarica; si mette via, entra in servizio.
//
// Regola pura di proposito: niente `document`, niente service worker, niente
// timer. Così la si riscontra con Node (`scripts/check-aggiornamento.mjs`)
// invece di doverla provare a mano dieci volte in un browser.

/** Quanto deve restare in secondo piano prima che valga la pena ricaricare. */
export const ATTESA_SECONDO_PIANO = 60_000;

/**
 * Freno al controllo: passare fra due app dieci volte in un minuto non deve
 * fare dieci richieste. La versione nuova può aspettare un quarto d'ora.
 */
export const INTERVALLO_CONTROLLO = 15 * 60_000;

/**
 * Cosa fare adesso.
 *
 * @param {object} stato
 * @param {boolean} stato.pronto           una versione nuova è scaricata e in attesa
 * @param {boolean} stato.occupato         c'è del lavoro in sospeso (vedi utils/occupato.js)
 * @param {boolean} stato.visibile         l'app è in primo piano
 * @param {number}  stato.msNascosta       da quanti ms è in secondo piano (0 se visibile)
 * @param {number}  stato.msDallUltimoControllo  da quanti ms non si controlla
 * @returns {{azione: 'applica'|'controlla'|'niente', perche: string}}
 */
export function decidiAggiornamento({
  pronto = false,
  occupato = false,
  visibile = true,
  msNascosta = 0,
  msDallUltimoControllo = Number.POSITIVE_INFINITY,
} = {}) {
  // Il lavoro in sospeso batte tutto: nessun aggiornamento vale un turno perso.
  // Vale anche in secondo piano — l'app può essere nascosta CON un modulo
  // aperto, ed è anzi il caso tipico di chi viene interrotto a metà.
  if (occupato) return { azione: 'niente', perche: 'c\'è del lavoro in sospeso' };

  // Da mettere in servizio: solo con l'app fuori dagli occhi da abbastanza
  // tempo. Vale anche al RIENTRO, perché il telefono può aver congelato la
  // pagina prima che scadesse l'attesa: quello che conta è quanto è stata via,
  // non chi se n'è accorto.
  if (pronto && msNascosta >= ATTESA_SECONDO_PIANO) {
    return { azione: 'applica', perche: 'versione pronta e app non in uso' };
  }
  if (pronto) return { azione: 'niente', perche: 'versione pronta, ma l\'app è in uso' };

  // Niente da applicare: al massimo si va a vedere se è uscito qualcosa, e solo
  // tornando in primo piano.
  if (!visibile) return { azione: 'niente', perche: 'in secondo piano non si controlla' };
  if (msDallUltimoControllo < INTERVALLO_CONTROLLO) {
    return { azione: 'niente', perche: 'controllato da poco' };
  }
  return { azione: 'controlla', perche: 'rientro in primo piano' };
}
