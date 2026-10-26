import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { getMonthStart, parseDate, payrollMonthKey, formatDate } from './utils/dates';
import { computePayByShift } from './motore/pay';
import { isMensilizzato } from './motore/ccnl';
import { computeAnnualGrossFromShifts, projectAnnualIncome } from './motore/net';
import { ENABLE_NET_CALC, ENABLE_STATS, ENABLE_MESE_PAGA } from './config/features';
import { genId } from './utils/id';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import Settings from './components/Settings';
import VerificaBusta from './components/VerificaBusta';
import ShiftForm from './components/ShiftForm';
import NavBar from './components/NavBar';
import InstallPrompt, { isIOS, isStandalone } from './components/InstallPrompt';
import { chiedereInstallazioneIOS, chiParlaInAlto, KEY_INSTALLA_IOS_RIFIUTATO } from './utils/installazione';
import SetupPrompt from './components/SetupPrompt';
import DatiMinimi from './components/DatiMinimi';
import SistemaMancanti from './components/SistemaMancanti';
import AvvisoMaggiorazione from './components/AvvisoMaggiorazione';
import AvvisoAggiornamento from './components/AvvisoAggiornamento';
import AvvisoAnnulla from './components/AvvisoAnnulla';
import { avvisoDaMostrare, DURATA_ANNULLA } from './utils/avvisi';
import { iscrivitiAggiornamenti, applicaAggiornamento, primaDiRicaricare } from './services/aggiornamento';
import useOccupato from './hooks/useOccupato';
import useOggi from './hooks/useOggi';
import { iscrivitiOccupato } from './utils/occupato';
import { isAssenza } from './motore/assenze';
import { turniDaImportare } from './utils/import-turni';
import { haDatiMinimi, maggiorazioneDaChiedere, promemoriaHaDaDire, KEY_PROMEMORIA_CHIUSO } from './utils/configurazione';

const DEFAULT_SETTINGS = {
  hourlyRate: 0,
  expectedWeeklyHours: 40,
  fullTimeWeeklyHours: 40,   // soglia oltre cui le ore diventano straordinarie invece che supplementari
  sundaySurchargePct: 0,
  overtimeSurchargePct: 0,   // maggiorazione supplementari (fra contratto e full-time)
  straordinarioSurchargePct: '', // maggiorazione straordinari (oltre il full-time); vuoto = come i supplementari
  holidaySurchargePct: 0,        // maggiorazione festivi (%)
  holidaySundayMode: 'max',      // festivo+domenica: 'max' | 'sum' | 'holiday'
  // Notturno: si paga sui soli minuti in fascia (motore/notturno.js). 0 = spento (default).
  nightSurchargePct: 0,
  // Vuoto = la fascia la decide il CCNL (`fasciaNotturnaRisolta`), poi le 22:00–06:00 di legge.
  nightStart: '',
  nightEnd: '',
  nightCumuloMode: 'max',        // notturno vs domenica/festivo: 'max' | 'somma'
  // Maggiorazioni per cui l'utente ha risposto «non ne ho»: non gli vengono più chieste.
  maggiorazioniNonDovute: [],
  patronSaintDate: '',           // santo patrono locale, formato 'MM-DD'
  priorTaxableIncome: 0,
  priorIncomeDate: '',       // data (ISO) in cui è stato impostato il montante (confine turni)
  previousRates: [],
  // Beta netto: aliquote addizionali IRPEF (%)
  addRegionalePct: 1.23,
  addComunalePct: 0,
  addizionaliAltrove: false,        // addizionali già trattenute da altro datore → 0
  noAddizionali: false,      // primo anno di lavoro: nessun anno precedente da cui calcolarle → 0
  noTrattamentoIntegrativo: false,  // storico: oggi lo tiene allineato a tiModo
  // Trattamento integrativo: 'auto' (come il software paghe), 'sempre' o 'mai'. Vedi
  // tiSpettaQuestoMese in motore/net.js.
  tiModo: 'auto',
  tiProjectionMode: 'stimato',      // 'stimato' | 'ytd' — proiezione per la decisione TI
  // Mensilità aggiuntive (dipendono dal CCNL)
  hasTredicesima: false,
  hasQuattordicesima: false,
  hireDate: '',              // data di assunzione: serve al rateo di 13ª/14ª
  ccnl: '',                  // preset contrattuale (contributi minori, divisore orario)
  // Quanti dipendenti ha l'azienda: decide le aliquote FIS e CIGS (di legge, a scaglioni).
  aziendaDipendenti: 'oltre15',
  // Nome del lavoratore sul foglio turni (per import AI da immagine collettiva)
  workerName: '',
  // Voci fisse mensili (indennità, superminimo...) e bonus per singolo mese
  fixedMonthlyItems: [],   // [{ id, label, amount }] ricorrenti ogni mese
  fixedMonthlyDeductions: [], // [{ id, label, amount }] trattenute fisse ogni mese
  // Quanto vale ogni singolo turno, in griglia e in agenda. SPENTO di default; una sola
  // chiave per tutte e due le viste.
  mostraEuroPerTurno: false,
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
  // Su quale periodo si contano ore e paga del mese: 'calendario' = dal 1 all'ultimo,
  // 'paga' = settimane intere. Conta solo sui CCNL mensilizzati.
  // Riscontro del default: scripts/check-busta-agosto-2026.mjs.
  periodoConteggio: 'calendario',
};

