import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// NB: SDK @google/generative-ai v0.24.1 (deprecato). Supporta responseSchema /
// responseMimeType e le metriche usage promptTokenCount/candidatesTokenCount/
// totalTokenCount, ma NON supporta thinkingConfig/thinkingBudget. I thinking
// token (thoughtsTokenCount), se restituiti dall'API, compaiono comunque nel
// usageMetadata grezzo loggato sotto (per questo logghiamo l'oggetto intero).

const MODEL = 'gemini-flash-latest';

// Tetto di sicurezza generoso: NON stringere sotto il fabbisogno reale
// (thinking + output condividono il budget su questo SDK; un cap basso
// troncherebbe il ragionamento e degraderebbe l'accuratezza dell'OCR).
const MAX_OUTPUT_TOKENS = 65536;

// Schema strutturato: array di turni con campi di provenienza per la
// validazione deterministica lato app (riga/colonna/testo grezzo). Nessun
// campo di testo libero oltre a questi, nessun riepilogo narrativo.
const responseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      data: { type: SchemaType.STRING, description: 'Data del turno in ISO YYYY-MM-DD' },
      ora_inizio: { type: SchemaType.STRING, description: 'Ora di inizio HH:MM (24h), vuoto se assente' },
      ora_fine: { type: SchemaType.STRING, description: 'Ora di fine HH:MM (24h), vuoto se assente' },
      codice_turno: { type: SchemaType.STRING, description: 'Sigla grezza della cella, es. "M", "P", "R"' },
      testo_grezzo: { type: SchemaType.STRING, description: 'Contenuto esatto della cella così com\'è nell\'immagine' },
      riga_identificata: { type: SchemaType.STRING, description: 'Etichetta della riga associata all\'utente' },
      intestazione_colonna: { type: SchemaType.STRING, description: 'Intestazione della colonna da cui deriva la data' },
    },
    required: ['data', 'ora_inizio', 'ora_fine', 'codice_turno', 'testo_grezzo', 'riga_identificata', 'intestazione_colonna'],
  },
};

function getModel() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chiave API mancante: aggiungi VITE_GEMINI_API_KEY in .env.local');
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });
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
// thinking (se presente nel grezzo) e totale. Serve per decidere dove
// intervenire senza ottimizzare alla cieca.
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
  const model = getModel();
  const base64 = await fileToBase64(imageFile);
  const currentYear = new Date().getFullYear();

  const name = String(workerName || '').trim();
  const nameRule = name
    ? `\nIl foglio contiene i turni di PIÙ persone: estrai SOLO quelli di "${name}". Individua la sua riga (match parziale, ignora maiuscole/accenti), riporta l'etichetta trovata in "riga_identificata" e ignora tutte le altre persone.`
    : '\nRiporta in "riga_identificata" l\'etichetta della riga da cui provengono i turni (vuoto se non applicabile).';

  // System prompt: task + allineamento riga/colonna + formati irregolari.
  // La FORMA dell'output è definita dallo schema: qui niente esempi JSON.
  const prompt = `Sei un estrattore di turni da un'immagine di un foglio turni (griglia con persone sulle righe e giorni sulle colonne).

Per ogni turno di lavoro con orario valido, deriva:
- la DATA dall'intestazione della colonna (giorno/mese/anno). Se l'anno non è indicato usa ${currentYear}. Riporta l'intestazione grezza in "intestazione_colonna".
- gli ORARI di inizio/fine (24h HH:MM). Se la cella riporta solo una sigla senza orario, lascia ora_inizio/ora_fine vuoti ma compila comunque codice_turno e testo_grezzo.
- "codice_turno" = sigla grezza della cella; "testo_grezzo" = contenuto esatto della cella.
${nameRule}

Allineamento: incrocia con attenzione la riga della persona con la colonna del giorno; non spostarti di riga/colonna. Gestisci immagini irregolari: screenshot WhatsApp, foto storte o ruotate, colonne non perfettamente allineate, celle unite. Ignora intestazioni, totali, legende e celle vuote/di riposo senza orario.`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: imageFile.type, data: base64 } },
  ]);

  const response = result.response;
  logUsage(response);

  // Troncamento esplicito: non parsare un JSON parziale (perderebbe turni).
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Risposta troncata (MAX_TOKENS): aumenta maxOutputTokens. Nessun turno importato per non perdere dati.');
  }

  const text = response.text().trim();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    // Fallback difensivo se, nonostante lo schema, arrivasse testo extra.
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('Nessun turno riconosciuto nell\'immagine');
    raw = JSON.parse(m[0]);
  }
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Nessun turno trovato');

  // Mappa allo schema turni dell'app; conserva i campi di provenienza per
  // eventuale validazione lato app.
  return raw
    .map(t => ({
      date: t.data,
      startTime: t.ora_inizio,
      endTime: t.ora_fine,
      breakMinutes: 0,
      note: t.codice_turno || '',
      _codice: t.codice_turno,
      _testoGrezzo: t.testo_grezzo,
      _riga: t.riga_identificata,
      _colonna: t.intestazione_colonna,
    }))
    .filter(s => s.date && s.startTime && s.endTime);
}
