# Arretrati — quello che il cancello di rilascio non copre

**Stato al 31 agosto 2026.** Compagno di `RILASCIO.md`, non un suo doppione:
quello si cancella dopo la pubblicazione, questo serve soprattutto dopo.

`RILASCIO.md` fa sette domande sulla **pubblicazione** — proxy protetto, piano
Gemini, header, informativa, rete di sicurezza, deploy verificato, riscontri
verdi. Qui c'è ciò che quelle sette non toccano: difetti del **prodotto**, del
**calcolo** e della **conservazione dei dati**, trovati leggendo il codice e
misurandoli contro i cedolini reali in `dati-buste/`.

Due scelte già fatte, che spiegano l'ordine delle voci:

- nel 1.0 la stima del netto resta **accesa**, con avvisi più forti sui limiti
  noti, mostrati dove l'utente li incontra e non solo in Impostazioni;
- questo è un **inventario completo ordinato per gravità**, non un elenco di
  cose da fare prima di lunedì. Cosa entri nel rilascio si decide altrove.

**Ogni voce marcata *(verificato)* è stata letta nel codice o misurata, non
dedotta.** Dove il verdetto dipendeva da un'ipotesi, la voce lo dice: tre
sospetti gravi — doppioni all'import, ripristino annullato dalla modifica
successiva, telemetria con dati personali — sono stati controllati e **si sono
rivelati infondati**, e stanno in fondo fra le cose che vanno bene.

---

# A. Perdita silenziosa dei dati

Questa famiglia viene prima di tutto il resto. L'app non ha server né account:
il localStorage del browser **è** l'archivio. Qui non si tratta di numeri
imprecisi, ma di lavoro che sparisce senza che nessuno lo dica.

### A1. La scrittura fallita è invisibile — `src/hooks/useLocalStorage.js:16-20` *(verificato)*

```js
try { localStorage.setItem(key, JSON.stringify(next)); }
catch { /* ignore quota errors */ }
return next;                    // ← lo stato React è aggiornato comunque
```

Se `setItem` fallisce — quota esaurita, Safari in navigazione privata, WebView
con storage bloccato — **l'utente vede il turno nel calendario**, i totali si
aggiornano, tutto sembra a posto. Al ricaricamento non c'è più. Nessun
messaggio, nessun indizio. Con un mese di inserimenti la perdita è totale e si
scopre solo dopo.

È il difetto peggiore del progetto: l'app promette persistenza e mente in
silenzio. Il minimo indispensabile è propagare il fallimento e dirlo.

### A2. Il backup che non esiste — `src/services/export.js:52-64` *(verificato)*

Nel ramo browser `deliver()` fa `a.click()` e finisce. `a.click()` non
restituisce nulla e non lancia: se il download è bloccato (Safari iOS in PWA,
browser interni di Instagram o Facebook, impostazioni restrittive) **la promise
si risolve con successo** e l'app annuncia «Backup scaricato: N turni al
sicuro».

Non esiste, nel codice attuale, alcun modo di sapere se il file è arrivato.
L'utente crede di avere un backup e non ce l'ha — il fallimento più caro
possibile, perché si scopre il giorno in cui serve. Aggravante:
`ErrorBoundary.jsx:47` mostra proprio quel messaggio rassicurante, e il
salvagente del testo grezzo (`:54-61`) **non scatta**, perché nessuna eccezione
è stata lanciata.

**A1 e A2 insieme sono la perdita totale con zero segnali**: i turni non si
salvano e il backup che li avrebbe recuperati non è mai stato scritto.

### A3. Il JSON corrotto viene cancellato invece che messo in salvo — `useLocalStorage.js:5-10` *(verificato)*

`JSON.parse` fallito → `initialValue`, in silenzio. L'utente apre l'app e trova
il calendario vuoto. Se a quel punto tocca qualunque cosa, `setValue` riscrive
la chiave e **i byte corrotti — in parte recuperabili a mano — spariscono per
sempre**. Manca la quarantena della stringa illeggibile e l'avviso «i dati
salvati non sono leggibili, non toccare niente».

