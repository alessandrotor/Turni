import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import useLocalStorage from './hooks/useLocalStorage';
import { getMonthStart, parseDate, payrollMonthKey } from './utils/dates';
import { calcTotalPay, computePayByShift } from './utils/pay';
import { isMensilizzato } from './utils/ccnl';
import { computeAnnualGrossFromShifts } from './utils/net';
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
};

export default function App() {
  const [shifts, setShifts] = useLocalStorage('turni_shifts', {});
  const [storedSettings, setSettings] = useLocalStorage('turni_settings', DEFAULT_SETTINGS);
  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => getMonthStart(new Date()));
  const [modal, setModal] = useState(null); // null | {type:'add',date} | {type:'edit',shift}

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
  const payrollShifts = useMemo(() => {
    if (!isMensilizzato(settings)) return monthShifts;
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

  const handleSaveShift = useCallback((shiftData) => {
    if (modal?.type === 'add') addShift(shiftData);
    else updateShift(shiftData);
    setModal(null);
  }, [modal, addShift, updateShift]);

  return (
    <div className="app">
      <NavBar view={view} onNavigate={setView} />

      <main className="main-content">
        <SetupPrompt settings={settings} onNavigate={setView} />
        <InstallPrompt />
        {view === 'calendar' && (
          <CalendarView
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            shifts={monthShifts}
            payrollShifts={payrollShifts}
            onAddShift={(date) => setModal({ type: 'add', date })}
            onEditShift={(shift) => setModal({ type: 'edit', shift })}
            onImportShifts={importShifts}
            settings={settings}
            onUpdateSettings={updateSettings}
            allShifts={allShifts}
            payByShift={payByShift}
            annualGross={annualGross.total}
            annualExtras={annualGross.extras}
            onNavigate={setView}
          />
        )}

        {view === 'stats' && (
          <StatsView
            allShifts={allShifts}
            settings={settings}
            payByShift={payByShift}
            onNavigate={setView}
            onOpenMonth={(y, m) => { setCurrentMonth(new Date(y, m, 1)); setView('calendar'); }}
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
          onSave={handleSaveShift}
          onDelete={(id) => { deleteShift(id); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
