# Turni — business plan e piano di sviluppo (versione 2)

> Copia del documento scritto a novembre 2026 sul Google Drive di chi mantiene il progetto (versione 2; la 1 è superata). Non si aggiorna: cosa si fa e in che ordine, oggi, sta in [`docs/piano-per-agenti.md`](../piano-per-agenti.md). Una differenza già nota: la «pagina pubblica» di cui parla è diventata la finestra «Ci perdo?» dentro l'app.

Novembre 2026 · versione 2: lancio gratuito, promessa corretta, a chi rivolgersi a Roma, web app o store

## In sintesi

**Turni esce gratuita, come web app, e resta gratuita finché la base di utenti non giustifica una partita IVA. Fino ad allora si lavora su due cose soltanto: farsi trovare e coprire più contratti.**

- **Promessa:** «Capisci la busta prima che arrivi». Mai la paura di restituire: quando il trattamento integrativo viene ripreso, quasi sempre le tasse scendono di altrettanto, e l'app lo dice con le cifre.
- **Web app:** è la scelta giusta e resta. Google Play si aggiunge dopo, con la stessa web app dentro, senza perdere gli aggiornamenti immediati.
- **Soldi:** nessun ricavo e quasi nessuna spesa nei primi due stadi. La partita IVA si apre prima del primo incasso, non a un certo numero di utenti; il numero di utenti serve a decidere se ne vale la pena.
- **Aiuto:** per ogni stadio la tabella della sezione 5 dice a chi rivolgersi a Roma.

Le cifre su utenti e ricavi sono ipotesi mie, dichiarate una per una: non esistono ancora dati di Turni su cui basarle.

## 1. La promessa, detta onestamente

