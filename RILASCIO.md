# Cancello di rilascio — Turni 1.0

**Sette domande. Se anche una sola risposta è «no» o «credo di sì», non si
pubblica: si sposta.**

Non sono un elenco di lavori fatti: sono cose che devono risultare **vere**
lunedì mattina, e verificabili da qualcun altro. Per questo sotto ogni domanda
c'è il modo di rispondere. Una casella spuntata a memoria non vale — il 18
agosto abbiamo scoperto che il worker in rete era il codice di dieci giorni
prima, e nessuno se n'era accorto perché tutti leggevano il repository invece
del server.

**Legenda:** `[x]` chiusa e verificata · `[~]` il lavoro è fatto ma la prova va
rifatta sul sito vero · `[ ]` da fare.

**Stato al 21 agosto 2026 (venerdì): 2 chiuse, 2 a metà, 3 da fare.**
Le due che possono spostare il rilascio sono la **4** (informativa) e la **5**
(rete di sicurezza): nessuna delle due è cominciata.

Questo file si cancella dopo la pubblicazione.

---

- [x] **1. Una richiesta al proxy senza lasciapassare viene rifiutata** — e
      l'ho verificato, non dedotto.

  <details><summary>come si verifica</summary>

  ```bash
  # Serve un'immagine vera in base64 (>512 caratteri): va bene un'icona del progetto.
  node -e "const fs=require('fs');fs.writeFileSync('/tmp/p.json',JSON.stringify({
    image:fs.readFileSync('public/pwa-192x192.png').toString('base64'),
    mimeType:'image/png',workerName:'Prova',installId:'prova',turnstileToken:''}))"

  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    https://turni-ai-proxy.magnaopa.workers.dev/parse-shifts \
    -H "Content-Type: application/json" -H "Origin: https://esempio.test" \
    --data-binary @/tmp/p.json
  ```
  Atteso: **403**. Se torna 200, il proxy è aperto.

  Prova gemella, che copre le difese sull'immagine — duemila byte casuali
  dichiarati come PNG devono dare **415**, non 502.
  </details>

  > **Verificato il 19/08/2026.** 403 con `turnstileToken` vuoto da origine
  > estranea; 415 sui byte casuali. Prima della distribuzione del worker
  > davano 200 e 502.
  > **Da rifare dopo ogni `wrangler deploy` del worker** — martedì è previsto
  > il rifacimento dei contatori, quindi questa spunta va tolta e riconquistata.

- [x] **2. So con certezza su che piano è il progetto Gemini**, perché l'ho
      guardato. Se è gratuito non c'è spesa da fermare e i contatori del worker
      sono la difesa; se la fatturazione è attiva, il tetto in AI Studio è
      impostato.

  <details><summary>come si verifica</summary>

  Google AI Studio → **Spend**. Se compare un piano a pagamento, imposta
  *Monthly spend cap → Edit spend cap*: è un blocco vero, non un avviso. I
  «budget» di Cloud Billing mandano solo una mail mentre la spesa continua.

  Guardalo, non ricordarlo: la scelta del piano è anche una **decisione di
  privacy** (sul gratuito Google può usare le immagini per addestramento e
  farle vedere a revisori), e va allineata con quello che dice l'informativa
  al punto 4.
  </details>

  > **Guardato il 19/08/2026: piano gratuito**, nessuna fatturazione attiva.
  > Non c'è spesa da fermare, quindi il tetto in AI Studio è rinviato al
  > dopo-lancio — decisione presa a ragion veduta, non dimenticanza. In cambio
  > i contatori del worker sono diventati la difesa principale, ed è per questo
  > che il 19 sono passati da rifinitura a lavoro vero (raffica 5/60s per IP e
  > per installazione).
  >
  > **Ma resta un debito al punto 4:** sul piano gratuito Google può usare le
  > immagini per migliorare i propri servizi, e sono fogli turni con i nomi dei
  > colleghi. L'informativa deve dirlo.

- [~] **3. Il sito manda gli header di sicurezza**, e girando per tutta l'app
      non compare nessun errore nella finestra degli errori.

  <details><summary>come si verifica</summary>

  ```bash
  curl -sI https://turni-9vr.pages.dev/ | grep -Ei \
    "content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy"
  ```
  Al 19/08 rispondono solo `referrer-policy` e `x-content-type-options`, i due
  che Cloudflare aggiunge da sé: **CSP, HSTS e `frame-ancestors` mancano.**

  La seconda metà non è automatizzabile e conta di più: percorri i nove flussi
  con la console aperta — calendario nelle **due viste**, inserimento e modifica
  turno, statistiche, export Excel, export PDF, backup in esportazione e in
  importazione, import da foto, installazione PWA, uso offline. Zero violazioni.

  Nella CSP servono `challenges.cloudflare.com` in `script-src` **e**
  `frame-src`, altrimenti Turnstile si spegne. E **non** serve
  `'unsafe-inline'`: se qualcosa non va, non aggiungerlo «per sicurezza».
  </details>

  > **Fatta e verificata sul sito di PROVA il 19/08/2026.** `public/_headers`
  > esiste; securityheaders.com dà **A+**; il giro dei nove flussi con
  > l'ascoltatore `securitypolicyviolation` attivo ha dato **zero violazioni**,
  > compreso un token Turnstile ottenuto per intero. La CSP è nata in sola
  > segnalazione ed è passata in vigore solo dopo quel giro.
  >
  > **Non ancora in produzione**, dove il deploy è manuale: gli header partono
  > col rilascio. La spunta si chiude **dopo** aver rifatto `curl -I` sul sito
  > vero — non prima.

