// Quando chiedere di aggiungere Turni alla schermata Home, e chi parla in alto.
//
// Su iOS non è una comodità: Safari cancella tutto lo storage di un sito (i turni compresi)
// dopo sette giorni di uso del browser senza aprirlo («7-Day Cap» di WebKit); le web app
// aggiunte alla Home ne sono esenti. L'avviso compare quando c'è almeno un turno da
// proteggere, non all'apertura, e dice il perché vero.
//
// Modulo puro, senza React e senza browser: `node scripts/check-installazione.mjs`.

// Il «no» all'avviso iOS. Fuori dal backup: dice qualcosa del DISPOSITIVO, non dei dati.
export const KEY_INSTALLA_IOS_RIFIUTATO = 'turni_install_ios_rifiutato';

/**
 * Il browser può cancellare i dati da solo? Vero solo per iOS fuori dalla Home.
 *
 * @param {object} ambiente
 * @param {boolean} ambiente.ios iPhone o iPad, qualunque browser (su iOS sono tutti WebKit)
 * @param {boolean} ambiente.standalone già aperta dalla schermata Home
 */
export function datiARischio({ ios = false, standalone = false } = {}) {
  return ios && !standalone;
}

/**
 * Tocca all'avviso iOS «aggiungila alla Home»?
 *
 * @param {object} stato
 * @param {number} stato.turni quanti turni ci sono: senza, non c'è niente da perdere
 * @param {boolean} stato.rifiutato ha già detto di no a QUESTA domanda
 */
export function chiedereInstallazioneIOS({
  ios = false, standalone = false, turni = 0, rifiutato = false,
} = {}) {
  return datiARischio({ ios, standalone }) && turni > 0 && !rifiutato;
}

/**
 * Chi parla in cima allo schermo.
 *
 * Stessa regola di `avvisi.js`: vince chi non può tornare (i dati cancellati da Safari non
 * tornano, la configurazione sì). Quando parla la striscia in basso, in alto tace chiunque.
 * Ultimo il banner di installazione fuori da iOS, una comodità.
 *
 * @param {object} stato
 * @param {boolean} stato.strisciaInBasso la striscia in fondo sta parlando
 * @param {boolean} stato.installaIOS `chiedereInstallazioneIOS` è vera
 * @param {boolean} stato.promemoria `promemoriaHaDaDire` è vera
 * @returns {'installa'|'promemoria'|'comodita'|null} chi può parlare; il banner
 *   di comodità poi decide da sé se il browser gli dà qualcosa da proporre.
 */
export function chiParlaInAlto({ strisciaInBasso = false, installaIOS = false, promemoria = false } = {}) {
  if (strisciaInBasso) return null;
  if (installaIOS) return 'installa';
  if (promemoria) return 'promemoria';
  return 'comodita';
}
