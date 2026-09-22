// Cosa c'è DENTRO un file di backup, e come si sostituiscono i dati senza
// restare a metà strada.
//
// COS'ERA PRIMA, E PERCHÉ ERANO DUE DIFETTI E NON UNO
//
// 1. `validaBackup` controllava la BUSTA, non il contenuto: è un oggetto?
//    `app === 'turni'`? `turni` è un oggetto? Fine. Dentro non guardava
//    nessuno, quindi una chiave che non è una data, un orario assurdo, un
//    `breakMinutes` negativo entravano tutti in localStorage — e da lì nel
//    render, dove `a.date.localeCompare(b.date)` su una voce senza `date` non
//    dà un numero sbagliato: fa saltare la pagina. Con gli originali già
//    cancellati dal punto 2.
//
//    C'era anche un buco preciso: `if (dati.formato > FORMATO)` NON ferma un
//    file senza `formato`, perché `undefined > 1` è `false`. Passava, e veniva
//    interpretato come formato 1 — esattamente ciò che quel controllo esiste
//    per impedire.
//
// 2. Il ripristino faceva quattro `setItem` in fila, nessuno protetto, e non
//    copiava da nessuna parte i dati che stava per sovrascrivere. Se il secondo
//    falliva per quota — ripristinare un backup grosso su uno storage quasi
//    pieno è proprio il caso tipico — i turni erano già stati sostituiti e le
//    impostazioni no: STATO MISTO, cioè dati di due backup diversi mescolati.
//    E quello che risaliva a schermo era un `QuotaExceededError` grezzo, non
//    uno dei messaggi in italiano scritti lì sopra.
//
// LA REGOLA NUOVA: o tutto, o niente, e comunque si dice cosa è successo.
// Le scritture si preparano prima (`pianoRipristino`), si eseguono sapendo
// com'era (`scriviConRitorno`), e al primo fallimento si rimette tutto
// com'era. Se nemmeno quello riesce, lo si dichiara invece di tacere.
//
// PERCHÉ QUI E NON IN `services/backup.js`
// Quel file importa `services/export.js`, che importa Capacitor: da Node non si
// carica. Il difetto peggiore di questo codice — sostituire i dati e lasciarli
// a metà — è però proprio quello che nessuno proverà mai a mano, perché
// richiede uno storage pieno al momento giusto. Qui invece lo storage è un
// argomento, e `scripts/check-backup.mjs` lo fa fallire al secondo colpo per
// vedere se i dati tornano davvero al loro posto.

export const APP_TAG = 'turni';
export const FORMATO = 1;

export const KEY_SHIFTS = 'turni_shifts';
export const KEY_SETTINGS = 'turni_settings';
export const KEY_TELEMETRY_OFF = 'turni_telemetry_off';
export const KEY_CAL_LAYOUT = 'turni_cal_layout';

export const LAYOUT_AMMESSI = new Set(['grid', 'timeline']);

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ORA = /^\d{2}:\d{2}$/;

// `2026-02-31` supera l'espressione regolare ma non esiste. Il giro per Date
// serve a quello: una data che non c'è finirebbe in una cella che non c'è.
function dataVera(iso) {
  if (typeof iso !== 'string' || !RE_DATA.test(iso)) return false;
  const [a, m, g] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
}

