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
// In pratica: **oltre i 15.000 € di reddito complessivo il trattamento
// integrativo si perde, e quello già preso torna indietro.**
//
// Vero alla lettera, e per un anno è stata la conclusione di questo modulo — ma
// come risposta alla domanda che la gente si fa davvero («ci perdo?») è
// fuorviante, perché descrive un movimento di cassa e lo lascia scambiare per
// una perdita. Il conto vero è più sotto, in `costoSoglia`: la detrazione da
// lavoro sale di 1.145 € nello stesso momento in cui il bonus sparisce, e di
// 1.200 € «persi» ne restano 129. Chi legge questo file si fermi lì prima di
// scrivere altri avvisi.
//
// IL RIMEDIO, che è la ragione per cui questo modulo serve a qualcosa:
// si può chiedere al datore di NON erogarlo, e prenderlo semmai a conguaglio se
// spetta davvero. Nell'app è `settings.noTrattamentoIntegrativo`, e quando è
// acceso qui non c'è più niente da restituire — per costruzione.
//
// Modulo puro, senza React e senza browser: `node scripts/check-restituzione.mjs`.

import { TAX_2026, tiDecision, calcNetAnnual, redditoComplessivo, tiSospeso } from './net.js';

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
  if (data == null) return 0;
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return 0;
  const inizio = Date.UTC(d.getFullYear(), 0, 1);
  const oggi = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.min(365, Math.max(0, Math.round((oggi - inizio) / 86400000) + 1));
}

/**
 * Il giorno a cui misurare l'anno GUARDATO, che non è sempre quello di oggi:
 * per un anno chiuso il 31 dicembre, per uno non ancora cominciato nessuno
 * (`null`, zero giorni). Prima si contavano i giorni di oggi qualunque anno si
 * aprisse: gennaio dell'anno dopo mostrava ~870 € «già erogati» su un anno in
 * cui non era ancora arrivato un euro. → check-restituzione.mjs
 */
