// Quanto rischi di dover RIDARE INDIETRO del trattamento integrativo.
//
// PERCHÉ ESISTE
// L'app sapeva già dire se il TI spetta ADESSO (`tiDecision` in net.js, con la
// capienza fatta per bene), ma non ha mai detto la cosa che alla gente costa
// davvero: che quei cento euro al mese già incassati possono essere richiesti
// indietro tutti insieme. Fino al 2 settembre 2026 la parola «restituzione» non
// compariva in tutto il repository.
//
// COME FUNZIONA IL MECCANISMO, che è il motivo per cui il difetto è insidioso
// Il datore fa da sostituto d'imposta e paga il TI ogni mese PRESUMENDO che il
// reddito resti quello che sembra a gennaio. Non è una previsione dell'app: è
// come lavora un software paghe. Se a fine anno il reddito è più alto — qualche
// turno in più, una tredicesima, un secondo datore — al conguaglio di dicembre
// (o nel quadro C del 730) quei soldi tornano indietro.
//
// CHI RISCHIA DI PIÙ È ESATTAMENTE CHI USA QUESTA APP: tempo determinato,
// lavoro intermittente, più datori nello stesso anno. Con due datori il difetto
// è quasi garantito, perché ognuno proietta il reddito per conto suo e paga
// credendo di essere l'unico.
//
// COSA L'APP NON PUÒ SAPERE, e che va detto accanto al numero
//  1. **Quanto ti hanno accreditato davvero.** Il cedolino lo scrive, l'app no:
//     qui si assume la quota piena di legge sui giorni trascorsi, cioè il caso
//     peggiore. È una stima al rialzo dichiarata, non un conto.
//  2. **Gli altri datori.** Turni ne vede uno. Chi ne ha avuti due ha un reddito
//     più alto di quello che l'app conosce, quindi il rischio VERO è maggiore di
//     quello calcolato — ed è il caso più esposto. Va scritto lì, non in un
//     disclaimer generico.
//  3. **Le detrazioni che non sono quelle da lavoro.** Nella fascia
//     15.000–28.000 la legge dà il TI solo se la somma delle detrazioni supera
//     l'imposta lorda. L'app conosce la sola detrazione da lavoro dipendente,
//     non i figli a carico né le spese mediche: con quella sola la capienza non
//     c'è MAI in tutta la fascia, quindi il modello dice «non spetta» per
//     chiunque superi i 15.000. Non è un difetto del conto — è la norma letta
//     con i dati che ci sono — ma è una stima al rialzo del rischio, e chi ha
//     altre detrazioni può stare meglio di così. Va detto accanto alla cifra.
//
// In pratica, ed è la risposta alla domanda che la gente si fa davvero:
// **oltre i 15.000 € di reddito complessivo il trattamento integrativo si perde,
// e quello già preso torna indietro.**
//
// IL RIMEDIO, che è la ragione per cui questo modulo serve a qualcosa:
// si può chiedere al datore di NON erogarlo, e prenderlo semmai a conguaglio se
// spetta davvero. Nell'app è `settings.noTrattamentoIntegrativo`, e quando è
// acceso qui non c'è più niente da restituire — per costruzione.
//
// Modulo puro, senza React e senza browser: `node scripts/check-restituzione.mjs`.

import { TAX_2026, tiDecision } from './net.js';

/**
 * Soglia di legge per la rateizzazione: sopra i 60 € il datore non trattiene
 * tutto a dicembre, ma spalma il recupero. Sotto, se lo riprende in una volta
 * sola. Cambia molto come si vive la cosa, quindi si dice.
 */
export const SOGLIA_RATEIZZAZIONE = 60;