function oraVera(hhmm) {
  if (typeof hhmm !== 'string' || !RE_ORA.test(hhmm)) return false;
  const [h, m] = hhmm.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Presente ma non un numero, oppure negativo. L'assente va bene: il motore ha i
// suoi ripieghi (`calcShiftMinutes`), ed è il caso dei backup vecchi.
function numeroStorto(valore) {
  if (valore === undefined || valore === null) return false;
  const n = Number(valore);
  return !Number.isFinite(n) || n < 0;
}

/**
 * Perché questa voce non è un turno, o `null` se lo è.
 *
 * Si guarda ciò che ROMPE, non ciò che è insolito: un turno di quattordici ore
 * è strano ma è un dato dell'utente, e non tocca a un controllo di integrità
 * metterlo in dubbio. Una voce senza `date` invece fa saltare l'ordinamento nel
 * render, ed è un'altra cosa.
 */
export function perche(voce) {
  if (!voce || typeof voce !== 'object' || Array.isArray(voce)) return 'non è una voce';
  if (!dataVera(voce.date)) return 'data assente o inesistente';
  if (voce.startTime !== undefined && !oraVera(voce.startTime)) return 'orario di inizio illeggibile';
  if (voce.endTime !== undefined && !oraVera(voce.endTime)) return 'orario di fine illeggibile';
  if (numeroStorto(voce.breakMinutes)) return 'pausa non valida';
  if (numeroStorto(voce.durationMinutes)) return 'durata non valida';
  if (numeroStorto(voce.surchargePct)) return 'maggiorazione non valida';
  return null;
}

/**
 * Due cose che non rompono il ripristino ma rompono dopo, e che si aggiustano
 * senza perdere niente dell'utente:
 *  · `id` diverso dalla chiave (o assente): modificare il turno scrive in
 *    `shifts[shift.id]`, quindi creava un doppione, e cancellarlo non trovava
 *    niente. L'archivio è indicizzato per chiave, e la chiave fa fede.
 *  · una nota che non è testo: `{shift.note}` di un oggetto fa saltare il
 *    render, `note.trim()` di un numero fa saltare il modulo.
 */
function riallinea(chiave, voce) {
  if (voce.id === chiave && (voce.note === undefined || typeof voce.note === 'string')) return voce;
  const aggiustata = { ...voce, id: chiave };
  if (aggiustata.note !== undefined && typeof aggiustata.note !== 'string') {
    aggiustata.note = typeof aggiustata.note === 'number' ? String(aggiustata.note) : '';
  }
  return aggiustata;
}

/**
 * Divide i turni del file in quelli che si possono ripristinare e quelli no.
 *
 * NON si rifiuta l'intero backup per tre voci storte su duecento: sarebbe
 * perdere centonovantasette giornate vere per proteggerne tre. Ma nemmeno si
 * scartano in silenzio — è il difetto dell'import da foto, che annuncia
 * «trovati 17 turni» e delle tre mancanti non dice niente: chi chiama riceve
 * l'elenco e lo mostra.
 *
 * @returns {{buoni: object, scartati: Array<{chiave: string, perche: string}>}}
 */
export function vagliaTurni(turni) {
  const buoni = {};
  const scartati = [];
  if (!turni || typeof turni !== 'object' || Array.isArray(turni)) return { buoni, scartati };

  for (const [chiave, voce] of Object.entries(turni)) {
    // `JSON.parse` crea «__proto__» come chiave vera, ma assegnarla a un
    // oggetto normale ne cambia il prototipo invece di aggiungere una voce: il
    // turno spariva senza finire fra gli scartati. L'app non genera mai
    // quell'id, quindi è un file scritto a mano o da altro, e lo si dice.
    if (chiave === '__proto__') {
      scartati.push({ chiave, perche: 'chiave non valida' });
      continue;
    }
    const guasto = perche(voce);
    if (guasto) scartati.push({ chiave, perche: guasto });
    else buoni[chiave] = riallinea(chiave, voce);
  }
  return { buoni, scartati };
}

/**
 * Il file è un backup di quest'app? Messaggio in italiano, oppure `null`.
 *
 * Solo la busta: il contenuto lo vaglia `vagliaTurni`. Sono due domande
 * diverse — «questo file è mio?» si risponde prima di toccare qualsiasi cosa,
 * «cosa ci si salva dentro?» riguarda le singole voci.
 */
export function controllaBusta(dati) {
  if (!dati || typeof dati !== 'object' || Array.isArray(dati)) {
    return 'Il file non contiene un backup valido.';
  }
  if (dati.app !== APP_TAG) {
    return 'Questo file non è un backup di Turni.';
  }
  // `undefined > 1` è false: senza questa riga un file senza `formato` passava
  // e veniva letto come formato 1.
  if (!Number.isInteger(dati.formato) || dati.formato < 1) {
    return 'Il backup è danneggiato: manca il numero di formato.';
  }
  if (dati.formato > FORMATO) {
    return `Backup creato da una versione più recente dell'app (formato ${dati.formato}). Aggiorna Turni e riprova.`;
  }
  if (typeof dati.turni !== 'object' || dati.turni === null || Array.isArray(dati.turni)) {
    return 'Il backup è danneggiato: manca l\'elenco dei turni.';
  }
  return null;
}

/**
 * Le scritture da fare, in ordine, prima di farne una sola.
 *
 * `valore: null` significa togliere la chiave. Averle tutte insieme prima di
 * cominciare è ciò che permette di sapere, a metà strada, cosa restava da fare.
 *
 * @param {object} dati backup già passato da `controllaBusta`
 * @param {object} turniBuoni i turni sopravvissuti a `vagliaTurni`
 */
export function pianoRipristino(dati, turniBuoni) {
  const piano = [
    { chiave: KEY_SHIFTS, valore: JSON.stringify(turniBuoni) },
  ];

  if (dati.impostazioni && typeof dati.impostazioni === 'object' && !Array.isArray(dati.impostazioni)) {
    piano.push({ chiave: KEY_SETTINGS, valore: JSON.stringify(dati.impostazioni) });
  }

  piano.push({ chiave: KEY_TELEMETRY_OFF, valore: dati.telemetriaDisattivata ? '1' : null });

  // Assente nei backup fatti prima che la vista agenda esistesse: in quel caso
  // si lascia la preferenza corrente com'è, invece di riportarla alla griglia.
  if (LAYOUT_AMMESSI.has(dati.vistaCalendario)) {
    piano.push({ chiave: KEY_CAL_LAYOUT, valore: dati.vistaCalendario });
  }

  return piano;
}

/**
 * Esegue il piano. O passa tutto, o non resta niente a metà.
 *
 * @param {Array} piano da `pianoRipristino`
 * @param {Storage} storage `localStorage`, o un finto per i riscontri
 * @returns {{ok: boolean, errore?: Error, tornatoIndietro?: boolean}}
 *   `tornatoIndietro: false` è il caso raro e grave: la scrittura è fallita E
 *   il ritorno pure. Chi chiama non può tacerlo, perché a quel punto i dati
 *   sono davvero mescolati.
 */
export function scriviConRitorno(piano, storage) {
  // I valori GREZZI di prima, non l'oggetto ricostruito: tornare indietro deve
  // rimettere le stesse identiche stringhe, non una versione riscritta da noi.
  const comEra = piano.map(({ chiave }) => {
    try {
      return { chiave, valore: storage.getItem(chiave) };
    } catch {
      return { chiave, valore: null };
    }
  });

  const scrivi = ({ chiave, valore }) => {
    if (valore === null || valore === undefined) storage.removeItem(chiave);
    else storage.setItem(chiave, valore);
  };

  // Si tiene il conto di cosa è stato toccato DAVVERO, e il ritorno rimette
  // solo quello, dall'ultima alla prima. Il primo tentativo scriveva tutte le
  // chiavi del piano, comprese quelle a cui non era ancora arrivato: su uno
  // storage bloccato significava rimettere le mani su dati sani che nessuno
  // aveva cambiato. Se il piano fallisce al primo colpo non c'è niente da
  // annullare, ed è giusto che il ritorno non faccia nulla.
  const fatte = [];

  try {
    for (const passo of piano) {
      scrivi(passo);
      fatte.push(passo.chiave);
    }
    return { ok: true };
  } catch (errore) {
    let tornatoIndietro = true;
    for (const chiave of [...fatte].reverse()) {
      const era = comEra.find((c) => c.chiave === chiave);
      try {
        scrivi(era);
      } catch {
        tornatoIndietro = false;
      }
    }
    return { ok: false, errore, tornatoIndietro };
  }
}
