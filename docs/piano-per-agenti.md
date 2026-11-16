# Turni — piano di sviluppo, per chi lo porta avanti

Questo documento è scritto per un modello di IA (o una persona) che prende in
mano il progetto senza aver seguito le conversazioni in cui il piano è nato.
Dice dove si vuole arrivare, cosa c'è già, cosa va fatto e in che ordine, e
soprattutto cosa decide chi mantiene il progetto e cosa puoi decidere tu.

Si legge insieme a `CLAUDE.md`, che resta la fonte delle regole del codice:
dove i due documenti sembrano dire cose diverse, vale `CLAUDE.md` e lo si
segnala a chi mantiene il progetto. Stato: novembre 2026.

## 1. Dove si vuole arrivare

Turni è una web app (PWA) che segna i turni e stima lordo e netto secondo la
busta paga italiana. Chi la mantiene è una persona sola, che ci lavora nel
tempo libero, a Roma.

**L'obiettivo dei prossimi dodici mesi:** uscire come app gratuita e arrivare a
una base di utenti (qualche migliaio che la usa davvero) che giustifichi
l'apertura di una partita IVA. Fino ad allora non ci sono ricavi, e non si
costruisce niente che li presupponga.

**La promessa al pubblico:** «Capisci la busta prima che arrivi». L'app unisce
tre cose che nessun concorrente ha insieme — i turni veri, le regole della busta
italiana, la previsione dell'anno — e non manda niente fuori dal telefono.

**Chi la usa:** dipendenti con orari variabili e redditi bassi (part-time,
stagionali, turnisti di ristorazione, commercio, vigilanza). Hanno il telefono
in una mano e stanno facendo altro.

### La regola sul messaggio, che non si negozia

Ogni anno circa 2,3 milioni di dipendenti si vedono riprendere il trattamento
integrativo a conguaglio. Nello stesso conguaglio alla gran parte di loro torna
IRPEF, perché superata la soglia la detrazione da lavoro sale: quasi sempre
pareggia. Chi mantiene il progetto lo ha detto in modo esplicito: **non si
guadagna sulla disinformazione.** Quindi:

- ogni volta che un testo dice che il trattamento integrativo viene ripreso,
  accanto ci sono le tasse che tornano e quello che resta davvero scoperto;
- non si scrivono titoli, avvisi o pagine che spaventano per far cliccare
  («rischi di restituire 700 €!»);
- la cifra viene sempre dal motore, mai da un testo scritto a mano, e mai da un
  eventuale partner commerciale.

Se un compito sembra richiedere il contrario, ci si ferma e lo si chiede.

## 2. Cosa è già deciso

Queste scelte sono di chi mantiene il progetto. Non vanno rimesse in
discussione dentro un compito; se hai una ragione seria per pensare che una sia
sbagliata, dilla, ma non agire di conseguenza da solo.

- **Resta una web app.** Niente app nativa. Gli aggiornamenti arrivano dal sito:
  le regole fiscali cambiano ogni gennaio e un conto sbagliato si corregge in
  giornata. Google Play si aggiungerà con la stessa web app dentro un involucro
  (Trusted Web Activity); l'App Store è rimandato.
- **Niente server, niente account, niente telemetria.** L'archivio è il
  localStorage. La `connect-src` della CSP non si allarga senza riscrivere
  l'informativa (`docs/privacy.md`) e `check-dati-in-uscita.mjs`.
- **La lettura dei turni con l'IA resta sospesa.**
- **Prima gratuita.** Versione a pagamento e referral verso fondi pensione sono
  ipotesi per dopo; i termini (`docs/termini.md`) oggi dicono «senza scopo di
  lucro» e non vanno toccati finché chi mantiene il progetto non lo decide.
- **Niente widget, niente notifiche push, niente sincronizzazione fra telefoni.**
  Richiedono un'app nativa o un server.

## 3. Come si lavora

Le regole del codice stanno in `CLAUDE.md`. Qui solo quelle che un nuovo
arrivato sbaglia più spesso.

- **Prima di toccare qualcosa, allinea la copia locale:**
  `git pull origin experimental`. Più sessioni lavorano sullo stesso
  repository.
- **Si lavora su `experimental`**, con commit e push lì. Nessuna pull request se
  non viene chiesta. `Beta` riceve solo correzioni e ritocchi piccoli.
- **I riscontri sono un cancello:** `npm run riscontri -- --senza-dist` deve
  passare prima di ogni push. Un riscontro rosso non si aggira e non si
  indebolisce per farlo passare: si capisce perché è rosso.
