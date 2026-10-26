// Cosa c'è DENTRO un file di backup, e come si sostituiscono i dati senza restare a
// metà strada.
//
// Si valida il CONTENUTO, non la busta (una voce senza `date` fa saltare il render), e
// il ripristino è o tutto o niente: le scritture si preparano prima (`pianoRipristino`),
// si eseguono sapendo com'era (`scriviConRitorno`) e al primo fallimento si torna
// indietro. Sta qui e non in `services/backup.js` perché quel file importa Capacitor e
// da Node non si carica; qui lo storage è un argomento e `scripts/check-backup.mjs`
// lo fa fallire a metà.

export const APP_TAG = 'turni';
export const FORMATO = 1;

export const KEY_SHIFTS = 'turni_shifts';
export const KEY_SETTINGS = 'turni_settings';
export const KEY_CAL_LAYOUT = 'turni_cal_layout';

export const LAYOUT_AMMESSI = new Set(['grid', 'timeline']);

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ORA = /^\d{2}:\d{2}$/;

// `2026-02-31` supera l'espressione regolare ma non esiste: il giro per Date lo scarta.
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
 * Si guarda ciò che ROMPE, non ciò che è insolito: un turno di quattordici ore è un
 * dato dell'utente, una voce senza `date` fa saltare l'ordinamento nel render.
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
 * Due cose che non rompono il ripristino ma rompono dopo, e si aggiustano senza
 * perdere niente: `id` diverso dalla chiave (la chiave fa fede, altrimenti modificare
 * crea un doppione) e una nota che non è testo (fa saltare il render).
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
 * Non si rifiuta l'intero backup per tre voci storte su duecento, ma nemmeno si
 * scartano in silenzio: chi chiama riceve l'elenco e lo mostra.
 *
 * @returns {{buoni: object, scartati: Array<{chiave: string, perche: string}>}}
 */
export function vagliaTurni(turni) {
  const buoni = {};
  const scartati = [];
  if (!turni || typeof turni !== 'object' || Array.isArray(turni)) return { buoni, scartati };

  for (const [chiave, voce] of Object.entries(turni)) {
    // `JSON.parse` crea «__proto__» come chiave vera, ma assegnarla a un oggetto normale
    // ne cambia il prototipo: il turno spariva senza finire fra gli scartati.
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
 * Solo la busta: il contenuto lo vaglia `vagliaTurni`.
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
 * `valore: null` significa togliere la chiave.
 *
 * @param {Object} dati backup già passato da `controllaBusta`
 * @param {object} turniBuoni i turni sopravvissuti a `vagliaTurni`
 */
export function pianoRipristino(dati, turniBuoni) {
  const piano = [
    { chiave: KEY_SHIFTS, valore: JSON.stringify(turniBuoni) },
  ];

  if (dati.impostazioni && typeof dati.impostazioni === 'object' && !Array.isArray(dati.impostazioni)) {
    piano.push({ chiave: KEY_SETTINGS, valore: JSON.stringify(dati.impostazioni) });
  }

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
 *   `tornatoIndietro: false`: la scrittura è fallita E il ritorno pure, i dati sono mescolati.
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

  // Si tiene il conto di cosa è stato toccato DAVVERO e il ritorno rimette solo quello,
  // dall'ultima alla prima: su uno storage bloccato non si toccano dati sani.
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

/**
 * L'opzione nucleare: tutto quello che Turni tiene su questo telefono, via (turni,
 * impostazioni, ripresa, immagine condivisa in attesa, copie del lettore di immagini).
 * È l'unica azione con una conferma PRIMA (components/EliminaDati.jsx): dopo non c'è
 * nessun'altra copia. `clear()` non tocca altro: l'origine è solo di Turni, e il
 * precache del service worker resta. Gli strumenti si passano da fuori per il
 * riscontro (`check-elimina-dati.mjs`). Non si ferma al primo errore: cancella tutto
 * quello che può e dice cosa non ha potuto.
 *
 * @param {{ localStorage?: any, sessionStorage?: any, caches?: any, indexedDB?: any }} [strumenti]
 * @returns {Promise<{ ok: boolean, errori: string[] }>}
 */
export async function eliminaTuttoIlLocale({ localStorage: ls, sessionStorage: ss, caches: cc, indexedDB: idb } = {}) {
  const errori = [];
  const prova = async (nome, fn) => { try { await fn(); } catch { errori.push(nome); } };
  await prova('memoria del browser', () => ls?.clear());
  await prova('sessione', () => ss?.clear());
  await prova('immagini condivise', () => cc?.delete('turni-condivisi'));
  await prova('copie del lettore di immagini', async () => {
    if (!idb?.databases) return;
    for (const { name } of await idb.databases()) {
      if (name) {
        await new Promise((ok, ko) => {
          const r = idb.deleteDatabase(name);
          r.onsuccess = ok; r.onerror = ko; r.onblocked = ok;
        });
      }
    }
  });
  if (ls && ls.length > 0) errori.push('memoria del browser');
  return { ok: errori.length === 0, errori: [...new Set(errori)] };
}
