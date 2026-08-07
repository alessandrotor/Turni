// Proxy per l'estrazione turni da immagine.
//
// Esiste per una ragione sola: la chiave Gemini non può stare nell'app. Vite
// sostituisce le `import.meta.env.*` a build time, quindi una chiave nel client
// finirebbe in chiaro dentro il bundle, che Capacitor impacchetta come asset
// dell'APK — estraibile da chiunque con un unzip, tester della beta compresi.
//
// Qui dentro vivono la chiave, il prompt e i parametri del modello. L'app manda
// solo l'immagine già ridimensionata e riceve le celle grezze riconosciute: la
// normalizzazione di date e orari resta sul telefono (`src/services/gemini.js`),
// dov'è già collaudata.

const MODEL = 'gemini-3-flash-preview';
const MAX_OUTPUT_TOKENS = 65536;

// Tetto sul base64 in arrivo: l'app ridimensiona a 1600 px prima di spedire,
// quindi oltre questa soglia non c'è un uso legittimo, c'è qualcuno che abusa.
const MAX_IMAGE_BYTES = 3_000_000;

// Limiti per installazione e per IP. L'endpoint è pubblico e senza KV configurato
// il worker funziona lo stesso (utile per `wrangler dev`), ma senza protezione.
const DAILY_PER_INSTALL = 50;
const PER_MINUTE_PER_IP = 10;

const CORS = {
  // L'app gira in WebView Capacitor (origine `https://localhost`) e in dev su
  // Vite: elencare le origini non aggiungerebbe sicurezza — il CORS protegge il
  // browser, non il server — mentre romperebbe i client legittimi.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const responseSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      data: { type: 'STRING', description: 'Data del turno in ISO YYYY-MM-DD' },
      ora_inizio: { type: 'STRING', description: 'Ora di inizio HH:MM (24h), vuoto se assente' },
      ora_fine: { type: 'STRING', description: 'Ora di fine HH:MM (24h), vuoto se assente' },
      codice_turno: { type: 'STRING', description: 'Sigla grezza della cella, es. "M", "P", "R"' },
      testo_grezzo: { type: 'STRING', description: "Contenuto esatto della cella così com'è nell'immagine" },
      riga_identificata: { type: 'STRING', description: "Etichetta della riga associata all'utente" },
      intestazione_colonna: { type: 'STRING', description: 'Intestazione della colonna da cui deriva la data' },
    },
    required: ['data', 'ora_inizio', 'ora_fine', 'codice_turno', 'testo_grezzo', 'riga_identificata', 'intestazione_colonna'],
  },
};

