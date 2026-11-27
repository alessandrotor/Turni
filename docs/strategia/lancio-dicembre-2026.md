# Il lancio di dicembre 2026: nome, vetrina, messaggio

Stato al 27 novembre 2026. Raccoglie le decisioni prese nella conversazione
del 24–27 novembre con chi mantiene il progetto, perché chi riprende il lavoro
(da claude.ai o da Claude Code nel terminale) non debba ricostruirle. Si legge
dopo `CLAUDE.md` e `docs/piano-per-agenti.md`; per la ricerca di mercato e il
piano d'impresa ci sono `docs/strategia/ricerca-di-mercato-2026-11.md` e
`docs/strategia/business-plan-2026-11.md`.

## In breve

| Tema | Deciso | Aperto |
|---|---|---|
| Nome pubblico | **Segnaturni** (in app, manifest, vetrina, informativa, termini) | si può ancora cambiare: «per cambiare c'è tempo» |
| Dominio | — | comprare segnaturni.app (libero) e segnaturni.it (probabilmente libero, da confermare) |
| Vetrina | `/benvenuto` sul sito di prova, terza versione approvata come base | il testo «è da sistemare», dice chi mantiene il progetto |
| Misura dell'interesse | «Mi interessa» contato in modo anonimo + canali WhatsApp/Telegram | i canali vanno creati da chi mantiene il progetto |
| Email | **non si chiedono**, per ora | — |
| Busta di dicembre spiegata | buona idea, **non si promette** | verifica legale prima di costruirla |

## 1. Il nome: Segnaturni

**Perché:** una parola sola, che si dice a voce e non si scrive sbagliata
(«segnali su Segnaturni»): il passaparola fra colleghi è il canale principale.
Tiene «turni», quindi chi fa turni si riconosce, e aggiunge il gesto.

**Come è applicato:** tutto ciò che si legge dice Segnaturni; repository,
identificatori e chiavi del localStorage (`turni_…`) restano «turni», perché
cambiarle farebbe perdere i dati a chi usa già l'app (vedi `CLAUDE.md`, in
testa). Nella vetrina il marchio è «Segna» scuro + «turni» blu, attaccati.
L'immagine d'anteprima dei link (`public/og-image.png`) è stata rifatta col
nome nuovo alla stessa misura (1470×771, `check-anteprima-link.mjs`).

**Scartati, e perché** (non riproporli):

| Nome | Motivo |
|---|---|
| Turni | turni.app e turni.it presi; non spiega cosa fa |
| Ci perdo | senza «?» suona come una sentenza negativa |
| Netto chiaro (nettochiaro.it è già suo) | non convince; troppo vicino a «Busta Chiara» |
| Conguaglio chiaro, Busta chiara | vicini o uguali al concorrente |
| Tornaconto, Turnoconto | «bruttissimo» |
| Quanto mi entra / ti entra | gioco di parole troppo facile |
| Inbusta | contiene «busta»; il .it è preso |
| Turno giusto | promette un controllo sul datore che l'app non fa |

Rimasti in lizza prima della scelta: Contaturni (il preferito di chi mantiene
il progetto prima di Segnaturni), Paga Turno, Turnista, Turnometro, Cartellino.

**Come si verificano i domini:** i .app col RDAP del registro Google
(`https://pubapi.registry.google/rdap/domain/NOME.app`, 404 = libero,
affidabile); i .it e i .com solo dalla presenza di server DNS
(`https://dns.google/resolve?name=NOME.it&type=NS`): «nessun DNS» vuol dire
probabilmente libero, non certamente. Prezzi indicativi: .app 13–15 €/anno,
.it 8–15 €/anno.

## 2. Il concorrente: Busta Chiara (bustachiara.app)

