# Informativa sulla privacy — Turni

**Ultimo aggiornamento:** 19 ottobre 2026

Turni serve a tenere traccia dei propri turni di lavoro e a stimare quanto si
guadagna. Questa informativa dice quali dati escono dal tuo dispositivo, dove
vanno e perché. È scritta per essere letta, non per essere firmata: non c'è
niente da accettare.

Vale per il sito turni-9vr.pages.dev e per il sito di prova, anche quando li
installi come app. Le condizioni d'uso sono in una pagina a parte:
[Termini d'uso](/termini/).

## In breve

**I tuoi turni non stanno su nessun server.** Non c'è un account da creare, non
c'è una sincronizzazione, e chi sviluppa l'app non può vedere i tuoi dati
nemmeno volendo.

Dal dispositivo escono solo i dati tecnici che servono a qualunque sito per
essere aperto (l'indirizzo IP, il tipo di browser) e un conteggio anonimo delle
visite. Turni, orari, paga, contratto, calcoli e le immagini dei tabelloni
restano dove li hai messi.

## Chi è il titolare

Il titolare del trattamento è **Alessandro Torreggiani**, che sviluppa e
pubblica Turni a titolo personale e gratuito. Contatto:
**g.asriel@gmail.com**.

## Dati che restano sul tuo dispositivo

Turni, orari, paga oraria, dati del contratto e tutto ciò che serve alla stima
del netto sono salvati **solo nella memoria locale del browser o dell'app**.
Il titolare non li riceve e non li tratta.

Questo ha un rovescio che è giusto conoscere: se cancelli i dati del sito,
disinstalli l'app, o svuoti la memoria del browser, **i tuoi turni spariscono e
non sono recuperabili da nessuna parte**. Non esiste una copia altrove. Per
questo c'è la funzione di backup in Impostazioni: il file che produce resta a
te, non viene inviato da nessuna parte.

## Turni letti da un'immagine

L'immagine del tabellone che scegli o condividi con Turni **si legge sul
telefono**: non viene inviata a nessun servizio. Il programma che la legge si
scarica la prima volta che usi la funzione, dal sito di Turni stesso e non da
servizi esterni, e resta nella memoria del telefono.

Se il tabellone contiene i nomi dei colleghi, Turni li legge sul telefono solo
per mostrarti l'elenco da cui scegliere il tuo, poi legge soltanto la tua riga.
L'immagine non viene conservata: un'immagine condivisa con l'app viene
cancellata appena letta.

## Lettura con l'intelligenza artificiale (spenta)

Nel codice di Turni esiste anche una lettura delle foto con Google Gemini, che
manda la foto e il nome da cercare a un servizio esterno. **Oggi è spenta.** Se
dovesse tornare attiva, questa informativa verrà aggiornata prima, e la prima
volta che la usi un avviso ti dirà, prima dell'invio, che la foto esce
dall'Unione Europea, che sul piano gratuito Google può usarla per migliorare i
suoi servizi, e che con la foto partono anche i nomi dei colleghi scritti sul
foglio.

## Servizi coinvolti

| Chi | Perché | Cosa vede | Base giuridica |
|---|---|---|---|
| **Cloudflare** (Pages) | ospita il sito e lo protegge dagli abusi | l'indirizzo IP e i dati tecnici della richiesta, come per qualunque sito | legittimo interesse a far funzionare il sito in sicurezza (art. 6.1.f GDPR) |
| **Cloudflare Web Analytics** | conteggio delle visite | pagina visitata e dati aggregati, **senza cookie e senza profilazione** | legittimo interesse a sapere se il sito viene usato (art. 6.1.f GDPR) |

Cloudflare tratta questi dati per conto del titolare, secondo le sue condizioni:
https://www.cloudflare.com/privacypolicy/

## Cookie e memoria del browser

Turni **non usa cookie**, né di profilazione né pubblicitari. Usa soltanto la
memoria locale del browser (dove stanno i tuoi dati) e la cache dell'app (che
la fa funzionare anche senza rete). Sono strumenti tecnici strettamente
necessari, per i quali la legge non chiede consenso (art. 122 del Codice
privacy): per questo non c'è nessun banner.

## Statistiche d'uso

**Non ne viene raccolta nessuna.** Non c'è un contatore di quante volte usi una
funzione, né un identificativo della tua installazione. Il codice che lo faceva
nelle versioni di prova è stato tolto il 12 ottobre 2026, e lo si può
verificare:

```bash
node scripts/check-dati-in-uscita.mjs
```

## Dati che non vengono raccolti

Nessun dato di contatto (email, telefono, rubrica), nessuna posizione, nessun
identificatore pubblicitario, nessuna cronologia. Non ci sono inserzioni e non
c'è profilazione.

## Permessi

Il sito non chiede permessi. L'accesso alle immagini passa dal selettore di
file o dalla condivisione del sistema, quindi riguarda solo il file che scegli
tu, una volta per volta: l'app non può sfogliare la tua galleria.

## Per quanto tempo

I dati sul tuo dispositivo restano finché non li cancelli tu. I dati tecnici
delle richieste al sito li conserva Cloudflare per il tempo necessario alla
sicurezza del servizio, secondo le sue condizioni.

## I tuoi diritti

Poiché i dati restano sul tuo dispositivo, li controlli direttamente: puoi
vederli, modificarli, esportarli in un file e cancellarli. In Impostazioni,
**Elimina tutti i dati** li toglie tutti dal dispositivo in una volta.

Per i dati tecnici trattati tramite Cloudflare puoi esercitare i diritti
previsti dagli articoli 15–22 del GDPR (accesso, rettifica, cancellazione,
limitazione, opposizione) scrivendo al contatto qui sopra.

Se ritieni che i tuoi dati siano trattati in modo non conforme, puoi proporre
reclamo al Garante per la protezione dei dati personali:
https://www.garanteprivacy.it

## Minori

L'app non è rivolta a minori di 14 anni e non raccoglie consapevolmente dati che
li riguardano.

## Stime economiche

Il calcolo del netto e delle voci in busta paga è una **stima indicativa**. Non
sostituisce la busta paga, il conguaglio fiscale, né un professionista. Le
condizioni complete sono nei [Termini d'uso](/termini/).

## Modifiche

Le modifiche vengono pubblicate a questo stesso indirizzo, con la data di
aggiornamento in cima.