- [ ] **4. L'informativa si apre da un indirizzo pubblico**, è collegata dentro
      l'app, e dice il vero.

  <details><summary>come si verifica</summary>

  Aprila **dal telefono, partendo dal link dentro l'app**, non dal file nel
  repository. Oggi `docs/privacy.md` esiste ma non è pubblicata da nessuna
  parte, quindi nessun utente la incontrerà mai.

  **Il codice HTTP da solo mente.** Verificato il 21/08: `/privacy` risponde
  **200**, ma è la SPA che serve `index.html` a qualunque indirizzo — dentro
  non c'è una riga di informativa. Guarda il CONTENUTO:

  ```bash
  curl -s https://turni-9vr.pages.dev/privacy | grep -ci informativa
  ```
  Zero occorrenze = non è pubblicata, per quanto il 200 dica il contrario.

  «Dice il vero» include le cose scomode: destinatari (Google, Cloudflare),
  trasferimento fuori dall'Unione, e — se il progetto resta sul piano gratuito
  — che le immagini possono essere usate per migliorare i servizi di Google e
  viste da revisori umani. Sono fogli turni con i nomi dei colleghi.
  </details>

- [ ] **5. Nessun punto dell'app lascia lo schermo bianco**, e la schermata di
      errore permette di salvare i propri dati.

  <details><summary>come si verifica</summary>

  Forza un'eccezione dentro una vista e prova a **scaricare il backup dalla
  schermata di errore**. Funziona perché `costruisciBackup()` legge direttamente
  da `localStorage` e non dipende dall'interfaccia.

  Provalo **stando sulla vista Agenda**: è il codice più giovane dell'app.
  </details>

- [ ] **6. Online c'è la versione aggiornata**, provata su due computer e due
      telefoni seguendo una lista scritta.

  <details><summary>come si verifica</summary>

  La lista va scritta **prima** di eseguirla: compilata mentre si prova diventa
  l'elenco delle cose che hanno funzionato, non di quelle che si dovevano
  provare. Due telefoni veri, uno iOS e uno Android, con installazione PWA, uso
  offline e un import da **una foto vera** di un foglio turni.

  «La versione aggiornata» va verificata sul **pacchetto servito**, non sul
  commit: su Cloudflare Pages parte del contenuto arriva dalle variabili al
  momento della build, quindi due deploy dello stesso commit possono contenere
  cose diverse. È già successo.
  </details>

- [ ] **7. Gli script sulle buste reali passano sul codice che va online.**
      Il calcolo della paga è stato toccato questa settimana: questa è l'unica
      prova che i numeri di chi usa già l'app non si sono mossi.

  <details><summary>come si verifica</summary>

  ```bash
  git checkout main   # il ramo da cui si pubblica, dopo il merge di rilascio
  for f in scripts/check-*.mjs; do
    printf "%-42s" "$(basename $f)"
    node "$f" >/dev/null 2>&1 && echo OK || echo FALLITO
  done
  ```
  Tutti verdi, e in particolare i quattro `check-busta-*` su turismo e servizi
  fiduciari. Con la maggiorazione notturna a zero il motore deve dare gli stessi
  numeri di prima: è quello che dimostrano.

  Sul ramo che va online, non su quello di ieri.
  </details>

  > **Verdi su `experimental` al 21/08/2026** — tredici script, compresi i
  > quattro sulle buste reali. Ma «il ramo che va online» è `main` **dopo il
  > merge di rilascio**, che non è ancora avvenuto: la spunta si chiude lì.
  >
  > Nel frattempo il motore è stato toccato altre due volte (maggiorazione
  > notturna, e il 21 la previsione del reddito annuo), quindi questa verifica
  > conta più di quanto contasse quando è stata scritta.

---

## Se devi tagliare

Sacrifica in quest'ordine: **il secondo proxy per le prove**, l'elenco ristretto
di chi può chiamare il proxy, il collaudo automatico in CI, il pulsante
«cancella tutti i dati». Nessuna delle quattro compare fra le sette domande.

**Non sacrificare mai** gli header, l'informativa, la rete di sicurezza. Se una
di queste non è pronta, si sposta il rilascio.
