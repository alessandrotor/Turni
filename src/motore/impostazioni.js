// LE IMPOSTAZIONI DEL MOTORE: ogni chiave che il motore legge, una riga.
//
// Le funzioni del motore ricevono un oggetto `impostazioni` piatto. Questo è
// il suo contratto: cosa c'è, a quale dei cinque gruppi appartiene, cosa vuol
// dire. Chi usa il motore da un'altra app ha due strade: `calcolaMese()` coi
// cinque ingressi (index.js li traduce qui con `impostazioniDa()`), oppure le
// funzioni una per una con un oggetto scritto secondo questa tabella.
//
// I NOMI sono quelli che Turni salva nel telefono di chi lo usa, e per questo
// non si cambiano: rinominarli voleva dire migrare i dati di tutti, per un
// motore che non diventa più portabile per questo. Quello che conta è che
// siano tutti qui, documentati, e che non ne compaia uno nuovo di nascosto:
// lo controlla `check-impostazioni-motore.mjs`, che confronta questa tabella
// con le chiavi che il codice legge davvero.
//
// I gruppi sono quelli del piano (docs/motore-portabile.md): il contratto, il
// lavoratore, il periodo (quello che cambia mese per mese), il programma paghe
// e il fisco dell'anno, più le scelte su come presentare il calcolo.

export const GRUPPI = ['contratto', 'lavoratore', 'periodo', 'programmaPaghe', 'fisco', 'scelte'];

export const IMPOSTAZIONI = {
  // ── il contratto ────────────────────────────────────────────────────────
  ccnl: ['contratto', 'codice di un file in contratti/; vuoto = la regola di legge'],
  periodoConteggio: ['contratto', "'calendario' (verificato) o 'paga' (settimane intere): il mese su cui si conta il monte ore"],

  // ── il lavoratore ───────────────────────────────────────────────────────
  hourlyRate: ['lavoratore', '€ lordi all\'ora, la paga di oggi'],
  previousRates: ['lavoratore', 'paghe precedenti a un aumento: [{ until: \'YYYY-MM-DD\', rate }]'],
  expectedWeeklyHours: ['lavoratore', 'ore settimanali del contratto'],
  fullTimeWeeklyHours: ['lavoratore', 'ore del tempo pieno: oltre, straordinario'],
  workingDaysPerWeek: ['lavoratore', 'giorni lavorativi della settimana: quanto vale una giornata di assenza'],
  onCall: ['lavoratore', 'lavoro a chiamata: nessun monte ore, soglia giornaliera'],
  dailyOvertimeThreshold: ['lavoratore', 'a chiamata: ore al giorno oltre cui c\'è la maggiorazione'],
  hireDate: ['lavoratore', 'data di assunzione, \'YYYY-MM-DD\': ratei di 13ª/14ª, giorni di detrazione'],
  hasTredicesima: ['lavoratore', 'la 13ª spetta'],
  hasQuattordicesima: ['lavoratore', 'la 14ª spetta'],
  overtimeSurchargePct: ['lavoratore', '% in più sul supplementare'],
  straordinarioSurchargePct: ['lavoratore', '% in più sullo straordinario; vuoto = come il supplementare'],
  sundaySurchargePct: ['lavoratore', '% in più la domenica'],
  holidaySurchargePct: ['lavoratore', '% in più nei festivi'],
  holidaySundayMode: ['lavoratore', "festivo di domenica: 'max' (la maggiore assorbe), 'sum', 'holiday'"],
  nightSurchargePct: ['lavoratore', '% in più sulle ore notturne'],
  nightStart: ['lavoratore', 'inizio della fascia notturna \'HH:MM\'; vuoto = quella del contratto'],
  nightEnd: ['lavoratore', 'fine della fascia notturna \'HH:MM\'; vuoto = quella del contratto'],
  nightCumuloMode: ['lavoratore', "notturno con altre maggiorazioni: 'max' (assorbe) o 'somma'"],
  patronSaintDate: ['lavoratore', 'santo patrono del comune, \'MM-DD\': festivo come gli altri'],
  absenceDailyHours: ['lavoratore', 'ore di una giornata di ferie o permesso; vuoto = ore settimanali ÷ giorni'],
  malattiaCarenzaGiorni: ['lavoratore', 'giorni di carenza della malattia, per evento (non verificati)'],
  malattiaCarenzaPct: ['lavoratore', '% pagata nei giorni di carenza (non verificata)'],
  malattiaPct: ['lavoratore', '% pagata dopo la carenza (non verificata)'],
  aziendaDipendenti: ['lavoratore', 'dimensione dell\'azienda: decide le aliquote del FIS'],
  ebtBase: ['lavoratore', 'base dell\'Ente Bilaterale letta in busta, se diversa da paga × monte ore'],
  addRegionalePct: ['lavoratore', '% dell\'addizionale regionale'],
  addComunalePct: ['lavoratore', '% dell\'addizionale comunale'],
  addizionaliAltrove: ['lavoratore', 'le addizionali le trattiene un altro datore'],
  noAddizionali: ['lavoratore', 'primo anno di lavoro: nessuna addizionale da trattenere'],
  fondoPensionePct: ['lavoratore', '% della quota a carico del lavoratore per il fondo pensione'],
  cassaSanitariaEuro: ['lavoratore', '€ al mese per la cassa sanitaria trattenuti in busta'],
  tfrInBusta: ['lavoratore', 'il TFR è pagato ogni mese in busta'],
  tfrTaxRate: ['lavoratore', '% di tassazione del TFR in busta; vuoto = il predefinito'],

  // ── il periodo: quello che cambia nell'anno ─────────────────────────────
  priorTaxableIncome: ['periodo', 'montante: lordo dell\'anno già pagato fino a priorIncomeDate'],
  priorIncomeDate: ['periodo', 'fino a quando arriva il montante, \'YYYY-MM-DD\''],
  monthlyBonusAmount: ['periodo', '€ del premio mensile, quando c\'è'],
  monthlyBonus: ['periodo', 'i mesi col premio: { \'YYYY-MM\': true }'],
  bonusPremioRisultato: ['periodo', 'il premio è di risultato: imposta sostitutiva invece dell\'IRPEF'],
  fixedMonthlyItems: ['periodo', 'voci fisse in busta ogni mese: [{ amount }]'],
  fixedMonthlyDeductions: ['periodo', 'trattenute fisse ogni mese, fuori dal fisco: [{ amount }]'],
  annualGrossManual: ['periodo', 'lordo dell\'anno scritto a mano, per la proiezione'],

  // ── il programma paghe e il fisco ───────────────────────────────────────
  programmaPaghe: ['programmaPaghe', 'codice di un file in programmi-paghe/; vuoto = Zucchetti, il verificato'],
  fisco: ['fisco', 'la tabella dell\'anno (fisco/), messa da chi conosce l\'anno con conFisco()'],

  // ── le scelte su come calcolare ─────────────────────────────────────────
  tiModo: ['scelte', "trattamento integrativo: 'auto' (come il datore), 'sempre', 'mai'"],
  noTrattamentoIntegrativo: ['scelte', 'storico: tiModo \'mai\' scritto alla vecchia maniera'],
  tiProjectionMode: ['scelte', "proiezione dell'anno: 'stimato' o 'ytd' (solo il maturato)"],
};