- **Ogni cifra a schermo viene dal motore** (`src/motore/`). Se il motore non la
  produce, la si aggiunge lì col suo riscontro. Un numero di dominio nuovo
  (un'aliquota, una soglia, una regola di contratto) entra solo con la fonte
  scritta in testa al riscontro: una busta, o la norma, e nel secondo caso
  l'interfaccia dice che non è verificato su una busta.
- **I file hanno un tetto di righe** (`check-dimensioni.mjs`). `CalendarView.jsx`,
  `App.jsx`, `net.js` e `index.css` sono al limite: il codice nuovo va in un
  componente o in un modulo nuovo, non in fondo a quelli.
- **Interfaccia, commenti e documentazione sono in italiano.** I commenti
  spiegano il perché, col caso concreto da cui nasce la regola.
- **Dati personali:** nel repository entrano solo cifre. Mai nomi, codici
  fiscali, IBAN, datori di lavoro, buste, CU, backup, foto di tabelloni coi nomi
  dei colleghi. I file di prova si tengono fuori dal repository.
- **Quando una voce si chiude**, lo si scrive in `CLAUDE.md` (il ragionamento,
  non le cifre) e, se era un difetto noto, in `COSE-NUOVE.md`.

### Come parlare con chi mantiene il progetto

- Risposte brevi, in italiano. Prima il risultato, poi il resto.
- Preferisce una figura a un paragrafo, e pochi numeri a schermo: quando una
  schermata ha troppe cifre lo dice, e ha ragione.
- **Mockup prima del codice solo per l'interfaccia grossa** (una schermata o una
  finestra nuova). I ritocchi si fanno direttamente. Un mockup è un'immagine con
  due o tre alternative e le cifre vere prese dal motore.
- Quando corregge un'affermazione di dominio (come funziona una busta, cosa fa
  il datore), di solito ha ragione lui: ha le buste in mano. Si verifica, non si
  insiste.
- Non si annuncia «è online»: la produzione è un deploy manuale e può essere
  indietro.

### Cosa puoi decidere da solo e cosa no

| Puoi deciderlo tu | Va chiesto prima |
|---|---|
| Nomi, struttura dei file, come dividere un componente | Una regola nuova nel motore che non viene da una busta o da una norma citata |
| Il testo di un'etichetta, restando nelle convenzioni | Alzare il tetto di righe di un file |
| Aggiungere un riscontro | Togliere o indebolire un riscontro |
| Correggere un difetto evidente che incontri nel compito | Qualunque cosa mandi dati fuori dal telefono |
| L'ordine dei passi dentro un compito | Cambiare l'ordine degli stadi, o aggiungere una funzione non in elenco |
| | Toccare termini, informativa, prezzi, partner |

## 4. Cosa c'è già

Per non rifare quello che esiste. I dettagli sono in `CLAUDE.md`.

- **Motore** (`src/motore/`): lordo per turno, netto del mese, previsione
  dell'anno, soglia dei 15.000, costo vero del superarla (`costoSoglia()`),
  conguaglio di dicembre come forchetta (`stimaConguaglio()`) e le sue due righe
  (`righeDiDicembre()`), fondo pensione dedotto col 730
  (`versamentoMigliore()`, `effettoVersamento()`).
- **Contratti verificati su buste vere:** Turismo e Vigilanza. Gli altri
  esistono ma l'app dichiara che non sono verificati (`AvvisoContratto.jsx`).
- **Confronto con la busta** (`VerificaBusta.jsx`, link `?verifica`): legge i
  cedolini Zucchetti con lo strato di testo (`src/utils/cedolino.js`) e
  scompone lo scarto per voci; a chi sviluppa arrivano solo scarti.
- **Riquadro del trattamento integrativo** (`RiquadroTI.jsx`): stato, barra,
  bilancia «perdi il tratt. integrativo / paghi meno tasse», tasselli della
  busta di dicembre, avviso quando la stima salta, riga del fondo pensione
  (`FondoPensione.jsx`, lavori in corso).
- **Segnare i turni:** orari proposti dallo storico, più giorni con un orario
  (`BarraSelezione.jsx`), incolla da un messaggio, tabellone da un'immagine letto
  sul telefono, righello per le foto senza griglia.
- **Archivio:** backup e ripristino, richiesta di archiviazione persistente dopo
  il primo turno (`proteggiArchivio()`).
- **Installazione:** `InstallPrompt.jsx`, anche per iPhone.

