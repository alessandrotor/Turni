# Turni — ricerca di mercato (versione 2)

> Copia del documento scritto a novembre 2026 sul Google Drive di chi mantiene il progetto (versione 2; la 1 è superata). Non si aggiorna: cosa si fa e in che ordine, oggi, sta in [`docs/piano-per-agenti.md`](../piano-per-agenti.md). Una differenza già nota: la «pagina pubblica» di cui parla è diventata la finestra «Ci perdo?» dentro l'app.

Novembre 2026 · concorrenti, domanda, il problema da risolvere · versione 2: corretta la lettura della restituzione, aggiunta la scelta fra web app e app negli store

## In sintesi

**Il problema da attaccare è la busta di dicembre che nessuno capisce, non una perdita di soldi.** Ogni anno circa 2,3 milioni di dipendenti si vedono riprendere il trattamento integrativo ricevuto in busta: 1 miliardo di euro. Ma nello stesso conguaglio a 1,8 milioni di loro tornano 1,5 miliardi di IRPEF: superata la soglia la detrazione da lavoro sale, e quasi sempre pareggia. Chi legge solo la trattenuta crede di aver perso 1.200 €; nella maggior parte dei casi ha perso poco o niente.

**La soluzione che Turni ha già, e gli altri no:** sa i turni veri, sa le regole della busta italiana e proietta l'anno. Quindi può dire a ottobre «a dicembre vedrai una trattenuta di 700 €, ti tornano 560 € di tasse, ti restano scoperti 140 €». La raccomandazione è posizionare l'app su questa promessa — «capisci la busta prima che arrivi» — e mai sulla paura di restituire: sarebbe guadagnare sulla disinformazione, e l'app esiste per fare il contrario.

- **I concorrenti stanno su tre isole separate:** le app di turni contano ore, i calcolatori partono dallo stipendio annuo, i controllori con l'IA leggono una busta già emessa. Nessuno unisce le tre cose.
- **Il punto debole di Turni è la copertura e la distribuzione, non l'idea:** due contratti verificati su buste vere, un solo programma paghe letto, nessuna presenza negli store.
- **Restare web app è la scelta giusta** per un'app di regole che cambiano ogni anno; lo store si può aggiungere dopo senza rinunciare agli aggiornamenti (sezione 6).

## 1. Il mercato in numeri

**Il trattamento integrativo, anno d'imposta 2024 (milioni di lavoratori)**

|                                      |                                                                                         |
|--------------------------------------|-----------------------------------------------------------------------------------------|
| Lo ricevono in busta dal datore      | <span style="color:#dc2626">████████████████████████████</span> **6,0 mln · 3,8 mld €** |
| A fine anno ne hanno diritto         | <span style="color:#dc2626">██████████████████████</span> **4,8 mln · 4,1 mld €**       |
| Devono restituirlo, tutto o in parte | <span style="color:#dc2626">███████████</span> **2,3 mln · 1,0 mld €**                  |
| Lo recuperano solo col 730           | <span style="color:#dc2626">████████</span> **1,7 mln · 1,2 mld €**                     |

