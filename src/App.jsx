import { useState, useCallback, useMemo } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { getMonthStart, parseDate } from './utils/dates';
import { calcTotalPay, computePayByShift } from './utils/pay';
import { monthlyBaseGross, receivedExtraMonthsCount } from './utils/net';
import { genId } from './utils/id';
import CalendarView from './components/CalendarView';
import Settings from './components/Settings';
import ShiftForm from './components/ShiftForm';
import NavBar from './components/NavBar';
import InstallPrompt from './components/InstallPrompt';

const DEFAULT_SETTINGS = {
  hourlyRate: 0,
  expectedWeeklyHours: 40,
  sundaySurchargePct: 0,
  overtimeSurchargePct: 0,
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
  monthlyBonus: {},        // { 'YYYY-MM': importo } bonus del singolo mese
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

  const monthShifts = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return allShifts.filter(s => {
      const d = parseDate(s.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [allShifts, currentMonth]);

  // Mappa paga per turno, calcolata UNA volta: è O(N) su tutta la storia dei
  // turni. Ricalcolarla a ogni chiamata di calcTotalPay (mese, anno, montante)
  // rallenta l'app col crescere dei turni; qui la memoizziamo e la passiamo giù.
  const payByShift = useMemo(() => computePayByShift(allShifts, settings), [allShifts, settings]);

  const year = currentMonth.getFullYear();

  // Reddito annuo lordo maturato dai turni dell'anno visualizzato,
  // più il montante fiscale già maturato prima di usare l'app.
  // Dipende dall'ANNO (non dal mese): navigare tra i mesi dello stesso anno non
  // deve ricalcolare RAL e tasse.
  const annualGross = useMemo(() => {
    const y = year;
    const yearShifts = allShifts.filter(s => parseDate(s.date).getFullYear() === y);
    // Confine automatico a granularità MESE: il montante rappresenta il reddito fino
    // al mese in cui è stato impostato. I turni dei mesi ≤ mese di riferimento sono già
    // inclusi nel montante e NON vanno ri-sommati (evita il doppio conteggio); si
    // contano solo quelli dei mesi successivi.
    const montante = Number(settings.priorTaxableIncome) || 0;
    const cutoff = settings.priorIncomeDate || '';
    const cutoffMonth = cutoff.slice(0, 7); // 'YYYY-MM'
    const sameYear = cutoff && Number(cutoff.slice(0, 4)) === y;
    const useCutoff = montante > 0 && sameYear;
    const counted = useCutoff ? yearShifts.filter(s => s.date.slice(0, 7) > cutoffMonth) : yearShifts;
    // Contesto straordinari = TUTTI i turni, non solo quelli dell'anno: le
    // settimane lun-dom a cavallo di capodanno vanno raggruppate per intero,
    // altrimenti lo stesso mese vale una cifra qui e un'altra nel calendario.
    const pay = calcTotalPay(counted, settings, allShifts, payByShift);
    const fromShifts = pay ? pay.total : 0;
    // Mensilità aggiuntive già incassate, in base alla data ODIERNA (non al mese
    // che si sta sfogliando): altrimenti aprire dicembre farebbe risultare la
    // tredicesima già presa, cambiando reddito annuo, aliquota e soglie bonus.
    // Contano per il RATEO maturato, non per una mensilità piena: chi è assunto
    // da sei mesi prende mezza quattordicesima.
    const now = new Date();
    let extras = 0;
    if (y <= now.getFullYear()) {
      const monthIndex = y < now.getFullYear() ? 11 : now.getMonth();
      extras = monthlyBaseGross(settings) * receivedExtraMonthsCount(settings, monthIndex, y);
    }
    const applyMontante = montante > 0 && (!cutoff || sameYear);
    return { total: fromShifts + (applyMontante ? montante : 0) + extras, extras };
  }, [allShifts, settings, year, payByShift]);

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
        <InstallPrompt />
        {view === 'calendar' && (
          <CalendarView
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            shifts={monthShifts}
            onAddShift={(date) => setModal({ type: 'add', date })}
            onEditShift={(shift) => setModal({ type: 'edit', shift })}
            onImportShifts={importShifts}
            settings={settings}
            onUpdateSettings={updateSettings}
            allShifts={allShifts}
            payByShift={payByShift}
            annualGross={annualGross.total}
            annualExtras={annualGross.extras}
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
