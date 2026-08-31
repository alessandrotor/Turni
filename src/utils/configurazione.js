// Cosa manca perché i conti siano attendibili, e quanto costa che manchi.
//
// PERCHÉ UN MODULO A PARTE
// La stessa risposta serve in quattro posti — il blocco al primo turno, l'avviso
// del contratto sotto il totale, l'avviso che compare DOPO aver segnato un turno
// di domenica o di notte, e il promemoria in Impostazioni. Quattro copie della
// stessa regola divergono: basta aggiungere un campo e ricordarsene in tre punti
// su quattro.
//
// Sta in `utils/` e non in un componente anche perché così si riscontra con Node
// puro: `node scripts/check-primo-avvio.mjs`.
//
// NIENTE «PRIMO ACCESSO», NIENTE COOKIE
// Non esiste un contrassegno «l'ho già visto». Ogni domanda nasce da una
// condizione che si legge nei dati già inseriti — la paga è zero, il contratto è
// vuoto, questo turno è di domenica e la maggiorazione domenicale vale zero.
// Sono stati dell'app, non tracce dell'utente: spariscono da soli quando
// spariscono i dati, e non c'è niente da conservare per riconoscere qualcuno.
//
// QUANTO COSTA CHE MANCHI
// Le cifre nei messaggi sono misurate, non stimate: mese di 25 giornate da 4 h
// su un part-time da 24 h/settimana con 4 domeniche e 6 turni che toccano la
// notte, confrontando la configurazione completa con quella a cui manca un
// pezzo. Servono a rendere la richiesta ragionevole invece che burocratica: «ti
// conto 45 € in più del vero» si capisce, «configura il CCNL» no.

import { isSunday } from './pay.js';
import { isHoliday } from './holidays.js';
import { toccaFasciaNotturnaPossibile, fasciaNotturnaPossibile } from './notturno.js';
import { isAssenza } from './assenze.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * I due dati senza cui non ha senso segnare un turno.
 *
 * - `hourlyRate`: senza, `calcTotalPay` ritorna `null` — non un importo
 *   sbagliato, proprio nessun importo in tutta l'app.
 * - le ore: reggono la soglia degli straordinari E quanto vale una giornata di
 *   ferie. La seconda è l'unica cosa che NON si recupera dopo: la durata di
 *   un'assenza viene scritta dentro il giorno quando lo si crea, quindi
 *   correggere le ore più tardi non aggiorna le ferie già segnate. Tutto il
 *   resto è retroattivo, perché i turni di lavoro salvano gli orari e non gli
 *   importi.
 *
 * Chi lavora a chiamata non ha ore settimanali: al loro posto vale la soglia
 * giornaliera, e se non è impostata non c'è niente da chiedere — senza contratto
 * a ore non esiste una soglia «giusta» da indovinare.
 */
export function datiMinimiMancanti(settings = {}) {
  const mancano = [];
  if (num(settings.hourlyRate) <= 0) mancano.push('hourlyRate');
  if (!settings.onCall && num(settings.expectedWeeklyHours) <= 0) mancano.push('expectedWeeklyHours');
  return mancano;
}

export function haDatiMinimi(settings = {}) {
  return datiMinimiMancanti(settings).length === 0;
}

/**
 * Il contratto manca. Non blocca niente: diventa un avviso sotto il totale del
 * mese, dove c'è un importo da qualificare.
 *
 * È il parametro che sposta di più, ed è l'unico che sbaglia verso l'ALTO:
 * senza, il motore perde la mensilizzazione (la soglia del supplementare torna
 * settimanale invece che mensile), il divisore orario del contratto e i
 * contributi minori. Misurato: +45,04 € di lordo e +39,39 € di netto al mese.
 */
export function contrattoMancante(settings = {}) {
  return !settings.ccnl;
}

