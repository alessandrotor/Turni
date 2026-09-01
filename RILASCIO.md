# Cancello di rilascio — Turni 1.0

**Otto domande. Se anche una sola risposta è «no» o «credo di sì», non si
pubblica: si sposta.**

*(Erano sette fino al 31 agosto. L'ottava — «il lavoro dell'utente è davvero
salvato?» — è entrata dopo la lettura del codice: era l'unica famiglia di guasti
capace di far perdere tutto senza un segnale, e nessuna delle altre sette la
sfiorava. Il resto di quella lettura sta in `COSE-NUOVE.md`, che non è un cancello
e non blocca niente.)*

Non sono un elenco di lavori fatti: sono cose che devono risultare **vere**
lunedì mattina, e verificabili da qualcun altro. Per questo sotto ogni domanda
c'è il modo di rispondere. Una casella spuntata a memoria non vale — il 18
agosto abbiamo scoperto che il worker in rete era il codice di dieci giorni
prima, e nessuno se n'era accorto perché tutti leggevano il repository invece
del server.

**Legenda:** `[x]` chiusa e verificata · `[~]` il lavoro è fatto ma la prova va
rifatta sul sito vero · `[ ]` da fare.

**Stato al 31 agosto 2026, dopo il deploy in produzione: 5 chiuse, 1 a metà,
2 da fare.**
Il sito è online con il lavoro di agosto — header, informativa vera, salvataggio
che avverte quando fallisce — e questo ha chiuso la **3** e la **4**, verificate
sul server e non sul repository. La **7** si è chiusa sul ramo che va davvero
online. Restano la **6** (il giro su due computer e due telefoni) e la **8** (il
salvataggio provato per davvero), più la **5** che aspetta un telefono vero.
La pagina Statistiche NON è stata pubblicata: è spenta da `VITE_BETA_STATS`.
La **5** (rete di sicurezza) è passata da «non cominciata» a fatta e provata:
resta a metà solo perché manca il collaudo su un telefono vero. Quella che può
ancora spostare il rilascio è la **4** (informativa), che aspetta il deploy
manuale in produzione.

C'è inoltre **una domanda che il rilascio non può chiudere**, perché la risposta
arriva da fuori: quale dei due modi di contare le ore del mese corrisponde a
quello che scrive la busta. Si scioglie con il cedolino di agosto, atteso
**intorno al 10 settembre 2026**. Non blocca la pubblicazione — sta in fondo,
dopo le sette domande, con il modo di rispondere.

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

- [x] **3. Il sito manda gli header di sicurezza**, e girando per tutta l'app
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
  > **Chiusa il 31/08/2026, sul sito vero.** Dopo il deploy manuale in
  > produzione, `curl -sI https://turni-9vr.pages.dev/` risponde con
  > `content-security-policy`, `strict-transport-security` (max-age 31536000,
  > includeSubDomains), `x-frame-options: DENY`, `x-content-type-options` e
  > `referrer-policy`. Non dedotto dal repository: letto dal server.
  >
  > La SECONDA metà — il giro dei nove flussi con zero violazioni — resta quella
  > del 19/08 sul sito di prova. La CSP servita è la stessa (viene dallo stesso
  > `public/_headers`), quindi la spunta si chiude; ma se qualcuno rifà quel
  > giro in produzione e trova una violazione, vince lui.
  >
  > **Da rifare dopo ogni deploy manuale**, come la 1 dopo ogni deploy del
  > worker. E ricordare il corollario: `public/_headers` NON si applica dentro
  > l'APK, dove non c'è un server Pages di mezzo (vedi COSE-NUOVE.md §E9).

