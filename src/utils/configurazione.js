// Cosa manca perché i conti siano attendibili, e quanto costa che manchi.
//
// Un modulo a parte perché la stessa risposta serve in quattro posti (blocco al primo
// turno, avviso del contratto sotto il totale, avviso dopo un turno di domenica o di
// notte, promemoria in Impostazioni): quattro copie divergono. Sta in `utils/` per
// riscontrarsi da Node: `node scripts/check-primo-avvio.mjs`.
//
// Niente «primo accesso» né contrassegni: ogni domanda nasce da una condizione che si
// legge nei dati già inseriti (paga zero, contratto vuoto, turno di domenica con
// maggiorazione zero). Le cifre nei messaggi sono misurate su una configurazione
// completa contro una a cui manca un pezzo.

import { isSunday } from '../motore/pay.js';
import { isHoliday } from '../motore/holidays.js';
import { toccaFasciaNotturnaPossibile, fasciaNotturnaPossibile } from '../motore/notturno.js';
import { isAssenza } from '../motore/assenze.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * I due dati senza cui non ha senso segnare un turno.
 *
 * - `hourlyRate`: senza, `calcTotalPay` ritorna `null` (nessun importo in tutta l'app).
 * - le ore: reggono la soglia degli straordinari E il valore di una giornata di ferie,
 *   che si scrive dentro il giorno alla creazione e correggendo le ore dopo non si
 *   aggiorna: l'unica cosa che NON si recupera. Il resto è retroattivo.
 *
 * Chi lavora a chiamata non ha ore settimanali: vale la soglia giornaliera, e se non è
 * impostata non c'è niente da chiedere.
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
 * È il parametro che sposta di più e l'unico che sbaglia verso l'ALTO: senza, il motore
 * perde la mensilizzazione, il divisore orario e i contributi minori.
 */
export function contrattoMancante(settings = {}) {
  return !settings.ccnl;
}

// ── Le maggiorazioni, chieste sul turno che le attiva ──
//
// Il rilevamento usa le stesse funzioni con cui il motore le paga, così l'avviso ne
// segue le regole. Unica differenza voluta: la fascia notturna NON nota, dove si guarda
// più largo e si dice «potrebbe» (`fasciaNotturnaPossibile`).
// Si chiede DOPO, mai durante: la domanda arriva a turno salvato, vedi
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
    // La NOTTE dipende da una fascia che il contratto decide: finché non è nota si guarda
    // la più larga e si dice «potrebbe» (`fasciaNotturnaPossibile`).
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
    // Se la fascia non è dichiarata da nessuno, il motore userà 22:00–06:00 (legge, non
    // contratto): va detto lì, in una riga.
    dopo: (settings) => (fasciaNotturnaPossibile(settings).certa
      ? null
      : 'Conterò la notte dalle 22:00 alle 06:00 (la legge). Se il tuo contratto dice un altro orario, cambialo in Impostazioni.'),
    tipico: 25,
  },
];

/**
 * La maggiorazione che questo turno attiva e che vale ancora zero — o `null`.
 *
 * Ne restituisce UNA sola anche se il turno ne attiverebbe due (domenica di notte):
 * due avvisi impilati sono un muro. L'altra tornerà al turno successivo che la attiva.
 * Le assenze non attivano niente, come nel motore. `maggiorazioniNonDovute` è la
 * memoria del «non ne ho»: una scelta dell'utente, nei settings.
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

// ── Il resto, che si può sistemare quando si vuole ──
//
// Ogni voce porta la DIREZIONE dell'errore (l'app conta di più o di meno?).
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
 * Non tutto ciò che è a zero: uno zero può essere la verità, per questo si rispetta
 * `maggiorazioniNonDovute`. Il posto giusto per chiederle resta il turno che le attiva.
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

// Il «no» al promemoria in alto. Il nome resta quello di sempre: cambiarlo
// farebbe ricomparire il promemoria a chi l'ha già chiuso.
export const KEY_PROMEMORIA_CHIUSO = 'turni_setup_dismissed';

/**
 * Il promemoria in alto («Manca ancora una cosa») ha qualcosa da dire?
 *
 * Sta qui e non in `SetupPrompt` perché App deve saperlo PRIMA di decidere chi parla
 * in alto. Tace a chi non ha ancora segnato niente e a chi non ha i dati minimi
 * (quelli li chiede il blocco al primo turno).
 */
export function promemoriaHaDaDire({ settings = {}, turni = 0, chiuso = false } = {}) {
  return turni > 0 && !chiuso && haDatiMinimi(settings) && consigliatiMancanti(settings).length > 0;
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