export const CAUSA = {
  NESSUNA: 'nessuna',
  RINUNCIATO: 'rinunciato',
  OLTRE_MAX: 'oltre-28k',
  SENZA_CAPIENZA: 'senza-capienza',
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const trunc2 = (n) => Math.trunc(n * 100) / 100;

// La differenza fra due importi già in centesimi si fa SUI CENTESIMI, interi.
// Con `trunc2(a - b)` si perdeva un centesimo per strada: `595.06` è in doppia
// precisione `595.0599999…`, quindi `Math.trunc(595.06 * 100)` fa 59505 e non
// 59506. A schermo si leggeva «erogati 595,06 · da restituire 595,05», con un
// centesimo sparito e nessuna spiegazione — il genere di dettaglio che fa
// dubitare di tutto il resto del conto.
const menoCent = (a, b) => (Math.round(a * 100) - Math.round(b * 100)) / 100;

/**
 * Giorni dell'anno già trascorsi alla data indicata, estremi compresi.
 * È la stessa base dei giorni con cui la busta calcola la quota (÷365).
 */
export function giorniTrascorsi(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return 0;
  const inizio = Date.UTC(d.getFullYear(), 0, 1);
  const oggi = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.min(365, Math.max(0, Math.round((oggi - inizio) / 86400000) + 1));
}

/**
 * Quanto avresti già preso SE il datore ti stesse accreditando la quota piena
 * fin qui — l'ipotesi che serve all'anteprima «sei vicino alla soglia, se la
 * superi restituisci circa X». Un «e se», non un fatto: sotto soglia non dice
 * che quei soldi sono già arrivati, dice quanto varrebbero se lo fossero.
 *
 * Volutamente SEPARATA da `rischioRestituzione`: quella funzione azzera erogato
 * ogni volta che il reddito non supera la soglia, anche quando la ragione è
 * l'incapienza a redditi bassissimi (dove il datore non avrebbe accreditato
 * NULLA, non una quota poi da restituire). Chi chiama questa funzione la usa
 * solo quando `bonus.nearThreshold` è vero, cioè a un soffio dai 15.000 — lì la
 * capienza c'è sempre, quindi l'ipotesi è realistica.
 */
export function quotaPotenziale(oggi = new Date()) {
  return trunc2((TAX_2026.TI_MASSIMO * giorniTrascorsi(oggi)) / 365);
}

/**
 * Il rischio di restituzione, in euro.
 *
 * @param {object} opts
 * @param {object} opts.settings impostazioni dell'app
 * @param {number} opts.proiezioneAnnua reddito annuo LORDO previsto a fine anno
 * @param {Date}   [opts.oggi] per i riscontri; di default la data corrente
 * @returns {{erogato, spettante, daRestituire, rateizzabile, causa, giorni, unSoloDatore}}
 */
export function rischioRestituzione({ settings = {}, proiezioneAnnua = 0, oggi = new Date() } = {}) {
  const T = TAX_2026;
  const giorni = giorniTrascorsi(oggi);
  const vuoto = {
    erogato: 0, spettante: 0, daRestituire: 0, rateizzabile: false,
    giorni, unSoloDatore: true,
  };

  // Ha già chiesto di non farselo accreditare: non c'è niente da riprendere.
  // È l'unico caso in cui il rischio è ZERO per costruzione, e non per stima.
  if (settings.noTrattamentoIntegrativo) {
    return { ...vuoto, causa: CAUSA.RINUNCIATO };
  }

  const decisione = tiDecision(num(proiezioneAnnua), settings);
  const spettante = num(decisione.importoAnnuo);

  // IL TI PUÒ ESSERE ZERO PER DUE MOTIVI OPPOSTI, e confonderli produce un
  // avviso falso — il primo giro di questo modulo ci è cascato, e lo diceva a
  // chi guadagna 2.150 € l'anno.
  //
  //  · REDDITO TROPPO ALTO: sopra i 15.000 il TI si perde. Qui il rischio è
  //    reale, perché il datore lo stava accreditando quando il reddito
  //    sembrava più basso, e a dicembre se lo riprende.
  //  · REDDITO TROPPO BASSO: sotto la no tax area non c'è imposta da
  //    compensare, quindi il TI non spetta per incapienza. Ma allora NON È MAI
  //    STATO ACCREDITATO: il software paghe del datore fa lo stesso conto e
  //    arriva alla stessa conclusione. Niente preso, niente da restituire.
  //
  // La restituzione nasce dal reddito che SALE oltre la soglia, mai dal reddito
  // che resta basso. Quindi si guarda quella soglia, non il solo `spettante`.
  const sopraSoglia = decisione.redditoStimato > T.TI_SOGLIA_PIENO;
  if (!sopraSoglia) {
    return { ...vuoto, spettante, causa: CAUSA.NESSUNA };
  }

  // Quanto il datore ha verosimilmente accreditato finora: la quota piena di
  // legge sui giorni trascorsi. È il caso peggiore, ed è quello giusto da
  // mostrare in un avviso — ma va detto che è un'ipotesi, perché chi guarda il
  // cedolino sa la cifra vera e noi no.
  const erogato = trunc2((T.TI_MASSIMO * giorni) / 365);
  const daRestituire = Math.max(0, menoCent(erogato, spettante));

  let causa = CAUSA.NESSUNA;
  if (daRestituire > 0) {
    causa = decisione.redditoStimato > T.TI_SOGLIA_MAX
      ? CAUSA.OLTRE_MAX
      : CAUSA.SENZA_CAPIENZA;
  }

  return {
    erogato,
    spettante,
    daRestituire,
    rateizzabile: daRestituire > SOGLIA_RATEIZZAZIONE,
    causa,
    giorni,
    // Promemoria per l'interfaccia: con più datori la stima è per DIFETTO.
    unSoloDatore: true,
  };
}