- [x] **4. L'informativa si apre da un indirizzo pubblico**, è collegata dentro
      l'app, e dice il vero.

  <details><summary>come si verifica</summary>

  **Fatto il 21/08:** l'informativa è riscritta, generata come pagina statica e
  collegata in fondo alle Impostazioni («Come vengono trattati i tuoi dati»).
  Resta da **verificarla dal telefono sul sito di prova**, e da pubblicarla in
  produzione con il deploy manuale.

  Prima diceva il falso in un punto non piccolo: «l'app non trasmette il nome»,
  mentre il nome parte a ogni import. Ora la tabella dei destinatari, il
  trasferimento fuori dall'Unione e l'uso dei contenuti da parte di Google sul
  piano gratuito sono scritti, non impliciti.

  Aprila **dal telefono, partendo dal link dentro l'app**, non dal file nel
  repository.

  **Il codice HTTP da solo mente.** Il 21/08 `/privacy` rispondeva **200**
  perché la SPA serve `index.html` a qualunque indirizzo. Guarda il CONTENUTO:

  ```bash
  curl -s https://turni-9vr.pages.dev/privacy/ | grep -ci "identificativo di sessione"
  ```
  Zero occorrenze = non è pubblicata, per quanto il 200 dica il contrario.

  **E provala anche dalla PWA installata**, non solo dal browser: il service
  worker devia ogni navigazione su `index.html`, e senza l'esclusione aggiunta
  in `vite.config.js` il link aprirebbe il calendario. Sarebbe un'informativa
  «pubblicata» che nessun utente può leggere.

  Una sola sorgente: `docs/privacy.md`. La pagina si rigenera da sola a ogni
  build (`npm run prebuild`), perché due copie a mano divergono e quella
  sbagliata è sempre la copia che legge l'utente.
  </details>

  > **Pubblicata il 31/08/2026 e verificata nel CONTENUTO**, non nel codice
  > HTTP: `curl -s https://turni-9vr.pages.dev/privacy/` contiene
  > «identificativo di sessione» e il passaggio sull'uso dei contenuti da parte
  > di Google sul piano gratuito. Resta da aprirla **dal telefono, partendo dal
  > link dentro l'app**, e dalla PWA installata.
  >
  > **Ma dice ancora il falso in un altro punto — 31/08/2026.**
  > `docs/privacy.md:27-30` promette che «i tuoi turni spariscono e **non sono
  > recuperabili da nessuna parte**. Non esiste una copia altrove». Ma
  > `android/app/src/main/AndroidManifest.xml:5` lascia `allowBackup="true"`:
  > con Auto Backup i dati dell'app — WebView storage compreso, dove stanno i
  > turni — finiscono sul Google Drive dell'utente.
  >
  > Va chiuso scegliendo, non riscrivendo in fretta: `allowBackup="false"` rende
  > vero ciò che è già scritto; tenerlo acceso è legittimo — è perfino una rete
  > di sicurezza contro la perdita dei dati (vedi domanda 8) — ma allora il
  > paragrafo va riscritto **e** dichiarato nel modulo Data Safety di Play.
  > Serve anche `android:dataExtractionRules` (API 31+), altrimenti il default
  > include tutto anche nel trasferimento fra dispositivi.
  >
  > Si verifica per davvero solo con `adb shell bmgr backupnow <package>`, non
  > deducendolo. Dettaglio in `COSE-NUOVE.md` §B1.

