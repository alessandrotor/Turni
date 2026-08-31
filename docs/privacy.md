# Informativa sulla privacy — Turni

**Ultimo aggiornamento:** 21 agosto 2026

Turni serve a tenere traccia dei propri turni di lavoro e a stimare quanto si
guadagna. Questa informativa dice quali dati escono dal tuo dispositivo, dove
vanno e perché. È scritta per essere letta, non per essere firmata.

Vale sia per il sito (turni-9vr.pages.dev) sia per l'app Android.

## In breve

**I tuoi turni non stanno su nessun server.** Non c'è un account da creare, non
c'è una sincronizzazione, e chi sviluppa l'app non può vedere i tuoi dati
nemmeno volendo.

Escono dal dispositivo **solo** due cose, e solo se usi l'import da foto:
la foto che scegli e il nome da cercarci dentro. Tutto il resto — turni,
orari, paga, contratto, calcoli — resta dove l'hai scritto.

## Dati che restano sul tuo dispositivo

Turni, orari, paga oraria, dati del contratto e tutto ciò che serve alla stima
del netto sono salvati **solo nella memoria locale del browser o dell'app**.

Questo ha un rovescio che è giusto conoscere: se cancelli i dati del sito,
disinstalli l'app, o svuoti la memoria del browser, **i tuoi turni spariscono e
non sono recuperabili da nessuna parte**. Non esiste una copia altrove. Per
questo c'è la funzione di backup in Impostazioni: il file che produce resta a
te, non viene inviato da nessuna parte.

## Import dei turni da foto

È l'unica funzione che manda qualcosa fuori, ed è facoltativa. Se non la usi,
nessuna immagine lascia mai il dispositivo.

Quando la usi, partono:

- **la foto che scegli tu**, volta per volta, dal selettore del sistema;
- **il nome** che hai indicato, perché serve a trovare la tua riga nel foglio e
  a non far leggere i turni di tutti gli altri;
- **un identificativo di sessione**, generato quando apri la pagina e **mai
  salvato**: cambia a ogni ricaricamento e serve solo a fermare chi tenta di
  inviare centinaia di richieste di fila. Non collega fra loro i tuoi import.

Il percorso è: dispositivo → un server intermedio gestito da chi sviluppa l'app
(Cloudflare Workers) → **Google Gemini**, che legge l'immagine e restituisce
date e orari. Il server intermedio non conserva né la foto né il nome.

### Le cose scomode, dette

- **La foto esce dall'Unione Europea.** Google tratta i dati anche su server
  fuori dallo Spazio economico europeo.
- **Finché il progetto Gemini resta sul piano gratuito, Google può usare i
  contenuti inviati per migliorare i propri servizi, e revisori umani possono
  vederli.** Sono le condizioni del piano gratuito:
  https://ai.google.dev/gemini-api/terms
- **Se il foglio contiene i nomi dei tuoi colleghi, partono anche quelli** — e
  loro non hanno scelto nulla. Puoi ritagliare la foto sulla tua riga prima di
  caricarla: l'app lo dice anche a schermo, prima del primo invio.

Per questo la prima volta compare un avviso: perché la decisione la prenda tu,
sapendo queste tre cose e non dopo.

## Altri servizi coinvolti

| Chi | Perché | Cosa vede |
|---|---|---|
| **Cloudflare** (Pages) | ospita il sito | l'indirizzo IP, come qualunque sito |
| **Cloudflare Turnstile** | verifica che dall'altra parte ci sia un browser vero, prima di spendere quota | segnali tecnici del browser, **nessun cookie di tracciamento** |
| **Cloudflare Web Analytics** | conteggio delle visite | pagina visitata e dati aggregati, **senza cookie e senza profilazione** |
| **Google Gemini** | legge la foto dei turni | vedi sopra |

## Statistiche d'uso

**Sul sito non ne viene raccolta nessuna.** Non c'è un contatore di quante volte
importi, né di quanto costa la funzione. Il codice per farlo esiste nel
repository ma nella versione pubblicata non è attivo, e si può verificare:

```bash
node scripts/check-dati-in-uscita.mjs
```

Nelle versioni di prova dell'app Android può essere attiva una statistica
tecnica — numero di token consumati, versione dell'app, un identificativo
casuale dell'installazione — con un interruttore per spegnerla in Impostazioni.
Quell'interruttore compare **solo dove la statistica esiste davvero**.

## Dati che non vengono raccolti

Nessun dato di contatto (email, telefono, rubrica), nessuna posizione, nessun
identificatore pubblicitario, nessuna cronologia. Non ci sono inserzioni e non
c'è profilazione.

Il **nome** che indichi per l'import è l'unica eccezione, e viaggia solo con la
foto, solo quando usi quella funzione: è spiegato sopra.

## Permessi

L'app Android chiede il solo permesso **Internet**, necessario all'import da
foto. L'accesso alle immagini passa dal selettore di sistema, quindi riguarda
solo il file che scegli tu, una volta per volta: l'app non può sfogliare la tua
galleria.

## I tuoi diritti

Poiché i dati restano sul tuo dispositivo, li controlli direttamente: puoi
vederli, modificarli, esportarli in un file e cancellarli dalle Impostazioni,
senza chiedere niente a nessuno.

Per le foto già inviate a Google valgono le condizioni di Google, e sono
irrecuperabili dalla nostra parte perché non le conserviamo.

## Minori

L'app non è rivolta a minori di 13 anni e non raccoglie consapevolmente dati che
li riguardano.

## Stime economiche

Il calcolo del netto e delle voci in busta paga è una **stima indicativa**. Non
sostituisce la busta paga, il conguaglio fiscale, né un professionista.

## Contatti

Per domande su questa informativa o sui tuoi dati: **g.asriel@gmail.com**

## Modifiche

Le modifiche vengono pubblicate a questo stesso indirizzo, con la data di
aggiornamento in cima.
