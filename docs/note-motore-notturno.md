# Note su motore/notturno.js

## La fascia

22:00–06:00 è la definizione del D.Lgs 66/2003 e la usano vigilanza e servizi
fiduciari, commercio/terziario e metalmeccanici industria.

Il Turismo fa storia a sé: l'art. 13 del CCNL distingue più casi e nessuno
comincia alle 22. Il testo consultato ad agosto 2026 riporta 24:00–06:00 per il
lavoro notturno ordinario, 23:00–06:00 per i lavoratori notturni di pubblici
esercizi e ristorazione, 23:30–06:30 per alberghiero e agenzie di viaggio.

Quei numeri non vanno presi come oro colato. Sotto l'etichetta «turismo /
pubblici esercizi» esistono contratti firmati da associazioni diverse
(Confcommercio, Conflavoro, ANPIT…) con clausole che non coincidono, e i rinnovi
hanno spostato anche la percentuale fra il 20% e il 25%. L'utente di riferimento
ricorda dalle proprie buste una fascia 23:30–06:00 in ristorazione, che non
corrisponde a nessuna delle tre: una versione diversa del contratto o un accordo
aziendale. In ogni caso la busta batte la ricerca.

Da qui tre conseguenze di disegno:

- la fascia è configurabile agli estremi, e `fasciaNotturna` non assume nulla
  sulla durata (23:30–06:30 dura sette ore, non otto);
- il suggerimento in Impostazioni non spaccia una tabella per verità: dice che
  le fasce variano e che il numero giusto sta sul cedolino;
- la fascia di partenza sta nel preset del contratto (`fasciaNotturna` in
  `src/data/ccnl.json`), accanto agli altri dati che dipendono dal CCNL.

Le 22:00–06:00 restano il ripiego per i contratti che non dichiarano nulla,
perché sono la definizione di legge. Per il Turismo erano semplicemente
sbagliate, e un default sbagliato è peggio di un campo vuoto: conta come
notturne ore che in busta non lo sono e gonfia la stima, cioè nella direzione
che fa male, perché ci si fa un conto che poi non arriva.

## La percentuale

Va dal 10% al 65% secondo classificazione (turnista o no, notturno abituale o
occasionale) e contratto. Non è un dato del contratto utilizzabile in
automatico, è un'impostazione dell'utente: la stessa scelta presa per festivo e
domenicale, scritta nella nota del CCNL vigilanza in ccnl.json.