function buildPrompt(workerName, currentYear) {
  const name = String(workerName || '').trim();
  const nameRule = name
    ? `\nIl foglio contiene i turni di PIÙ persone: estrai SOLO quelli di "${name}". Individua la sua riga (match parziale, ignora maiuscole/accenti), riporta l'etichetta trovata in "riga_identificata" e ignora tutte le altre persone.`
    : '\nRiporta in "riga_identificata" l\'etichetta della riga da cui provengono i turni (vuoto se non applicabile).';

  return `Sei un estrattore di turni da un'immagine di un foglio turni (griglia con persone sulle righe e giorni sulle colonne).

Per ogni turno di lavoro con orario valido, deriva:
- la DATA dall'intestazione della colonna (giorno/mese/anno). Se l'anno non è indicato usa ${currentYear}. Riporta l'intestazione grezza in "intestazione_colonna".
- gli ORARI di inizio/fine (24h HH:MM). Se la cella riporta solo una sigla senza orario, lascia ora_inizio/ora_fine vuoti ma compila comunque codice_turno e testo_grezzo.
- "codice_turno" = sigla grezza della cella; "testo_grezzo" = contenuto esatto della cella.
${nameRule}

Allineamento: incrocia con attenzione la riga della persona con la colonna del giorno; non spostarti di riga/colonna. Gestisci immagini irregolari: screenshot WhatsApp, foto storte o ruotate, colonne non perfettamente allineate, celle unite. Ignora intestazioni, totali, legende e celle vuote/di riposo senza orario.`;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// Conteggio a finestra fissa su KV. Eventualmente consistente: una raffica molto
// rapida può sforare di poco. Basta a fermare l'abuso continuativo, che è ciò
// che brucia la quota; contro un attacco mirato serve Play Integrity.
async function overLimit(kv, key, max, ttlSeconds) {
  if (!kv) return false;
  const current = Number(await kv.get(key)) || 0;
  if (current >= max) return true;
  await kv.put(key, String(current + 1), { expirationTtl: ttlSeconds });
  return false;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (url.pathname !== '/parse-shifts') return json({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!env.GEMINI_API_KEY) return json({ error: 'Proxy non configurato' }, 500);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body non valido' }, 400);
    }

    const { image, mimeType, workerName, installId } = body || {};
    if (typeof image !== 'string' || !image) return json({ error: 'Immagine mancante' }, 400);
    if (image.length > MAX_IMAGE_BYTES) return json({ error: 'Immagine troppo grande' }, 413);

    const ip = request.headers.get('CF-Connecting-IP') || 'sconosciuto';
    const today = new Date().toISOString().slice(0, 10);
    const minute = Math.floor(Date.now() / 60000);
    const install = String(installId || 'anonimo').slice(0, 40);

    if (await overLimit(env.RATE, `ip:${ip}:${minute}`, PER_MINUTE_PER_IP, 120)
      || await overLimit(env.RATE, `install:${install}:${today}`, DAILY_PER_INSTALL, 86400)) {
      return json({ error: 'Troppe richieste: riprova più tardi.' }, 429);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    let upstream;
    try {
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: buildPrompt(workerName, new Date().getFullYear()) },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Estrazione deterministica: stessa immagine → stesso risultato.
            temperature: 0,
            // LOW: sui test l'accuratezza è identica a MID/HIGH con molti meno
            // token immagine (prompt ~600 contro ~1400).
            mediaResolution: 'MEDIA_RESOLUTION_LOW',
          },
        }),
      });
    } catch {
      return json({ error: 'Il servizio di riconoscimento non risponde.' }, 502);
    }

    if (!upstream.ok) {
      // Il messaggio di Google può contenere dettagli della chiave: non rimbalzarlo.
      console.error('gemini', upstream.status, await upstream.text().catch(() => ''));
      const messaggio = upstream.status === 429
        ? 'Quota del riconoscimento esaurita: riprova più tardi.'
        : 'Il riconoscimento non è riuscito.';
      return json({ error: messaggio }, upstream.status === 429 ? 429 : 502);
    }

    const data = await upstream.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason ?? null;
    const u = data?.usageMetadata || {};

    // Troncamento esplicito: un JSON parziale perderebbe turni in silenzio.
    if (String(finishReason) === 'MAX_TOKENS') {
      return json({ error: 'Risposta troncata: nessun turno importato per non perdere dati.' }, 502);
    }

    const text = (candidate?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) return json({ error: 'Nessuna risposta dal modello (possibile blocco o quota).' }, 502);

    let items;
    try {
      items = JSON.parse(text);
    } catch {
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) return json({ error: "Nessun turno riconosciuto nell'immagine" }, 422);
      items = JSON.parse(m[0]);
    }
    if (!Array.isArray(items)) return json({ error: 'Nessun turno trovato' }, 422);

    return json({
      items,
      usage: {
        prompt: u.promptTokenCount ?? null,
        output: u.candidatesTokenCount ?? null,
        thinking: u.thoughtsTokenCount ?? null,
        total: u.totalTokenCount ?? null,
        finishReason: finishReason ? String(finishReason) : null,
        model: MODEL,
        resolution: 'LOW',
      },
    });
  },
};
