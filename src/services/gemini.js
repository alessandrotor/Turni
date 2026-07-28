import { GoogleGenAI, Type, MediaResolution } from '@google/genai';

// SDK ufficiale mantenuto (@google/genai). Supporta structured output
// (responseSchema/responseMimeType), thinkingConfig/thinkingBudget e restituisce
// thoughtsTokenCount nel usageMetadata (a differenza del vecchio generative-ai).

// BRANCH flash-lite: modello fissato a Gemini 3 Flash (NON 3.6).
const MODEL = 'gemini-3-flash-preview';

// Tetto di sicurezza generoso: NON stringere sotto il fabbisogno reale — su un
// modello "thinking" un cap basso troncherebbe il ragionamento e perderebbe
// turni. Il thinking si controlla semmai con thinkingConfig (vedi sotto).
const MAX_OUTPUT_TOKENS = 65536;

// Budget di thinking: lasciato al DEFAULT del modello per ora. Prima misuriamo
// thoughtsTokenCount reale (log sotto), poi si decide un valore. Per applicarlo:
//   config.thinkingConfig = { thinkingBudget: N }   // N>0, NON azzerare
// (serve ragionamento spaziale per allineare riga/colonna).

// Schema strutturato: array di turni con campi di provenienza per la
// validazione deterministica lato app. Niente testo libero oltre a questi.
const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      data: { type: Type.STRING, description: 'Data del turno in ISO YYYY-MM-DD' },
      ora_inizio: { type: Type.STRING, description: 'Ora di inizio HH:MM (24h), vuoto se assente' },
      ora_fine: { type: Type.STRING, description: 'Ora di fine HH:MM (24h), vuoto se assente' },
      codice_turno: { type: Type.STRING, description: 'Sigla grezza della cella, es. "M", "P", "R"' },
      testo_grezzo: { type: Type.STRING, description: 'Contenuto esatto della cella così com\'è nell\'immagine' },
      riga_identificata: { type: Type.STRING, description: 'Etichetta della riga associata all\'utente' },
      intestazione_colonna: { type: Type.STRING, description: 'Intestazione della colonna da cui deriva la data' },
    },
    required: ['data', 'ora_inizio', 'ora_fine', 'codice_turno', 'testo_grezzo', 'riga_identificata', 'intestazione_colonna'],
  },
};

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chiave API mancante: aggiungi VITE_GEMINI_API_KEY in .env.local');
  return new GoogleGenAI({ apiKey });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Log della ripartizione token: prompt (immagine+testo), output effettivo,
// thinking e totale — per decidere dove intervenire senza ottimizzare alla cieca.
function logUsage(response) {
  try {
    const u = response?.usageMetadata || {};
    console.log('[gemini-usage]', JSON.stringify(u));
    console.log('[gemini-usage] prompt=%s output(candidates)=%s thinking(thoughts)=%s total=%s',
      u.promptTokenCount, u.candidatesTokenCount, u.thoughtsTokenCount ?? 'n/d', u.totalTokenCount);
    const fr = response?.candidates?.[0]?.finishReason;
    if (fr) console.log('[gemini-usage] finishReason=%s', fr);
  } catch (e) {
    console.log('[gemini-usage] impossibile leggere usageMetadata:', e.message);
  }
}

export async function parseShiftsFromImage(imageFile, workerName = '') {
  const ai = getClient();
  const base64 = await fileToBase64(imageFile);
  const currentYear = new Date().getFullYear();

  const name = String(workerName || '').trim();
  const nameRule = name
    ? `\nIl foglio contiene i turni di PIÙ persone: estrai SOLO quelli di "${name}". Individua la sua riga (match parziale, ignora maiuscole/accenti), riporta l'etichetta trovata in "riga_identificata" e ignora tutte le altre persone.`
    : '\nRiporta in "riga_identificata" l\'etichetta della riga da cui provengono i turni (vuoto se non applicabile).';

  const prompt = `Sei un estrattore di turni da un'immagine di un foglio turni (griglia con persone sulle righe e giorni sulle colonne).

Per ogni turno di lavoro con orario valido, deriva:
- la DATA dall'intestazione della colonna (giorno/mese/anno). Se l'anno non è indicato usa ${currentYear}. Riporta l'intestazione grezza in "intestazione_colonna".
- gli ORARI di inizio/fine (24h HH:MM). Se la cella riporta solo una sigla senza orario, lascia ora_inizio/ora_fine vuoti ma compila comunque codice_turno e testo_grezzo.
- "codice_turno" = sigla grezza della cella; "testo_grezzo" = contenuto esatto della cella.
${nameRule}

Allineamento: incrocia con attenzione la riga della persona con la colonna del giorno; non spostarti di riga/colonna. Gestisci immagini irregolari: screenshot WhatsApp, foto storte o ruotate, colonne non perfettamente allineate, celle unite. Ignora intestazioni, totali, legende e celle vuote/di riposo senza orario.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: prompt },
      { inlineData: { mimeType: imageFile.type, data: base64 } },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // Estrazione deterministica: stessa immagine → stesso risultato.
      temperature: 0,
      // Risoluzione LOW: sui test (tabella + conversazione) l'accuratezza è
      // identica ad HIGH/MID ma con meno token immagine (prompt ~600 vs ~1400).
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
    },
  });

  logUsage(response);

  // Ripartizione token esposta anche all'app (pannello debug beta).
  const u = response?.usageMetadata || {};
  const finishReason = response?.candidates?.[0]?.finishReason ?? null;
  const usage = {
    prompt: u.promptTokenCount ?? null,
    output: u.candidatesTokenCount ?? null,
    thinking: u.thoughtsTokenCount ?? null,
    total: u.totalTokenCount ?? null,
    finishReason: finishReason ? String(finishReason) : null,
    model: MODEL,
    resolution: 'LOW',
  };

  // Troncamento esplicito: non parsare un JSON parziale (perderebbe turni).
  if (String(finishReason) === 'MAX_TOKENS') {
    throw new Error('Risposta troncata (MAX_TOKENS): aumenta maxOutputTokens. Nessun turno importato per non perdere dati.');
  }

  const text = (response.text || '').trim();
  if (!text) throw new Error('Nessuna risposta dal modello (possibile blocco o quota).');

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('Nessun turno riconosciuto nell\'immagine');
    raw = JSON.parse(m[0]);
  }
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Nessun turno trovato');

  // Mappa allo schema turni dell'app; conserva i campi di provenienza.
  const shifts = raw
    .map(t => ({
      date: toIsoDate(t.data),
      startTime: t.ora_inizio,
      endTime: t.ora_fine,
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
// DD/MM/YYYY (o con . / -); l'app usa e ordina per stringa ISO.
function toIsoDate(d) {
  const s = String(d || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// Nota del turno: tiene sigle/luoghi (es. "CASSA", "Museo Napoleonico") ma
// scarta il valore se è solo orari/numeri (es. "12,00 16,50"), che sul foglio
// a tabella il modello a volte mette per errore nel codice turno.
function cleanNote(code) {
  const s = String(code || '').trim();
  if (!s) return '';
  return /^[\d\s.,:h–-]+$/.test(s) ? '' : s;
}
