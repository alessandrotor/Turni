# Turni — note per Claude

PWA (React 18 + Vite, Capacitor per Android) che segna i turni e stima lordo e
netto secondo le regole della busta paga italiana. Codice, commenti e interfaccia
sono in italiano: scrivere nella stessa lingua.

Branch di lavoro: `experimental`. La produzione è un deploy manuale e può essere
molto indietro rispetto al repository — prima di dire «è online» va guardato il
sito, non il codice.

## La parola d'ordine: frictionless

**Ogni cosa che l'app chiede all'utente deve guadagnarsi il diritto di
interromperlo.** Nel dubbio non si chiede: si segnala dove non dà fastidio, e si
lascia che sia lui a tornarci quando gli serve.

Chi usa Turni sta facendo altro — è in pausa, sta timbrando, ha il telefono in
una mano. Non è venuto a configurare un software: è venuto a segnare un turno.
Una domanda in mezzo a quel gesto non viene letta, viene chiusa; e chi impara a
chiudere gli avvisi chiude anche quelli che contavano.

In pratica, e sono regole, non aspirazioni:

- **All'apertura non si chiede niente.** Chi non ha ancora capito cosa fa l'app
  risponde a caso.
- **Si chiede DOPO l'azione, mai durante.** Il modulo del turno serve a segnare
  il turno: mentre lo si compila non compare altro. La domanda nasce dal turno
  già salvato — vedi `AvvisoMaggiorazione.jsx`.
- **Un avviso alla volta.** Due impilati sono un muro. Quando la striscia in
  fondo parla, il promemoria in alto tace (`SetupPrompt` accetta `sospeso`).
- **Le risposte comuni costano un tocco.** «No» e «non adesso» non devono
  richiedere di leggere, capire o digitare niente.
- **Un «no» dura.** Una domanda già rifiutata che ritorna è peggio della domanda
  (`maggiorazioniNonDovute`). Un «non adesso» dura almeno la sessione.
- **Si blocca solo per ciò che non si recupera dopo.** Oggi sono due dati:
  paga oraria e ore settimanali (`datiMinimiMancanti`). Tutto il resto è
  retroattivo, quindi può aspettare.
- **L'app non si aggiorna addosso a chi la sta usando, ma si aggiorna.** La
  versione nuova si scarica quando si torna sull'app e entra in servizio quando
  la si mette via — in secondo piano da un minuto e senza niente in sospeso —
  oppure quando lo dice l'utente col pulsante. Non è un compromesso fra i due
  fastidi: è che esiste un momento in cui ricaricare non dà fastidio a nessuno.
  Regola pura in `utils/aggiornamento.js`, «lavoro in sospeso» dichiarato dai
  componenti in `utils/occupato.js`, riscontro `check-aggiornamento.mjs`.
  Attenzione al difetto silenzioso: una chiave di `occupato` che resta accesa
  blocca gli aggiornamenti per sempre senza che nessuno se ne accorga.
  Perché tutto questo funzioni, il browser deve prima ACCORGERSI che `sw.js` è
  cambiato: `public/_headers` gli dà `Cache-Control: no-cache` apposta, perché
  su questo punto Chrome e altri browser si sono storicamente comportati in
  modo diverso (osservato su Firefox il 1° settembre 2026: l'avviso non
  compariva mai, nemmeno ricaricando a mano). Riscontro nello stesso
  `check-aggiornamento.mjs`. Non è retroattivo: un profilo che ha già la copia
  vecchia in cache va sbloccato una volta con un ricaricamento forzato.
- **Niente contrassegni «l'ho già visto».** Le domande nascono dallo stato dei
  dati, non da tracce lasciate addosso a chi usa l'app.
- **Meglio chiedere di troppo che sbagliare in silenzio, ma solo dicendo la
  verità sul perché.** Quando l'app non sa (la fascia notturna senza contratto)
  guarda largo e scrive «potrebbe»: chiedere di più costa un tocco, non chiedere
  costa soldi ogni mese.
- **Non chiedere non basta: il GESTO va contato.** Per un anno tutte le regole
  qui sopra hanno riguardato le domande, e nessuna il gesto che l'app esiste per
  fare. Segnare un turno costava dieci interazioni, e otto erano lì per
  correggere `08:00–16:00` scritti a mano nel modulo. Ora gli orari li propone
  lo storico (`utils/orari-proposti.js`) e il turno tipico costa due tocchi.
  La regola generale: **quello che l'app può dedurre dai dati già inseriti non
  si fa digitare.** Ma non si inventa nemmeno — la proposta è una coppia che
  nello storico esiste davvero, mai una media, e il riscontro lo verifica.
