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

## Turnstile

Prova che dall'altra parte c'è un browser vero. È l'unica difesa che *previene*
l'abuso automatizzato invece di limitarne il danno: l'URL del proxy si ricava
decompilando l'app, quindi senza questo controllo un ciclo `for` basta a bruciare
la quota giornaliera.

```bash
npx wrangler secret put TURNSTILE_SECRET
```

Il **sitekey** (pubblico) va in `VITE_TURNSTILE_SITEKEY` nel `.env.local` dell'app.
Nella dashboard Cloudflare va creato in modalità **invisibile**, e fra i domini
ammessi deve comparire anche **`localhost`**: l'APK Capacitor gira su
`https://localhost` e senza quel dominio verrebbe rifiutato.

Senza `TURNSTILE_SECRET` il worker salta la verifica — comodo per `wrangler dev`,
**da non lasciare così in rete**.

## Limiti

Due contatori su KV, con comportamenti diversi in caso di guasto:

| | Soglia | Se KV non risponde |
|---|---|---|
| **Globale al giorno** | 300 | **Blocca** (503) — è il tetto di spesa |
| **Per installazione al giorno** | 25 | **Lascia passare** — è una guardia, non sicurezza |

La distinzione non è un dettaglio: `installId` arriva dal client e chiunque può
generarne uno nuovo a ogni richiesta, quindi non è un controllo di sicurezza e
non deve poter spegnere la funzione. Il tetto globale sì.

**Il conto delle scritture KV è il vincolo che regge il dimensionamento.** Il
piano gratuito dà 1.000 scritture al giorno e qui se ne fanno **due** per
richiesta: 300 × 2 = 600, con margine. Aggiungendo un terzo contatore si
arriverebbe a 900 e il fail-closed si rivolterebbe contro, spegnendo la funzione
quando il limitatore esaurisce la *propria* quota — prima ancora di raggiungere
il tetto di richieste. Se un giorno si alza il tetto, va rifatto questo conto.

Il conteggio è eventualmente consistente: una raffica molto rapida può sforare
di poco.

## Tetti per richiesta

| | Valore | Perché |
|---|---|---|
| `MAX_OUTPUT_TOKENS` | 12.288 | Un foglio mensile intero ne consuma ~3.400 |
| Immagine | 512 B – 3 MB | L'app ridimensiona a 1600 px prima di spedire |
| Formati | JPEG, PNG, WebP | Verificati sui **magic bytes**, non sul `mimeType` dichiarato |
| Nome | 80 caratteri, una riga | Finisce nel prompt |
| Risposta | 200 elementi, 200 caratteri per campo | Contro l'output pilotato dall'immagine |

## Cosa NON è coperto

Lo `responseSchema` impedisce al modello di uscire dalla forma prevista, quindi
un "ignora le istruzioni" scritto nell'immagine non ha dove sfogare. Restano:

- **turni falsi** inseriti nell'immagine — mitigati dalla modale di conferma,
  dove i turni si rivedono prima di importarli;
- **il tetto di spesa lato Google**, che va impostato su AI Studio / Cloud
  Console: è l'unico controllo che regge anche se il worker viene aggirato del
  tutto.