Visto il 27 novembre 2026. Per **dipendenti pubblici** (tabelle ARAN, NoiPA);
le buste caricate vanno su un server (Supabase, Francoforte) e le legge Claude
di Anthropic; account obbligatorio con nome, email, telefono; non gestisce
turni; non ancora uscito (lista d'attesa). Ci si distingue su due cose,
indicate da chi mantiene il progetto:

1. **La privacy:** i dati non escono dal telefono, e si può controllare.
2. **I turni:** loro guardano la busta dopo; Segnaturni la vede arrivare.

Non si nomina il concorrente nella pubblicità: si dicono le nostre
caratteristiche. E si evitano nomi e colori che lo ricordino (la seconda
versione della vetrina, color carta, gli somigliava ed è stata scartata).

## 3. La vetrina `/benvenuto`

File: `public/benvenuto/index.html`, `public/benvenuto/frasi.js`,
`public/benvenuto/grazie/index.html`, `public/benvenuto/calendario.jpg`. Pagine
statiche fuori dal ripiego del service worker (`navigateFallbackDenylist` in
`vite.config.js`), come informativa e termini. Online sul sito di prova:
`https://test.turni-9vr.pages.dev/benvenuto/`. `noindex` finché il nome non è
definitivo.

**Decisioni di stile** (dopo tre versioni):
- toni **azzurri chiari** (`#dce9ff` → `#e9f2ff` in apertura, sezioni bianche e
  azzurre alternate), blu pieno `#2c5fe8` solo per pulsanti e accenti; niente
  color carta, niente apertura scura;
- via i segni da pagina generata con l'IA: bagliori sfumati, badge a pillola
  con emoji, etichette in maiuscolo sopra i titoli, tre schede uguali coi numeri
  nei cerchi, terminale finto, citazione in prima persona;
- **screenshot vero** dell'app (turni inventati, lordo ~1.400 €: «1.000 è
  brutto») in una cornice da telefono, proporzioni vere (`height:auto`);
- font di sistema: la CSP non lascia caricare Google Fonts;
- su telefono una colonna sola e «Apri l'app» fisso in basso.

**Il titolo:** la prima riga **gira da sola** ogni **7,5 secondi** (scelta di chi
mantiene il progetto) fra undici frasi che mostrano cosa l'app sa segnare («Sei
ore di domenica.», «Il turno di Natale.», «Un giorno di malattia.»…), sopra la
domanda fissa «Quanto ti entra in busta?». Ordine mescolato, nessuna
ripetizione finché non sono passate tutte, ferma a scheda nascosta, senza
movimento con «meno animazioni». Due righe di altezza tenute, così la pagina
non salta. Lo script è `frasi.js`, servito dal sito stesso come vuole la CSP.

**Lo stesso stile nell'app** (prova su `experimental`, 27 novembre 2026): la
«prima versione» del mockup, scelta da chi mantiene il progetto fra tre —
le altre due avevano più contrasto (fascia blu piena) e poi la stessa fascia
piatta, «il coso bombato no». Colori nelle variabili di `src/index.css`, marchio
in `NavBar.jsx`, il totale del mese grande come un titolo che scorrendo si
riduce a una riga (`useScorrimento.js`). Font di sistema come la vetrina.

**Niente promesse:** «Stiamo preparando la spiegazione della busta di
dicembre e le novità per il 2027» è stato tolto: non è detto che arrivi.

## 4. Misurare l'interesse senza chiedere dati

«Mi interessa» porta a `/benvenuto/grazie/`: ogni visita lì è un interessato,
e la conta il contatore visite che c'era già (Cloudflare Web Analytics, lo
snippet è messo a mano in ogni pagina). Si legge nella dashboard Cloudflare,
visite a `/benvenuto/grazie/` contro quelle a `/benvenuto/`. Nessun dato nuovo,
nessun cambio all'informativa.

I canali WhatsApp e Telegram sono segnati «presto»: chi mantiene il progetto
deve crearli e dare i link.

**Le email** sono state valutate e rimandate: sono dati personali, renderebbero
chi mantiene il progetto titolare del trattamento, richiederebbero un servizio
esterno nella `connect-src`, un'informativa riscritta e la cancellazione con un
clic, e contraddirebbero a vista il «niente esce dal telefono». Se un giorno
servono: doppia conferma, servizio con server nell'UE, una frase onesta accanto
(«è l'unico dato che ti chiediamo, e solo se vuoi»).

## 5. Il piano di lancio (proposta, non ancora avviata)

Il momento è il conguaglio: a dicembre migliaia di persone si vedono
riprendere il trattamento integrativo e pensano di perderci. Fasi:

| Quando | Fase | Messaggio |
|---|---|---|
| fino al 7 dicembre | preparazione: produzione aggiornata, dominio | — |
| 8–24 dicembre | prima del conguaglio | sai già cosa trovi a dicembre, e se ti conviene fare quelle ore in più |
| 27 dicembre – 31 gennaio | arriva la busta (il picco) | ti hanno ripreso il tratt. integrativo? Guarda la riga sotto: le tasse che ti rendono |
| febbraio – marzo | tenere chi è arrivato | segna i turni e a dicembre niente sorprese |

Canali, in ordine di resa attesa: passaparola fra colleghi (link `?ciperdo`),
video brevi con lo schermo dell'app (il grafico mese per mese, le due righe del
conguaglio), gruppi Facebook e Reddit dove la domanda viene già fatta, pagine
che rispondono alle ricerche, annunci Meta solo nella fase del picco
(150–300 € in tutto, facoltativi), patronati e CAF come semina lenta.