Sospeso, non tolto: «Copia la settimana scorsa» (`CopiaSettimana.jsx`).
Messo da parte da chi mantiene il progetto: «Il turno conviene?».

## 5. Cosa va fatto

Tre stadi. Dentro uno stadio l'ordine è una proposta; fra uno stadio e l'altro
c'è una condizione, e la verifica chi mantiene il progetto.

Ogni voce dice: perché esiste, cosa si costruisce, dove mettere le mani, quando
è finita, e cosa resta da decidere. «Mockup: sì» vuol dire che si mostra
un'immagine e si aspetta la scelta prima di scrivere codice.

### Stadio A — pronti a uscire

Condizione per passare a B: l'app è in produzione, trovabile, e la stima del
conguaglio di dicembre 2026 torna con la busta vera entro la forchetta.

**A1. «Mi riprendono il trattamento integrativo: ci perdo?»** — FATTO
(novembre 2026), come riga e finestra DENTRO l'app (`CiPerdo.jsx`, link
`?ciperdo`): chi mantiene il progetto non vuole una pagina separata. Resta
aperto: titolo e anteprima del link `?ciperdo` per WhatsApp e Google (A6), e
la riga «Spiegalo a un collega» nel riquadro, mostrata in un mockup e non
ancora decisa. Il testo qui sotto è il progetto originale.
- *Perché:* nessuno trova l'app. La domanda viene cercata ogni anno fra
  novembre e luglio, e le risposte in rete parlano solo della restituzione.