// ── Le maggiorazioni, chieste sul turno che le attiva ───────────────────────
//
// Il rilevamento NON è scritto qui: sono le stesse funzioni che usa il motore
// per pagarle. Se un giorno cambia la regola del notturno, l'avviso la segue
// senza che nessuno se ne ricordi — mentre una copia della condizione
// resterebbe indietro e comparirebbe quando il motore non è d'accordo.
//
// L'unica differenza voluta è la fascia notturna quando NON la si conosce: lì
// l'avviso guarda più largo del motore e lo dice («potrebbe»). Il perché sta in
// `fasciaNotturnaPossibile`.
//
// E si chiede DOPO, mai durante. Il modulo del turno serve a segnare il turno:
// mentre lo si compila non deve comparire altro. La domanda arriva quando il
// turno è già salvato, in un avviso che non copre niente e si chiude — vedi
// AvvisoMaggiorazione.jsx.
const TIPI_MAGGIORAZIONE = [
  {
    tipo: 'domenica',
    chiave: 'sundaySurchargePct',
    attiva: (shift) => isSunday(shift.date),
    titolo: 'Hai segnato un turno di domenica',
    domanda: 'Le domeniche ti sono pagate di più?',
    costo: 'Finché non lo so conto zero, e questa domenica vale come un giorno qualsiasi.',
    tipico: 10,
  },
  {
    tipo: 'festivo',
    chiave: 'holidaySurchargePct',
    attiva: (shift, settings) => isHoliday(shift.date, settings),
    titolo: 'Hai segnato un turno in un giorno festivo',
    domanda: 'I festivi lavorati ti sono pagati di più?',
    costo: 'Finché non lo so conto zero, e questo festivo vale come un giorno qualsiasi.',
    tipico: 20,
  },
  {
    // La NOTTE è l'unico caso in cui non basta guardare la data: dipende da una
    // fascia oraria che il contratto decide, e che chi non ha ancora scelto il
    // contratto non ci ha detto. Vedi `fasciaNotturnaPossibile`: finché non è
    // nota si guarda la più larga fra quelle che esistono, e si dice
    // «potrebbe». È l'unico punto in cui l'avviso è più largo del motore, ed è
    // voluto: chiedere di troppo costa un tocco, non chiedere costa soldi.
    tipo: 'notte',
    chiave: 'nightSurchargePct',
    attiva: (shift, settings) => toccaFasciaNotturnaPossibile(shift, settings),
    titolo: (settings) => (fasciaNotturnaPossibile(settings).certa
      ? 'Hai segnato un turno in fascia notturna'
      : 'Questo turno potrebbe essere notturno'),
    domanda: 'Le ore di notte ti sono pagate di più?',
    costo: (settings) => {
      const f = fasciaNotturnaPossibile(settings);
      return f.certa
        ? `La notte del tuo contratto va dalle ${f.inizio} alle ${f.fine}. È la maggiorazione che pesa di più: circa 38 € al mese.`
        : `Senza contratto non so da che ora conta la notte, quindi guardo la fascia più larga (${f.inizio}–${f.fine}). Se ce l'hai, è la maggiorazione che pesa di più: circa 38 € al mese.`;
    },
    // Quando la fascia non è dichiarata da nessuno, impostare la percentuale
    // non basta a rendere il conto giusto: il motore userà 22:00–06:00, che è
    // legge e non contratto. Va detto lì, una riga, non un altro passaggio.
    dopo: (settings) => (fasciaNotturnaPossibile(settings).certa
      ? null
      : 'Conterò la notte dalle 22:00 alle 06:00 (la legge). Se il tuo contratto dice un altro orario, cambialo in Impostazioni.'),
    tipico: 25,
  },
];

/**
 * La maggiorazione che questo turno attiva e che vale ancora zero — o `null`.
 *
 * Ne restituisce UNA sola anche quando il turno ne attiverebbe due (una domenica
 * di notte): due avvisi impilati dentro il form del turno diventano un muro, e
 * chi li vede insieme li chiude tutti senza leggerli. L'altra tornerà da sé al
 * turno successivo che la attiva.
 *
 * Le assenze non attivano niente: una domenica di ferie non prende il
 * domenicale, non ci si è andati — è la stessa regola del motore.
 *
 * `maggiorazioniNonDovute` è la memoria del «non ne ho»: una scelta dell'utente,
 * non un contrassegno per riconoscerlo. Sta nei settings come tutto il resto.
 */
export function maggiorazioneDaChiedere(shift, settings = {}) {
  if (!shift || isAssenza(shift)) return null;
  const rifiutate = Array.isArray(settings.maggiorazioniNonDovute) ? settings.maggiorazioniNonDovute : [];

  for (const m of TIPI_MAGGIORAZIONE) {
    if (rifiutate.includes(m.tipo)) continue;
    if (num(settings[m.chiave]) > 0) continue;
    let attiva = false;
    try {
      attiva = m.attiva(shift, settings);
    } catch {
      // Un turno a metà compilazione (data vuota, orari incompleti) non deve far
      // cadere il form: nel dubbio non si chiede niente.
      attiva = false;
    }
    if (attiva) {
      // I testi possono dipendere dalle impostazioni (la fascia notturna nota o
      // no): si risolvono qui, così chi disegna riceve stringhe e basta.
      const risolvi = (v) => (typeof v === 'function' ? v(settings) : v);
      return {
        ...m,
        titolo: risolvi(m.titolo),
        costo: risolvi(m.costo),
        dopo: risolvi(m.dopo) || null,
      };
    }
  }
  return null;
}

