import { isIsoDate } from '../utils/dates';
import { installId } from './telemetry';
import { ottieniToken, turnstileAttivo } from './turnstile';

// La chiamata a Gemini NON avviene più da qui: la fa il proxy in `worker/`.
// Motivo: Vite sostituisce le `import.meta.env.*` a build time, quindi una
// chiave lasciata nel client finirebbe in chiaro nel bundle, che Capacitor
// impacchetta come asset dell'APK — estraibile con un unzip da chiunque scarichi
// l'app, tester della beta compresi.
//
// Restano qui il ridimensionamento dell'immagine (va fatto sul telefono, prima
// di spedire) e la normalizzazione di date e orari, che è pura e già collaudata.
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || '';

// Oltre questo tempo la richiesta viene annullata: senza timeout una chiamata
// che non risponde lascia il pulsante bloccato su "Analisi in corso" per sempre.
const REQUEST_TIMEOUT_MS = 120000;

// L'immagine viene ridimensionata prima dell'invio: `mediaResolution: LOW` fa
// comunque scalare il modello lato server, quindi una foto da 12 MP servirebbe
// solo a occupare memoria e banda (≈7 MB di base64).
const MAX_IMAGE_SIDE = 1600;
const RESIZE_MIME = 'image/jpeg';
const RESIZE_QUALITY = 0.85;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato'));
    reader.readAsDataURL(file);
  });
}

// Ridimensiona il lato lungo a MAX_IMAGE_SIDE mantenendo le proporzioni.
// Se qualcosa non va (canvas non disponibile, immagine illeggibile) si ripiega
// sull'originale: l'import deve funzionare comunque.
async function prepareImage(file) {
  const dataUrl = await fileToDataUrl(file);
  const original = { data: String(dataUrl).split(',')[1], mimeType: file.type || 'image/jpeg' };
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = dataUrl;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!longest || longest <= MAX_IMAGE_SIDE) return original;

    const scale = MAX_IMAGE_SIDE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const resized = canvas.toDataURL(RESIZE_MIME, RESIZE_QUALITY).split(',')[1];
    if (!resized) return original;
    return { data: resized, mimeType: RESIZE_MIME };
  } catch {
    return original;
  }
}

export async function parseShiftsFromImage(imageFile, workerName = '') {
  if (!PROXY_URL) {
    throw new Error('Servizio di riconoscimento non configurato: manca VITE_AI_PROXY_URL.');
  }
  const image = await prepareImage(imageFile);

  // Token di verifica: si chiede QUI, dopo che il file è stato scelto, non prima.
  // Anticiparlo al click del pulsante romperebbe il gesto utente su iOS, dove il
  // selettore file deve aprirsi nello stesso turno dell'evento.
  let turnstileToken = '';
  if (turnstileAttivo()) {
    try {
      turnstileToken = await ottieniToken();
    } catch (e) {
      // `ottieniToken` ha già riprovato per conto suo: se si arriva qui il
      // guasto è persistito, quindi il consiglio non può più essere «riprova».
      // Il motivo tecnico resta in console, dove serve a chi ripara.
      console.warn('turnstile: nessun token dopo i tentativi —', e?.message);
      throw new Error('Verifica di sicurezza non riuscita. Ricarica la pagina e riprova; se continua, potrebbe essere un blocco del browser.');
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${PROXY_URL.replace(/\/$/, '')}/parse-shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        image: image.data,
        mimeType: image.mimeType,
        workerName,
        installId: installId(),
        turnstileToken,
      }),
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Tempo scaduto (${REQUEST_TIMEOUT_MS / 1000}s): riprova con un'immagine più piccola o una connessione migliore.`);
    }
    throw new Error('Impossibile contattare il servizio di riconoscimento: controlla la connessione.');
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    // Il proxy manda messaggi già scritti per chi usa l'app: si mostrano così.
    throw new Error(payload?.error || 'Il riconoscimento non è riuscito.');
  }

  const raw = payload?.items;
  const usage = payload?.usage || {};
  console.log('[gemini-usage]', JSON.stringify(usage));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Nessun turno trovato');

  // Mappa allo schema turni dell'app; conserva i campi di provenienza.
  // Data e orari vengono NORMALIZZATI e validati: un valore fuori formato
  // entrerebbe nei totali ma non combacerebbe con la chiave della cella del
  // calendario, rendendo il turno invisibile e non modificabile.
  const shifts = raw
    .map(t => ({
      date: toIsoDate(t.data),
      startTime: toHHMM(t.ora_inizio),
      endTime: toHHMM(t.ora_fine),
      breakMinutes: 0,
      note: cleanNote(t.codice_turno),
      _codice: t.codice_turno,
      _testoGrezzo: t.testo_grezzo,
      _riga: t.riga_identificata,
      _colonna: t.intestazione_colonna,
    }))
    .filter(s => s.date && s.startTime && s.endTime);

  return { shifts, usage };
}

// Normalizza la data a ISO YYYY-MM-DD. Il modello a volte restituisce
// DD/MM/YYYY (o con . / -) oppure ISO senza zero iniziale ("2026-7-5").
// Ritorna '' se non è una data reale: il chiamante scarta il turno.
function toIsoDate(d) {
  const s = String(d || '').trim();
  let iso = '';
  let m = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/);
  if (m) {
    iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  } else {
    m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return isIsoDate(iso) ? iso : '';
}

// Normalizza l'orario a HH:MM. Accetta "8:00", "08.00", "8,30", "0800".
// Ritorna '' se non è un orario valido.
function toHHMM(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[:.,h]?(\d{2})$/i);
  if (!m) return '';
  const h = Number(m[1]);
  let min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  // Un orario che finisce in :50 è quasi sempre una lettura errata di :30
  // (mezz'ora): sui fogli turni un turno che inizia o finisce davvero alle :50 è
  // rarissimo, mentre la mezz'ora è la norma. Correggiamo verso il caso comune.
  if (min === 50) min = 30;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Nota del turno: tiene sigle/luoghi (es. "CASSA", "Museo Napoleonico") ma
// scarta il valore se è solo orari/numeri (es. "12,00 16,50"), che sul foglio
// a tabella il modello a volte mette per errore nel codice turno.
function cleanNote(code) {
  const s = String(code || '').trim();
  if (!s) return '';
  return /^[\d\s.,:h–-]+$/.test(s) ? '' : s;
}