export function dataDiRiferimento(anno, oggi = new Date()) {
  const corrente = oggi.getFullYear();
  if (anno === corrente || anno == null) return oggi;
  return anno < corrente ? new Date(anno, 11, 31) : null;
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
  if (tiSospeso(settings)) {
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

// ─────────────────────────────────────────────────────────────────────────────
// QUANTO COSTA DAVVERO SUPERARE LA SOGLIA
//
// Tutto quello che sta sopra risponde a «quanto ti riprendono», che è un fatto
// di cassa. Non risponde alla domanda che uno si fa davvero prima di accettare
// un turno in più: **ci perdo?**
//
// La risposta è no, quasi. Sopra i 15.000 il trattamento integrativo sparisce
// (−1.200), ma la detrazione da lavoro salta da 1.955 a 3.100 (+1.145): è uno
// scalino scritto nell'art. 13 TUIR apposta per non punire chi supera la soglia,
// e compensa il 95% della perdita. Quello che resta scoperto non è il bonus:
// è l'indennità L. 207/2024, che attraversando la fascia scende di ~70 €.
//
// Il conto, sul motore (vedi check-costo-soglia.mjs):
//
//   lordo    imponibile  detr.lav.     TI   cuneo    netto
//   16.596       15.000      1.955  1.200     790   15.454   ← ultimo sotto
//   16.597       15.001      3.100      0     720   15.325   ← il fondo
//   16.795       15.180      3.085      0     727   15.454   ← di nuovo in pari
//
// Centoventinove euro l'anno nel punto peggiore, e una buca larga duecento euro
// di lordo. Non milleduecento. La differenza conta perché l'avviso di prima
// gridava «restituisci 805 €» anche a chi la soglia l'aveva superata da un pezzo
// e non ci stava più perdendo niente.
//
// I 129 € sono una COSTANTE STRUTTURALE: dipendono dalle sole aliquote statali,
// non dai contributi, quindi vengono identici su CCNL e orari diversi. Cambia
// solo la larghezza della buca. Il riscontro lo verifica su tre profili, perché
// è l'affermazione forte di tutto questo modulo.

/**
 * La forma della buca attorno ai 15.000 €, calcolata sul motore.
 *
 * Niente costanti: `perditaMax` esce da due chiamate a `calcNetAnnual` e il
 * resto da ricerche binarie, una trentina di valutazioni in tutto. La scansione
 * euro per euro serviva per capire, non per girare dentro un componente.
 *
 * @returns {{tetto, nettoTetto, perditaMax, pareggio, larghezzaBuca, voci}}
 *   `tetto` è l'ultimo lordo che resta sotto soglia; `pareggio` il primo oltre
 *   il quale si sta di nuovo bene come prima; `voci` scompone la perdita nei
 *   movimenti che la producono (vedi sotto).
 */
export function costoSoglia(settings = {}) {
  const netto = (g) => calcNetAnnual(g, settings).net;

  // IL TETTO SI CERCA SULL'IMPONIBILE, mai convertendo la soglia in lordo.
  // `taxableToGross(15000)` e `redditoComplessivo` arrotondano in punti diversi
  // — lo dice già bonus.js — e durante l'analisi il primo dava 16.622, che è
  // GIÀ sopra soglia (imponibile 15.023). Il calcolo della perdita partiva
  // dall'altro lato dello scalino e restituiva zero: nessun errore a schermo,
  // solo un avviso che taceva.
  let lo = 0;
  let hi = 60000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (redditoComplessivo(mid, settings) <= TAX_2026.TI_SOGLIA_PIENO) lo = mid;
    else hi = mid - 1;
  }
  const tetto = lo;
  const nettoTetto = netto(tetto);

  // Lo scalino è tutto fra il tetto e l'euro successivo: due valutazioni bastano.
  const perditaMax = Math.max(0, nettoTetto - netto(tetto + 1));

  // Il pareggio per bisezione: dopo lo scalino il netto torna a crescere, quindi
  // «primo valore che raggiunge di nuovo nettoTetto» è ben definito.
  let pareggio = null;
  if (perditaMax > 0) {
    let a = tetto + 1;
    let b = tetto + 5000;
    if (netto(b) >= nettoTetto) {
      while (a < b) {
        const mid = Math.floor((a + b) / 2);
        if (netto(mid) >= nettoTetto) b = mid;
        else a = mid + 1;
      }
      pareggio = a;
    }
  }

  // PERCHÉ la perdita è quella e non 1.200: i movimenti che la compongono,
  // presi dal motore ai due lati dello scalino. Servono a un'interfaccia che
  // deve spiegare, non solo annunciare — e spiegare con numeri ricalcolati a
  // mano nel componente è il modo sicuro per farli smettere di combaciare.
  //
  // `altro` assorbe il resto (l'euro di lordo in più, meno i suoi contributi)
  // così le voci sommano SEMPRE a `perditaMax`, anche dopo gli arrotondamenti:
  // un riquadro che spiega un conto e poi non torna è peggio che tacere.
  const sotto = calcNetAnnual(tetto, settings);
  const sopra = calcNetAnnual(tetto + 1, settings);
  const tasseDi = (v) => v.irpefNetta + v.addRegionale + v.addComunale;
  const perdita = Math.round(perditaMax);
  const bonus = Math.round(sopra.trattamentoIntegrativo - sotto.trattamentoIntegrativo);
  const tasse = Math.round(tasseDi(sotto) - tasseDi(sopra));
  const indennita = Math.round(sopra.bonusCuneo - sotto.bonusCuneo);

  return {
    tetto,
    nettoTetto,
    perditaMax: perdita,
    pareggio,
    larghezzaBuca: pareggio === null ? null : pareggio - tetto,
    voci: {
      bonus,                                             // sparisce: negativo
      tasse,                                             // scendono: positivo
      indennita,                                         // scende: negativo
      altro: -perdita - (bonus + tasse + indennita),
      detrazioneSotto: Math.round(sotto.detrazioneLavoro),
      detrazioneSopra: Math.round(sopra.detrazioneLavoro),
    },
  };
}

export const POSIZIONE = {
  SOTTO: 'sotto',
  DENTRO: 'dentro-buca',
  OLTRE: 'oltre',
};

/**
 * Dove si trova il reddito previsto rispetto alla buca.
 *
 * È su questo che l'interfaccia sceglie cosa dire, e i tre casi vogliono tre
 * messaggi diversi — non tre intensità dello stesso allarme:
 *  · SOTTO  quanto margine resta, e quanto costerebbe bruciarlo
 *  · DENTRO quanto manca per tornare in pari: l'unico caso in cui l'avviso
 *           suggerisce di guadagnare DI PIÙ, ed è anche l'unico azionabile
 *  · OLTRE  niente da fare e niente da temere, e va detto: allarmare qui è il
 *           difetto che questa funzione esiste per togliere
 */
export function posizioneRispettoSoglia(proiezioneAnnua, settings = {}, costo = null) {
  const c = costo || costoSoglia(settings);
  const g = Math.max(0, Number(proiezioneAnnua) || 0);
  if (g <= c.tetto) return POSIZIONE.SOTTO;
  if (c.pareggio !== null && g < c.pareggio) return POSIZIONE.DENTRO;
  return POSIZIONE.OLTRE;
}

/**
 * Quanto manca, in euro di lordo, per uscire dalla buca dal basso.
 * Zero se non si è dentro: così l'interfaccia non deve rifare il confronto.
 */
export function mancaAlPareggio(proiezioneAnnua, settings = {}, costo = null) {
  const c = costo || costoSoglia(settings);
  if (c.pareggio === null) return 0;
  const g = Math.max(0, Number(proiezioneAnnua) || 0);
  return g > c.tetto && g < c.pareggio ? Math.round(c.pareggio - g) : 0;
}
