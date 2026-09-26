// Quando chiedere di aggiungere Turni alla schermata Home, e chi parla in alto.
//
// PERCHÉ SU iOS NON È UNA COMODITÀ
// Altrove installare la web app è una comodità: si apre a tutto schermo, anche
// offline. Su iPhone e iPad è l'unica cosa che protegge i dati. Safari cancella
// tutto lo storage di un sito — localStorage compreso, cioè TUTTI i turni —
// dopo sette giorni di uso del browser senza che quel sito venga aperto (il
// «7-Day Cap» di WebKit, dal 2020). Le web app aggiunte alla Home ne sono
// esenti: contano i giorni in cui si usa l'app, non Safari.
//
// Turni tiene i dati solo sul telefono, senza copie altrove. Due settimane di
// ferie senza aprirla in Safari possono bastare a perdere l'anno. E niente lo
// segnala: al ritorno l'app è semplicemente vuota.
//
// QUANDO CHIEDERLO
// Non all'apertura. Il banner di prima compariva su un'app vuota, dando come
// motivo «si apre a tutto schermo»; chi lo chiudeva in quel momento lo
// chiudeva per sempre, prima di avere qualcosa da perdere e senza sapere che
// il motivo vero era un altro. Ora compare quando c'è almeno un turno da
// proteggere, e dice il perché vero — «meglio chiedere di troppo che sbagliare
// in silenzio, ma solo dicendo la verità sul perché».
//
// Modulo puro, senza React e senza browser: `node scripts/check-installazione.mjs`.

// Il «no» all'avviso iOS. Fuori dal backup come le altre chiavi dei banner:
// dice qualcosa del DISPOSITIVO, non dei dati, e ripristinato su un altro
// telefono zittirebbe l'avviso proprio dove non è stato mai visto.
export const KEY_INSTALLA_IOS_RIFIUTATO = 'turni_install_ios_rifiutato';

/**
 * Il browser può cancellare i dati da solo? Vero solo per iOS fuori dalla Home.
 *
 * @param {object} ambiente
 * @param {boolean} ambiente.nativo app Capacitor: lo storage lo garantisce il sistema
 * @param {boolean} ambiente.ios iPhone o iPad, qualunque browser (su iOS sono tutti WebKit)
 * @param {boolean} ambiente.standalone già aperta dalla schermata Home
 */
export function datiARischio({ nativo = false, ios = false, standalone = false } = {}) {
  return !nativo && ios && !standalone;
}

/**
 * Tocca all'avviso iOS «aggiungila alla Home»?
 *
 * @param {object} stato
 * @param {number} stato.turni quanti turni ci sono: senza, non c'è niente da perdere
 * @param {boolean} stato.rifiutato ha già detto di no a QUESTA domanda
 */
export function chiedereInstallazioneIOS({
  nativo = false, ios = false, standalone = false, turni = 0, rifiutato = false,
} = {}) {
  return datiARischio({ nativo, ios, standalone }) && turni > 0 && !rifiutato;
}

/**
 * Chi parla in cima allo schermo.
 *
 * Stessa regola di `avvisi.js` per la striscia in basso: vince chi non può
 * tornare. Dati cancellati da Safari non tornano più; la configurazione che il
 * promemoria suggerisce è retroattiva e può aspettare. E quando parla la
 * striscia in basso, in alto tace chiunque: due avvisi insieme sono un muro.
 *
 * @param {object} stato
 * @param {boolean} stato.strisciaInBasso la striscia in fondo sta parlando
 * @param {boolean} stato.installaIOS `chiedereInstallazioneIOS` è vera
 * @returns {'installa'|'promemoria'|null} chi può parlare; il promemoria poi
 *   decide da sé se ha qualcosa da dire.
 */
export function chiParlaInAlto({ strisciaInBasso = false, installaIOS = false } = {}) {
  if (strisciaInBasso) return null;
  if (installaIOS) return 'installa';
  return 'promemoria';
}
