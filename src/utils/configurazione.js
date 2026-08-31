// Cosa manca perché i conti siano attendibili, e quanto costa che manchi.
//
// PERCHÉ UN MODULO A PARTE
// La stessa risposta serve in quattro posti — il blocco al primo turno, l'avviso
// del contratto sotto il totale, gli avvisi sulle maggiorazioni dentro il form
// del turno, e il promemoria in Impostazioni. Quattro copie della stessa regola
// divergono: basta aggiungere un campo e ricordarsene in tre punti su quattro.
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
import { toccaFasciaNotturna } from './notturno.js';
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
const TIPI_MAGGIORAZIONE = [
  {
    tipo: 'domenica',
    chiave: 'sundaySurchargePct',
    attiva: (shift) => isSunday(shift.date),
    titolo: 'È domenica: hai una maggiorazione?',
    costo: 'Ora conto zero, quindi questo turno vale meno del vero.',
    tipico: 10,
  },
  {
    tipo: 'festivo',
    chiave: 'holidaySurchargePct',
    attiva: (shift, settings) => isHoliday(shift.date, settings),
    titolo: 'È un giorno festivo: hai una maggiorazione?',
    costo: 'Ora conto zero, quindi questo turno vale meno del vero.',
    tipico: 20,
  },
  {
    tipo: 'notte',
    chiave: 'nightSurchargePct',
    attiva: (shift, settings) => toccaFasciaNotturna(shift, settings),
    titolo: 'Questo turno tocca la fascia notturna',
    costo: 'È la maggiorazione che pesa di più: senza, un mese come questo vale circa 38 € in meno.',
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
    if (attiva) return { ...m };
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
    chiave: 'sundaySurchargePct',
    etichetta: 'Maggiorazione domenicale',
    tipico: '10',
    direzione: 'meno',
    perche: 'Senza, le domeniche valgono come un giorno qualsiasi: circa 12 € in meno al mese.',
  },
  {
    chiave: 'nightSurchargePct',
    etichetta: 'Maggiorazione notturna',
    tipico: '25',
    direzione: 'meno',
    perche: 'È quella che pesa di più: circa 38 € in meno al mese per chi fa qualche notte.',
  },
  {
    chiave: 'holidaySurchargePct',
    etichetta: 'Maggiorazione festivi',
    tipico: '20',
    direzione: 'meno',
    perche: 'I giorni festivi lavorati valgono come gli altri.',
  },
  {
    chiave: 'overtimeSurchargePct',
    etichetta: 'Maggiorazione supplementari',
    tipico: '30',
    direzione: 'meno',
    perche: 'Le ore oltre il tuo orario vengono pagate come le altre.',
  },
  {
    chiave: 'addComunalePct',
    etichetta: 'Addizionale comunale',
    tipico: '0,8',
    direzione: 'piu',
    perche: 'Senza, il netto stimato è più alto del vero: fino a circa 17 € al mese insieme alla regionale.',
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