Fonte: [MEF, Analisi dei dati IRPEF, anno d'imposta 2024](https://www1.finanze.gov.it/finanze/analisi_stat/public/v_4_0_0/contenuti/analisi_dati_2024_irpef.pdf), par. 1.9. Nello stesso paragrafo: a oltre 1,8 milioni di chi restituisce sono state rese ritenute IRPEF per 1,5 miliardi.

Letto in un altro modo: **più di un lavoratore su tre** fra quelli che ricevono il trattamento in busta se lo vede riprendere. **Non vuol dire che ci rimetta:** a 1,8 milioni di loro il conguaglio rende 1,5 miliardi di IRPEF, più del miliardo ripreso. È uno spostamento di cassa che in busta appare come una trattenuta senza spiegazione. E 1,7 milioni hanno il caso opposto: ne avevano diritto e lo incassano solo l'anno dopo col 730. Sono 4 milioni di persone l'anno a cui serve capire prima cosa succede.

L'86,1% del trattamento va a chi ha un reddito fra 7.500 e 15.000 €: part-time, stagionali, chi fa turni variabili. È esattamente chi usa un'app di turni.

**Quanti sono i lavoratori a cui parla l'app**

|                                                              |                                                                             |
|--------------------------------------------------------------|-----------------------------------------------------------------------------|
| Dipendenti in Italia (ricavato dai dati MEF)                 | <span style="color:#2563eb">████████████████████████████</span> **~24 mln** |
| Lavorano nel fine settimana (30,9% dei dipendenti)           | <span style="color:#2563eb">█████████</span> **~7,5 mln**                   |
| Ricevono il tratt. integrativo in busta                      | <span style="color:#2563eb">███████</span> **6,0 mln**                      |
| Lavoratori «vulnerabili»: a termine o part-time involontario | <span style="color:#2563eb">█████</span> **oltre 4 mln**                    |
| Fanno turni di notte                                         | <span style="color:#2563eb">███</span> **2,5 mln**                          |
| Dipendenti della ristorazione                                | <span style="color:#2563eb">█</span> **oltre 1 mln**                        |

Fonti: MEF (dipendenti e trattamento), Eurostat via CIJ Europe (fine settimana, anno non indicato nella fonte), Istat Rapporto annuale 2026 (vulnerabili, 17% degli occupati), Istat 2022 via Inail (notte), Fipe Rapporto Ristorazione 2026. I ~7,5 milioni sono ricavati: 30,9% di 24,4 milioni. Le categorie si sovrappongono: non vanno sommate.

**La busta paga è un problema riconosciuto**

|                                                |                                                                           |
|------------------------------------------------|---------------------------------------------------------------------------|
| Ha avuto un problema in busta almeno una volta | <span style="color:#0891b2">█████████████████████████</span> **53%**      |
| Irregolarità o ritardi nell'ultimo anno        | <span style="color:#0891b2">███████████████████</span> **40%**            |
| Non capisce cosa c'è scritto in busta          | <span style="color:#0891b2">█████████████</span> **27%**                  |
| Part-time nella ristorazione                   | <span style="color:#0891b2">████████████████████████████</span> **58,8%** |

Fonti: State of Payroll Report 2024 via Sky TG24 e BusinessOnline (oltre 2.500 intervistati; il paese del campione non è indicato, quindi va preso come ordine di grandezza); Facile.it (1.400 dipendenti italiani); Fipe su dati Inps 2023.

## 2. I concorrenti

Non esiste un concorrente diretto che faccia le stesse cose. Esistono quattro famiglie, ognuna copre un pezzo.

| Famiglia                           | Chi sono                                                                                  | Punti di forza                                                                                                                                                                                                                                                        | Debolezze rispetto a Turni                                                                                                                                                                                                                                                                                              |
|------------------------------------|-------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **App di turni personali**         | Supershift (Germania), Shifter, My Shift Planner, Shiftify, ShiftPro, Shift & Pay Tracker | Negli store da anni, grafica curata, widget, sveglie, rotazioni, sincronizzazione col calendario. Supershift: 4,8/5 con 11.000 valutazioni sull'App Store italiano, oltre 1 milione di installazioni Android (dato di un aggregatore), 5 milioni di utenti dichiarati | I «guadagni» sono paga oraria × ore più una maggiorazione scelta a mano. Niente contratto italiano, niente supplementare a settimana, niente netto, niente tratt. integrativo, niente previsione dell'anno. Non sanno cosa sia una busta paga                                                                           |
| **Calcolatori del netto**          | Money.it, Coverflex, partitaiva.it, iBustaPaga, «Busta Paga - Costo del lavoro»           | Gratis, in cima a Google, aggiornati al fisco 2026                                                                                                                                                                                                                    | Partono dallo stipendio annuo fisso. Chi fa turni variabili non ha uno stipendio annuo da inserire: è proprio quello che non sa. Nessuna memoria, nessun mese reale                                                                                                                                                     |
| **Controllo della busta con l'IA** | BustaIA, GioIA (Chiedi a Gioia), ChatGPT usato a mano                                     | Leggono qualunque cedolino, anche in foto. Spiegano le voci a parole. GioIA dichiara 31 contratti e oltre 700 buste analizzate                                                                                                                                        | Guardano al passato: una busta già emessa. Non sanno i turni, quindi non possono dire se le ore pagate sono giuste. La busta va su server esterni (Gemini, Claude) e i dati estratti restano nell'account, compreso il datore. Money.it documenta errori tipici: aliquote superate, scaglioni annuali applicati al mese |
| **Software aziendali**             | Skello, Factorial (da 5 € per dipendente al mese), Dipendenti in Cloud, Zucchetti         | Hanno i turni ufficiali e l'app per il dipendente                                                                                                                                                                                                                     | Li sceglie e li paga il datore. Mostrano al lavoratore i turni, non i conti. Non diranno mai «la busta è sbagliata»                                                                                                                                                                                                     |

### Chi fa cosa

| Funzione                                       | Turni             | App di turni | Calcolatori | IA sulla busta | Software aziendali |
|------------------------------------------------|-------------------|--------------|-------------|----------------|--------------------|
| Segnare i turni                                | ✅                | ✅           | ❌          | ❌             | ✅                 |
| Lordo secondo il contratto italiano            | ✅                | ❌           | ◐           | ◐              | ❌                 |
| Netto del mese                                 | ✅                | ❌           | ✅          | ✅             | ❌                 |
| Previsione dell'anno e della soglia dei 15.000 | ✅                | ❌           | ❌          | ❌             | ❌                 |
| Conguaglio di dicembre stimato prima           | ✅                | ❌           | ❌          | ❌             | ❌                 |
| Confronto con la busta vera                    | ✅ (Zucchetti)    | ❌           | ❌          | ✅             | ❌                 |
| I dati restano sul telefono                    | ✅                | ◐            | ✅          | ❌             | ❌                 |
| Tanti contratti coperti                        | ❌ (2 verificati) | —            | ◐           | ◐              | —                  |
| Presenza negli store, widget, sveglie          | ❌                | ✅           | ❌          | ❌             | ✅                 |

✅ sì · ◐ in parte · ❌ no. Valutazione mia, dalle schede pubbliche dei prodotti.

## 3. Cosa chiede il mercato

- **Capire, senza allarmi.** La restituzione del trattamento integrativo torna ogni anno sui giornali come «chi rischia di restituire il bonus», quasi sempre senza dire che le tasse scendono insieme. Capita a 2,3 milioni di persone, e l'informazione in giro le spaventa più del dovuto: c'è spazio per chi dice la cifra vera.
- **Potersi fidare della busta.** Quattro lavoratori su dieci riferiscono un'irregolarità nell'ultimo anno, uno su quattro non sa leggerla. Nel 2026 sono nati almeno due servizi che la controllano con l'IA, e i quotidiani pubblicano guide su come farlo con ChatGPT: la domanda c'è, e chi la serve oggi lo fa mandando la busta su un server.
- **Capire le novità del 2026.** La legge di bilancio 2026 tassa al 15% le maggiorazioni per notte, festivi e turni fino a 1.500 € l'anno, con regole a parte per turismo e ristorazione. Vale solo per il 2026 e riguarda proprio i turnisti: chi glielo calcola?
- **Riservatezza.** Le guide stesse consigliano di oscurare nome, codice fiscale e IBAN prima di dare la busta a un'IA. Un'app che non manda niente fuori risponde a un timore che il mercato ha già espresso.
- **Pensione integrativa.** Gli iscritti sono 10,5 milioni, il 39,9% delle forze di lavoro; nel 2025 le nuove adesioni sono state 757 mila, il massimo da dieci anni, per oltre metà sotto i 35 anni. Sei lavoratori su dieci non hanno ancora un fondo.

## 4. Il problema e la soluzione

**Il problema, in una frase:** chi lavora a turni con un reddito variabile non sa quanto prenderà, e a dicembre trova in busta una trattenuta che nessuno gli ha spiegato e che sembra una perdita anche quando non lo è.

È un problema con tre proprietà che lo rendono buono: è misurato (2,3 milioni di persone l'anno), è ricorrente (ogni dicembre), e per risolverlo servono insieme turni, contratto e fisco, cioè la combinazione che oggi ha solo Turni.

<table style="border-collapse:collapse;width:100%">
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">La soluzione</th>
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Cosa c'è già</th>
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Cosa manca</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>1. «Capisci la busta prima che arrivi»</strong><br />
La previsione di dicembre come promessa principale: quanto ti riprendono, quanto ti torna di tasse, cosa resta davvero scoperto</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Riquadro del tratt. integrativo, conguaglio stimato, «chiedi al datore di sospenderlo», avviso quando la stima cambia</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Dirlo fuori dall'app: una pagina di ingresso che parte dalla domanda («devo restituire il trattamento integrativo? e ci perdo?») e un calcolo rapido senza turni per chi arriva da Google</td>
</tr>
<tr class="even">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>2. «La busta torna?»</strong><br />
Il confronto fra i propri turni e il cedolino, sul telefono</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">«Confronta con la busta», con lo scarto diviso per voci</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Leggere altri programmi paghe oltre a Zucchetti; più contratti verificati. Oggi è il limite più grosso</td>
</tr>
<tr class="odd">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top"><strong>3. «Cosa mi conviene»</strong><br />
Turno in più, fondo pensione, detassazione 2026</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Fondo pensione col cursore (in corso)</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">Il confronto bonifico / busta, la detassazione delle maggiorazioni, «il turno conviene?» (messo da parte)</td>
</tr>
</tbody>
</table>

**Raccomandazione:** puntare tutto sulla 1 come messaggio, usare la 2 come prova di serietà, e la 3 come strada verso i ricavi, più avanti: prima l'app esce gratuita. La 1 non richiede codice nuovo nel motore: richiede di farsi trovare. La stagione giusta è adesso: fra novembre e dicembre arrivano i conguagli, e in primavera il 730.

## 5. I punti deboli di Turni, detti chiari

- **Copertura dei contratti:** solo Turismo e Vigilanza sono confermati su buste vere. Per gli altri l'app lo dichiara, ma un lavoratore del Commercio oggi riceve una stima non verificata.
- **Un solo programma paghe letto:** il confronto automatico funziona con i cedolini Zucchetti; gli altri vanno inseriti a mano.
- **Distribuzione:** non è negli store. Supershift ha 11.000 valutazioni solo in Italia su iPhone; Turni si trova solo conoscendo l'indirizzo.
- **Comodità da calendario:** niente widget, sveglie, rotazioni automatiche, sincronizzazione col calendario del telefono. Per chi cerca «un calendario dei turni» le altre sono più comode.
- **Un solo datore:** l'app non vede un secondo lavoro, proprio il caso in cui la restituzione è più probabile.
- **Calcoli fiscali in BETA,** e così vanno presentati.

## 6. Web app o app negli store?

**Restare web app è la scelta giusta, e non va cambiata.** Quello che manca è farsi trovare, e si risolve senza scrivere un'app nuova.

<table style="border-collapse:collapse;width:100%">
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Cosa dà la web app</th>
<th style="text-align: left; border: 1px solid #cbd5e1; background: #e2e8f0; padding: 5px;">Cosa costa</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">• <strong>Aggiornamenti immediati:</strong> le regole fiscali cambiano ogni gennaio e un conto sbagliato si corregge in giornata, senza attendere la revisione di uno store<br />
• Un solo codice per Android, iPhone e computer<br />
• Nessuna commissione degli store<br />
• La promessa «niente esce dal telefono» si verifica da fuori<br />
• Sostenibile per una persona sola</td>
<td style="border: 1px solid #cbd5e1; padding: 5px; vertical-align: top">• <strong>Non si trova negli store,</strong> dove chi cerca «turni di lavoro» cerca<br />
• Su iPhone l'installazione è a mano («Aggiungi a Home») e alcune funzioni mancano («Condividi → Turni» è solo Android)<br />
• Per alcuni «un link» sembra meno serio di un'app<br />
• Niente widget<br />
• <strong>I dati su iPhone:</strong> Safari può cancellare i dati di un sito non usato per sette giorni se non è stato aggiunto alla Home. Per un'app il cui archivio è sul telefono è il rischio più serio</td>
</tr>
</tbody>
</table>

**La via di mezzo, senza rinunciare a niente:** la stessa web app si può pubblicare su Google Play dentro un involucro (Trusted Web Activity). Il contenuto resta quello del sito: gli aggiornamenti continuano ad arrivare da soli, senza ripubblicare. Costa 25 \$ una volta. Per l'App Store serve un involucro diverso e Apple è più restrittiva: da rimandare.

**Cosa fare:** niente app nativa. Su iPhone insistere sull'installazione in Home e sul backup. Google Play quando l'app gratuita è stabile.

La regola dei sette giorni di Safari viene da fonti del 2020–2022 (WebKit): va riprovata su un iPhone di oggi. Il comportamento di Google Play è descritto nella documentazione di Chrome per sviluppatori.

## 7. I ricavi, più avanti: il fondo pensione

- **Perché è coerente:** l'app sa il reddito e le tasse dell'anno, quindi sa dire quanto torna da un versamento. È un consiglio che fa risparmiare il lavoratore, non una pubblicità.
- **Il bacino:** circa il 60% delle forze di lavoro non è iscritto. Attenzione però: dal 2026 i neoassunti aderiscono in automatico, quindi il bacino dei giovani si restringerà.
- **Il limite dei redditi bassi:** chi guadagna 15.000 € l'anno versa poco. Il valore di un contatto per un fondo sarà basso: va verificato prima di costruirci sopra.
- **Cosa non ho trovato:** nessuna cifra pubblica su quanto un fondo aperto o un PIP paghi per un'adesione portata da terzi. Le regole COVIP sulla raccolta delle adesioni vanno lette prima di qualunque accordo: non è detto che un'app possa farlo senza essere un soggetto abilitato.

## 8. Limiti di questa ricerca

- I numeri sulle app (installazioni, utenti) vengono da schede pubbliche e aggregatori, non dagli store direttamente: sono ordini di grandezza.
- L'indagine sugli errori in busta è di un'azienda del settore, e non è chiaro in che paese sia stata fatta.
- Non ho trovato un dato Istat recente sul totale dei lavoratori a turni (non solo notturni).
- Non ho parlato con nessun utente: la domanda è ricavata da dati e stampa, non da interviste. Cinque interviste a colleghi di altri contratti varrebbero più di questo documento.

## Fonti

- [MEF, Analisi dei dati IRPEF, anno d'imposta 2024](https://www1.finanze.gov.it/finanze/analisi_stat/public/v_4_0_0/contenuti/analisi_dati_2024_irpef.pdf)
- [Supershift, scheda App Store Italia](https://apps.apple.com/it/app/app/id1104165041)
- [Skello, confronto delle app di turni](https://www.skello.io/it/blog/app-per-turni-di-lavoro) (fonte di parte: vende software aziendale)
- [apkcombo, installazioni Android di Supershift](https://apkcombo.com/supershift-shift-work-calendar/app.supershift/)
- [BustaIA](https://www.bustaia.it/controllo-busta-paga-online)
- [GioIA](https://www.chiediagioia.it/analizza-busta-paga)
- [Money.it, controllare la busta con l'IA](https://www.money.it/come-controllare-la-busta-paga-con-l-intelligenza-artificiale)
- [BusinessOnline, oscurare i dati prima dell'IA](https://www.businessonline.it/news/controllare-la-propria-busta-paga-con-lia-perch-conviene-oscurando-prima-determinati-dati-per-non-rischiare_n88246.html)
- [Sky TG24, errori in busta paga](https://tg24.sky.it/economia/2025/02/04/lavoro-busta-paga-errori)
- [BusinessOnline, State of Payroll Report 2024](https://www.businessonline.it/news/quasi-il-50-dei-dipendenti-ha-avuti-errori-in-busta-paga-nellultimo-anno-i-pi-diffusi-e-come-riconoscerli_n76385.html)
- [Facile.it, un italiano su quattro non sa leggere la busta](https://www.facile.it/conti/news/busta-paga-un-italiano-su-quattro-non-sa-leggerla.html)
- [Inail su dati Istat, lavoro notturno](https://file.conflavoro.it/unasf/GliInfortuniSulLavoroInOrariNotturnoInItalia.pdf)
- [CIJ Europe su dati Eurostat, lavoro nel fine settimana](https://cijeurope.com/en/over-20-of-employed-people-in-eu-worked-on-weekends-in-2023/post.html)
- [Istat via Milano Finanza, lavoratori vulnerabili](https://www.milanofinanza.it/mfnewswires/lavoro-italia-in-ritardo-strutturale-condizione-giovani-critica-istat-202605211148061318)
- [Fipe, Rapporto Ristorazione 2026](https://www.confcommerciomilano.it/export/sites/unione/doc/news_comunicati/pdf/2026/fipe_risto_rapp26.pdf)
- [Fipe, part-time nella ristorazione](https://fipe.it/wp-content/uploads/2024/12/Lavoro-femminile-dalla-ristorazione-segnali-positivi.pdf)
- [COVIP via L'Adige, iscritti a fine 2025](https://www.ladige.it/attualita/covip-10-5-milioni-iscritti-a-previdenza-complementare-a-fine-2025-4-8-yljrvs2s)
- [Teleborsa, nuove adesioni ai fondi pensione](https://www.teleborsa.it/News/2026/06/10/covip-pepe-nuovi-iscritti-ai-fondi-pensione-al-top-da-10-anni-oltre-la-meta-under-35-anni-151.html)
- [EcNews, detassazione di notturno, festivo e turni](https://www.ecnews.it/lavoro/news-del-giorno/legge-bilancio-2026-detassazione-lavoro-festivo-notturno-turni/)
- [Chrome per sviluppatori, Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [The Register, la regola dei sette giorni di Safari](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/)