**Regole del messaggio** (dalla sezione 1 di `docs/piano-per-agenti.md`): mai
«recupera i tuoi soldi»; sempre accanto stima beta, un solo datore, verificato
su cedolini generati con Zucchetti; la privacy detta in modo verificabile («la
busta e i turni non escono dal telefono», non «non esce nessun dato»: c'è il
contatore visite).

**SEO:** «calcolo stipendio netto» è affollatissimo (giornali, patronati,
calcolatori); sul conguaglio con restituzione ci sono solo articoli, nessuno
strumento: lì c'è spazio. Volumi reali **non ancora raccolti**: servono Google
Trends e Keyword Planner da un browser normale (da qui Trends risponde 429).

## 6. La busta di dicembre spiegata (idea, non promessa)

Carichi il PDF della busta di dicembre e l'app mette in fila le righe del
conguaglio (tratt. integrativo ripreso, IRPEF resa, indennità, saldo) con il
perché. Il lettore Zucchetti e il conguaglio ci sono già. Mockup fatto (tre
schermate: ingresso con la privacy in grande, il conguaglio coi due tasselli,
il ponte verso l'app). Se si fa, è una pagina dello stesso sito (per la SEO un
sito solo accumula autorità), non un dominio separato.

**Prima, la verifica legale** chiesta da chi mantiene il progetto. Quello che
una ricerca ha trovato (fonti di settore, testi originali non letti):
- privacy: se la busta non lascia il telefono, la tesi più solida è che chi
  sviluppa non sia titolare del trattamento, ma nessuna fonte lo conferma per
  questo caso;
- L. 12/1979 (consulenti del lavoro): riserva gli adempimenti per conto dei
  datori; spiegare al lavoratore la sua busta, gratis, non sembra rientrarci —
  area grigia, nessuna sentenza su app simili;
- art. 348 c.p. (esercizio abusivo): riguarda attività organizzate e pagate;
  il rischio sale col referral dei fondi pensione;
- regola pratica: **l'app spiega, non consiglia**;
- chi consultare: un avvocato privacy/IT e un consulente del lavoro, un'ora
  ciascuno, prima del lancio.

## 7. Cosa è stato fatto nel motore nella stessa conversazione

- La proiezione annua non conta più due volte le ferie già segnate dopo oggi:
  ogni mese da oggi in poi vale la mensilità da contratto, e le ore ordinarie
  già segnate ne coprono una parte (`giaCoperto()`, `src/motore/copertura.js`,
  riscontro in `check-proiezione.mjs`).
- «Perché ogni mese è diverso» disegna la detrazione mese per mese
  (`GraficoMesi.jsx`, `detrazioneMesePerMese()`, `check-mese-per-mese.mjs`): il
  riscontro parte dalla busta di ottobre 2026, dove la detrazione del mese è
  l'annua sul reddito presunto per i giorni del mese su 365.

## 8. Prossimi passi, in ordine

1. **Chi mantiene il progetto:** comprare segnaturni.app e .it; creare i canali
   WhatsApp e Telegram; decidere il testo della vetrina.
2. Collegare il dominio a Cloudflare Pages e portare la vetrina all'indirizzo
   principale (l'app resta raggiungibile; da decidere su quale percorso).
3. Togliere `noindex` dalla vetrina quando il nome è definitivo.
4. Portare in produzione (deploy manuale, lo fa chi mantiene il progetto).
5. Verifica legale, poi eventualmente la busta di dicembre spiegata.
6. Raccogliere i volumi di ricerca veri e decidere le pagine per la SEO. Volumi relativi
   e domini raccolti il 27/11: `docs/strategia/seo-e-domini-2026-11.md`.