- *Cosa:* una pagina raggiungibile senza aver segnato turni. Pochi dati (lordo
  dell'anno o paga e ore, contratto), e una risposta in tre cifre: la
  trattenuta, le tasse che tornano, quello che resta. Poi l'invito a segnare i
  turni per la stima vera.
- *Dove:* le cifre da `costoSoglia()` e dalle funzioni del conguaglio; nessun
  conto nella pagina. Deve avere titolo, descrizione e anteprima del link propri.
- *Finita quando:* le cifre coincidono con quelle del riquadro per gli stessi
  dati (un riscontro lo verifica); la pagina non chiede niente all'apertura;
  rispetta la regola sul messaggio della sezione 1.
- *Mockup:* sì. *Scadenza utile:* prima delle buste di dicembre.
- *Stato:* fatto, vedi sopra.

**A2. Giro di controllo sui testi che parlano di restituzione** — FATTO
(novembre 2026). Corretti due testi (il popup «Come funziona» e la riga «Se la
superi» del riquadro); gli altri avevano già il pareggio accanto o non ne
parlano come perdita. `check-testi-restituzione.mjs` conta per file le frasi
a schermo con «restituire» o «riprendere»: un testo nuovo lo fa diventare
rosso finché qualcuno non lo rilegge e aggiorna il conto.
- *Perché:* la regola sul messaggio. Il riquadro la rispetta; avvisi, popup,
  pagina dei termini e testo di presentazione non sono stati ricontrollati.
- *Cosa:* cercare ogni «restitu», «riprend», «conguaglio» a schermo e nei testi
  pubblici, e correggere dove manca il pareggio.
- *Finita quando:* c'è un elenco dei testi trovati con cosa è stato cambiato.
  Vale la pena un riscontro che impedisca a un testo nuovo di dire «restituire»
  senza la sua spiegazione.
- *Mockup:* no.

**A3. «Lo prendi col 730»**
- *Perché:* circa 1,7 milioni di persone hanno diritto al trattamento
  integrativo ma lo incassano solo in dichiarazione, perché il datore mese per
  mese non lo ha dato. Oggi l'app dice «non c'è» e si ferma lì.
- *Cosa:* quando l'anno previsto dà diritto al trattamento ma le buste non lo
  hanno erogato, dirlo: quanto, e che arriva col 730.
- *Dove:* motore (la differenza fra spettante sull'anno ed erogato è già nel
  conguaglio), poi una riga nel riquadro.
- *Attenzione:* è il caso opposto alla restituzione; `CLAUDE.md` avverte che il
  trattamento può essere zero per due motivi opposti. Serve il riscontro.
- *Mockup:* no, è una riga; sì se diventa più di una riga.

**A4. Il messaggio per l'ufficio paghe**
- *Perché:* il confronto con la busta trova uno scarto e poi lascia solo chi
  l'ha trovato. I servizi concorrenti spiegano; nessuno aiuta a chiedere.
- *Cosa:* dallo scarto scomposto, un testo breve e cortese da mandare a chi fa
  le paghe («a settembre risultano 14,25 ore supplementari, in busta 12,25»),
  da copiare o condividere. Lo stesso per la richiesta di sospendere il
  trattamento integrativo.
- *Dove:* accanto a `VerificaBusta.jsx`. Il testo resta sul telefono.
- *Attenzione:* qui l'utente manda le SUE cifre a chi le ha già, quindi le cifre
  intere sono lecite; non è il testo che arriva a chi sviluppa, che resta di
  soli scarti. I due testi non vanno confusi né uniti.
- *Mockup:* sì.

**A5. iPhone: installazione e backup**
- *Perché:* Safari può cancellare i dati di un sito non usato per sette giorni
  se non è stato aggiunto alla Home. La richiesta di archiviazione persistente
  c'è già ma il browser può rifiutarla.
- *Cosa:* guida più visibile ad «Aggiungi a Home» su iPhone; un promemoria del
  backup che nasce dai dati (turni aggiunti dopo l'ultimo backup), non da un
  timer né da un contrassegno «già visto».
- *Finita quando:* rispetta «un avviso alla volta» e ha il suo posto in
  `check-avvisi.mjs`.
- *Limite noto:* chi mantiene il progetto non ha un iPhone su cui provare
  (novembre 2026). Si fanno le protezioni possibili e nel riferire si dice che
  su iPhone non è verificato; non lo si dà per funzionante.
- *Mockup:* no per il promemoria, sì se cambia l'invito a installare.

**A6. Farsi riconoscere da fuori**
- *Cosa:* dominio proprio (lo compra chi mantiene il progetto), titolo,
  descrizione, immagine di anteprima, in modo che un link condiviso dica cos'è.
- *Mockup:* no.

**A7. Il riscontro sulla busta di dicembre**
- *Cosa:* quando arriva la busta di dicembre 2026 col conguaglio, diventa un
  riscontro come le altre. È la prova della promessa.
- *Attenzione:* la busta la fornisce chi mantiene il progetto e non entra nel
  repository; entrano solo le cifre.

**A8. Da `experimental` a `Beta` e in produzione**
- *Cosa:* riportare a blocchi ciò che è maturo. Cosa è maturo lo decide chi
  mantiene il progetto; il deploy di produzione lo fa lui.

### Stadio B — più lavoratori

Condizione per passare a C: qualche migliaio di utenti attivi, e almeno tre
su dieci di chi installa segnano turni per tre mesi. Le misure vengono dallo
store e dal contatore visite, non da telemetria.

**B1. Google Play**
- *Cosa:* la web app dentro una Trusted Web Activity. Serve il file di
  associazione sul dominio e un manifest in ordine.
- *Attenzione:* l'account dello store e la firma sono di chi mantiene il
  progetto. Tu prepari, lui pubblica. Non deve cambiare il modo in cui l'app si
  aggiorna.

**B2. Secondo lettore di cedolini**
- *Perché:* il confronto con la busta funziona solo con Zucchetti. È il limite
  più grosso della funzione che dà credibilità a tutto il resto.
- *Cosa:* dividere il lettore per programma paghe (uno per file, come il motore
  fa coi programmi paghe) e aggiungere il secondo.
- *Quale:* lo decidono le buste dei tester. Chi mantiene il progetto conta di
  procurarsi buste non Zucchetti: senza almeno due buste vere dello stesso
  programma non si comincia.
- *Finita quando:* il lettore nuovo ha il suo riscontro, e la pagina resta senza
  rete (`check-verifica-busta.mjs` verde).

**B3. Commercio e Pubblici esercizi verificati**
- *Cosa:* portare due contratti da «non verificato» a «verificato».
- *Stato:* per ora non ci sono buste di altri contratti in arrivo, quindi
  questa voce aspetta. Arriveranno invece buste di colleghi del Turismo, con
  livelli e orari diversi: servono a rafforzare il contratto che c'è, ognuna
  come riscontro.
- *Attenzione:* un contratto si dichiara verificato solo quando una busta vera
  torna. Mai tarando i valori per far tornare una busta sola: `CLAUDE.md`
  racconta il caso della malattia integrata da un datore.

**B4. Altri redditi nell'anno**
- *Perché:* l'app vede un solo datore. Con un secondo lavoro, o con la
  disoccupazione, la previsione dell'anno è sbagliata per difetto proprio nel
  caso più a rischio.
- *Cosa:* un dato in più — quanto altro reddito c'è nell'anno — che entra nella
  previsione e nella soglia.
- *Dove:* motore, con riscontro; poi Impostazioni e una riga dove si vede
  l'effetto.
- *Attenzione:* cambia il cuore del motore: prima di scrivere, proporre a chi
  mantiene il progetto come entra nel conto. `check-numeri-fermi.mjs` non deve
  muoversi per chi non lo usa.
- *Mockup:* sì per dove si chiede.

**B5. La busta spiegata voce per voce**
- *Perché:* un lavoratore su quattro dice di non capire la busta, e i servizi
  concorrenti la spiegano mandandola a un server.
- *Cosa:* dopo aver letto il cedolino, ogni voce ha accanto due righe che dicono
  cos'è, scritte una volta per tutte e tenute nell'app. Niente modelli, niente
  rete.
- *Attenzione:* le voci si chiamano come sul cedolino. I nomi delle voci di una
  busta possono rivelare il datore: non escono dal telefono.
- *Mockup:* sì.

**B6. Ferie e permessi residui**
- *Perché:* è una cosa che le app di turni contano e che la busta stampa, quindi
  si può verificare.
- *Cosa:* maturato, goduto, residuo.
- *Attenzione:* la maturazione è una regola di contratto: entra nel motore solo
  con una busta che la conferma.
- *Mockup:* sì.

**B7. Primo turno senza storico**
- *Perché:* chi arriva dallo store non ha uno storico da cui proporre gli orari.
- *Deciso:* solo la durata. Bottoni con le durate ricavate dalle ore
  settimanali; l'ora di inizio la scrive l'utente. Niente orari di inizio
  proposti: l'app non inventa un orario. Dal secondo turno propone lo storico.
- *Mockup:* sì.

**B8. Cose piccole**
- Invito a provare l'app nell'immagine di «Condividi la settimana»
  (`ShareWeekModal.jsx`).
- Esportare i turni nel calendario del telefono con un file .ics: copre la
  comodità che le altre app danno coi widget.

### Stadio C — quando ci sono gli utenti

Non si comincia senza un sì esplicito: qui cambiano termini e informativa.

- **C1. Fondo pensione, bonifico o in busta:** il mockup col verdetto calcolato
  è già stato mostrato e non ancora approvato. Il conto «in busta» esiste nel
  motore (`trattenuteFuoriReddito()`), quello col bonifico pure.
- **C2. «Il turno conviene?»:** messo da parte.
- **C3. Detassazione 2026 delle maggiorazioni:** vale un anno solo e il Turismo
  ha regole a parte. Si fa solo se viene prorogata.
- **C4. Versione a pagamento, referral:** solo dopo che chi mantiene il progetto
  ha deciso, con un commercialista e un avvocato. La promessa principale resta
  gratuita in ogni caso.

### Cosa non si fa

App nativa, widget, notifiche push, account, sincronizzazione su server,
scambio di turni fra colleghi, stima della disoccupazione, riaccensione della
lettura con l'IA. Se un compito porta lì, ci si ferma.

## 6. Come consegnare un compito

- Un compito è finito quando i riscontri passano, la cosa è stata provata nel
  browser coi dati di prova, ed è su `experimental`.
- Nel riferire: cosa fa adesso, in una riga; cosa non è stato verificato, detto
  chiaramente (per esempio «non provato su iPhone»); cosa resta da decidere.
- Se a metà scopri che il compito poggia su un presupposto falso, fermati e
  dillo: un compito fatto bene sulla premessa sbagliata costa più di una domanda.
- Aggiorna questo documento quando una voce si chiude o cambia, e `CLAUDE.md`
  col ragionamento.

## 7. Da dove viene questo piano

Dalla ricerca di mercato e dal business plan di novembre 2026 (seconda
versione), copiati in `docs/strategia/` così come erano scritti. In breve, quello che serve sapere per lavorare:

- **I concorrenti stanno su isole separate.** Le app di turni contano ore e
  hanno gli store, i widget e le sveglie. I calcolatori del netto partono da uno
  stipendio annuo che un turnista non conosce. I servizi che controllano la
  busta con l'IA leggono solo buste già emesse e le mandano a un server.
- **Il vantaggio di Turni** è l'unione di turni, contratto e fisco, più la
  riservatezza. I suoi punti deboli sono la copertura (due contratti, un
  programma paghe) e il fatto che non si trova.
- **Le cifre sul mercato** vengono dall'analisi delle dichiarazioni IRPEF del
  Dipartimento delle Finanze per l'anno d'imposta 2024 e da fonti di settore.
  Le cifre su utenti e ricavi nel business plan sono ipotesi, non dati.