// ── Il resto, che si può sistemare quando si vuole ──────────────────────────
//
// Ogni voce porta la DIREZIONE dell'errore, che è l'informazione che rende la
// segnalazione utile invece che ansiogena: sapere se l'app ti sta contando di
// più o di meno cambia cosa te ne fai del numero che vedi.
const CONSIGLIATI = [
  {
    chiave: 'overtimeSurchargePct',
    etichetta: 'Ore in più',
    tipico: '30',
    direzione: 'meno',
    // In busta hanno due nomi diversi a seconda di dove cadono, e l'utente li
    // legge lì: dirglielo qui evita che cerchi una voce che non trova.
    perche: 'Le ore oltre il tuo orario. In busta si chiamano «supplementari» finché stai sotto il full-time, «straordinari» oltre.',
  },
  {
    chiave: 'nightSurchargePct',
    etichetta: 'Lavoro notturno',
    tipico: '25',
    direzione: 'meno',
    perche: 'È quella che pesa di più: circa 38 € al mese per chi fa qualche notte.',
  },
  {
    chiave: 'sundaySurchargePct',
    etichetta: 'Domeniche',
    tipico: '10',
    direzione: 'meno',
    perche: 'Senza, una domenica vale come un giorno qualsiasi.',
  },
  {
    chiave: 'holidaySurchargePct',
    etichetta: 'Giorni festivi',
    tipico: '20',
    direzione: 'meno',
    perche: 'Vale per i festivi lavorati, non per le domeniche.',
  },
  {
    chiave: 'addComunalePct',
    etichetta: 'Addizionali IRPEF',
    tipico: '0,8',
    direzione: 'piu',
    perche: 'Dipendono da dove abiti e si trovano in busta. Senza, il netto risulta più alto del vero.',
    // La regionale ha un valore di ripiego plausibile (1,23%, il minimo della
    // forbice) quindi non risulta mai «mancante» — ma si legge sulla stessa
    // riga della busta, e chiederne una sola manda l'utente a guardare due
    // volte lo stesso foglio.
    insieme: [{ chiave: 'addRegionalePct', etichetta: 'Addizionale regionale', tipico: '1,23' }],
    etichettaCampo: 'Addizionale comunale',
  },
];

/**
 * Le voci non indispensabili che mancano ancora.
 *
 * Non è un elenco di tutto ciò che è a zero: uno zero può essere la verità (chi
 * non lavora mai di notte non ha una maggiorazione notturna). Per questo si
 * rispetta `maggiorazioniNonDovute`, e per questo il posto giusto dove chiederle
 * resta il turno che le attiva — qui servono solo a dire «guarda che c'è
 * dell'altro», non a mettere fretta.
 */
export function consigliatiMancanti(settings = {}) {
  const rifiutate = Array.isArray(settings.maggiorazioniNonDovute) ? settings.maggiorazioniNonDovute : [];
  const perTipo = { sundaySurchargePct: 'domenica', nightSurchargePct: 'notte', holidaySurchargePct: 'festivo' };
  return CONSIGLIATI.filter((c) => {
    if (num(settings[c.chiave]) > 0) return false;
    const tipo = perTipo[c.chiave];
    return !(tipo && rifiutate.includes(tipo));
  });
}

/**
 * Il quadro completo, per chi deve mostrarlo tutto insieme (Impostazioni, e il
 * promemoria nel calendario).
 */
export function statoConfigurazione(settings = {}) {
  const minimi = datiMinimiMancanti(settings);
  const contratto = contrattoMancante(settings);
  const consigliati = consigliatiMancanti(settings);
  return {
    minimiMancanti: minimi,
    contrattoMancante: contratto,
    consigliatiMancanti: consigliati,
    completo: minimi.length === 0 && !contratto && consigliati.length === 0,
    // Quante cose restano da sistemare, per la riga «mancano ancora N cose».
    quanteMancano: minimi.length + (contratto ? 1 : 0) + consigliati.length,
  };
}
