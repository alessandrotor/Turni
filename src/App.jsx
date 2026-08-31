import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import useLocalStorage from './hooks/useLocalStorage';
import { getMonthStart, parseDate, payrollMonthKey } from './utils/dates';
import { calcTotalPay, computePayByShift } from './utils/pay';
import { isMensilizzato } from './utils/ccnl';
import { computeAnnualGrossFromShifts, projectAnnualIncome } from './utils/net';
import { ENABLE_NET_CALC, ENABLE_STATS } from './config/features';
import { genId } from './utils/id';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import Settings from './components/Settings';
import ShiftForm from './components/ShiftForm';
import NavBar from './components/NavBar';
import InstallPrompt from './components/InstallPrompt';
import SetupPrompt from './components/SetupPrompt';

const DEFAULT_SETTINGS = {
  hourlyRate: 0,
  expectedWeeklyHours: 40,
  fullTimeWeeklyHours: 40,   // soglia oltre cui le ore diventano straordinarie invece che supplementari
  sundaySurchargePct: 0,
  overtimeSurchargePct: 0,   // maggiorazione supplementari (fra contratto e full-time)
  straordinarioSurchargePct: '', // maggiorazione straordinari (oltre il full-time); vuoto = come i supplementari
  holidaySurchargePct: 0,        // maggiorazione festivi (%)
  holidaySundayMode: 'max',      // festivo+domenica: 'max' | 'sum' | 'holiday'
  // Notturno: si paga sui soli minuti in fascia, non sul turno intero (vedi
  // utils/notturno.js). 0 = spento, ed e' il default: chi non lo imposta ha il
  // motore identico a prima che esistesse.
  nightSurchargePct: 0,
  // Vuoto = la fascia la decide il CCNL (vedi `fasciaNotturnaRisolta`), e solo
  // se il contratto non dice nulla si ripiega sulle 22:00–06:00 di legge.
  // Scriverci '22:00' come faceva prima significava imporre a TUTTI la
  // definizione di legge, che per il turismo è sbagliata.
  nightStart: '',
  nightEnd: '',
  nightCumuloMode: 'max',        // notturno vs domenica/festivo: 'max' | 'somma'
  patronSaintDate: '',           // santo patrono locale, formato 'MM-DD'
  priorTaxableIncome: 0,
  priorIncomeDate: '',       // data (ISO) in cui è stato impostato il montante (confine turni)
  previousRates: [],
  // Beta netto: aliquote addizionali IRPEF (%)
  addRegionalePct: 1.23,
  addComunalePct: 0,
  addizionaliAltrove: false,        // addizionali già trattenute da altro datore → 0
  noAddizionali: false,      // primo anno di lavoro: nessun anno precedente da cui calcolarle → 0
  noTrattamentoIntegrativo: false,  // override: forza esclusione TI (va a conguaglio)
  tiProjectionMode: 'stimato',      // 'stimato' | 'ytd' — proiezione per la decisione TI
  // Mensilità aggiuntive (dipendono dal CCNL)
  hasTredicesima: false,
  hasQuattordicesima: false,
  hireDate: '',              // data di assunzione: serve al rateo di 13ª/14ª
  ccnl: '',                  // preset contrattuale (contributi minori, divisore orario)
  // Quanti dipendenti ha l'azienda: NON è un vezzo statistico, decide le
  // aliquote FIS e CIGS, che sono di legge e a scaglioni (5 e 15 dipendenti).
  // Default 'oltre15' = comportamento identico a prima di questa impostazione.
  aziendaDipendenti: 'oltre15',
  // Nome del lavoratore sul foglio turni (per import AI da immagine collettiva)
  workerName: '',
  // Voci fisse mensili (indennità, superminimo...) e bonus per singolo mese
  fixedMonthlyItems: [],   // [{ id, label, amount }] ricorrenti ogni mese
  fixedMonthlyDeductions: [], // [{ id, label, amount }] trattenute fisse ogni mese
  monthlyBonusAmount: 0,   // importo fisso del bonus (es. bonus presenza), se lo si prende
  monthlyBonus: {},        // { 'YYYY-MM': true } mesi in cui il bonus fisso è stato preso
                           // (valori numerici legacy: importo di quel mese, preservato com'era)
  // Lavoratore a chiamata (senza ore settimanali fisse)
  onCall: false,
  annualGrossManual: 0,      // reddito annuo lordo stimato (per aliquota fiscale)
  dailyOvertimeThreshold: 0, // ore/giorno oltre cui scatta lo straordinario
  tfrInBusta: false,         // aggiungi la quota TFR come anticipo sul netto
  tfrTaxRate: '',            // aliquota tassazione separata TFR (%) — vuoto = default 23%
  // Assenze (ferie, permessi, malattia)
  workingDaysPerWeek: 6,     // giorni su cui si spalma l'orario: dà le ore di un giorno di assenza
  absenceDailyHours: '',     // ore di un giorno di assenza — vuoto = ore settimanali ÷ giorni
  malattiaCarenzaGiorni: 3,  // primi giorni di ogni evento pagati diversamente
  malattiaCarenzaPct: 0,     // % della paga in quei giorni
  malattiaPct: 100,          // % della paga dal giorno successivo
  // Su quale periodo si contano ore e paga del mese: 'paga' = settimane intere
  // come in busta (primo lunedì → domenica prima del primo lunedì dopo),
  // 'calendario' = dal 1 all'ultimo del mese. Conta solo sui CCNL mensilizzati:
  // altrove i due periodi coincidono già.
  periodoConteggio: 'paga',
};