- [~] **5. Nessun punto dell'app lascia lo schermo bianco**, e la schermata di
      errore permette di salvare i propri dati.

  <details><summary>come si verifica</summary>

  Forza un'eccezione dentro una vista e prova a **scaricare il backup dalla
  schermata di errore**. Funziona perché `costruisciBackup()` legge direttamente
  da `localStorage` e non dipende dall'interfaccia.

  Provalo **stando sulla vista Agenda**: è il codice più giovane dell'app.

  Non basta vedere la schermata: il file va **aperto**, e dentro ci devono
  essere i turni. Una schermata d'errore con un pulsante che non produce nulla
  è peggio di nessun pulsante, perché toglie anche il sospetto.
  </details>

  > **Fatto e verificato il 23/08/2026 sul pacchetto di produzione**
  > (`vite preview` su `dist`, non sul server di sviluppo: l'overlay di Vite
  > nasconde proprio ciò che si vuole guardare).
  >
  > `ErrorBoundary` avvolge `App` in `main.jsx` — fuori e non dentro, altrimenti
  > un errore nella radice porterebbe via anche il salvagente. Caduta forzata
  > nel render della vista Agenda, con 12 turni in memoria:
  > `#root` non resta vuoto, compare la schermata; il pulsante ha **scaricato
  > davvero** `Turni_backup_2026-08-23.json`, e il file aperto conteneva i 12
  > turni, le impostazioni e la vista scelta. Ricaricando senza la caduta
  > armata l'app torna normale.
  >
  > Se il download fallisce — su Android `deliver()` carica i plugin Capacitor
  > con import dinamici, che in uno stato rotto possono fallire a loro volta —
  > la schermata ripiega sul backup in chiaro dentro un riquadro di testo, da
  > copiare a mano. Quella via non dipende da niente.
  >
  > **Resta [~] e non [x]** per due ragioni oneste: la prova è su Chromium da
  > riga di comando, non su un telefono vero; e un error boundary intercetta gli
  > errori di RENDER, non quelli nei gestori di eventi né quelli asincroni. Lo
  > schermo bianco è coperto, «nessun punto dell'app» è più di così.

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

  **E l'APK non è il sito.** Il sito prende le variabili dalla CI, l'AAB le
  prende da `.env.local` sulla macchina di chi compila: è un'asimmetria che
  nasconde i guasti fino al primo tester. Prima di ogni `npm run android:release`:

  ```bash
  grep -c VITE_TURNSTILE_SITEKEY .env.local   # deve dare 1
  grep VITE_TELEMETRY_URL .env.local          # deve essere vuota per lo Store
  npm run build && node scripts/check-dati-in-uscita.mjs
  ```

  Attenzione all'ultimo: senza `dist/` **non fallisce**, stampa una riga e passa
  (`scripts/check-dati-in-uscita.mjs:110-112`). Va lanciato dopo la build, o non
  ha controllato niente.
  </details>

  > **Al 31/08/2026 quel controllo fallisce, in due direzioni opposte.**
  > `.env.local` **non ha** `VITE_TURNSTILE_SITEKEY` e **ha**
  > `VITE_TELEMETRY_URL` valorizzata: l'AAB che uscirebbe oggi ha l'import da
  > foto **morto al 100%** (403 «ricarica la pagina», consiglio che non risolve
  > nulla perché il difetto è nel pacchetto) **e** la telemetria accesa. Vedi
  > `COSE-NUOVE.md` §B2.

- [x] **7. Gli script sulle buste reali passano sul codice che va online.**
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

  > **Chiusa il 31/08/2026 su `main`, dopo il merge di rilascio e prima del
  > deploy**: 22 script, tutti verdi — non più tredici, perché nel frattempo
  > sono arrivati i riscontri sulle buste 2026 (`check-buste-2026.mjs`, 60
  > confronti a zero scarti su cinque cedolini), la tabella retributiva del
  > turismo e la strada di consegna dei file.
  >
  > **Da rifare a ogni merge di rilascio.** E vale ancora l'avvertenza di
  > CLAUDE.md: `check-dati-in-uscita.mjs` esamina `dist/`, quindi va lanciato
  > DOPO una build — senza, non fallisce ma non ha controllato niente
  > (COSE-NUOVE.md §E8).

