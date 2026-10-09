# Piano: un motore che si porta in un'altra app

**Obiettivo.** Prendere il motore di calcolo così com'è e metterlo in un'altra
app, senza portarsi dietro il CCNL Turismo, il programma paghe Zucchetti, il
2026 o i dati di una persona. Oggi il motore è già fatto di funzioni pure in
gran parte, ma le regole di un contratto, di un programma paghe e di un anno
stanno mescolate nel codice, e un solo oggetto `settings` porta tutto.

**Criterio di riuscita.** Una cartella del motore che non importa niente fuori
da sé, riceve tutto quello che le serve come dati, e dà gli stessi numeri di
oggi al centesimo: i riscontri restano verdi a ogni passo, e un riscontro
nuovo confronta l'uscita prima e dopo su un insieme di casi fissi.

**Non è un lavoro per `Beta`**: si fa su `experimental`, un passo per volta.

---

## 1. Dove sta oggi l'accoppiamento

### Un solo oggetto per quattro cose diverse

Il motore legge una cinquantina di chiavi da `settings`, che però contiene:

| Cosa | Esempi | Di chi è |
|---|---|---|
| Contratto | `ccnl`, ore full-time, maggiorazioni, fascia notturna, malattia | del CCNL |
| Lavoratore | paga oraria, ore settimanali, assunzione, montante, addizionali, fondo pensione, patrono | della persona |
| Dati del calendario | bonus spuntati mese per mese, tratt. integrativo copiato dalle buste | della persona, nel tempo |
| Preferenze dell'app | euro per turno, nome sul foglio, modo della proiezione | dell'interfaccia |

Un'altra app avrebbe le prime due cose, forse la terza, mai la quarta.

### Regole di un contratto scritte nel codice

`src/data/ccnl.json` e `ccnl.js` sono già la strada giusta: i contratti sono
dati. Ma alcune regole del Turismo stanno ancora nel codice:

- l'Ente Bilaterale con la quota ditta come fringe benefit (`calcContributi`);
- la settimana di sei giorni per le ferie e le festività escluse dal loro
  computo (`periodo-assenza.js`, art. 134);
- il non cumulo delle maggiorazioni come default (`getShiftSurchargeParts`);
- la fascia notturna di settore (`notturno.js`, già in parte dal JSON).

### Regole del programma paghe, che non sono legge

Verificate sulle buste Zucchetti, e giustamente nel motore, ma un altro datore
potrebbe fare diversamente:

- il trattamento integrativo deciso sul lordo del mese × 12 (`tiSpettaQuestoMese`);
- l'IVS sul lordo arrotondato all'euro, trattamento e indennità troncati;
- la capienza sul progressivo dell'anno (`capienzaProgressiva`);
- l'eccedenza arrotondata al quarto d'ora.

### Un anno scritto dentro

`TAX_2026` (scaglioni, detrazioni, soglie, indennità L. 207/24) è usato in
cinque moduli; l'aliquota dei premi di risultato (`aliquotaPremio`) e le
festività con l'anno d'inizio (`holidays.js`) hanno l'anno nel codice.

### Un paese

Le festività sono quelle italiane (`isHoliday`); il patrono arriva dal
lavoratore. Va bene per un'app italiana, ma deve essere un dato, non un import.

### L'orologio

Cinque funzioni hanno `new Date()` come valore predefinito (proiezione,
conguaglio, restituzione). Un riscontro è già diventato rosso il primo
ottobre per questo: nel motore l'oggi deve sempre arrivare da fuori.

### Moduli che non sono motore

In `src/utils` stanno anche moduli che toccano il browser o i servizi:
`backup-contenuto.js`, `import-turni.js`, `installazione.js`, `orari.js`.
Restano all'app.

### I riscontri

Sono due cose insieme: la prova delle regole (norma, motore) e la prova sulle
buste di una persona, con le sue cifre e la sua paga oraria (9,21802 €). Nel
repository entrano solo cifre, ma sono di una persona sola.

---

## 2. La forma che dovrebbe avere

Il motore riceve cinque cose, tutte come dati:

1. **Contratto**: tutto quello che oggi è CCNL, compreso quello ancora nel
   codice (Ente Bilaterale, settimana delle ferie, festività escluse, non
   cumulo). Un file per contratto; un contratto che non sa una cosa la dichiara
   assente, e il motore usa la regola di legge.
2. **Lavoratore**: paga, ore, assunzione, montante, previdenza, addizionali,
   patrono.
3. **Periodo**: turni e voci del mese (bonus spuntati, voci fisse, assenze).
4. **Regole del programma paghe**: un profilo, oggi uno solo ("Zucchetti", il
   verificato), con le regole del paragrafo sopra. Un'app che non sa quale
   programma usa il datore prende quello verificato e lo dice.
5. **Fisco dell'anno**: una tabella per anno (scaglioni, detrazioni, soglie,
   L. 207/24, aliquota dei premi, festività nuove), scelta dalla data.

Più **oggi**, sempre esplicito. Nessun import da React, dal browser, da
`src/config` o da `src/services`.

L'app attuale resta com'è: un adattatore traduce `settings` nei cinque oggetti,
così l'interfaccia non si accorge di niente.

---

## 3. I passi, nell'ordine

Ogni passo è un commit, coi riscontri verdi e i numeri identici.

0. **Il riscontro dei numeri fermi.** Prima di toccare niente: un insieme di
   casi (i mesi delle buste di riferimento, più casi limite) con l'uscita di
   oggi salvata, e un riscontro che la confronta al centesimo. È la rete per
   tutti i passi dopo.
1. **Il confine.** Una cartella del motore e un riscontro che fallisce se un
   suo file importa qualcosa da fuori, come già fa `check-verifica-busta.mjs`
   con la rete. Si spostano i moduli puri; quelli col browser restano.
2. **L'orologio.** Tolto ogni `new Date()` predefinito: chi chiama passa
   l'oggi. Il riscontro con l'orologio spostato resta, e diventa più semplice.
3. **Il fisco per anno.** `TAX_2026` diventa la riga 2026 di una tabella;
   aliquota dei premi e festività con anno vanno lì. Il 2027 si aggiunge come
   dato.
4. **Il profilo del programma paghe.** Le regole Zucchetti escono dal codice e
   diventano un profilo; il motore le legge da lì.
5. **Il contratto come dati.** Le regole del Turismo ancora nel codice passano
   nel suo file, con un valore di legge per i contratti che non le dicono.
6. **I cinque oggetti.** Il motore smette di leggere `settings`; l'adattatore
   dell'app glieli prepara.
7. **I riscontri in due.** Quelli delle regole (dati sintetici) vanno col
   motore; quelli delle buste di riferimento restano al progetto, con le cifre
   in file a parte e la paga oraria come profilo di riferimento con un nome.
8. **Il pacchetto.** La cartella diventa un pacchetto con la sua versione, e
   `docs/motore-di-calcolo.md` diventa il suo manuale.

---

## 4. Cosa non deve cambiare

- **Nessun numero.** Se un passo sposta un centesimo, il passo è sbagliato:
  si torna indietro, non si aggiorna il riscontro.
- **Le regole dei contratti restano verificate dove lo erano**: spostare una
  regola in un file non la rende meno vera, ma il suo riscontro la segue.
- **Le dimensioni**: i file nuovi stanno sotto le 600 righe, e quelli che oggi
  sono congelati scendono, non salgono.
- **La documentazione**: ogni passo aggiorna questo file e `CLAUDE.md`.