### A4. Il file nativo finisce nella cache — `export.js:50` *(verificato)*

`directory: Directory.Cache`. Se l'utente chiude il foglio di condivisione senza
scegliere una destinazione, il backup vive solo in una cartella che Android e
iOS possono svuotare quando vogliono.

### A5. Il ripristino sostituisce senza rete — `services/backup.js:135-146` *(verificato)*

Quattro `setItem` in fila, nessuno protetto, e **nessuna copia dei dati attuali**
prima di sovrascriverli: nessun annullamento, nessuna opzione «unisci invece di
sostituire». Chi sbaglia file perde tutto in un click. Il commento a `:116` dice
«chi chiama deve aver già chiesto conferma»: una conferma non è un annullamento.

Se il secondo `setItem` fallisce per quota — ripristinare un backup grosso su uno
storage quasi pieno è proprio il caso tipico — i turni sono già stati sostituiti
e le impostazioni no: **stato misto**, e l'eccezione che risale è un
`QuotaExceededError` grezzo, non uno dei messaggi in italiano scritti sopra.

*(Il timore che il ripristino venisse annullato dalla prima modifica successiva
è infondato: `Settings.jsx:228` ricarica la pagina, con il commento che spiega
perché.)*

### A6. `validaBackup` controlla la busta, non il contenuto — `backup.js:98-112` *(verificato)*

Verifica che sia un oggetto, che `app === 'turni'`, che `turni` sia un oggetto.
**Nessun controllo sulle singole voci**: chiavi non-data, orari assurdi,
`breakMinutes` negativi passano tutti e finiscono in localStorage, da dove
entrano nei calcoli (NaN) o nel render — con gli originali già cancellati da A5.

Inoltre `if (dati.formato > FORMATO)` non ferma il file senza `formato`:
`undefined > 1` è `false`, quindi passa e viene interpretato come formato 1 —
esattamente ciò che il commento a `:26-28` dice di voler evitare.

### A7. Le scritture che scavalcano React — `correzioni.js:21` *(verificato)*

`correzioni.js` legge i turni da localStorage, li corregge e li riscrive
direttamente, mentre lo stato React contiene ancora i turni vecchi. La prima
modifica successiva riscrive la mappa vecchia e **fa tornare gli orari a :50**.
L'utente ha visto «12 turni corretti» e la correzione sparisce. A differenza del
ripristino, qui non c'è nessun reload.

### A8. Tre chiavi su otto restano fuori dal backup *(verificato)*

Inventario completo: `turni_shifts`, `turni_settings`, `turni_telemetry_off`,
`turni_cal_layout` (coperte), `turni_install_id` (esclusa di proposito e
documentata), e **`turni_setup_dismissed`, `turni_invio_foto_ok`,
`turni_install_dismissed`** (fuori, non documentate). Conseguenza modesta —
dopo un ripristino ricompaiono prompt e avvertenze già viste — ma va scritto,
perché oggi la copertura si deduce solo leggendo quattro file.

---

# B. Promesse non mantenute all'utente

Contraddicono qualcosa che l'app **dice**. Il punto 4 di `RILASCIO.md` esiste
perché l'informativa una volta diceva il falso: queste sono della stessa
famiglia.

### B1. `allowBackup="true"` contro l'informativa *(verificato)*

`android/app/src/main/AndroidManifest.xml:5` lascia attivo Auto Backup: i dati
dell'app — WebView storage compreso, dove stanno i turni — finiscono sul Google
Drive dell'utente. `docs/privacy.md:27-30` afferma l'opposto, in grassetto:

> «i tuoi turni spariscono e **non sono recuperabili da nessuna parte**. Non
> esiste una copia altrove.»