Ogni anno 2,3 milioni di dipendenti si vedono riprendere 1,0 miliardo di trattamento integrativo. Nello stesso conguaglio, a 1,8 milioni di loro tornano 1,5 miliardi di IRPEF (MEF, anno d'imposta 2024). Il danno vero non è la perdita: è una trattenuta grossa a dicembre che nessuno spiega, e tutta l'informazione in giro che la racconta come soldi persi.

| Si dice                                                                                             | Non si dice                        |
|-----------------------------------------------------------------------------------------------------|------------------------------------|
| «A dicembre vedrai una trattenuta di 700 €. Te ne tornano 560 di tasse. Scoperti restano 140.»      | «Rischi di restituire 700 €!»      |
| «Superare la soglia ti costa al massimo ~130 € l'anno, e bastano poche ore in più per recuperarli.» | «Attento a non superare i 15.000.» |
| «È una stima: ecco cosa l'app non sa.»                                                              | Una cifra secca senza incognite    |

Questa regola vale anche per la pagina pubblica, per la scheda sullo store e per qualunque futuro partner: la cifra viene dal motore dell'app, e un messaggio che spaventa per far cliccare non si pubblica.

## 2. Web app o app negli store?

**Non sbagli: restare web app è la scelta giusta per questo prodotto.** Le regole fiscali cambiano ogni gennaio, e un conto sbagliato va corretto in giornata, non dopo la revisione di uno store. Con un solo sviluppatore, un solo codice per tutti i telefoni è l'unica strada che regge.

| Cosa dà la web app                        | Cosa costa                                                                                         | Come si rimedia                                                                                                                                                                  |
|-------------------------------------------|----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Aggiornamenti immediati, uguali per tutti | Non si trova negli store                                                                           | Pubblicare su Google Play la stessa web app dentro un involucro (Trusted Web Activity): il contenuto resta quello del sito e si aggiorna da solo. 25 \$ una volta                |
| Un solo codice, nessuna commissione       | Su iPhone si installa a mano e mancano alcune funzioni                                             | Guidare all'«Aggiungi a Home». L'App Store si rimanda: serve un involucro diverso e Apple è più restrittiva                                                                      |
| Riservatezza verificabile da fuori        | **Su iPhone Safari può cancellare i dati** di un sito non usato per sette giorni, se non è in Home | Spingere l'installazione in Home su iPhone, ricordare il backup, chiedere al browser l'archiviazione persistente. Da riprovare su un iPhone di oggi: le fonti sono del 2020–2022 |
| Sostenibile da soli                       | Niente widget; «un link» sembra meno serio                                                         | Lo store Android risolve la serietà; i widget restano fuori                                                                                                                      |

**In breve:** niente app nativa. Web app adesso, Google Play nello stadio B, App Store solo se i numeri su iPhone lo chiedono.

## 3. Gli stadi

Ogni stadio ha un traguardo e una condizione per passare al successivo. Se la condizione non si avvera ci si ferma a capire perché, invece di costruire altro.

<table style="border-collapse:collapse;width:100%">
<colgroup>
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
</colgroup>
<thead>
<tr class="header">
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Stadio</th>
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Cosa si fa</th>
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Traguardo</th>
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Si passa oltre se…</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>A. Lancio gratuito</strong><br />
mesi 0–3</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">• Portare in produzione ciò che è maturo<br />
• Termini e informativa rivisti da un avvocato<br />
• Motore controllato da un consulente del lavoro<br />
• Pagina pubblica: «Mi riprendono il trattamento integrativo: ci perdo?»<br />
• La busta di dicembre col conguaglio vero come riscontro<br />
• Protezione dei dati su iPhone</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">App in produzione, trovabile, con un parere professionale alle spalle</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">La stima del conguaglio di dicembre torna con la busta vera entro la forchetta</td>
</tr>
<tr class="even">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>B. Crescita gratuita</strong><br />
mesi 3–12</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">• Google Play (stessa web app)<br />
• Secondo lettore di cedolini<br />
• Commercio e Pubblici esercizi verificati su buste<br />
• Sindacati di settore a Roma<br />
• Invito nell'immagine «Condividi la settimana»<br />
• Primo turno in due tocchi senza storico</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">1.000 utenti attivi a metà stadio, 5.000–10.000 alla fine</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Almeno il 30% di chi installa segna turni per tre mesi</td>
</tr>
<tr class="odd">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>C. Partita IVA</strong><br />
dal mese 12, se B è riuscito</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">• Commercialista, apertura, nuovi termini (oggi dicono «senza scopo di lucro»)<br />
• «Cosa mi conviene»: fondo pensione, detassazione, turno in più<br />
• Prova di una versione Pro e, con parere legale, di un fondo partner</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Primi incassi</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">I ricavi coprono i costi fissi della partita IVA, oppure un partner chiede un contratto</td>
</tr>
<tr class="even">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>D. Società</strong><br />
solo se serve</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">• Notaio e commercialista</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">—</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Arrivano soci o investitori, o serve separare il patrimonio personale</td>
</tr>
</tbody>
</table>

**Utenti attivi attesi**

|         |                                                                          |
|---------|--------------------------------------------------------------------------|
| Mese 3  | <span style="color:#2563eb">█</span> **200**                             |
| Mese 6  | <span style="color:#2563eb">█</span> **1.000**                           |
| Mese 12 | <span style="color:#2563eb">██████</span> **5.000–10.000**               |
| Mese 24 | <span style="color:#2563eb">██████████████████████████</span> **20.000** |

Ipotesi di crescita, non una previsione: serve a fissare i traguardi degli stadi.

### Quando aprire la partita IVA

- **Non dipende dal numero di utenti.** Secondo le guide fiscali consultate serve per un'attività di vendita abituale, anche solo avendo un account venditore su uno store. Un'app gratuita senza incassi non la richiede.
- **Il numero di utenti serve a decidere se conviene.** La mia proposta: parlarne col commercialista intorno ai 5.000 utenti attivi che restano, e aprirla prima del primo incasso.
- **Da chiedere al commercialista:** regime forfettario (tetto 85.000 € di ricavi), codice attività, contributi INPS, e se l'aliquota ridotta dei primi anni vale ancora per chi apre adesso: le fonti non concordano.

## 4. Soldi: costi adesso, ricavi dopo

| Voce                                           | Importo                                      | Quando                                 |
|------------------------------------------------|----------------------------------------------|----------------------------------------|
| Ospitalità del sito                            | 0 €                                          | Sempre: pagine statiche, nessun server |
| Dominio proprio                                | ~15 € l'anno (ipotesi)                       | Stadio A                               |
| Avvocato: termini, informativa, responsabilità | 300–800 € (ipotesi)                          | Stadio A                               |
| Consulente del lavoro: controllo del motore    | da concordare; forse in cambio di visibilità | Stadio A                               |
| Google Play                                    | 25 \$ una volta                              | Stadio B                               |
| Commercialista e costi della partita IVA       | da preventivo                                | Stadio C                               |
| App Store                                      | 99 \$ l'anno                                 | Solo se serve                          |

**Ricavi possibili nello stadio C** (ipotesi, da verificare allora): una versione Pro a ~10 € l'anno, sul prezzo che il mercato già paga, e il referral verso un fondo pensione. Con 20.000 utenti, il 3% che paga la Pro e lo 0,5% che apre un fondo a 30 € di compenso, fanno circa 9.000 € l'anno. Con 3.000 utenti circa 700 €. È un'attività che si ripaga, e diventa di più solo oltre le decine di migliaia di utenti. La promessa principale resta gratuita in ogni caso.

## 5. A chi rivolgersi a Roma, stadio per stadio

| Stadio                          | Chi                                                        | Per cosa                                                                                                                                       | Come trovarlo                                                                              |
|---------------------------------|------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| **A**                           | Avvocato esperto di privacy e digitale                     | Termini, informativa, limiti di responsabilità: anche gratis, l'app dà stime fiscali a tuo nome. Basta un incontro                             | Ordine degli Avvocati di Roma, elenco degli iscritti                                       |
| **A**                           | Consulente del lavoro                                      | Far controllare i conti del motore; avere buste di altri contratti e programmi paghe                                                           | Ordine dei Consulenti del Lavoro di Roma                                                   |
| **A–B**                         | Lazio Innova, Spazio Attivo Roma                           | Orientamento pubblico per chi avvia un'impresa; gestisce il bando regionale Pre-Seed per startup innovative (fino a 145.000 € a fondo perduto) | Sito di Lazio Innova. Non ho trovato la pagina dello sportello: verificare cosa offre oggi |
| **B**                           | Sindacati di settore: Filcams CGIL, Fisascat CISL, UILTuCS | Utenti e buste di Commercio e Pubblici esercizi: controllare la busta è il loro mestiere                                                       | Sedi di Roma e Lazio delle tre sigle                                                       |
| **B**                           | Dock Startup Lab                                           | Pre-incubatore gratuito di quattro mesi. Le candidature 2026 sono chiuse: vale il prossimo giro                                                | Sito di Dock Startup Lab                                                                   |
| **B → C**                       | Commercialista                                             | Quando aprire, regime, codice attività. Prima del primo incasso                                                                                | Ordine dei Dottori Commercialisti di Roma                                                  |
| **C**                           | Camera di Commercio di Roma                                | Iscrizione al Registro Imprese; orientamento alle nuove imprese                                                                                | Sito della Camera di Commercio. Non ho trovato la pagina dello sportello: verificare       |
| **C**, prima del fondo pensione | Avvocato di diritto finanziario, poi COVIP                 | Sapere se un'app può segnalare adesioni a un fondo ed essere pagata. Non ho trovato una regola chiara: serve un parere                         | COVIP ha sede a Roma, piazza Augusto Imperatore 27                                         |
| **D**                           | Notaio                                                     | Costituzione della società                                                                                                                     | Consiglio Notarile di Roma                                                                 |

Non indico studi privati: gli Ordini pubblicano gli elenchi degli iscritti. Bandi e sportelli pubblici cambiano spesso: le voci marcate «verificare» vanno controllate sui siti prima di muoversi.

## 6. Come ci si fa trovare

- **Ricerca su Google:** una pagina pubblica con un calcolo rapido e onesto: «Mi riprendono il trattamento integrativo: ci perdo?». Tre dati, la trattenuta, le tasse che tornano, quello che resta. La domanda torna ogni anno fra novembre e luglio.
- **Passaparola fra colleghi:** «Condividi la settimana» esiste già; un tabellone condiviso in un gruppo WhatsApp raggiunge tutto il locale.
- **Sindacati e consulenti del lavoro:** hanno gli iscritti e le buste.
- **Google Play** nello stadio B.
- **Tre momenti l'anno:** conguaglio (novembre–dicembre), CU (marzo), 730 (aprile–luglio).

**Come si misura senza telemetria:** visite dal contatore già presente, installazioni e valutazioni dallo store. Non serve tracciare nessuno.

## 7. I rischi

| Rischio                                                 | Quanto pesa | Cosa si fa                                                                                                                  |
|---------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------------|
| **Una stima sbagliata** fa perdere soldi o fiducia      | Alto        | BETA dichiarata, incognite accanto a ogni cifra, contratti nuovi solo con buste vere, controllo di un consulente del lavoro |
| **Nessuno la trova**                                    | Alto        | È il rischio principale: per questo gli stadi A e B sono distribuzione e copertura                                          |
| **Dati persi su iPhone**                                | Alto        | Installazione in Home, backup, archiviazione persistente; da provare su un iPhone vero                                      |
| **Le regole cambiano ogni anno**                        | Alto        | Il fisco è già un file per anno. Un mese di aggiornamento ogni gennaio                                                      |
| **Responsabilità personale** finché non c'è una società | Medio       | Termini rivisti da un avvocato già nello stadio A                                                                           |
| **Il referral non è permesso** o paga poco              | Medio       | Parere legale prima di costruire; la Pro non dipende da nessuno                                                             |
| **Una persona sola**                                    | Medio       | I riscontri automatici proteggono il motore; il rischio resta sul tempo                                                     |

## 8. I primi tre passi

1.  Un incontro con un avvocato su termini, informativa e responsabilità.
2.  Un consulente del lavoro che guardi i conti del motore, e che possa portare buste di altri contratti.
3.  La pagina pubblica «ci perdo?» pronta prima delle buste di dicembre.

## Da dove vengono i numeri

- Mercato e concorrenti: la ricerca di mercato di novembre 2026 (versione 2), con le sue fonti.
- Trattamento integrativo ripreso e IRPEF resa: [MEF, Analisi dei dati IRPEF, anno d'imposta 2024](https://www1.finanze.gov.it/finanze/analisi_stat/public/v_4_0_0/contenuti/analisi_dati_2024_irpef.pdf), par. 1.9.
- Partita IVA e store: [Il Commercialista Online](https://www.ilcommercialistaonline.it/vendita-app-ecco-come-mettersi-in-regola/); regime forfettario: [PartitaIVA.it](https://www.partitaiva.it/?p=107992) e [StartupItalia](https://startupitalia.eu/economy/flat-tax-al-15-per-i-professionisti-e-al-5-per-le-giovani-startup-le-regole-del-regime-forfettario-per-il-2026/), che non concordano.
- Google Play con la web app: [Chrome per sviluppatori](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start). Dati su Safari: [The Register, 2020](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/).
- Bando Pre-Seed: [EconomyUp](https://www.economyup.it/startup/pre-seed-regione-lazio-la-misura-per-sostenere-le-startup-in-fase-iniziale-anche-con-capitali-privati/). Dock Startup Lab: [Superscout](https://superscout.co/incubator/dock-startup-lab). Adesioni ai fondi: [COVIP, deliberazione 22 dicembre 2020](https://www.covip.it/sites/default/files/provvedimenti/deliberazione_22_dicembre_2020_0.pdf).
- Utenti, quote, compensi, parcelle: ipotesi mie, da sostituire con dati e preventivi veri.
