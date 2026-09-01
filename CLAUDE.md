# Turni — note per Claude

PWA (React 18 + Vite, Capacitor per Android) che segna i turni e stima lordo e
netto secondo le regole della busta paga italiana. Codice, commenti e interfaccia
sono in italiano: scrivere nella stessa lingua.

Branch di lavoro: `experimental`. La produzione è un deploy manuale e può essere
molto indietro rispetto al repository — prima di dire «è online» va guardato il
sito, non il codice.

## La parola d'ordine: frictionless

**Ogni cosa che l'app chiede all'utente deve guadagnarsi il diritto di
interromperlo.** Nel dubbio non si chiede: si segnala dove non dà fastidio, e si
lascia che sia lui a tornarci quando gli serve.

Chi usa Turni sta facendo altro — è in pausa, sta timbrando, ha il telefono in
una mano. Non è venuto a configurare un software: è venuto a segnare un turno.
Una domanda in mezzo a quel gesto non viene letta, viene chiusa; e chi impara a
chiudere gli avvisi chiude anche quelli che contavano.

In pratica, e sono regole, non aspirazioni:

- **All'apertura non si chiede niente.** Chi non ha ancora capito cosa fa l'app
  risponde a caso.
- **Si chiede DOPO l'azione, mai durante.** Il modulo del turno serve a segnare
  il turno: mentre lo si compila non compare altro. La domanda nasce dal turno
  già salvato — vedi `AvvisoMaggiorazione.jsx`.
- **Un avviso alla volta.** Due impilati sono un muro. Quando la striscia in
  fondo parla, il promemoria in alto tace (`SetupPrompt` accetta `sospeso`).
- **Le risposte comuni costano un tocco.** «No» e «non adesso» non devono
  richiedere di leggere, capire o digitare niente.
- **Un «no» dura.** Una domanda già rifiutata che ritorna è peggio della domanda
  (`maggiorazioniNonDovute`). Un «non adesso» dura almeno la sessione.
- **Si blocca solo per ciò che non si recupera dopo.** Oggi sono due dati:
  paga oraria e ore settimanali (`datiMinimiMancanti`). Tutto il resto è
  retroattivo, quindi può aspettare.
- **L'app non si aggiorna addosso a chi la sta usando, ma si aggiorna.** La
  versione nuova si scarica quando si torna sull'app e entra in servizio quando
  la si mette via — in secondo piano da un minuto e senza niente in sospeso —
  oppure quando lo dice l'utente col pulsante. Non è un compromesso fra i due
  fastidi: è che esiste un momento in cui ricaricare non dà fastidio a nessuno.
  Regola pura in `utils/aggiornamento.js`, «lavoro in sospeso» dichiarato dai
  componenti in `utils/occupato.js`, riscontro `check-aggiornamento.mjs`.
  Attenzione al difetto silenzioso: una chiave di `occupato` che resta accesa
  blocca gli aggiornamenti per sempre senza che nessuno se ne accorga.
  Perché tutto questo funzioni, il browser deve prima ACCORGERSI che `sw.js` è
  cambiato: `public/_headers` gli dà `Cache-Control: no-cache` apposta, perché
  su questo punto Chrome e altri browser si sono storicamente comportati in
  modo diverso (osservato su Firefox il 1° settembre 2026: l'avviso non
  compariva mai, nemmeno ricaricando a mano). Riscontro nello stesso
  `check-aggiornamento.mjs`. Non è retroattivo: un profilo che ha già la copia
  vecchia in cache va sbloccato una volta con un ricaricamento forzato.
- **Niente contrassegni «l'ho già visto».** Le domande nascono dallo stato dei
  dati, non da tracce lasciate addosso a chi usa l'app.
- **Meglio chiedere di troppo che sbagliare in silenzio, ma solo dicendo la
  verità sul perché.** Quando l'app non sa (la fascia notturna senza contratto)
  guarda largo e scrive «potrebbe»: chiedere di più costa un tocco, non chiedere
  costa soldi ogni mese.

Il riscontro di queste regole è `scripts/check-primo-avvio.mjs`: non verifica che
le funzioni rispondano, verifica che una configurazione completa non chieda
niente e che un «no» non torni.

## Comandi

```sh
npm run dev
npm run build
for f in scripts/check-*.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done
```

`check-dati-in-uscita.mjs` ispeziona `dist/`: vuole una build fatta con
`VITE_AI_PROXY_URL=https://turni-ai-proxy-test.magnaopa.workers.dev`, altrimenti
fallisce senza che ci sia niente di rotto. È l'unico falso allarme noto.

## La regola che conta più di tutte

**Nessun numero di dominio entra nel motore senza un riscontro.** Ogni fatto
retributivo che l'app dà per buono ha il suo `scripts/check-*.mjs`, con in testa
la busta da cui viene e il ragionamento che lo ricava. I riscontri non sono test
di regressione: sono la documentazione di cosa si sa e come lo si sa.