Scegliere: `allowBackup="false"` (coerente con quanto già scritto), oppure
riscrivere il paragrafo **e** dichiararlo nel Data Safety di Play. Manca anche
`android:dataExtractionRules` (API 31+), senza cui vale il default che include
tutto anche nel trasferimento fra dispositivi.

Nota non secondaria: se si sceglie `allowBackup="true"` consapevolmente, diventa
un rimedio parziale ad A1–A5.

### B2. L'AAB di oggi ha l'import morto e la telemetria accesa *(verificato)*

`.env.local` **non contiene** `VITE_TURNSTILE_SITEKEY` (zero occorrenze) e
**contiene** `VITE_TELEMETRY_URL` valorizzata. `npm run android:release`
(`package.json:12`) legge proprio quel file:

- **import spento al 100%**: `turnstile.js:12,19` → nessun token →
  `gemini.js:113-114` manda `turnstileToken: ''` → il worker risponde **403**
  «ricarica la pagina e riprova», consiglio che non risolve nulla perché il
  difetto è nel pacchetto;
- **telemetria accesa** in un pacchetto destinato allo Store.

Il sito di prova non lo mostra, perché la CI passa la sitekey da una variabile
GitHub (`deploy-test.yml:60`): è l'asimmetria fra build web e APK a nascondere
il guasto fino al primo tester.

### B3. L'import altera e scarta dati senza dirlo *(verificato)*

- `gemini.js:209-212`: `if (min === 50) min = 30`. Un turno che finisce davvero
  alle 12:50 viene salvato come 12:30 — **venti minuti di paga per turno** — e
  l'anteprima mostra già «12:30», senza segno che il valore sia stato cambiato
  rispetto alla foto. Per i dati già salvati esiste `correzioni.js`, che almeno
  mostra l'elenco; qui no.
- `gemini.js:178`: i turni non interpretabili vengono filtrati via. Il modale
  annuncia «Trovati 17 turni» e delle 3 mancanti non si sa nulla — né quante, né
  quali. L'utente conferma convinto che il foglio sia stato importato per
  intero, e il mese risulterà corto.

*(Il timore dei doppioni è infondato: `App.jsx importShifts` deduplica su
data+orari.)*

---

# C. Il calcolo applica il presente a tutta la storia

### C1. Un anno diverso dal 2026 usa la fiscalità 2026 — *misurato*

`src/utils/net.js` ha una sola tabella, `TAX_2026`, usata senza mai guardare
l'anno. `StatsView.jsx:81-91` lascia sfogliare tutti gli anni con dati.

| mese | app | busta reale | scarto |
|---|---|---|---|
| gen 2025 | 1.035,44 | 974,00 | **+61,44** |
| mar 2025 | 1.096,58 | 1.035,00 | **+61,58** |
| mag 2025 | 1.023,31 | 963,00 | **+60,31** |
| ott 2025 | 1.133,57 | 1.080,00 | **+53,57** |

**~59 €/mese, sempre verso l'alto.** Cause verificate: nel 2025 la detrazione
valeva ~1.380 € annui contro i 1.955 del 2026; nel 2024 c'era in più l'«Esonero
IVS L. 197/2022» (56–110 €/mese) che il motore non conosce. E il **1° gennaio
2027 questo diventa il caso normale**.

**Decisione presa: non calcolarlo fuori dal 2026.** Dove manca la tabella, ore e
lordo restano, e al posto del netto va una riga che spiega perché.

**Come si esegue.** Le funzioni fiscali non ricevono l'anno — `calcNetMonthly`
prende `monthDays`, non una data — quindi il controllo va nelle **tre giunture**
dove l'anno è già noto, che sono tutte e sole queste:

| dove | cosa fare |
|---|---|
| `src/hooks/useMonthlyNet.js:20,59` | aggiungere l'anno alla condizione di `showNetPanel`; al posto del pannello, la spiegazione |
| `src/utils/stats.js:87` | restituire `net: null` invece di 0, così la colonna resta vuota e non finge uno zero |
| `src/components/StatsView.jsx:129` | stessa condizione su `calcNetAnnual` |

In `net.js` esportare `ANNI_FISCALI = [2026]` e `fiscalitaDisponibile(anno)`:
la regola vive in un posto solo e aggiungere il 2027 sarà una riga.
`useMonthlyNet` importa già `TAX_2026` (`:4`), quindi il percorso è aperto.

Da scrivere in `RILASCIO.md` come **scadenza**: il 1° gennaio 2027 il netto
sparisce a tutti finché non arriva `TAX_2027`.

### C2. Il CCNL non è storicizzato — rischio reale, **non** dimostrato *(verificato)*

`settings.ccnl` è un campo unico (`ccnl.js:82,93`, `net.js:118,254`,
`notturno.js:75`): chi cambia contratto vede tutti i mesi passati ricalcolati con
quello nuovo, e non esiste l'equivalente di `previousRates`.

Sembrava un problema attuale — le fixture mostrano due datori. **Non lo è**: il
divisore implicito è 172,00 su tutte e 23 le buste di entrambi i datori, e le ore
contrattuali 103,20 ovunque. Cambiano livello e paga base, che `previousRates`
già copre. Resta un rischio per chi cambia settore davvero, ma è potenziale, e in
un progetto la cui regola è «nessun numero senza riscontro» va tenuto sotto le
cose dimostrabili.

---

# D. La configurazione non si difende, e non lo dice

### D1. «Salva» che non salva, senza un solo messaggio — `Settings.jsx:396` + i 16 `<details>` *(verificato)*

Il modulo è `<form onSubmit>` **senza `noValidate`**, quindi la validazione HTML
nativa è attiva. I campi stanno dentro **16 sezioni `<details>`, di cui una sola
aperta** (`:401`). Un `<input>` invalido dentro una sezione chiusa non è
focalizzabile: il browser **annulla la submit e non mostra nulla** — solo un
avviso in console.

Effetto pratico: si digita un valore, si richiude la sezione, si preme «Salva
impostazioni» e **non succede assolutamente niente**, nemmeno il «✓ Salvato!».
Il pulsante sembra rotto.

E scatta anche su valori legittimi, per via di `step`: `step="0.5"` sulle ore
settimanali rende invalido 37,25; `step="1"` sulle percentuali di malattia rende
invalido 66,66; `step="0.5"` su `absence-hours-setting` (`:848`) rende invalido
**6,67 — cioè proprio il numero che il placeholder di quel campo suggerisce**
(40 h ÷ 6 giorni).

### D2. Ore settimanali a 0: uno stato invisibile che falsa tutto — `Settings.jsx:28,497` *(verificato)*

`required` non compare **nemmeno una volta** nel file, e un `<input type=number>`
vuoto senza `required` è valido: si salva `expectedWeeklyHours: 0`. Alla
riapertura `value={form.expectedWeeklyHours || ''}` mostra un **campo vuoto**, e
l'utente crede che valga il default 40. Lo zero è invisibile e sopravvive ai
riavvii.

Da lì: soglia dei supplementari a 0 → **ogni ora lavorata diventa
supplementare**; ore di una giornata di ferie a 0 → ogni assenza vale zero. Lo
stesso schema vale per `dailyOvertimeThreshold` (`:539`) nel percorso «a
chiamata».

### D3. Il primo avvio produce due errori, entrambi ottimistici *(verificato)*

Un utente che non sia l'autore vede all'apertura **un solo campo**: la paga
oraria. Compila, salva, ottiene «✓ Salvato!» — e ha configurato l'app con
**tutte le maggiorazioni a 0** e **le addizionali a 0**. I due errori vanno
nella stessa direzione:

- maggiorazioni a 0 → il lordo è **più basso** del reale per chi lavora
  domeniche, festivi e notti, cioè il pubblico dell'app;
- addizionali a 0 → il netto è **più alto** del reale.

Nessun campo è marcato indispensabile, non esiste un indicatore di completezza,
e il «✓ Salvato!» è identico per una configurazione completa e per una vuota.
L'unica retroazione — l'anteprima settimanale — **sparisce** se la paga è 0 o se
si è a chiamata, cioè proprio quando servirebbe.

Esiste già in casa il modello da imitare: l'avviso sulla fascia notturna
divergente dal CCNL, con il pulsante «usa quella del contratto» (`:692-709`), è
l'unico controllo di coerenza del file e dimostra che il pattern era alla
portata.

### D4. Il lavoro in corso si perde con un tocco — `ShiftForm.jsx:198` *(verificato)*

`onClick={(e) => e.target === e.currentTarget && onClose()}` sull'overlay:
chiusura immediata, nessuna conferma. Su un telefono l'area attorno al modale è
ampia e il tocco accidentale è banale. Il caso peggiore è il **periodo di
assenza**: si impostano venti giornate, si tolgono i riposi, si correggono le ore
riga per riga — il lavoro manuale più lungo dell'app — e un tocco azzera tutto.

Stessa lacuna in `Settings.jsx`, dove si perdono decine di campi uscendo dalla
vista. Il commento a `:1612-1615` dice che il link all'informativa usa
`target="_blank"` *«per non far perdere le modifiche non salvate»*: il problema
era noto e risolto per un link solo. E lo stato `saved` (`:90`) **già contiene**
l'informazione «ci sono modifiche non salvate», semplicemente non viene usata
per proteggere niente.

### D5. Campi fiscali senza alcun limite *(verificato)*

`type="text"` più `parseNum`, senza `min`/`max` né controlli: aliquota TFR
(`:1304`), addizionale regionale e comunale (`:1337,1352`), reddito annuo
previsto (`:562`), montante (`:943`). Il testo dichiara i range plausibili
(1,23–3,33%) ma **non li impone**: digitare `12,3` invece di `1,23` toglie ~11%
del lordo dal netto, in silenzio. È l'errore di battitura più tipico che esista.

### D6. Il CCNL scritto ma non scelto — `Settings.jsx:339-345` *(verificato)*

La combobox tiene separati il testo digitato e il codice. Se si scrive
«commercio terziario» senza selezionare dalla tendina, **a schermo resta scritto
il contratto** ma si salva `ccnl: ''` → preset generico, con divisore orario
52/12 invece di quello vero. E il divisore è il dato che `CLAUDE.md` documenta
come determinante.

### D7. La combobox non è usabile da tastiera — `Settings.jsx:996,1009` *(verificato)*

La selezione avviene solo con `onMouseDown`; `onKeyDown` intercetta **solo**
Escape. Non esistono ↓/↑/Invio. Peggio: premendo Invio nel campo — essendo un
`<input type="text">` dentro un `<form>` — **si invia l'intero modulo** invece
di scegliere la voce. `role="combobox"` è dichiarato ma la lista non ha
`role="listbox"`/`option`: uno screen reader annuncia un combobox e poi non
trova nessuna opzione.

### D8. Altro, dalla stessa area *(verificato)*

- Righe di «paghe precedenti» e «voci fisse» incomplete vengono **scartate in
  silenzio** con il messaggio «✓ Salvato!» (`:256,261,265`).
- Nessun `max` su nessun campo data: assunzione nel 2030 accettata (`:1263`),
  `until` futura che applica la paga vecchia ai turni futuri (`:1427`).
- Submit **muta** se il periodo è attivo e nessuna riga è spuntata
  (`ShiftForm.jsx:145-147`): si preme il pulsante e non accade nulla.
- Nessun `aria-describedby` in tutto `Settings.jsx`: le decine di `form-hint`
  che spiegano i campi — la parte migliore dell'interfaccia — non sono associate
  ai campi per chi usa uno screen reader.
