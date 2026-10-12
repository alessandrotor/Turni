# Il motore di calcolo di Turni

Calcola paga lorda e netta secondo la busta paga italiana: turni, maggiorazioni,
contributi, IRPEF, detrazioni, trattamento integrativo, conguaglio di dicembre.
Questa cartella non importa niente da fuori (né React, né il browser, né il
resto dell'app) e si può copiare così com'è in un altro progetto.

## Come si usa

```js
import { calcolaMese } from './motore/index.js';

const { lordo, netto } = calcolaMese({
  contratto: 'turismo',
  lavoratore: {
    pagaOraria: 9.21802, oreSettimanali: 24, assunzione: '2025-12-29',
    tredicesima: true, quattordicesima: true,
    maggiorazioni: { supplementare: 30, domenicale: 10, festivo: 20 },
  },
  periodo: { anno: 2026, mese: 8, turni },   // mese da 0 a 11
  oggi: new Date(),
});
```

`turni` è un elenco di `{ id, date: 'YYYY-MM-DD', startTime: 'HH:MM', endTime:
'HH:MM', breakMinutes }`; ferie, permessi, malattia e festività hanno `type` e
`durationMinutes` al posto degli orari. Servono i turni di tutto l'anno: le
settimane a cavallo dei mesi e il progressivo dell'anno li usano.

La tabella che traduce questi ingressi nei campi interni è `impostazioniDa()`
in `index.js`. Le funzioni una per una (paga per turno, proiezione dell'anno,
conguaglio) sono esportate dallo stesso file.

## Cosa sta dove

| Cartella o file | Cosa contiene | Chi la cambia |
|---|---|---|
| `contratti/` | un file per contratto: divisore orario, mensilizzazione, Ente Bilaterale, fascia notturna, straordinario notturno | chi aggiunge o corregge un CCNL |
| `fisco/` | un file per anno: scaglioni IRPEF, detrazioni, trattamento integrativo, indennità L. 207/24; l'aliquota dei premi di risultato | a ogni legge di bilancio |
| `programmi-paghe/` | come il programma paghe del datore anticipa l'anno mese per mese (reddito presunto) | chi trova un datore che fa diversamente |
| `holidays.js` | le festività nazionali, una riga ciascuna | quando una legge ne aggiunge una |
| `pay.js` | dalla timbratura agli euro lordi: monte ore, supplementare, straordinario, maggiorazioni | |
| `net.js` | dal lordo al netto: contributi, IRPEF, detrazioni, trattamento integrativo | |
| `capienza.js`, `conguaglio.js`, `restituzione.js` | il trattamento integrativo mese per mese e a dicembre | |
| `riscontri/` | i riscontri delle regole, con dati sintetici | |

## Aggiungere o togliere, a mano

**Un contratto.** Copia `contratti/turismo.js` in `contratti/<codice>.js`,
cambia `codice`, `nome` e le regole, e aggiungi una riga in
`contratti/index.js` (l'`import` e il nome nell'elenco). Un campo che non
scrivi vale la regola di legge (`LEGGE` nello stesso file). Per toglierlo:
cancella la riga e il file.

**Un anno fiscale.** Copia `fisco/2026.js` in un file nuovo (2027.js), cambia `anno` e
i valori che la legge di bilancio cambia, aggiungi la riga in `fisco/index.js`.
Attenzione: oggi il motore usa la tabella 2026 per ogni anno; `fiscoDellAnno()`
sceglie quella giusta, ma collegarla a ogni calcolo è un passo ancora da fare.

**Un programma paghe.** Copia `programmi-paghe/zucchetti.js`, cambia le regole
tenendo le stesse funzioni (oggi `lordoPresuntoAnno`), aggiungi la riga in
`programmi-paghe/index.js`. Si sceglie con `programmaPaghe`; senza, vale
Zucchetti, l'unico verificato sulle buste.

**Una festività.** Una riga in `holidays.js`: in `FIXED` se vale da sempre, in
`DAL_ANNO` col primo anno se è nuova.

## Tre regole che il motore rispetta

1. **Non importa niente da fuori da questa cartella.** Niente pacchetti npm,
   niente `window`, `localStorage` o `fetch`.
2. **Non legge l'orologio.** La data di oggi la passa chi chiama; senza, le
   funzioni che ne hanno bisogno si fermano con un errore che lo dice.
3. **Nessun numero cambia senza un riscontro.** Ogni regola ha il suo
   `riscontri/check-*.mjs`; `check-numeri-fermi.mjs` blocca al centesimo
   l'uscita su cinque profili, e uno spostamento non deve muoverla.

Le prime due le controlla `riscontri/check-confine-motore.mjs`.

## I riscontri

```sh
node src/motore/riscontri/check-numeri-fermi.mjs     # i numeri non si sono mossi
node src/motore/riscontri/check-confine-motore.mjs   # il motore non esce dalla cartella
```

Quelli sulle buste paga di una persona non stanno qui: restano all'app che li
ha (in Turni, `scripts/check-busta-*.mjs` e simili), perché contengono le sue
cifre.

## Cosa non è ancora agnostico

- **Le impostazioni interne.** Le funzioni leggono un solo oggetto
  `impostazioni` con i nomi di Turni (`hourlyRate`, `expectedWeeklyHours`…).
  `calcolaMese` li nasconde, ma le funzioni una per una li vogliono ancora.
- **Il fisco per anno**, come sopra: c'è la tabella, non ancora il
  collegamento.
- **Alcune regole Zucchetti sono ancora nel codice**: la decisione «lordo × 12»
  quando manca il progressivo, i troncamenti al centesimo di trattamento
  integrativo e indennità.