- **Per ciò che si recupera, l'annulla dopo; la conferma prima mai.** Una
  domanda «sei sicuro?» costa un tocco a tutti per un errore che fa uno, e
  insegna a chiudere gli avvisi a riflesso. Cancellare un turno agisce subito e
  apre una finestra per tornare indietro (`utils/avvisi.js`, `DURATA_ANNULLA`).
  Quella finestra è lavoro in sospeso: tiene la sua chiave in `occupato`.
- **Dove l'annulla dopo non può esistere, si protegge il gesto.** Un turno
  cancellato esiste ancora per otto secondi; una bozza chiusa no, non è mai
  stata scritta da nessuna parte. Quindi il tocco sull'area scura attorno al
  modulo del turno chiude finché non c'è niente da perdere, e smette appena c'è
  — con un cenno che indica la ✕ (`utils/bozza.js`). Il caso che conta non è il
  turno da otto tocchi: è il periodo di assenza, venti giornate corrette riga
  per riga. Difetto silenzioso: un campo nuovo nel modulo che nessuno elenca lì
  resta scoperto, e per questo `check-bozza.mjs` l'elenco non lo dà per buono —
  lo confronta con i campi che `ShiftForm.jsx` modifica davvero.

Il riscontro di queste regole è `scripts/check-primo-avvio.mjs`: non verifica che
le funzioni rispondano, verifica che una configurazione completa non chieda
niente e che un «no» non torni. Accanto, `check-orari-proposti.mjs` (l'app non
inventa un orario) e `check-avvisi.mjs`, che sull'ordine delle strisce controlla
la cosa che nessun occhio umano controlla: che ogni avviso abbia almeno una
schermata in cui compare, cioè che il prossimo aggiunto in cima non ne seppellisca
un altro per sempre.

## I tester si verificano da soli: `?verifica`

Il link `…/?verifica` apre «Confronta con la busta» (`VerificaBusta.jsx`). Il
tester sceglie il PDF del cedolino e l'app lo confronta coi propri conti. A chi
sviluppa arriva solo il testo di `testoDaCondividere`, cioè **gli scarti, mai le
cifre intere**. La pagina promette in grande che la busta non viene inviata a
nessun servizio esterno, e **quella frase deve restare vera**.
`check-verifica-busta.mjs` segue gli import della pagina fino in fondo, e basta
una `fetch` aggiunta in `net.js` per farlo diventare rosso. Cerca anche nel testo
ogni importo assoluto, compreso il caso subdolo già capitato: con un lato a zero,
lo scarto È la cifra intera dell'altro lato.

Il lettore dei PDF è uno solo, `src/utils/cedolino.js`, per Node e per il browser.
Attenzione a `DecompressionStream`: rifiuta il ritorno a capo che il PDF lascia
dopo il deflate, mentre `zlib` lo ignora (vedi `inflateBrowser`). Legge solo i
cedolini Zucchetti con lo strato di testo; per il resto c'è l'inserimento a mano.

## Comandi

```sh
npm run dev
npm run build
for f in scripts/check-*.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done
```

`check-dati-in-uscita.mjs` ispeziona `dist/`, e su una build locale fallisce
senza che ci sia niente di rotto: `.env.local` imposta `VITE_TELEMETRY_URL`,
quindi in `dist/` finisce `script.google.com`. La CI non la imposta
(`deploy-test.yml`). Vuole anche il proxy AI nel bundle. È l'unico falso
allarme noto.

`COSE-NUOVE.md` è l'inventario dei difetti noti, e invecchia in silenzio se
nessuno lo tocca: quando una voce si chiude va marcata lì, col riscontro che la
tiene chiusa. Il testo del difetto resta sotto, perché spiega perché era un
difetto.

## A cosa serve l'app, secondo chi la usa

Da un'analisi empirica su una manciata di persone, le due domande che contano
davvero sono **quanto guadagno con questi turni** e **come evito di dover
restituire il trattamento integrativo**. Non il calendario: quello è il mezzo.

Il motore le sapeva già rispondere entrambe; nessuna delle due arrivava a
schermo. `computePayByShift` produce venti campi in euro per ogni turno e per un
anno non se n'è visto nemmeno uno — il primo euro compariva nel totale del mese,
sotto tutta la griglia. E `tiDecision` sapeva dire se il bonus spetta ADESSO, mai
quanto costa scoprire a dicembre che non spettava.

- **Il totale del mese sta nella barra flottante**, sempre, perché è la risposta
  alla prima domanda. Gli euro sul singolo turno sono un'opzione
  (`mostraEuroPerTurno`), spenta di default: chi non l'accende trova il
  calendario di prima.