- La sezione **Addizionali IRPEF** non porta il marcatore BETA che `CLAUDE.md`
  prescrive per i calcoli fiscali, mentre lo porta il CCNL, dove i dati sono
  meglio verificati.
- Tre classi CSS diverse per lo stesso tipo di avviso (`:137,693,1076`): il
  segnale non si impara a riconoscere.

---

# E. Il giorno in cui si rompe, non lo sapremo

| # | Problema | Dove | Conseguenza |
|---|---|---|---|
| E1 | Worker senza log persistenti | manca `[observability]` in `worker/wrangler.toml` | I `console.error` esistono solo per chi ha un `wrangler tail` aperto. La diagnosi scritta apposta per il guasto più probabile (`index.js:388`) non la leggerà mai nessuno |
| E2 | Chiave Gemini scaduta = guasto generico | `worker/src/index.js:393-397` | 400/401/403 collassano in un 502 «Il riconoscimento non è riuscito»: si cerca il guasto ovunque tranne che nella chiave. Il 404 ha già il suo caso (`:387-391`), manca il gemello |
| E3 | Modello preview senza ripiego | `index.js:13` → `gemini-3-flash-preview` | Il codice ammette (`:384-386`) che i nomi preview vengono ritirati: quel giorno l'import muore per tutti finché non si modifica il sorgente e si ridistribuiscono **due** worker a mano. Basterebbe spostarlo in `[vars]` |
| E4 | Il tetto giornaliero è bruciabile da uno solo | `index.js:50`, `:334` | La raffica è 5/60 s per IP = 7.200/giorno: i 300 riconoscimenti di tutti se ne vanno in un'ora per mano di una persona |
| E5 | La procedura di deploy in produzione non esiste | `deploy-test.yml:3` rimanda a `memory/web-deploy.md`, **assente** | L'unico passo che porta online il 1.0 è manuale e vive nella testa di una persona — in un documento fondato su «verificabile da qualcun altro» |
| E6 | Chi ha l'APK non è raggiungibile | asset impacchettati, SW disattivo sul nativo (`main.jsx:22-27`) | Se dopo il rilascio si scopre un errore nel netto, chi ha l'APK continua a vederlo. Manca un controllo di «versione minima» o un avviso in app |
| E7 | Nessuna verifica che il worker in rete sia quello del repo | `check-proxy-difese.mjs:14` prova il codice, non il deploy | È l'incidente del 18 agosto (`RILASCIO.md:9-11`), e può ripetersi identico |
| E8 | `check-dati-in-uscita` verde senza aver controllato | `scripts/check-dati-in-uscita.mjs:110-112` *(verificato)* | Senza `dist/` stampa una riga e **non** fallisce: nel giro «tutti gli script verdi» il controllo più importante per la privacy può risultare superato senza essere stato fatto |
| E9 | Il beacon Cloudflare finisce nell'APK | `index.html:36`, non condizionato | Contatta `static.cloudflareinsights.com` a ogni avvio, non è nel Data Safety e l'informativa lo colloca fra i servizi *del sito*. **Corollario**: `public/_headers` non si applica dentro l'APK — il punto 3 di RILASCIO protegge metà utenti |

---

# F. Medi

