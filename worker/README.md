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

Due livelli con scopi diversi, e solo il primo costa scritture KV.

| | Soglia | Dove | Se si guasta |
|---|---|---|---|
| **Globale al giorno** | 300 | KV | **Blocca** (503) — e' il tetto di spesa |
| **Raffica per IP** | 5 / 60 s | rate limiting binding | **Lascia passare** |
| **Raffica per installazione** | 5 / 60 s | rate limiting binding | **Lascia passare** |

Il tetto globale sta su KV perche' deve valere su tutto il pianeta e perche' in
caso di guasto deve bloccare: se non si puo' leggere quanto si e' speso, non si
spende. E' l'unica difesa che regge anche quando tutto il resto e' aggirato.

Le due raffiche sono guardie contro il **ciclo**, non contro l'uso, e si
guastano in modo permissivo: dietro c'e' gia' il tetto globale. Coprono due
aggiramenti diversi — chi rigenera l'`installId` a ogni richiesta resta appeso
all'IP, chi cambia rete resta appeso all'installazione.

**Perche' al minuto e non al giorno.** Il binding accetta solo periodi da 10 o
60 secondi: finestre giornaliere non esistono. Contro la minaccia vera e' anche
la scelta migliore — chi abusa lo fa in ciclo, e un limite al minuto lo ferma in
pochi secondi, mentre un contatore giornaliero lo lascerebbe correre fino a
bruciare la quota di tutti.

Le soglie della raffica vivono in `wrangler.toml`, non nel codice: duplicarle
creerebbe un numero che sembra autorevole e non lo e'.

**Il conto delle scritture KV.** Il piano gratuito ne da' 1.000 al giorno e qui
se ne fa **una** per richiesta: 300 su 1.000, con margine largo. Erano due
finche' esisteva il contatore "25 al giorno per installazione", sostituito dalle
raffiche. Se un giorno si alza il tetto globale, va rifatto questo conto — e va
rifatto anche `check-proxy-difese.mjs`, che asserisce la singola scrittura.

Il conteggio globale e' eventualmente consistente: una raffica molto rapida puo'
sforare di poco. Il rate limiter, in piu', conta **per singolo data center**, e
Cloudflare lo dichiara "non un sistema di contabilita' accurato": va bene per
una guardia, non andrebbe bene per un tetto di spesa.

## CORS

Ristretto, ma con un'avvertenza su cosa protegge: il CORS vive nel **browser**.
Impedisce a una pagina di terzi di leggere la risposta di questo proxy usando la
sessione di un tuo utente. Contro uno script a riga di comando non fa nulla —
basta non mandare l'header `Origin`.

Per questo un'origine non ammessa non viene respinta con un errore: sarebbe
teatro. Semplicemente non le si restituisce il permesso.

Ammessi: `turni-9vr.pages.dev` e i suoi sottodomini (sito di prova e anteprime
di Pages), `https://localhost` per la WebView Capacitor dell'APK, e
`http://localhost:<porta>` per `npm run dev`.

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
