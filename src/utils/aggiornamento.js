// Quando entra in servizio una versione nuova, e quando andarla a cercare.
//
// Esiste un momento in cui ricaricare non dà fastidio a nessuno: quando l'app non è sotto
// gli occhi. Si applica solo con DUE condizioni, entrambe necessarie:
//  1. l'app non è in primo piano da almeno un minuto (per non ricaricare quando si sbircia
//     una notifica e si torna subito);
//  2. non c'è NIENTE IN SOSPESO (turno in attesa dei dati minimi, modulo a metà,
//     impostazioni non salvate, import da foto in volo): lo dichiarano i componenti,
//     vedi utils/occupato.js.
//
// Il controllo si fa al RITORNO in primo piano, non con un timer di sottofondo.
//
// Regola pura di proposito (niente `document`, service worker o timer), così la si
// riscontra da Node: `scripts/check-aggiornamento.mjs`.

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
 * @param {boolean} [stato.pronto]          una versione nuova è scaricata e in attesa
 * @param {boolean} [stato.occupato]        c'è del lavoro in sospeso (vedi utils/occupato.js)
 * @param {boolean} [stato.visibile]        l'app è in primo piano
 * @param {number}  [stato.msNascosta]      da quanti ms è in secondo piano (0 se visibile)
 * @param {number}  [stato.msDallUltimoControllo] da quanti ms non si controlla
 * @returns {{azione: 'applica'|'controlla'|'niente', perche: string}}
 */
export function decidiAggiornamento({
  pronto = false,
  occupato = false,
  visibile = true,
  msNascosta = 0,
  msDallUltimoControllo = Number.POSITIVE_INFINITY,
} = {}) {
  // Il lavoro in sospeso batte tutto, anche in secondo piano (l'app può essere nascosta
  // CON un modulo aperto).
  if (occupato) return { azione: 'niente', perche: 'c\'è del lavoro in sospeso' };

  // Da mettere in servizio: solo con l'app fuori dagli occhi da abbastanza tempo. Vale
  // anche al RIENTRO: conta quanto è stata via, non chi se n'è accorto.
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