| # | Problema | Dove | Nota |
|---|---|---|---|
| F1 | `0.6.0` contro «Turni 1.0» | `package.json:4` → `build.gradle:36-37` | Passando a `1.0.0` il versionCode salta da 600 a **10000**: da lì nulla di inferiore è più caricabile. Da decidere prima del primo upload |
| F2 | Nessun changelog | non esiste `CHANGELOG.md` | Play chiede le note a ogni upload; un tester non sa dire su quale versione ha visto il bug |
| F3 | PWA installata può restare indietro | `vite.config.js:12-17`, `main.jsx:29-31` | Il SW cerca aggiornamenti al caricamento: una PWA mai chiusa davvero può restare vecchia a lungo. E con `autoUpdate` la ricarica, se arriva mentre si compila un turno, se lo porta via |
| F4 | Due schede si sovrascrivono | nessun listener `storage` in `useLocalStorage` | Ogni scheda riscrive l'intero oggetto turni dalla propria copia in memoria: lavorare in due schede cancella il lavoro dell'altra. Alto su desktop, nullo nell'APK |
| F5 | Il limitatore «per installazione» non limita | `gemini.js:13` genera un id nuovo a ogni caricamento | Basta un F5. `worker/README.md:106-107` descrive una difesa che non esiste più |
| F6 | Turnstile è un punto singolo di guasto | `turnstile.js:13` → `index.js:208` | Un suo disservizio spegne l'import anche con Gemini e worker sani; la via di fuga (togliere `TURNSTILE_SECRET`) non è scritta da nessuna parte |
| F7 | `xlsx@0.18.5` abbandonato su npm | `package.json:24` | Attenuante verificata: usata solo in scrittura (`export.js:69,93-97`), mai per leggere file dell'utente. Ma non c'è una versione npm a cui aggiornare |
| F8 | La suite non è riproducibile da terzi | `dati-buste/` gitignorata | `RILASCIO.md:6-7` pretende «verificabile da qualcun altro»: per i riscontri sulle buste non lo è |
| F9 | Build non firmata se manca il keystore | `build.gradle:23-27, 68-70` | Oggi `android:release` produrrebbe un AAB che Play rifiuta, e lo scopriresti in Console |
| F10 | Anteprima import non modificabile | `ImportModal.jsx` | O si accetta tutto o si annulla tutto: un orario sbagliato costringe a rifare l'import |
| F11 | La telemetria non è filtrata dal modulo | `telemetry.js:69-74` | Lo spread `...data` è aperto. **Nei fatti** il chiamante passa solo booleani e metriche (`CalendarView.jsx:388-391`), quindi oggi nessun dato personale parte: ma è una promessa affidata alla disciplina, non al codice. Una whitelist la renderebbe vera |
| F12 | Attesa fino a due minuti senza annullare | `turnstile.js:86-98` + `gemini.js:55` | 2 tentativi × 20 s più 120 s di timeout, senza barra di avanzamento né modo di fermare |
| F13 | Il «riprova domani» sbaglia di due ore | `index.js:333` usa UTC | In estate chi sfora all'01:30 aspetta fino alle 02:00 |
| F14 | Documentazione divergente sull'informativa | `docs/pubblicazione-play.md:69-70` | Dice ancora «attiva GitHub Pages»: seguirlo creerebbe una seconda copia destinata a divergere — il guasto che `genera-privacy.mjs` esiste per impedire |

---

# G. Bassi

- **G1.** `minifyEnabled false` (`build.gradle:66`) — Play accetta; senza R8 gli stack trace arrivano leggibili.
- **G2.** Mail personale come contatto pubblico (`privacy.md:126`): cambiarla dopo tocca informativa, scheda Store e ogni copia scaricata.
- **G3.** FileProvider più largo del necessario (`res/xml/file_paths.xml`): default Capacitor, `exported="false"`, ma un revisore lo segnala.
- **G4.** `genera-privacy.mjs:25-26` dipende dalla directory corrente.
- **G5.** `worker/README.md:40-41` descrive un blocco KV «da scommentare» che è già attivo.
- **G6.** Nessun `engines` in `package.json`: la produzione si costruisce a mano, con Node ignoto.
- **G7.** React 18 / Vite 5 indietro di una major — da non toccare a ridosso della pubblicazione.
- **G8.** `tests/` contiene PDF di cedolino col nome e il codice fiscale **nel nome del file**. Gitignorata e non tracciata: il rischio non è git, è uno zip del progetto o un allegato a una segnalazione. Per `dati-buste/` la ragione è scritta nel `.gitignore`; per `tests/` no.
- **G9.** Chiave React duplicabile in `ImportModal.jsx:88` (due turni identici nella stessa foto).
- **G10.** Telemetria **opt-out**, non opt-in (`telemetry.js:47-53`), e se localStorage lancia restituisce `true` → si invia comunque.

