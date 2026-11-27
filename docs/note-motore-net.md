# Note su motore/net.js

Il ragionamento dietro alcune scelte di `net.js` che non stava bene dentro il
codice. Le cifre esatte restano nei riscontri citati.

## Base dell'Ente Bilaterale

La base certificata è (minimo tabellare + contingenza) × part-time, cioè la
retribuzione SENZA il terzo elemento. Lo dimostra
`scripts/check-tabellare-turismo.mjs`, che verifica anche l'identità inversa
(retribuzione − base = terzo elemento riproporzionato).

Il motore usa invece `monthlyBaseGross`, che il terzo elemento ce l'ha dentro
perché deriva dalla paga oraria: 951,30 invece di 948,05 (+0,34%). Sulla quota
dello 0,20% fanno 1,90 contro 1,89, meno di un centesimo di trattenuta.

Il valore esatto non è riportabile: il terzo elemento è contrattazione
territoriale di secondo livello, cambia per provincia e per accordo, e in
`ccnl.json` (nazionale) non può stare come costante. Averlo esatto vorrebbe
dire chiederlo in Impostazioni: un campo in più per un centesimo al mese, che
la regola di CLAUDE.md sul frictionless vieta. `ebtBase` resta come appiglio
per i riscontri, che il numero preciso lo leggono dal cedolino.

Se un giorno le tabelle territoriali entrassero nel progetto, il punto da
cambiare è la riga della base in `calcContributi`.

## Capienza del trattamento integrativo

La capienza non si misura sulla detrazione piena: la norma la confronta con la
detrazione da lavoro diminuita di 75 € (qui su base annua, quindi 75 pieni).
Senza lo sconto il trattamento verrebbe negato a chi per legge ci rientra, in
una fascia stretta ma reale (imposta lorda fra detrazione − 75 e detrazione,
attorno agli 8.200–8.500 € di imponibile).

Non riscontrato su busta: nelle buste disponibili la capienza c'è comunque, con
o senza lo sconto. Viene dalla norma; se un cedolino dicesse il contrario,
vince il cedolino.

Nella fascia 15.000–28.000 la somma delle detrazioni che fa da metro è
elencata dalla norma, e l'elenco è chiuso (artt. 12 e 13 c. 1 TUIR, art. 15
c. 1 lett. a e b e c. 1-ter per mutui contratti entro il 2021, rate di art. 15
c. 1 lett. c e 16-bis e di altre norme per spese sostenute entro il 2021; testo
in `docs/trattamento-integrativo.md` §10). L'ulteriore detrazione della
L. 207/2024 non è in quell'elenco, quindi non entra nel metro, anche se entra
nell'IRPEF netta. Con i parametri 2026 la differenza non si vede; si tiene
perché è la norma.

## Base del TFR in busta

Le due buste disponibili calcolano la base in modi diversi e nessuno dei due è
il lordo pieno che usa il motore:

- fiduciari, giugno: solo la retribuzione ordinaria, senza maggiorazioni;
- Turismo, luglio: retribuzione + indennità utili al TFR + maggiorazione
  domenicale, senza il lavoro supplementare e senza voci aziendali, e nemmeno
  così torna (la formula dà 67,39 contro i 66,39 stampati).

Due buste che si contraddicono e una che non quadra non bastano a stabilire una
regola: la base resta il lordo finché non arriva un terzo cedolino.

## Previsione in avanti (`projectAnnualIncome`)

La domanda a cui il numero risponde è «accetto questo straordinario, o mi fa
superare la soglia?». Con l'annualizzazione (maturato × 12 / mesi trascorsi) un
euro ad agosto ne spostava uno e mezzo, a gennaio dodici. Il vecchio `Math.max`
con la proiezione da contratto faceva da pavimento: misurato il 21 agosto, i
primi 200 € di straordinari lasciavano il margine fermo a 4.238 €, i successivi
lo abbassavano di 300 € ogni 200. Un numero che non si muove e poi si muove
troppo non è una risposta.

Sommando il futuro invece di annualizzare il passato, ogni euro in più sposta
la previsione di un euro. I supplementari sono già dentro il maturato, e chi
non ha lavorato nulla ottiene comunque dodici mensilità piene.

Il mese in corso vale per i giorni che gli restano, oggi compreso. Contato come
già trascorso, il primo del mese la previsione perdeva una mensilità e la
recuperava durante il mese: il margine andava a dente di sega.

Un anno chiuso non ha futuro; uno non ancora cominciato è tutto futuro. Prima
valeva 12 «trascorsi» anche per quest'ultimo: a dicembre, aprendo gennaio, la
previsione dell'anno dopo erano i soli turni già segnati e la striscia
annunciava sedicimila euro di margine. → `src/motore/riscontri/check-proiezione.mjs`