- **Il lordo di un turno si chiede a `lordoTurno`** (`utils/pay.js`), mai
  sommando a mano `base + surcharge` dentro un componente. Il riscontro
  (`check-lordo-turno.mjs`) verifica che la somma dei turni faccia esattamente
  il totale del mese: se la cella e il riepilogo dicessero cifre diverse,
  nessuna delle due sarebbe più credibile.
- **Il rischio di restituzione è una CIFRA, non uno stato**
  (`utils/restituzione.js`). «Bonus ridotto: reddito oltre i 15.000» descriveva
  una condizione; «di questo passo devi restituire ~805 €» dice cosa costa.
  **Ma quella cifra è cassa, non perdita**, e per un anno l'app le ha confuse.
  Superare i 15.000 costa **~129 € l'anno**, non 1.200: la detrazione da lavoro
  salta da 1.955 a 3.100 (art. 13 TUIR) nello stesso momento in cui il bonus
  sparisce, e compensa il 95%. Quel che resta scoperto è il cuneo, non il bonus.
  La buca è larga ~200 € di lordo: oltre, guadagnare di più conviene come prima.
  Da qui i tre casi dell'avviso — sotto, dentro la buca, oltre — invece di un
  allarme unico che gridava anche a chi non stava più perdendo niente.
  → `check-costo-soglia.mjs`, `costoSoglia()`
- **Il rimedio sta accanto al numero.** L'unica azione che evita il conguaglio —
  chiedere al datore di non erogarlo — viveva in Impostazioni come «Forza
  esclusione TI (override, va a conguaglio)», in gergo delle paghe. Ora si legge,
  e la casella è dentro il riquadro rosso: mandare a cercare un interruttore chi
  ha appena letto di dover restituire dei soldi significa che non lo troverà.
  Per la stessa ragione la domanda «e se lo prendessi tutti i mesi?» è una
  casella dentro quel riquadro, sotto il previsto di fine anno: non tocca i
  dati salvati e non sostituisce la cifra vera, le si affianca — serve a
  confrontare. E risponde con l'esito, non col lordo: «+1.080 €» non dice se
  fai saltare la soglia, che è il motivo per cui te lo stai chiedendo.