---

## Dove mettere questo elenco

`RILASCIO.md` va lasciato com'è: sette domande sulla **pubblicazione**, con un
principio che si indebolisce se ci si versa dentro quaranta voci di natura
diversa — e si cancella dopo la pubblicazione, mentre questo serve soprattutto
dopo.

Proposta: un `ARRETRATI.md` accanto, che nasce da questo documento, con **tre**
sole aggiunte a `RILASCIO.md`:

1. punto **4** (informativa): la contraddizione `allowBackup` — quella domanda è
   già «l'informativa dice il vero», e oggi non lo dice;
2. punto **6** (versione online): la verifica di `.env.local` prima dell'AAB —
   il pacchetto di oggi ha l'import spento e la telemetria accesa, e nessuna
   delle sette se ne accorgerebbe;
3. una domanda **nuova**: «un turno inserito è davvero salvato, e il backup che
   l'app dice di aver scaricato esiste davvero?» — A1 e A2 sono l'unica famiglia
   che può far perdere all'utente tutto il suo lavoro senza un segnale, e il
   cancello di rilascio non la copre.

---

## Verifica

Per i punti sul calcolo (C1, C2):

```bash
for f in scripts/check-*.mjs; do printf "%-42s" "$(basename $f)"; \
  node "$f" >/dev/null 2>&1 && echo OK || echo FALLITO; done
```

Tutti verdi, `check-buste-2026.mjs` compreso: non calcolare fuori dal 2026 non
deve muovere di un centesimo i mesi del 2026. Poi, a mano: due turni nel 2025,
aprire quell'anno in Statistiche e Calendario, e verificare che al posto del
netto ci sia la spiegazione e non uno zero, con ore e lordo intatti.

Per A1 e A2, la prova è nel browser e non si può fare con uno script:

```js
// DevTools, prima di inserire un turno:
Storage.prototype.setItem = function () { throw new DOMException('QuotaExceeded'); };
```

Inserire un turno: oggi compare nel calendario e sparisce al reload. Dopo la
correzione deve comparire un messaggio. Per A2, Safari iOS in PWA o un browser
interno (Instagram): chiedere il backup e verificare che l'app non dichiari
successo se il file non è stato consegnato.

Per B2, prima di ogni AAB:

```bash
grep -c VITE_TURNSTILE_SITEKEY .env.local   # deve essere 1, oggi è 0
grep VITE_TELEMETRY_URL .env.local          # deve essere vuota per lo Store
npm run build && node scripts/check-dati-in-uscita.mjs
```

Per B1, `adb shell bmgr backupnow <package>`: è l'unico modo di sapere se il
localStorage della WebView finisce davvero nel backup, invece di dedurlo.

---

## Cose controllate che vanno bene

Nessun segreto in chiaro fra i file versionati. Permessi Android ridotti al solo
`INTERNET`, plugin compresi — la causa più comune di rigetto è fuori gioco.
Validazioni del worker in ordine di costo crescente (`index.js:294-342`), magic
bytes oltre al mimeType dichiarato, tetti sull'output. Fallimento **chiuso** su
tutti e tre gli anelli della catena dell'import. `ErrorBoundary` fuori da `App`.
`navigateFallbackDenylist` sull'informativa. Gli errori di import ed export
arrivano all'utente con un messaggio in italiano (`CalendarView.jsx:389,467`).
L'import deduplica su data+orari. Il ripristino ricarica la pagina. Nessun
`TODO`/`FIXME` pendente in tutto `src/`.