- [ ] **8. Un turno inserito è davvero salvato, e il backup che l'app dice di
      aver scaricato esiste davvero.** Non «lo mostra a schermo»: è sul disco, e
      c'è ancora dopo un ricaricamento.

  <details><summary>come si verifica</summary>

  Le altre sette domande proteggono dati, sito e pacchetto. Nessuna guarda il
  posto in cui l'app **è** l'archivio: non c'è server, non c'è account, e se il
  localStorage rifiuta una scrittura nessuno se ne accorge — oggi `setValue`
  aggiorna lo stato React comunque (`src/hooks/useLocalStorage.js:16-20`,
  `catch { /* ignore quota errors */ }`). L'utente vede il turno nel calendario,
  i totali si aggiornano, e al ricaricamento non c'è più.

  **Prova 1 — la scrittura che fallisce.** Nella console del browser, *prima* di
  inserire un turno:

  ```js
  Storage.prototype.setItem = function () { throw new DOMException('QuotaExceeded'); };
  ```

  Inserire un turno. Oggi: compare, e sparisce al ricaricamento, in silenzio.
  Deve invece comparire un messaggio che dica che **non** è stato salvato.

  **Prova 2 — il backup che non arriva.** Nel ramo browser `deliver()` fa
  `a.click()` e finisce (`src/services/export.js:52-64`): `a.click()` non
  restituisce nulla e non lancia, quindi se il download è bloccato — Safari iOS
  in PWA, browser interno di Instagram o Facebook — la promessa si risolve **con
  successo** e l'app annuncia «Backup scaricato: N turni al sicuro».

  Provare il backup da un browser interno o da iOS in modalità PWA, e guardare
  se il file esiste davvero. Se non c'è, l'app non deve dire che c'è.

  Le due insieme sono il guasto peggiore possibile per quest'app: i turni non si
  salvano **e** il backup che li avrebbe recuperati non è mai stato scritto.
  Nessuna delle due lascia un segnale.

  Nota per chi risponde: `ErrorBoundary.jsx:47` mostra proprio quel messaggio
  rassicurante, e il salvagente del testo grezzo (`:54-61`) **non scatta**,
  perché nessuna eccezione è stata lanciata.
  </details>

  > **Aperta dal 31/08/2026.** Vedi `COSE-NUOVE.md` §A1 e §A2 — dove ci sono
  > anche i sei difetti minori della stessa famiglia (ripristino senza
  > annullamento, backup che non valida il contenuto, correzione orari che si
  > perde alla prima modifica).

---

## In attesa della busta di agosto — quale dei due conteggi è quello vero

**Non è un'ottava domanda: è l'unica cosa in questo elenco che non dipende da
noi.** Il rilascio non l'aspetta.

Su un CCNL mensilizzato l'app può contare le ore del mese in due modi, e li
espone entrambi in Impostazioni (`periodoConteggio`):

- **mese di paga** (default) — settimane intere, dal primo lunedì del mese alla
  domenica prima del primo lunedì del mese dopo;
- **mese di calendario** — dal 1 all'ultimo giorno.

**Cosa è già riscontrato e cosa no.** Le buste di giugno e luglio 2026 hanno
stabilito che la *soglia* del lavoro supplementare si conta sul mese di paga:
131,45 − 103,20 = 28,25 e 109,70 − 103,20 = 6,50, esatti entrambi
(`scripts/check-mese-paga-2026.mjs`). Resta da confermare la cosa accanto, che
non è la stessa: che anche il **totale ore stampato** in busta segua quel taglio,
e quindi che il default dell'app mostri il numero che l'utente si aspetta di
ritrovare sul cedolino.

**Perché proprio agosto risponde.** È il mese in cui le due letture divergono di
più, quindi la busta discrimina invece di lasciare il dubbio:

| | periodo | ampiezza |
|---|---|---|
| mese di paga | 3 ago → **6 set** | 5 settimane |
| mese di calendario | 1 ago → 31 ago | 31 giorni |

Cinque settimane contro poco più di quattro: se i due numeri fossero vicini il
confronto non direbbe nulla, qui invece separa. (Settembre, per dire, tornerebbe
a 4 settimane e sarebbe una prova più debole.)

<details><summary>come si verifica</summary>

**Scrivi i due numeri PRIMA che arrivi la busta.** Apri agosto 2026 in
Calendario, annota le ore totali con `periodoConteggio` su *mese di paga*, poi
cambia in *mese di calendario* e annota di nuovo. Metti le due cifre qui sotto.

È lo stesso principio della lista scritta prima al punto 6: a busta aperta si
sceglie senza accorgersene la lettura che assomiglia di più al numero stampato,
e la prova diventa una conferma di sé stessa.

Poi confronta con le **ore** del cedolino, non con l'importo: gli importi
contengono maggiorazioni e indennità che qui non c'entrano.

