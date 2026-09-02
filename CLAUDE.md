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

Il riscontro di queste regole è `scripts/check-primo-avvio.mjs`: non verifica che
le funzioni rispondano, verifica che una configurazione completa non chieda
niente e che un «no» non torni. Accanto, `check-orari-proposti.mjs` (l'app non
inventa un orario) e `check-avvisi.mjs`, che sull'ordine delle strisce controlla
la cosa che nessun occhio umano controlla: che ogni avviso abbia almeno una
schermata in cui compare, cioè che il prossimo aggiunto in cima non ne seppellisca
un altro per sempre.

## Comandi

```sh
npm run dev
npm run build
for f in scripts/check-*.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done
```

`check-dati-in-uscita.mjs` ispeziona `dist/`: vuole una build fatta con
`VITE_AI_PROXY_URL=https://turni-ai-proxy-test.magnaopa.workers.dev`, altrimenti
fallisce senza che ci sia niente di rotto. È l'unico falso allarme noto.

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
- **Il rimedio sta accanto al numero.** L'unica azione che evita il conguaglio —
  chiedere al datore di non erogarlo — viveva in Impostazioni come «Forza
  esclusione TI (override, va a conguaglio)», in gergo delle paghe. Ora si legge,
  e la casella è dentro il riquadro rosso: mandare a cercare un interruttore chi
  ha appena letto di dover restituire dei soldi significa che non lo troverà.

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

### Da dove viene la paga oraria — confermato sul cedolino

```
minimo tabellare   1.057,72
contingenza          522,37
terzo elemento         5,41   ← voce a sé, stampata in busta
                   ─────────
mensile full-time  1.585,50   ÷ 172 = 9,21802 €/h   × 60% = 951,30 €
```

- Il divisore **172** è lo stesso `monthlyHoursFactor: 4.3` di
  `src/data/ccnl.json` scritto in un altro modo (40 h × 4,3). Le ore mensili del
  contratto, 103,20, sono 172 × 60%.
- Il **terzo elemento** è un importo fisso mensile della contrattazione
  territoriale: entra nella retribuzione e quindi nella paga oraria, ma **non**
  nella base dell'Ente Bilaterale (948,05 = (tabellare + contingenza) × 60%). Da
  lì i 3,25 € di scarto con la retribuzione, che per mesi sono rimasti annotati
  come inspiegati. Sul datore 2024-2025 nemmeno la maggiorazione domenicale lo
  comprendeva (rapporto 0,99547).
- Riscontro: `scripts/check-tabellare-turismo.mjs`.

### Gli altri, con il loro riscontro

- **Mese di paga**: nei contratti mensilizzati la busta taglia a settimane
  intere, e la settimana a cavallo appartiene al mese del **lunedì**. La soglia
  del supplementare è **mensile** (103,20 h), non settimanale.
  → `check-mese-paga-2026.mjs`
- **Ore oltre soglia**: la busta scrive l'ora INTERA al 130%, non il solo +30%.
  → `check-busta-luglio-2026.mjs`
- **Maggiorazioni Turismo** (17 cedolini 2024-2025): notturno 25%, domenicale
  10%, supplementare 30%, festivo 20%. Attenzione a come il cedolino le SCRIVE:
  domenicale e notturno riportano la sola maggiorazione, il festivo il totale
  (120% = +20%). → `check-busta-maggiorazioni-reali.mjs`
- **Fascia notturna**: le buste non riportano le timbrature, quindi non è
  ricavabile da lì. L'art. 13 CCNL prevede orari diversi per settore (24:00-06:00
  ordinario, 23:00-06:00 pubblici esercizi, 23:30-06:30 alberghiero); l'app usa
  quella del CCNL e lascia sovrascrivere. → `check-notturno.mjs`
- **Ferie e permessi** stanno DENTRO la voce «Retribuzione»; la **malattia** è
  una voce a sé; la **festività non lavorata** è un giustificativo a sé.
  → `check-assenze.mjs`, `check-festivita.mjs`
- **Malattia**: la carenza si conta per EVENTO, non per anno. Percentuali e
  giorni NON sono verificati su nessun cedolino, e **le buste che la contengono
  non fanno testo**: `luglio-24` e `novembre-24` mostrano una scomposizione
  completa e invitante («Carenza Malattia», «Malattia Inps 80», «Int. Car.
  Malattia»), ma sono di un altro datore che sceglieva di **integrare** la
  malattia. È una scelta aziendale, non la norma del CCNL — tararci sopra i
  default significherebbe promettere a tutti quello che faceva un'azienda sola.
  Marzo 2026 ha una malattia sul datore attuale, ma come semplice storno
  («Assenza per malattia», −72,06): dice quanto viene tolto, non quanto l'INPS
  o il contratto restituiscono.

## Convenzioni dell'interfaccia

Discendono tutte dalla parola d'ordine qui sopra.

- Le giornate pagate ma non lavorate **non si chiamano «assenza»** a schermo:
  ferie, permesso, malattia, festività, ognuna col suo nome. Se da orario non era
  previsto andare a lavoro, non è un buco da giustificare. Gli identificatori nel
  codice (`isAssenza`, `assenzaMinutes`, `utils/assenze.js`) restano come sono.
- Quando i conteggi non coprono il mese visualizzato (mese di paga), il periodo
  si **dichiara sopra i numeri**. Non si allunga il calendario per farceli stare:
  provato, era brutto e si perdeva di vista che mese si stava guardando.
- I calcoli fiscali sono marcati BETA e invitano a farsi controllare da un
  professionista. Non togliere quell'avviso.
