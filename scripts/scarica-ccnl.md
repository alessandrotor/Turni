# Scaricare l'elenco dei CCNL (`scarica-ccnl.mjs`)

Un piccolo programma che scarica da internet **l'elenco di tutti i Contratti
Collettivi Nazionali di Lavoro (CCNL) attualmente in vigore** e lo salva in due
file:

- `ccnl.json` — l'elenco in formato dati (usato dall'app);
- `ccnl.csv` — lo stesso elenco apribile con Excel / Fogli Google.

Per ogni contratto salva le **info principali**: codice, denominazione, settore,
parti firmatarie (associazioni datoriali e sindacati), date di vigenza. **Non**
scarica il testo dei contratti: crea la *lista* da cui, in un secondo momento, si
può ricavare il testo di ognuno.

I dati vengono dall'**archivio ufficiale del CNEL** (sezione *Contratti Open
Data*), rilasciati con licenza aperta e aggiornati ogni settimana.

## Cosa serve

Solo **Node.js** installato (versione 18 o più recente). Si scarica gratis da
<https://nodejs.org>. Non serve nient'altro.

> **Cos'è un file `.mjs`?** È semplicemente un file JavaScript "a moduli": un
> programmino che si esegue con Node. Il `.mjs` (invece di `.js`) serve solo a
> dire a Node "questo è un modulo": così **funziona da qualsiasi cartella**, anche
> fuori da questo progetto, senza dover configurare niente.

## Come si usa

### Fuori da questo progetto (uso generale)

Copia il file `scarica-ccnl.mjs` in una cartella qualsiasi, apri il terminale in
quella cartella e lancia:

```
node scarica-ccnl.mjs
```

Crea `ccnl.json` e `ccnl.csv` nella cartella corrente. Puoi anche indicare un
nome/percorso di output:

```
node scarica-ccnl.mjs elenco-contratti.json
```

Per l'aiuto:

```
node scarica-ccnl.mjs --help
```

### Dentro il progetto Turni

Dalla cartella del progetto, un solo comando aggiorna il file usato dall'app:

```
npm run ccnl:aggiorna
```

Scarica l'elenco aggiornato e lo scrive in `src/data/ccnl.json`.

## Rilanciarlo non cancella le tue modifiche

Se il file di output esiste già, i **campi curati a mano** non vengono persi:
`verificato`, `monthlyHoursFactor`, `contributiExtra`, `enteBilaterale`. Puoi
quindi rilanciarlo quando vuoi per aggiornare l'elenco, senza buttare via i
parametri che hai verificato tu.