// Schermata da riprendere dopo un aggiornamento applicato in secondo piano, così il
// ricaricamento non riporta al calendario del mese corrente. In sessionStorage (vale per
// questa scheda), letta una volta sola all'import del modulo e subito cancellata (in
// StrictMode un inizializzatore la rileggerebbe due volte).
const RIPRESA = (() => {
  try {
    const grezzo = sessionStorage.getItem('turni_ripresa');
    if (!grezzo) return null;
    sessionStorage.removeItem('turni_ripresa');
    return JSON.parse(grezzo);
  } catch {
    return null;
  }
})();

// La scorciatoia dall'icona («Segna il turno di oggi») apre il modulo invece del
// calendario. Il PARAMETRO È UN CONTRATTO col manifest in vite.config.js
// (check-configurazione.mjs). Letto e cancellato subito, come RIPRESA, con
// `history.replaceState` (niente voce in più nella cronologia).
const SCORCIATOIA = (() => {
  try {
    const chiesto = new URLSearchParams(window.location.search).get('nuovo');
    if (!chiesto) return null;
    window.history.replaceState({}, '', window.location.pathname);
    return chiesto;
  } catch {
    return null;
  }
})();

// `?verifica` apre «Confronta con la busta» (VerificaBusta.jsx). L'indirizzo NON si
// pulisce: chi ricarica mentre cerca il PDF deve ritrovare la pagina.
const VERIFICA = (() => {
  try { return new URLSearchParams(window.location.search).has('verifica'); } catch { return false; }
})();