Tre cose che il modello NON sa, e che vanno scritte accanto alla cifra e non in
un disclaimer generico: quanto è stato accreditato davvero (lo dice il cedolino,
non l'app); che **l'app vede un solo datore**, quindi per chi ne ha due la stima
è per difetto proprio nel caso più a rischio; e che nella fascia 15.000–28.000 si
conosce la sola detrazione da lavoro, con cui la capienza non c'è mai — quindi il
modello dice «non spetta» a chiunque superi i 15.000.

Attenzione al difetto che è già capitato: **il TI può essere zero per due motivi
opposti** — reddito troppo alto (rischio vero) o troppo basso, sotto la no tax
area (nessuna imposta da compensare, e il datore non l'ha mai accreditato).
Confonderli faceva dire «devi restituire 805 €» a chi guadagna 2.150 € l'anno.

## La regola che conta più di tutte

**Nessun numero di dominio entra nel motore senza un riscontro.** Ogni fatto
retributivo che l'app dà per buono ha il suo `scripts/check-*.mjs`, con in testa
la busta da cui viene e il ragionamento che lo ricava. I riscontri non sono test
di regressione: sono la documentazione di cosa si sa e come lo si sa.

Se un valore NON è verificabile su un cedolino, l'interfaccia deve dirlo
(esempio: i parametri della malattia in Impostazioni, marcati come non
verificati).

## Fatti verificati sulle buste

Busta di riferimento: LUL Zucchetti, CCNL Turismo, **livello 5, part-time 60%**,
giugno e luglio 2026. Nel repository entrano solo cifre — mai nome, codice
fiscale, indirizzo, IBAN o datore.

**Le cifre esatte vivono nel codice dei riscontri (`scripts/check-*.mjs`), non
qui.** Questo file spiega il RAGIONAMENTO — perché un dato è fatto così, cosa
dimostra, dove si rompe — non ripete gli importi: sono usati, non pubblicati.
Per i numeri, apri lo script citato.

### Da dove viene la paga oraria — confermato sul cedolino

La paga oraria non è il solo minimo tabellare: ci entra anche il **terzo
elemento**, un importo fisso mensile della contrattazione territoriale. Il
divisore orario del Turismo è lo stesso `monthlyHoursFactor: 4.3` di
`src/data/ccnl.json` scritto in un altro modo (40 h × 4,3).

Il terzo elemento entra nella retribuzione e quindi nella paga oraria, ma
**non** nella base dell'Ente Bilaterale — da lì nasce uno scarto fra i due
totali che per mesi era rimasto annotato come inspiegato. Sul datore 2024-2025
nemmeno la maggiorazione domenicale lo comprendeva.

- Riscontro: `scripts/check-tabellare-turismo.mjs`.

### Gli altri, con il loro riscontro

- **La finestra del mese è il CALENDARIO**, dal 1 all'ultimo giorno — non le
  settimane intere. Lo ha deciso la busta di **agosto 2026**, su un
  discriminante scritto prima che arrivasse: quindici giorni di ferie iniziati
  lunedì 31 agosto valgono 7 giornate nel mese di paga e 1 sola nel calendario,
  e la busta ne paga **una** (`Ferie godute 4,00 ORE`). Conferma il totale:
  120,75 h col calendario contro le 120,70 stampate, 138,75 col mese di paga.
  → `check-busta-agosto-2026.mjs`
- **Tasse e bonus si decidono sul MESE, non sull'anno.** Il software paghe
  prende il lordo del mese, lo moltiplica per dodici e da lì sceglie in blocco
  detrazione, indennità L. 207/2024 e trattamento integrativo. L'app faceva come
  la legge — guardava l'anno — e prometteva ogni mese un bonus che in busta
  spesso non c'era. Riscontro su quattro cedolini 2026, al centesimo sul TI:
  febbraio e maggio e luglio sotto soglia col bonus, agosto sopra senza. Per chi
  legge, la soglia si dice in una cifra sola: **1.250 € di lordo al mese**
  (15.000 ÷ 12). → `check-ti-mensile.mjs`
  Attenzione a non confonderla con la proiezione annua, che RESTA e serve ad
  altro: il margine del bonus e il rischio di restituzione sono domande
  sull'anno. Il pannello del netto le tiene su due righe separate apposta.
- **Si annualizza solo ciò che ricorre davvero.** Un montante fermato a luglio
  contiene già la 14ª erogata a giugno — il progressivo del cedolino la
  comprende — e sommarla un'altra volta gonfiava il maturato di mezza
  mensilità. Ma il danno grosso era il secondo: `projectAnnualIncome` sottrae
  le una-tantum PRIMA di annualizzare, quindi una quota non dichiarata in
  `extras` passa per reddito ricorrente e viene moltiplicata per
  12/mesi-trascorsi. Stessa regola per il bonus spuntato mese per mese: un
  premio di produttività non torna ogni mese, e a settembre tre bonus da 120 €
  ne promettevano quattro. → `check-montante-mensilita.mjs`,
  `check-proiezione.mjs`
- **La soglia del supplementare resta MENSILE** (103,20 h = 24 × 4,3), non
  settimanale: questo lo avevano stabilito giugno e luglio, e non cambia.
  → `check-mese-paga-2026.mjs`
- **Le assenze riempiono il monte ore**, anche quando cadono in coda al mese:
  in busta `4,00 ferie + 99,20 retribuzione = 103,20`, e il lavoro eccedente è
  tutto supplementare. Contarle in ordine cronologico faceva perdere ore già
  maturate a chi andava in ferie a fine mese. → `check-assenze.mjs`
- **La busta arrotonda l'eccedenza al quarto d'ora**: il monte ore 103,20 non è
  un multiplo di 15 minuti (è 103h12min), quindi l'eccedenza vera di agosto era
  17,55 h e il cedolino stampa 17,50.
- **Ore oltre soglia**: la busta scrive l'ora INTERA al 130%, non il solo +30%.
  → `check-busta-luglio-2026.mjs`
- **Maggiorazioni Turismo** (17 cedolini 2024-2025): notturno, domenicale,
  supplementare, festivo. Attenzione a come il cedolino le SCRIVE: domenicale e
  notturno riportano la sola maggiorazione, il festivo il totale.
  → `check-busta-maggiorazioni-reali.mjs`
- **Fascia notturna**: le buste non riportano le timbrature, quindi non è
  ricavabile da lì. L'art. 13 CCNL prevede orari diversi per settore (24:00-06:00
  ordinario, 23:00-06:00 pubblici esercizi, 23:30-06:30 alberghiero); l'app usa
  quella del CCNL e lascia sovrascrivere. → `check-notturno.mjs`
- **Ferie e permessi** stanno DENTRO la voce «Retribuzione»; la **malattia** è
  una voce a sé; la **festività non lavorata** è un giustificativo a sé.
  → `check-assenze.mjs`, `check-festivita.mjs`
- **Malattia**: la carenza si conta per EVENTO, non per anno. Percentuali e
  giorni NON sono verificati su nessun cedolino, e **le buste che la contengono
  non fanno testo**: due mesi mostrano una scomposizione completa e invitante,
  ma sono di un altro datore che sceglieva di **integrare** la malattia. È una
  scelta aziendale, non la norma del CCNL — tararci sopra i default
  significherebbe promettere a tutti quello che faceva un'azienda sola. Un mese
  sul datore attuale ha una malattia come semplice storno: dice quanto viene
  tolto, non quanto l'INPS o il contratto restituiscono.

## L'archivio è il localStorage

Non c'è server né account: quello che il browser tiene **è** l'archivio. Da qui
due regole sul ripristino di un backup (`utils/backup-contenuto.js`,
`check-backup.mjs`).

- **O tutto o niente, e comunque si dice cosa è successo.** Quattro `setItem` in
  fila non sono una sostituzione: se il secondo fallisce per quota — un backup
  grosso su uno storage quasi pieno è il caso tipico — restano i turni nuovi con
  le impostazioni vecchie, cioè due backup mescolati. Le scritture si preparano
  prima, si eseguono sapendo com'era, e al primo fallimento si torna indietro;
  se nemmeno il ritorno riesce, lo si dichiara. Il riscontro rompe lo storage a
  metà ripristino, a capienze diverse, e verifica che i dati tornino al loro
  posto — provarlo a mano non lo farà mai nessuno.
- **Si valida il contenuto, non la busta.** Controllare `app === 'turni'` lascia
  entrare chiavi che non sono date e minuti negativi, e da lì il render salta
  con gli originali già cancellati. Attenzione al buco preciso già capitato:
  `dati.formato > FORMATO` NON ferma un file senza `formato`, perché
  `undefined > 1` è `false` — passava, e veniva letto come formato 1.
- **Prima di sostituire si mostra il confronto, non si chiede «sei sicuro?»**
  Il file si legge senza scrivere niente, e lo stesso tocco di prima mostra le
  due cifre a confronto, la data del backup, le voci illeggibili e la via per
  portarsi via i dati di adesso.

## Convenzioni dell'interfaccia

Discendono tutte dalla parola d'ordine qui sopra.

- Le giornate pagate ma non lavorate **non si chiamano «assenza»** a schermo:
  ferie, permesso, malattia, festività, ognuna col suo nome. Se da orario non era
  previsto andare a lavoro, non è un buco da giustificare. Gli identificatori nel
  codice (`isAssenza`, `assenzaMinutes`, `utils/assenze.js`) restano come sono.
- Quando i conteggi non coprono il mese visualizzato (mese di paga), il periodo
  si **dichiara sopra i numeri**. Non si allunga il calendario per farceli stare:
  provato, era brutto e si perdeva di vista che mese si stava guardando.
- **Non si scrolla se non è assolutamente necessario.** Vale soprattutto per
  ciò che si apre sopra la pagina: una finestra che costa uno scorrimento per
  arrivare al pulsante che la chiude è una finestra scritta troppo lunga, e la
  risposta giusta è tagliare il testo, non allungare il contenitore. Il
  calendario e la pagina scorrono, quello è il loro mestiere; un popup no.
- Le voci che esistono anche **sul cedolino si chiamano come lì** («Indennità
  L. 207/24», non «sconto sui contributi»): la prima cosa che si fa con una
  cifra dell'app è cercarla in busta, e un nome inventato la rende
  irrintracciabile. Il gergo si spiega accanto, non si sostituisce.
- **La validazione dei moduli è nostra, non del browser.** Impostazioni è un
  `<form>` con sedici `<details>` quasi tutti chiusi: un campo invalido dentro
  una sezione chiusa annulla l'invio SENZA un messaggio, perché il fumetto
  nativo non ha dove attaccarsi — si premeva «Salva» e non succedeva niente.
  Ora la sezione si apre, il fuoco va sul campo e solo allora si chiede al
  browser di dirlo. E gli `step` valgono `"any"`: `step="0.5"` rifiutava 37,25
  ore, `step="1"` il 66,66%. Il difetto non si vede provando l'app coi propri
  dati, che sono tondi — si vede leggendo la marcatura, ed è ciò che fa
  `check-impostazioni.mjs`.
- **Un campo vuoto non è uno zero.** `|| ''` faceva sparire lo zero delle ore
  settimanali mostrandolo identico a «non l'ho ancora messo», mentre mandava a
  zero la soglia dei supplementari: `?? ''`, e `min="1"` dove lo zero è un dato
  mancante travestito.
- I calcoli fiscali sono marcati BETA e invitano a farsi controllare da un
  professionista. Non togliere quell'avviso.