Attenzione a un dettaglio che potrebbe già essere una risposta: il mese di paga
di agosto **si chiude il 6 settembre**, e la busta viene emessa intorno al 10. Fa
in tempo a contenerlo — ma se le ore stampate si fermassero al 31 agosto, quello
stesso è il dato che decide.
</details>

### Un secondo discriminante, arrivato per caso: le ferie a cavallo

**Ferie di 15 giorni cominciate lunedì 31 agosto 2026.** È una fortuna per questa
prova, perché il 31 agosto è il lunedì che apre l'ULTIMA settimana del mese di
paga di agosto (3 ago → 6 set). Le due letture non divergono più di qualche ora
discutibile: divergono di un numero intero che si conta con un dito.

| lettura | giornate di ferie che finiscono nella busta di AGOSTO |
|---|---|
| mese di paga | **7** — 31 ago + 1, 2, 3, 4, 5, 6 set |
| mese di calendario | **1** — solo il 31 ago |

È un discriminante migliore del totale ore, perché non dipende da quanto sono
completi i turni inseriti nell'app: sette contro uno non lascia spazio a
interpretazioni.

**COME SI LEGGE, altrimenti la prova non vale niente.** Zucchetti stampa le ferie
godute come **montante progressivo dell'anno**, non come dato del mese: il numero
sul cedolino di luglio comprende ore consumate a marzo. Quindi NON si guarda il
numero stampato su agosto — si fa la **differenza fra il montante di agosto e
quello di luglio**. Chi legge il valore assoluto e lo confronta con 7 non sta
misurando niente.

Vale anche al contrario, e va detto perché ci siamo già cascati: la busta di
luglio **non dimostra nulla** sulle ferie. Riporta 5,50 h di ferie e 4,50 di
permessi «godute», ma sono montanti che risalgono a marzo, non assenze cadute nel
periodo 6 lug → 2 ago. Per un po' quelle cifre sono state citate nel codice come
prova che «le ferie stanno dentro la Retribuzione, verificato nel periodo» —
corretto il 1° settembre 2026 in `utils/assenze.js` e `check-assenze.mjs`. Il
comportamento resta quello atteso per un mensilizzato, ma è un'attesa ragionata,
non un riscontro: agosto è la prima occasione vera di verificarlo.

> **Da compilare.** Montante ferie godute: luglio ……… · agosto ……… ·
> differenza ……… (previsione scritta prima: **7 giornate**, cioè 28 h su un
> part-time da 4 h/giorno).

**Cosa farne, in un verso e nell'altro.**

- Se vince il **mese di paga**: la spunta si chiude, il default resta com'è, e la
  busta di agosto diventa il terzo cedolino di riscontro — vale la pena scriverne
  lo script (`scripts/check-busta-agosto-2026.mjs`, sul modello di quelli di
  giugno e luglio). Con tre buste si potrebbe anche riprendere la questione
  aperta sulla base del TFR, che con due sole non si poteva decidere.
- Se vince il **mese di calendario**: cambia il default in `DEFAULT_SETTINGS`
  (`src/App.jsx`) e aggiorna di conseguenza `docs/motore-di-calcolo.md` §16, dove
  le due letture sono descritte come «due tagli diversi sugli stessi turni».
  Nessuna formula del motore cambia: la soglia del supplementare resta sul mese
  di paga, che è riscontrato a parte.

> **Da compilare.** Ore di agosto 2026 nelle due modalità, annotate il ……… :
> mese di paga ……… h · mese di calendario ……… h.
> Busta ricevuta il ……… : ore stampate ……… h → vince ………

---

## Se devi tagliare

Sacrifica in quest'ordine: **il secondo proxy per le prove**, l'elenco ristretto
di chi può chiamare il proxy, il collaudo automatico in CI, il pulsante
«cancella tutti i dati». Nessuna delle quattro compare fra le sette domande.

**Non sacrificare mai** gli header, l'informativa, la rete di sicurezza. Se una
di queste non è pronta, si sposta il rilascio.