Se un valore NON è verificabile su un cedolino, l'interfaccia deve dirlo
(esempio: i parametri della malattia in Impostazioni, marcati come non
verificati).

## Fatti verificati sulle buste

Busta di riferimento: LUL Zucchetti, CCNL Turismo, **livello 5, part-time 60%**,
giugno e luglio 2026. Nel repository entrano solo cifre — mai nome, codice
fiscale, indirizzo, IBAN o datore.

### Da dove viene la paga oraria — confermato sul cedolino

```
minimo tabellare   1.057,72
contingenza          522,37
terzo elemento         5,41   ← voce a sé, stampata in busta
                   ─────────
mensile full-time  1.585,50   ÷ 172 = 9,21802 €/h   × 60% = 951,30 €
```

- Il divisore **172** è lo stesso `monthlyHoursFactor: 4.3` di
  `src/data/ccnl.json` scritto in un altro modo (40 h × 4,3). Le ore mensili del
  contratto, 103,20, sono 172 × 60%.
- Il **terzo elemento** è un importo fisso mensile della contrattazione
  territoriale: entra nella retribuzione e quindi nella paga oraria, ma **non**
  nella base dell'Ente Bilaterale (948,05 = (tabellare + contingenza) × 60%). Da
  lì i 3,25 € di scarto con la retribuzione, che per mesi sono rimasti annotati
  come inspiegati. Sul datore 2024-2025 nemmeno la maggiorazione domenicale lo
  comprendeva (rapporto 0,99547).
- Riscontro: `scripts/check-tabellare-turismo.mjs`.

### Gli altri, con il loro riscontro

- **Mese di paga**: nei contratti mensilizzati la busta taglia a settimane
  intere, e la settimana a cavallo appartiene al mese del **lunedì**. La soglia
  del supplementare è **mensile** (103,20 h), non settimanale.
  → `check-mese-paga-2026.mjs`
- **Ore oltre soglia**: la busta scrive l'ora INTERA al 130%, non il solo +30%.
  → `check-busta-luglio-2026.mjs`
- **Maggiorazioni Turismo** (17 cedolini 2024-2025): notturno 25%, domenicale
  10%, supplementare 30%, festivo 20%. Attenzione a come il cedolino le SCRIVE:
  domenicale e notturno riportano la sola maggiorazione, il festivo il totale
  (120% = +20%). → `check-busta-maggiorazioni-reali.mjs`
- **Fascia notturna**: le buste non riportano le timbrature, quindi non è
  ricavabile da lì. L'art. 13 CCNL prevede orari diversi per settore (24:00-06:00
  ordinario, 23:00-06:00 pubblici esercizi, 23:30-06:30 alberghiero); l'app usa
  quella del CCNL e lascia sovrascrivere. → `check-notturno.mjs`
- **Ferie e permessi** stanno DENTRO la voce «Retribuzione»; la **malattia** è
  una voce a sé; la **festività non lavorata** è un giustificativo a sé.
  → `check-assenze.mjs`, `check-festivita.mjs`
- **Malattia**: la carenza si conta per EVENTO, non per anno. Percentuali e
  giorni NON sono verificati su nessun cedolino, e **le buste che la contengono
  non fanno testo**: `luglio-24` e `novembre-24` mostrano una scomposizione
  completa e invitante («Carenza Malattia», «Malattia Inps 80», «Int. Car.
  Malattia»), ma sono di un altro datore che sceglieva di **integrare** la
  malattia. È una scelta aziendale, non la norma del CCNL — tararci sopra i
  default significherebbe promettere a tutti quello che faceva un'azienda sola.
  Marzo 2026 ha una malattia sul datore attuale, ma come semplice storno
  («Assenza per malattia», −72,06): dice quanto viene tolto, non quanto l'INPS
  o il contratto restituiscono.

## Convenzioni dell'interfaccia

Discendono tutte dalla parola d'ordine qui sopra.

- Le giornate pagate ma non lavorate **non si chiamano «assenza»** a schermo:
  ferie, permesso, malattia, festività, ognuna col suo nome. Se da orario non era
  previsto andare a lavoro, non è un buco da giustificare. Gli identificatori nel
  codice (`isAssenza`, `assenzaMinutes`, `utils/assenze.js`) restano come sono.
- Quando i conteggi non coprono il mese visualizzato (mese di paga), il periodo
  si **dichiara sopra i numeri**. Non si allunga il calendario per farceli stare:
  provato, era brutto e si perdeva di vista che mese si stava guardando.
- I calcoli fiscali sono marcati BETA e invitano a farsi controllare da un
  professionista. Non togliere quell'avviso.