export default function App() {
  const [shifts, setShifts, erroreTurni] = useLocalStorage('turni_shifts', {});
  const [storedSettings, setSettings, erroreImpostazioni] = useLocalStorage('turni_settings', DEFAULT_SETTINGS);
  // Un solo avviso anche se falliscono entrambi: il guasto è lo stesso (lo
  // storage non accetta scritture) e due banner identici uno sull'altro
  // sembrerebbero due problemi diversi. Vincono i turni, che sono la cosa che
  // l'utente ha inserito a mano.
  const erroreSalvataggio = erroreTurni || erroreImpostazioni;
  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => getMonthStart(new Date()));
  const [modal, setModal] = useState(null); // null | {type:'add',date} | {type:'edit',shift}
  // Giorno su cui atterrare arrivando dal calendarietto di Statistiche.
  const [focusDate, setFocusDate] = useState(null);

  // Sfogliare i mesi spegne l'evidenziazione: il giorno tappato non è più
  // quello che si sta guardando, e una cella accesa in un altro mese sarebbe
  // solo un residuo da capire.
  const goToMonth = useCallback((m) => { setFocusDate(null); setCurrentMonth(m); }, []);

  // L'evidenziazione è un segnaposto per ritrovare il giorno appena tappato,
  // non uno stato di selezione: il primo tocco successivo la spegne, ovunque
  // cada. Senza, restava accesa fino al ricaricamento della pagina.
  // Il listener parte sul giro dopo (setTimeout 0), altrimenti intercetterebbe
  // lo stesso clic che l'ha accesa e la spegnerebbe all'istante.
  useEffect(() => {
    if (!focusDate) return undefined;
    const spegni = () => setFocusDate(null);
    const id = setTimeout(() => document.addEventListener('click', spegni, { once: true }), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', spegni);
    };
  }, [focusDate]);

  // I settings salvati da una versione precedente non hanno i campi aggiunti
  // dopo: senza questo merge resterebbero `undefined` e alcune funzioni si
  // spegnerebbero in silenzio (es. expectedWeeklyHours mancante = nessuno
  // straordinario calcolato finché non si risalva la pagina Impostazioni).
  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...storedSettings }),
    [storedSettings],
  );

  // Aggiorna solo alcuni campi delle impostazioni (es. workerName dal modal import)
  const updateSettings = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, [setSettings]);

  const addShift = useCallback((shiftData) => {
    const id = genId();
    setShifts(prev => ({ ...prev, [id]: { ...shiftData, id } }));
  }, [setShifts]);

  // Molte giornate in UNA scrittura sola, e nella stessa passata via i turni
  // che quelle giornate coprono: non si puo' lavorare ed essere in ferie lo
  // stesso giorno. Scriverle una per una farebbe altrettanti render e
  // altrettanti salvataggi su localStorage.
  const addShifts = useCallback((lista, idsDaRimuovere = []) => {
    if (!lista?.length) return;
    setShifts(prev => {
      const next = { ...prev };
      for (const id of idsDaRimuovere) delete next[id];
      for (const dati of lista) {
        const id = genId();
        next[id] = { ...dati, id };
      }
      return next;
    });
  }, [setShifts]);

  const updateShift = useCallback((shift) => {
    setShifts(prev => ({ ...prev, [shift.id]: shift }));
  }, [setShifts]);

  const deleteShift = useCallback((id) => {
    setShifts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setShifts]);

  // Elenco piatto dei turni, calcolato una volta sola: serve sia come contesto
  // per gli straordinari sia come sorgente delle viste. Ricrearlo a ogni render
  // (Object.values inline) invaliderebbe ogni memo a valle.
  const allShifts = useMemo(() => Object.values(shifts), [shifts]);

  // Storage persistente: si chiede al browser di non sfrattare i dati sotto
  // pressione di memoria. La richiesta arriva al PRIMO turno inserito, non
  // all'avvio: su Firefox fa comparire un permesso, e chiederlo davanti a
  // un'app vuota significa farlo negare senza aver capito cosa protegge.
  // Sul nativo non serve, la persistenza la garantisce il sistema.
  const persistenzaChiesta = useRef(false);
  useEffect(() => {
    if (persistenzaChiesta.current || allShifts.length === 0) return;
    if (Capacitor.isNativePlatform()) return;
    persistenzaChiesta.current = true;
    navigator.storage?.persist?.().catch(() => {});
  }, [allShifts.length]);

  const monthShifts = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return allShifts.filter(s => {
      const d = parseDate(s.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [allShifts, currentMonth]);

  // Turni del MESE DI PAGA: per i contratti mensilizzati la busta non taglia a
  // fine mese ma a fine settimana (vedi payrollMonthKey), quindi ore e
  // retribuzione del mese si contano su un insieme diverso da quello disegnato
  // sul calendario. Negli altri casi i due insiemi coincidono.
  //
  // `periodoConteggio` lascia scegliere: il mese di paga fa quadrare i conti
  // con la busta, il mese di calendario risponde alla domanda «quanto ho
  // lavorato a luglio». Sono due domande diverse ed entrambe legittime, e
  // l'app non può decidere quale interessa oggi.
  const payrollShifts = useMemo(() => {
    if (!isMensilizzato(settings) || settings.periodoConteggio === 'calendario') return monthShifts;
    const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    return allShifts.filter(s => payrollMonthKey(s.date) === key);
  }, [allShifts, monthShifts, currentMonth, settings]);

  // Mappa paga per turno, calcolata UNA volta: è O(N) su tutta la storia dei
  // turni. Ricalcolarla a ogni chiamata di calcTotalPay (mese, anno, montante)
  // rallenta l'app col crescere dei turni; qui la memoizziamo e la passiamo giù.
  const payByShift = useMemo(() => computePayByShift(allShifts, settings), [allShifts, settings]);

  const year = currentMonth.getFullYear();

  // Reddito annuo lordo maturato dai turni dell'anno visualizzato, più il
  // montante fiscale già maturato prima di usare l'app. Dipende dall'ANNO
  // (non dal mese): navigare tra i mesi dello stesso anno non deve
  // ricalcolare RAL e tasse. Stessa funzione usata dalla pagina Statistiche,
  // per anni diversi: un'unica fonte evita che le due pagine mostrino cifre
  // diverse per lo stesso anno (vedi `computeAnnualGrossFromShifts` in net.js).
  const annualGross = useMemo(
    () => computeAnnualGrossFromShifts(year, allShifts, settings, payByShift),
    [allShifts, settings, year, payByShift],
  );

  // Reddito dell'anno PROIETTATO a dicembre, non quello incassato finora.
  // Serve al riquadro del bonus: le soglie del trattamento integrativo valgono
  // sull'anno intero, quindi «quanto posso ancora guadagnare» misurato sul
  // maturato racconta un margine che non esiste — ad agosto direbbe che ci sono
  // seimila euro di spazio mentre quattro mesi di stipendio se li mangiano
  // comunque. È la stessa grandezza che usa la pagina Statistiche: passarla da
  // qui è ciò che impedisce alle due schermate di dire numeri diversi.
  const annualProjection = useMemo(
    () => projectAnnualIncome(annualGross.total, annualGross.extras, settings, year, {
      enableNetCalc: ENABLE_NET_CALC,
    }),
    [annualGross, settings, year],
  );

  const importShifts = useCallback((parsedShifts) => {
    setShifts(prev => {
      const next = { ...prev };
      // Deduplica su data+orari: reimportare la stessa foto (o una foto che si
      // sovrappone a turni già inseriti) non deve creare doppioni.
      const seen = new Set(Object.values(prev).map(s => `${s.date}|${s.startTime}|${s.endTime}`));
      parsedShifts.forEach(shiftData => {
        const key = `${shiftData.date}|${shiftData.startTime}|${shiftData.endTime}`;
        if (seen.has(key)) return;
        seen.add(key);
        const id = genId();
        next[id] = { ...shiftData, id, breakMinutes: shiftData.breakMinutes || 0, note: shiftData.note || '' };
      });
      return next;
    });
  }, [setShifts]);

  // Il modale manda un turno solo (caso di sempre) oppure una LISTA piu' gli
  // id da rimuovere, quando si segna un periodo di assenza.
  const handleSaveShift = useCallback((dati, idsDaRimuovere = []) => {
    if (Array.isArray(dati)) addShifts(dati, idsDaRimuovere);
    else if (modal?.type === 'add') addShift(dati);
    else updateShift(dati);
    setModal(null);
  }, [modal, addShift, addShifts, updateShift]);

  return (
    <div className="app">
      <NavBar view={view} onNavigate={setView} />

      <main className="main-content">
        {/* Il salvataggio non sta funzionando. Sta PRIMA di tutto il resto e non
            si può chiudere: quello che si sta guardando è a schermo ma non su
            disco, e nasconderlo riporterebbe l'app a mentire come faceva prima.
            `role="alert"` perché venga annunciato anche da uno screen reader:
            comparire in silenzio sarebbe la stessa cosa che non comparire. */}
        {erroreSalvataggio && (
          <div className="salvataggio-ko" role="alert">
            <strong>⚠️ {erroreSalvataggio.testo}</strong>
            <p>{erroreSalvataggio.rimedio}</p>
            <button type="button" onClick={() => setView('settings')}>
              Vai al backup
            </button>
          </div>
        )}
        <SetupPrompt settings={settings} onNavigate={setView} turniInseriti={allShifts.length} />
        <InstallPrompt />
        {view === 'calendar' && (
          <CalendarView
            currentMonth={currentMonth}
            onMonthChange={goToMonth}
            focusDate={focusDate}
            shifts={monthShifts}
            payrollShifts={payrollShifts}
            onAddShift={(date) => setModal({ type: 'add', date })}
            onEditShift={(shift) => setModal({ type: 'edit', shift })}
            onImportShifts={importShifts}
            onAddShifts={addShifts}
            settings={settings}
            onUpdateSettings={updateSettings}
            allShifts={allShifts}
            payByShift={payByShift}
            annualGross={annualGross.total}
            annualProjection={annualProjection.value}
            annualExtras={annualGross.extras}
            onNavigate={setView}
          />
        )}

        {ENABLE_STATS && view === 'stats' && (
          <StatsView
            allShifts={allShifts}
            settings={settings}
            payByShift={payByShift}
            onNavigate={setView}
            onOpenMonth={(y, m) => { setFocusDate(null); setCurrentMonth(new Date(y, m, 1)); setView('calendar'); }}
            // Dal giorno del calendarietto si va al Calendario ESATTAMENTE su
            // quel giorno: la cella si illumina e ci si scorre sopra. Atterrare
            // sul mese e basta lasciava il lavoro a metà — toccava ricercare a
            // mano il giorno appena tappato.
            onOpenDay={(iso) => {
              const d = parseDate(iso);
              setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              setFocusDate(iso);
              setView('calendar');
            }}
          />
        )}

        {view === 'settings' && (
          <Settings settings={settings} onSave={setSettings} />
        )}

        <footer className="app-footer">v{__APP_VERSION__}</footer>
      </main>

      {modal && (
        <ShiftForm
          modal={modal}
          settings={settings}
          turni={allShifts}
          onSave={handleSaveShift}
          onDelete={(id) => { deleteShift(id); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
