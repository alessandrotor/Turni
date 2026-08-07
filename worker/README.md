# turni-ai-proxy

Proxy fra l'app e Gemini. Serve a tenere la chiave API **fuori dal pacchetto
Android**: Vite sostituisce le `import.meta.env.*` a build time, quindi una
chiave nel client finirebbe in chiaro dentro l'APK, leggibile con un unzip.

Qui dentro stanno chiave, prompt e parametri del modello. L'app manda l'immagine
già ridimensionata e riceve le celle grezze riconosciute.

## Primo avvio

```bash
cd worker
npm install
```

### In locale

Crea `worker/.dev.vars` (gitignorato):

```
GEMINI_API_KEY=la-tua-chiave
```

poi:

```bash
npm run dev        # espone http://localhost:8787
```

e nella root del progetto metti in `.env.local`:

```
VITE_AI_PROXY_URL=http://localhost:8787
```

### In rete

```bash
npx wrangler kv namespace create RATE     # una volta sola
# incolla l'id in wrangler.toml e togli il commento al blocco [[kv_namespaces]]

npx wrangler secret put GEMINI_API_KEY    # la chiave resta su Cloudflare
npm run deploy
```

Wrangler stampa l'URL finale (`https://turni-ai-proxy.<sottodominio>.workers.dev`):
va messo in `VITE_AI_PROXY_URL` **prima** di costruire l'AAB per il Play Store,
altrimenti l'app parte senza sapere a chi chiedere.

## API

`POST /parse-shifts`

```json
{ "image": "<base64 senza prefisso data:>", "mimeType": "image/jpeg",
  "workerName": "Mario Rossi", "installId": "tst_xxxx" }
```

Risposta `200`:

```json
{ "items": [ { "data": "...", "ora_inizio": "...", "...": "..." } ],
  "usage": { "prompt": 598, "output": 777, "thinking": 2032, "total": 3407 } }
```

Gli errori tornano come `{ "error": "messaggio in italiano" }` con lo stato HTTP
appropriato — l'app li mostra così come sono, quindi vanno scritti per essere
letti da chi usa l'app, non da chi la sviluppa.

## Limiti

Con il binding KV attivo: 10 richieste al minuto per IP e 50 al giorno per
installazione. Il conteggio è eventualmente consistente, quindi una raffica molto
rapida può sforare di poco: basta a fermare l'abuso continuativo (quello che
brucia la quota), non un attacco mirato.

L'URL è ricavabile decompilando l'APK. Per una beta chiusa è un rischio
accettabile; l'irrobustimento vero è legare l'accesso a Play Integrity.
