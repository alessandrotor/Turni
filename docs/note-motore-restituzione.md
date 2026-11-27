# Note su motore/restituzione.js

## Cosa l'app non può sapere

Vanno dette accanto alla cifra, non in un disclaimer generico.

1. **Quanto è stato accreditato davvero.** Lo scrive il cedolino, l'app no: si
   assume la quota piena di legge sui giorni trascorsi, cioè il caso peggiore.
   È una stima al rialzo dichiarata, non un conto.
2. **Gli altri datori.** L'app vede un solo datore. Chi ne ha avuti due ha un
   reddito più alto di quello che l'app conosce, quindi il rischio vero è
   maggiore di quello calcolato, ed è il caso più esposto: ognuno proietta il
   reddito per conto suo credendosi l'unico.
3. **Le detrazioni che non sono quelle da lavoro.** Nella fascia 15.000–28.000
   la legge dà il TI solo se la somma delle detrazioni supera l'imposta lorda.
   L'app conosce la sola detrazione da lavoro, non i figli a carico né le spese
   mediche: con quella sola la capienza non c'è mai, quindi il modello dice «non
   spetta» a chiunque superi i 15.000. È la norma letta con i dati che ci sono,
   ma è una stima al rialzo del rischio.

## Il TI zero per due motivi opposti

Reddito troppo alto: sopra i 15.000 il TI si perde. Il rischio è reale perché
il datore lo accreditava quando il reddito sembrava più basso, e a dicembre se
lo riprende. Reddito troppo basso: sotto la no tax area non c'è imposta da
compensare, il TI non spetta per incapienza e non è mai stato accreditato (il
software paghe del datore fa lo stesso conto). Niente preso, niente da
restituire. Il primo giro di questo modulo li confondeva e lo diceva a chi
guadagna 2.150 € l'anno.

## Restituzione contro perdita

«Oltre i 15.000 il TI si perde e quello preso torna indietro» è vero alla
lettera, ma come risposta a «ci perdo?» è fuorviante: descrive un movimento di
cassa e lo lascia scambiare per una perdita. Sopra i 15.000 il TI sparisce
(−1.200), ma la detrazione da lavoro salta da 1.955 a 3.100 (+1.145): è uno
scalino dell'art. 13 TUIR che compensa il 95%. Quello che resta scoperto è
l'indennità L. 207/2024, che attraversando la fascia scende di ~70 €.

Il conto, sul motore (→ `src/motore/riscontri/check-costo-soglia.mjs`):

| lordo  | imponibile | detr. lav. | TI    | cuneo | netto  |                   |
|--------|------------|------------|-------|-------|--------|-------------------|
| 16.596 | 15.000     | 1.955      | 1.200 | 790   | 15.454 | ultimo sotto      |
| 16.597 | 15.001     | 3.100      | 0     | 720   | 15.325 | il fondo          |
| 16.795 | 15.180     | 3.085      | 0     | 727   | 15.454 | di nuovo in pari  |

Centoventinove euro l'anno nel punto peggiore e una buca larga duecento euro di
lordo, non milleduecento. L'avviso di prima gridava «restituisci 805 €» anche a
chi la soglia l'aveva superata da un pezzo. I 129 € dipendono dalle sole
aliquote statali, non dai contributi: sono identici su CCNL e orari diversi, e
il riscontro lo verifica su tre profili.

## Il tetto si cerca sull'imponibile

La conversione della soglia in lordo e il reddito complessivo arrotondano in
punti diversi. Durante l'analisi la conversione dava 16.622, già sopra soglia
(imponibile 15.023): il calcolo della perdita partiva dall'altro lato dello
scalino e restituiva zero, senza errori a schermo, solo con un avviso che
taceva.
