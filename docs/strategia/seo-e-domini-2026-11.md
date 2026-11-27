# Domini e ricerca: i nomi e le domande, 27 novembre 2026

Raccolto dal browser di chi mantiene il progetto (Google Trends, Google.it,
whois del Registro .it, RDAP del registro .app e di Verisign per il .com). Si
legge dopo `docs/strategia/lancio-dicembre-2026.md`, di cui chiude il punto 6
dei prossimi passi («raccogliere i volumi di ricerca veri»). Google Trends dà
numeri RELATIVI (100 = la settimana più cercata fra i termini confrontati), non
ricerche al mese: per le cifre assolute serve Keyword Planner, che chiede un
account Google Ads.

## In breve

- **segnaturni.it, .app e .com sono liberi.** Il .it è verificato sul whois
  del Registro («Dominio non registrato»), il .app e il .com sui registri.
- **Il nome non porta ricerche, e non deve:** nessuno cerca «segnaturni»,
  «contaturni» o «app turni» in quantità misurabile. Le ricerche stanno tutte
  dalla parte del fisco: «trattamento integrativo» ha una media di 38,
  «calendario turni» di 1, sulla stessa scala.
- **Il momento giusto è la seconda settimana di dicembre**, non gennaio: il
  picco di «trattamento integrativo» cade fra il 7 e il 14 dicembre da quattro
  anni di fila. Quello di «conguaglio busta paga» cade nelle prime due
  settimane di gennaio.
- **«segnaturni» esiste già come parola**: è il segnalino dei giochi da tavolo.
  Lo è anche «contaturni». Non è un problema di marchio, ma cercando il nome
  esce prima quel mondo.

## 1. I domini

| Nome | .it | .app | .com |
|---|---|---|---|
| **segnaturni** | **libero** (whois) | libero (RDAP) | libero (RDAP) |
| segnaturno | probabilmente libero (nessun DNS) | libero | libero |
| contaturni | probabilmente libero | libero | libero |
| pagaturno | probabilmente libero | libero | libero |
| turnometro | probabilmente libero | libero | **preso** |
| turnista | preso | libero | preso |
| cartellino | preso | libero | preso |

Come rifarlo: il .app e il .com con l'RDAP (`pubapi.registry.google`,
`rdap.verisign.com`, 404 = libero), da un browser qualsiasi. Il .it solo sul
whois web del Registro .it, che ha un reCAPTCHA: l'RDAP del .it non risponde
da fuori e il DNS dice solo «probabilmente». Dal container di sviluppo questi
indirizzi sono bloccati.

## 2. Il nome, cercato

Ricerche su Google.it con il nome fra virgolette:

- **«segnaturni»:** i primi dieci risultati sono tutti giochi da tavolo
  (segnalini, recensioni, prodotti su Amazon). Nessuna app.
- **«contaturni»:** è il nome di un accessorio (Bone Wars) e di un prodotto
  Need Games.
- **«turnometro»:** c'è già uno strumento web con quel nome, in spagnolo.
- **«pagaturno»:** nessun risultato.
- Vicino per suono: **«Segna Ore – Presenze e Turni»**, un'app su Google Play
  che fa una cosa simile (segnare ore e turni). Non è lo stesso nome, ma chi
  cerca «segna turni app» trova lei per prima.

Cosa vuol dire: un sito nuovo su segnaturni.it supera i giochi da tavolo per
il proprio nome in poche settimane (dominio uguale al nome, contenuto
pertinente), ma all'inizio chi sente il nome a voce e lo cerca può finire su un
segnalino. Il link diretto (`?ciperdo`) conta più del nome cercato.

## 3. Cosa cerca la gente (Google Trends, Italia, ultimi 5 anni)

Media del periodo, sulla stessa scala:

| Termine | Media | Note |
|---|---|---|
| trattamento integrativo | 38 | picchi a dicembre e gennaio, e un secondo rialzo a febbraio |
| calcolo stipendio netto | 23 | in calo dal 2025: 30 nel 2022, ~12 nel 2026 |
| conguaglio busta paga | 2 | quasi zero tutto l'anno, poi 40 nella 1ª–2ª settimana di gennaio |
| restituzione trattamento integrativo | 0 | volume minimo; le correlate sono «trattamento integrativo 2026» |
| app turni lavoro / app turni / calendario turni / turnista | 0–1 | non misurabili accanto al fisco |

I picchi di «trattamento integrativo» (la settimana più alta di ogni stagione):

| Stagione | Dicembre | Gennaio |
|---|---|---|
| 2022-23 | 70 (11 dic) | 100 (8 gen) |
| 2023-24 | 70 (17 dic) | 73 (7 gen) |
| 2024-25 | 74 (8 dic) | 72 (5 gen) |
| 2025-26 | 86 (7 dic) | 82 (11 gen) |

Il picco di dicembre non è mai sceso, e cade quando arrivano la busta di
novembre e la tredicesima. **Per esserci, l'app deve essere online entro il
primo fine settimana di dicembre.** Novembre 2026 è già sopra gli anni
precedenti (58 a metà mese).

Le ricerche correlate «in crescita» hanno sempre l'anno dentro («trattamento
integrativo 2026», «conguaglio busta paga gennaio 2026»): le pagine vanno
scritte con l'anno nel titolo e aggiornate ogni anno.

## 4. Chi c'è oggi nei risultati

| Ricerca | Primi risultati |
|---|---|
| restituzione trattamento integrativo | laborability, informazionefiscale, INPS, fiscoetasse, regimeminimi, epwelfare: articoli |
| trattamento integrativo calcolo | Wolters Kluwer, adessoscuola, fiscomania, ODCEC Roma, ipsoa: articoli e guide per professionisti |
| trattamento integrativo 15000 superato | **un gruppo Facebook al primo posto**, poi studi e giornali |
| conguaglio busta paga gennaio | studi paghe, CGIL Lazio, **di nuovo Facebook** |
| calcolo stipendio netto part time turni | sei calcolatori di stipendio, nessuno che conti i turni |

Due cose da tenere:
1. **Nessuno strumento** risponde alle domande sul trattamento integrativo:
   sono tutti articoli. Una pagina che fa il conto (il «Ci perdo?» di oggi,
   raggiungibile con un indirizzo suo) ha spazio.
2. **Facebook è nei primi risultati** proprio sulle domande che contano: la
   gente le fa nei gruppi. Conferma il canale «gruppi Facebook» del piano di
   lancio.

## 5. Cosa ne viene, in proposta

- Il nome resta Segnaturni. Si compra **segnaturni.it** (il più importante: chi
  lo sente a voce scrive .it) e **segnaturni.app**. Il .com è libero e costa
  poco, e serve solo a non farselo prendere.
- La pagina da far trovare non è quella del nome, ma una per la domanda:
  «Trattamento integrativo 2026: me lo riprendono a dicembre?», col conto dentro.
  Dentro lo stesso sito, come già deciso per la busta di dicembre.
- Tempi: online entro il **6 dicembre**, per il picco della settimana
  successiva. Seconda ondata per il conguaglio a gennaio.

Restano senza numero le ricerche al mese: per quelle serve Keyword Planner da
un account Google Ads.