export default function App() {
  const [shifts, setShifts, erroreTurni] = useLocalStorage('turni_shifts', {});
  const [storedSettings, setSettings, erroreImpostazioni] = useLocalStorage('turni_settings', DEFAULT_SETTINGS);
  // Un solo avviso anche se falliscono entrambi (stesso guasto: lo storage non accetta
  // scritture). Vincono i turni, inseriti a mano.
  const erroreSalvataggio = /** @type {{ testo: string, rimedio: string } | null} */ (erroreTurni || erroreImpostazioni);
  // `stats` passa dal flag anche in ripresa: una vista che non esiste più lascerebbe lo
  // schermo vuoto.
  const [view, setView] = useState(
    VERIFICA ? 'verifica'
      : (RIPRESA?.view === 'stats' && !ENABLE_STATS ? 'calendar' : (RIPRESA?.view || 'calendar')),
  );
  const [currentMonth, setCurrentMonth] = useState(() => (
    RIPRESA?.mese ? getMonthStart(new Date(RIPRESA.mese)) : getMonthStart(new Date())
  ));
  // Dalla scorciatoia il modulo è già aperto sul giorno di oggi al primo render, non «si
  // apre da solo» dopo un istante.
  const [modal, setModal] = useState(/** @type {any} */ ( // null | {type:'add',date} | {type:'edit',shift}
    SCORCIATOIA === 'oggi' ? { type: 'add', date: formatDate(new Date()) } : null
  ));
  // Giorno su cui atterrare arrivando dal calendarietto di Statistiche.
  const [focusDate, setFocusDate] = useState(null);

  // Sfogliare i mesi spegne l'evidenziazione del giorno tappato.
  const goToMonth = useCallback((m) => { setFocusDate(null); setCurrentMonth(m); }, []);

  // L'evidenziazione è un segnaposto, non una selezione: il primo tocco successivo la
  // spegne. Il listener parte sul giro dopo (setTimeout 0), per non intercettare il clic
  // che l'ha accesa.
  useEffect(() => {
    if (!focusDate) return undefined;
    const spegni = () => setFocusDate(null);
    const id = setTimeout(() => document.addEventListener('click', spegni, { once: true }), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', spegni);
    };
  }, [focusDate]);

  // I settings salvati da una versione precedente non hanno i campi nuovi: il merge evita
  // `undefined` che spegnerebbe funzioni in silenzio.
  const settings = useMemo(
    () => {
      const uniti = { ...DEFAULT_SETTINGS, ...storedSettings };
      // Col selettore spento il periodo è sempre il calendario, anche per chi si era
      // salvato «paga»: si normalizza QUI, dove i settings nascono. Il dato salvato non si tocca.
      if (!ENABLE_MESE_PAGA) uniti.periodoConteggio = 'calendario';
      return uniti;
    },
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

  // Molte giornate in UNA scrittura sola, togliendo i turni che coprono (non si può
  // lavorare ed essere in ferie lo stesso giorno): un solo render e un solo salvataggio.
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

  // Elenco piatto dei turni, calcolato una volta: ricrearlo a ogni render invaliderebbe i memo.
  const allShifts = useMemo(() => Object.values(shifts), [shifts]);

  // Storage persistente: si chiede al PRIMO turno inserito, non all'avvio (su Firefox
  // compare un permesso, e davanti a un'app vuota verrebbe negato).
  const persistenzaChiesta = useRef(false);
  useEffect(() => {
    if (persistenzaChiesta.current || allShifts.length === 0) return;
    persistenzaChiesta.current = true;
    navigator.storage?.persist?.().catch(() => {});
  }, [allShifts.length]);

  // Su iOS Safari cancella lo storage dei siti non aperti per sette giorni; l'unica
  // esenzione è l'app aggiunta alla Home. Chiave del «no» NUOVA di proposito.
  const ambiente = useMemo(() => ({
    ios: isIOS(), standalone: isStandalone(),
  }), []);
  const [installaIOSRifiutato, setInstallaIOSRifiutato] = useState(() => {
    try { return localStorage.getItem(KEY_INSTALLA_IOS_RIFIUTATO) === '1'; } catch { return false; }
  });
  const rifiutaInstallaIOS = useCallback(() => {
    setInstallaIOSRifiutato(true);
    try { localStorage.setItem(KEY_INSTALLA_IOS_RIFIUTATO, '1'); } catch { /* il no vale almeno per questa sessione */ }
  }, []);
  const installaIOS = chiedereInstallazioneIOS({
    ...ambiente, turni: allShifts.length, rifiutato: installaIOSRifiutato,
  });

  // Il promemoria in alto. Deciso qui perché il banner di installazione deve sapere se tacere.
  const [promemoriaChiuso, setPromemoriaChiuso] = useState(() => {
    try { return localStorage.getItem(KEY_PROMEMORIA_CHIUSO) === '1'; } catch { return false; }
  });
  const chiudiPromemoria = useCallback(() => {
    setPromemoriaChiuso(true);
    try { localStorage.setItem(KEY_PROMEMORIA_CHIUSO, '1'); } catch { /* il no vale almeno per questa sessione */ }
  }, []);
  const promemoria = promemoriaHaDaDire({
    settings, turni: allShifts.length, chiuso: promemoriaChiuso,
  });

  const monthShifts = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return allShifts.filter(s => {
      const d = parseDate(s.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [allShifts, currentMonth]);

  // Turni del MESE DI PAGA: per i contratti mensilizzati la busta taglia a fine settimana
  // (`payrollMonthKey`), non a fine mese. `periodoConteggio` lascia scegliere fra mese di
  // paga (conti con la busta) e di calendario («quanto ho lavorato a luglio»).
  const payrollShifts = useMemo(() => {
    if (!isMensilizzato(settings) || settings.periodoConteggio === 'calendario') return monthShifts;
    const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    return allShifts.filter(s => payrollMonthKey(s.date) === key);
  }, [allShifts, monthShifts, currentMonth, settings]);

  // Mappa paga per turno, calcolata UNA volta (O(N) su tutta la storia) e passata giù.
  const payByShift = useMemo(() => computePayByShift(allShifts, settings, { oggi: new Date() }), [allShifts, settings]);

  const year = currentMonth.getFullYear();

  // Reddito annuo lordo maturato nell'anno visualizzato, più il montante. Dipende dall'ANNO,
  // non dal mese. Stessa funzione della pagina Statistiche (`computeAnnualGrossFromShifts`).
  const oggi = useOggi();
  const annualGross = useMemo(
    () => computeAnnualGrossFromShifts(year, allShifts, settings, payByShift, oggi),
    [allShifts, settings, year, payByShift, oggi],
  );

  // Reddito dell'anno PROIETTATO a dicembre, non l'incassato: le soglie del trattamento
  // integrativo valgono sull'anno intero. Stessa grandezza della pagina Statistiche.
  const annualProjection = useMemo(
    () => projectAnnualIncome(annualGross.total, annualGross.extras, settings, year, {
      enableNetCalc: ENABLE_NET_CALC, oggi,
    }),
    [annualGross, settings, year, oggi],
  );

  // Doppioni, giorni già di ferie o malattia e campi da tenere: la regola è in
  // `utils/import-turni.js`, la stessa dell'anteprima.
  const importShifts = useCallback((parsedShifts) => {
    setShifts(prev => {
      const { daSalvare } = turniDaImportare(parsedShifts, Object.values(prev));
      if (daSalvare.length === 0) return prev;
      const next = { ...prev };
      for (const dati of daSalvare) {
        const id = genId();
        next[id] = { ...dati, id };
      }
      return next;
    });
  }, [setShifts]);

  // Il modale manda un turno solo (caso di sempre) oppure una LISTA piu' gli
  // id da rimuovere, quando si segna un periodo di assenza.
  const salvaDavvero = useCallback((dati, idsDaRimuovere = [], tipoModale) => {
    if (Array.isArray(dati)) addShifts(dati, idsDaRimuovere);
    else if (tipoModale === 'add') addShift(dati);
    else updateShift(dati);
  }, [addShift, addShifts, updateShift]);

  // Il primo turno non si salva senza paga e ore (utils/configurazione.js): resta qui in
  // attesa e si salva appena i dati arrivano.
  const [inAttesa, setInAttesa] = useState(null);
  const [sistemaAperto, setSistemaAperto] = useState(false);

  // ── L'avviso sulle maggiorazioni, a turno già salvato ──
  // Nasce qui DOPO il salvataggio e vive in una striscia che non copre niente
  // (AvvisoMaggiorazione.jsx); la regola è `maggiorazioneDaChiedere`. `zittiti` è il
  // «non adesso»: dura la sessione, per tipo, e non va nei settings. Il «no» invece è una
  // risposta e si conserva nei settings.
  const [avviso, setAvviso] = useState(null);
  const zittiti = useRef(new Set());

  // Versione nuova scaricata e in attesa: si accende solo un avviso chiudibile (vedi
  // services/aggiornamento.js).
  const [aggiornamentoPronto, setAggiornamentoPronto] = useState(false);
  useEffect(() => iscrivitiAggiornamenti(setAggiornamentoPronto), []);

  // Lavoro in sospeso FUORI da App (Impostazioni non salvate, foto in riconoscimento):
  // «Aggiorna» lo butterebbe via, e App non lo vede, si legge dal registro. Le chiavi di
  // App ('modale', 'annulla') le decide `avvisoDaMostrare`.
  const [occupatoAltrove, setOccupatoAltrove] = useState(false);
  useEffect(() => iscrivitiOccupato((chiavi) => {
    setOccupatoAltrove(chiavi.some(k => k !== 'modale' && k !== 'annulla'));
  }), []);

  // L'ultimo turno cancellato, finché si fa in tempo a rimetterlo. Vive qui e
  // non nel modulo perché il modulo si smonta nell'istante della cancellazione.
  const [annullabile, setAnnullabile] = useState(null);

  // La finestra si chiude da sola: il timer sta in un effetto con la sua pulizia (in
  // StrictMode un `setTimeout` sparso lascerebbe due timer).
  useEffect(() => {
    if (!annullabile) return undefined;
    const t = setTimeout(() => setAnnullabile(null), DURATA_ANNULLA);
    return () => clearTimeout(t);
  }, [annullabile]);

  // Niente ricaricamenti con del lavoro in sospeso; il caso grave è `inAttesa`, un turno
  // GIÀ COMPILATO e non ancora salvato.
  useOccupato('modale', !!modal || !!inAttesa || sistemaAperto);

  // Anche l'annulla è lavoro in sospeso: la chiave si spegne da sé (`useOccupato` la lega
  // allo stato), così non resta accesa per sempre.
  useOccupato('annulla', !!annullabile);

  // Un istante prima dell'aggiornamento si mette da parte cosa si stava guardando (vedi RIPRESA).
  useEffect(() => primaDiRicaricare(() => {
    try {
      sessionStorage.setItem('turni_ripresa', JSON.stringify({
        view,
        mese: currentMonth.toISOString(),
      }));
    } catch { /* senza sessionStorage si riparte dal calendario: non è un guasto */ }
  }), [view, currentMonth]);

  const proponiMaggiorazione = useCallback((dati) => {
    // Un periodo di ferie salva una lista: le assenze non attivano niente
    // (`maggiorazioneDaChiedere` lo sa), quindi basta guardare il primo turno.
    const turno = Array.isArray(dati) ? dati[0] : dati;
    const m = maggiorazioneDaChiedere(turno, settings);
    if (m && !zittiti.current.has(m.tipo)) setAvviso(m);
  }, [settings]);

  const handleSaveShift = useCallback((dati, idsDaRimuovere = []) => {
    if (!haDatiMinimi(settings)) {
      setInAttesa({ dati, idsDaRimuovere, tipoModale: modal?.type });
      setModal(null);
      return;
    }
    salvaDavvero(dati, idsDaRimuovere, modal?.type);
    setModal(null);
    proponiMaggiorazione(dati);
  }, [modal, settings, salvaDavvero, proponiMaggiorazione]);

  // La cancellazione avviene SUBITO; la via di ritorno viene dopo (utils/avvisi.js). Si
  // tiene il turno per intero, non il solo id: il record è già tolto dalla mappa.
  const cancellaTurno = useCallback((id) => {
    const turno = shifts[id];
    deleteShift(id);
    setModal(null);
    // Cancellare è «la prossima cosa»: la domanda sulle maggiorazioni cede il posto.
    setAvviso(null);
    if (turno) setAnnullabile(turno);
  }, [shifts, deleteShift]);

  // Rimettere il turno è `updateShift`: torna lo stesso record con lo STESSO id, e non
  // riparte la domanda sulle maggiorazioni. Se nel frattempo il giorno ha qualcosa che non
  // può convivere (ferie dove c'era lavoro, o viceversa) la striscia si ritira: rimetterlo
  // darebbe lavoro e ferie nello stesso giorno.
  useEffect(() => {
    if (!annullabile) return;
    const assenza = isAssenza(annullabile);
    const conflitto = Object.values(shifts).some(s =>
      s.date === annullabile.date && s.id !== annullabile.id && isAssenza(s) !== assenza);
    if (conflitto) setAnnullabile(null);
  }, [shifts, annullabile]);

  const annullaCancellazione = useCallback(() => {
    if (annullabile) updateShift(annullabile);
    setAnnullabile(null);
  }, [annullabile, updateShift]);

  // Dati minimi arrivati: si scrivono con updateSettings (PATCH), mai con setSettings, che
  // porterebbe via i campi che questo modulo non conosce.
  const completaDatiMinimi = useCallback((patch) => {
    updateSettings(patch);
    if (inAttesa) {
      salvaDavvero(inAttesa.dati, inAttesa.idsDaRimuovere, inAttesa.tipoModale);
      // Anche il primo turno può essere di domenica: le impostazioni appena scritte non sono
      // ancora in `settings`, quindi si valuta sull'unione.
      const turno = Array.isArray(inAttesa.dati) ? inAttesa.dati[0] : inAttesa.dati;
      const m = maggiorazioneDaChiedere(turno, { ...settings, ...patch });
      if (m && !zittiti.current.has(m.tipo)) setAvviso(m);
    }
    setInAttesa(null);
  }, [updateSettings, inAttesa, salvaDavvero, settings]);

  // Chi ha diritto alla striscia in fondo, adesso. Una riga sola perché la
  // regola vive altrove, riscontrata: vedi utils/avvisi.js.
  const chiParla = avvisoDaMostrare({
    modaleAperto: !!modal || !!inAttesa || sistemaAperto,
    annulla: !!annullabile,
    maggiorazione: !!avviso,
    aggiornamento: aggiornamentoPronto && !occupatoAltrove,
  });
  // E chi in cima: l'avviso iOS batte il promemoria, perché i turni cancellati
  // da Safari non tornano e la configurazione sì. Vedi utils/installazione.js.
  const inAlto = chiParlaInAlto({ strisciaInBasso: chiParla !== null, installaIOS, promemoria });

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
        {/* Sulla verifica della busta niente promemoria in alto: la prima cosa
            che il tester deve vedere è che la busta resta sul telefono. */}
        {view !== 'verifica' && (
          <>
            {/* Uno solo dei due, mai impilati: `chiParlaInAlto`. Il promemoria
                tace davanti alla striscia in fondo e all'avviso iOS; il banner
                di installazione fuori da iOS tace davanti a tutti. */}
            <SetupPrompt
              settings={settings}
              parla={inAlto === 'promemoria'}
              onSistema={() => setSistemaAperto(true)}
              onChiudi={chiudiPromemoria}
            />
            <InstallPrompt
              installaIOS={inAlto === 'installa'}
              sospeso={inAlto !== 'comodita'}
              onRifiutaIOS={rifiutaInstallaIOS}
              onBackup={() => setView('settings')}
            />
          </>
        )}
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
            // Dal giorno del calendarietto si va al Calendario ESATTAMENTE su quel giorno: la
            // cella si illumina e ci si scorre sopra.
            onOpenDay={(iso) => {
              const d = parseDate(iso);
              setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              setFocusDate(iso);
              setView('calendar');
            }}
          />
        )}

        {/* `updateSettings` e non `setSettings`: la pagina Impostazioni
            costruisce un oggetto con i propri campi, e sostituire l'intero
            blocco portava via quelli che non conosce — `periodoConteggio`
            tornava a «mese di paga» a ogni salvataggio, cancellando in silenzio
            una scelta fatta dal calendario. */}
        {view === 'settings' && (
          <Settings settings={settings} onSave={updateSettings} />
        )}

        {view === 'verifica' && (
          <VerificaBusta
            allShifts={allShifts}
            settings={settings}
            onChiudi={() => {
              try { window.history.replaceState({}, '', window.location.pathname); } catch { /* niente */ }
              setView('calendar');
            }}
          />
        )}

        <footer className="app-footer">v{__APP_VERSION__}</footer>
      </main>

      {sistemaAperto && (
        <SistemaMancanti
          settings={settings}
          onSalva={(patch) => { updateSettings(patch); setSistemaAperto(false); }}
          onChiudi={() => setSistemaAperto(false)}
          onVaiAImpostazioni={() => { setSistemaAperto(false); setView('settings'); }}
        />
      )}

      {inAttesa && (
        <DatiMinimi
          settings={settings}
          onSalva={completaDatiMinimi}
          onAnnulla={() => setInAttesa(null)}
        />
      )}

      {modal && (
        <ShiftForm
          // ShiftForm fissa lo stato iniziale al montaggio (`initial`): senza key, passando da
          // un turno a un altro resterebbero i dati del primo.
          key={modal.type === 'edit' ? modal.shift.id : modal.date}
          modal={modal}
          settings={settings}
          turni={allShifts}
          onSave={handleSaveShift}
          onDelete={cancellaTurno}
          onClose={() => setModal(null)}
        />
      )}

      {/* UN AVVISO ALLA VOLTA. La precedenza non è più scritta qui a mano:
          con tre strisce le condizioni incrociate diventano sei, e nessuno si
          accorgerebbe che una è finita in fondo alla catena e non compare mai
          più. La regola, col suo perché, sta in utils/avvisi.js e ha il suo
          riscontro. Qui si legge soltanto chi ha vinto. */}
      {chiParla === 'aggiornamento' && (
        <AvvisoAggiornamento
          onAggiorna={applicaAggiornamento}
          onChiudi={() => setAggiornamentoPronto(false)}
        />
      )}

      {chiParla === 'annulla' && (
        <AvvisoAnnulla
          turno={annullabile}
          onAnnulla={annullaCancellazione}
          onChiudi={() => setAnnullabile(null)}
        />
      )}

      {/* In fondo allo schermo: non copre l'app, non ferma niente, e se la si
          ignora se ne va da sé alla prossima cosa. */}
      {chiParla === 'maggiorazione' && (
        <AvvisoMaggiorazione
          avviso={avviso}
          onImposta={(chiave, valore) => updateSettings({ [chiave]: valore })}
          onNonNeHo={() => {
            const gia = Array.isArray(settings.maggiorazioniNonDovute) ? settings.maggiorazioniNonDovute : [];
            updateSettings({ maggiorazioniNonDovute: [...gia, avviso.tipo] });
            setAvviso(null);
          }}
          onChiudi={() => {
            zittiti.current.add(avviso.tipo);
            setAvviso(null);
          }}
        />
      )}
    </div>
  );
}
