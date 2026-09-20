import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import {
  formatDate, formatMonthYear, isToday, isWeekend,
  addMonths, getMonthStart, getDaysInMonth, isCurrentMonth, formatPayrollRange,
} from '../utils/dates';
import { calcShiftMinutes, calcTotalPay, formatCurrency, lordoTurno } from '../utils/pay';
import { TIPO, ETICHETTA, ICONA, tipoTurno } from '../utils/assenze';
import { isMensilizzato } from '../utils/ccnl';
import { calcBonusMargin, BONUS_STATUS, margineInOre } from '../utils/bonus';
import { rischioRestituzione, quotaPotenziale, CAUSA, costoSoglia, posizioneRispettoSoglia, mancaAlPareggio, POSIZIONE } from '../utils/restituzione';
import { festivitaSenzaTurno, giornateFestive } from '../utils/festivita-non-lavorate';
import { contrattoMancante } from '../utils/configurazione';
import { ENABLE_MESE_PAGA } from '../config/features';
import { accettatoInvioFoto, accettaInvioFoto } from '../services/gemini';
import { minutiGiornoAssenza } from '../utils/assenze';
import { EXTRA_MONTHS, TAX_2026 } from '../utils/net';
import { ENABLE_DEBUG } from '../config/features';
import useMonthlyNet from '../hooks/useMonthlyNet';

// Aliquota contributiva: fino a 3 decimali, senza zeri inutili in coda
// (9,19% e 0,267%, non 9,190% né 0,300%).
const fmtPct = (pct) => String(Number(pct.toFixed(3))).replace('.', ',');

// Da dove arriva il reddito annuo di riferimento, per dirlo all'utente.
const PROJECTION_LABEL = {
  // 'previsione' è il caso normale: maturato finora + quello che resta da
  // contratto. Gli altri tre restano perché rispondono a domande diverse e la
  // funzione li tratta ancora a parte (vedi projectAnnualIncome in net.js).
  previsione: 'da quanto hai segnato più i mesi che restano',
  contratto: 'da contratto',
  maturato: 'dal maturato annualizzato',
  manuale: 'inserita a mano',
};
import { exportShiftsExcel, exportShiftsPDF } from '../services/export';
import { sendImportTelemetry } from '../services/telemetry';
import ImportModal from './ImportModal';
import TimelineView from './TimelineView';
import useOccupato from '../hooks/useOccupato';
import { KEY_CAL_LAYOUT } from '../services/backup';

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// I minuti non sono sempre interi: le ore contrattuali mensili nascono da una
// moltiplicazione (24 × 4,3 = 103,19999…), quindi lo straordinario che ne deriva
// porta con sé la coda binaria. Senza arrotondare uscirebbe «6h 30.00000000000091m».
function formatMinutesShort(mins) {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Ore di una giornata, assenze comprese: è il totale che quel giorno vale in
// busta, non le sole ore lavorate.
const minutiDelGiorno = (turni) => turni.reduce((somma, s) => somma + calcShiftMinutes(s), 0);

export default function CalendarView({
  currentMonth,
  onMonthChange,
  shifts,
  // Turni del mese di PAGA: coincidono con `shifts` salvo contratti
  // mensilizzati, dove il mese di busta è fatto di settimane intere. La
  // griglia resta disegnata su `shifts` (il mese di calendario), i totali si
  // contano su questi.
  payrollShifts,
  onAddShift,
  onEditShift,
  onImportShifts,
  // Crea più giornate in una sola scrittura: serve alla proposta delle
  // festività non lavorate qui sotto (la stessa usata per le assenze a periodo).
  onAddShifts,
  settings,
  onUpdateSettings,
  allShifts,
  payByShift,
  annualGross,
  // Reddito dell'anno PROIETTATO a dicembre: e' la grandezza su cui si
  // misurano le soglie del bonus, che valgono sull'anno intero.
  annualProjection = 0,
  annualExtras = 0,
  onNavigate,
  // Giorno da mettere in evidenza arrivando da un'altra pagina (il
  // calendarietto di Statistiche): la cella si illumina e ci si scorre sopra,
  // altrimenti si atterra sul mese e tocca ricercare a mano il giorno tappato.
  focusDate = null,
}) {
  const [importParsed, setImportParsed] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [showNetDetail, setShowNetDetail] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [nameInput, setNameInput] = useState('');
  // Modifica del nome fuori dall'import (nessun file in attesa): riusa la stessa modale.
  const [editingName, setEditingName] = useState(false);
  // Quando la modale del nome è stata aperta perché si voleva importare: dopo il
  // salvataggio si apre il selettore immagini. Il nome è OBBLIGATORIO prima di
  // caricare una foto, per non spendere token dell'AI a vuoto.
  const [pickAfterName, setPickAfterName] = useState(false);
  const [importUsage, setImportUsage] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Un import da foto in corso tiene occupata l'app: la richiesta al modello è
  // già stata pagata, e i turni riconosciuti non sono ancora stati confermati.
  // Un ricaricamento in quel momento butterebbe via tutti e due, quindi
  // l'aggiornamento aspetta il momento dopo. Vedi utils/occupato.js.
  useOccupato('import', importLoading || !!pendingImportFile || !!importParsed);
  // Default al mese di CALENDARIO: chi segna i turni pensa in mesi solari, non
  // in periodi di paga a settimane intere (quelli sono un dettaglio interno
  // del calcolo del netto, non come l'utente registra le cose giorno per giorno).
  const [exportPeriod, setExportPeriod] = useState('calendar');
  // Avvertenza sull'invio della foto: mostrata una volta sola, ricordata nel
  // browser. Vedi `accettatoInvioFoto` in services/gemini.js.
  const [mostraAvvisoFoto, setMostraAvvisoFoto] = useState(false);
  const [contiBonusAperti, setContiBonusAperti] = useState(false);
  const [calLayout, setCalLayout] = useState(() => {
    try { return localStorage.getItem(KEY_CAL_LAYOUT) || 'grid'; } catch { return 'grid'; }
  });
  const handleSetLayout = useCallback((mode) => {
    setCalLayout(mode);
    try { localStorage.setItem(KEY_CAL_LAYOUT, mode); } catch { /* storage non disponibile: la scelta vale per questa sessione */ }
  }, []);
  const fileInputRef = useRef(null);
  const nameModalRef = useRef(null);
  const focusCellRef = useRef(null);

  // Porta sotto gli occhi il giorno arrivato da un'altra pagina. `block:
  // 'center'` e non 'nearest': su un mese lungo la cella può essere appena
  // fuori dallo schermo, e uno scroll minimo la lascerebbe sul bordo.
  useEffect(() => {
    if (!focusDate || !focusCellRef.current) return;
    focusCellRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusDate]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  // Monday-first offset
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = Math.ceil((firstOffset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstOffset + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  // Turni raggruppati per data e ordinati per ora di inizio: senza sort le pill
  // seguirebbero l'ordine di inserimento nell'oggetto, non quello cronologico.
  const byDate = useMemo(() => {
    const map = {};
    shifts.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    Object.values(map).forEach(list =>
      list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
    return map;
  }, [shifts]);

  // Monthly totals — sul mese di PAGA (vedi prop payrollShifts).
  const counted = payrollShifts || shifts;
  // Periodo di paga diverso dal mese di calendario: va detto, altrimenti le ore
  // non corrispondono ai turni visibili sulla griglia e sembrano sbagliate.
  const payrollRange = payrollShifts && payrollShifts !== shifts
    ? formatPayrollRange(year, month)
    : null;
  // Il toggle del periodo esiste solo dove i due periodi differiscono davvero.
  // Si guarda il CONTRATTO e non `payrollRange`, che diventa null appena si
  // sceglie il mese di calendario — e il comando sparirebbe subito dopo averlo
  // usato, senza modo di tornare indietro.
  const mensilizzato = !settings.onCall && isMensilizzato(settings);
  const periodoPaga = settings.periodoConteggio !== 'calendario';
  const totalMins = useMemo(
    () => counted.reduce((sum, s) => sum + calcShiftMinutes(s), 0),
    [counted],
  );
  const pay = useMemo(
    () => calcTotalPay(counted, settings, allShifts || counted, payByShift),
    [counted, settings, allShifts, payByShift],
  );

  // Giornate pagate senza turno del mese, contate dai turni e non da `pay`:
  // senza una paga oraria impostata `calcTotalPay` restituisce null, ma le ore
  // di ferie, malattia e festività esistono lo stesso e vanno mostrate.
  //
  // A schermo non si chiamano mai «assenze»: una festività, o un giorno di
  // ferie concordato, era previsto che non si lavorasse — chiamarlo assenza
  // suona come un buco da giustificare e confonde. Ogni voce compare col
  // proprio nome (ferie, permesso, malattia, festività), che è anche quello
  // che si legge in busta.
  const assenze = useMemo(() => {
    const per = new Map();
    let minuti = 0;
    let giorni = 0;
    for (const s of counted) {
      const t = tipoTurno(s);
      if (t === TIPO.LAVORO) continue;
      const m = calcShiftMinutes(s);
      const v = per.get(t) || { minuti: 0, giorni: 0 };
      v.minuti += m;
      v.giorni += 1;
      per.set(t, v);
      minuti += m;
      giorni += 1;
    }
    const voci = [...per.entries()];
    const dettaglio = voci
      .map(([t, v]) => `${formatMinutesShort(v.minuti)} di ${ETICHETTA[t].toLowerCase()}`)
      .join(' · ');
    // «3 giorni di ferie · 1 di festività»: la parola «giorni» una volta sola
    // — ripeterla a ogni voce fa filastrocca — ma il «di» resta su tutte,
    // altrimenti si legge «7 ferie». Il singolare va scritto (1 giorno):
    // con una voce sola è l'unico posto in cui si legge.
    const dettaglioGiorni = voci
      .map(([t, v], i) => {
        const nome = ETICHETTA[t].toLowerCase();
        const unita = i === 0 ? `${v.giorni === 1 ? 'giorno' : 'giorni'} ` : '';
        return `${v.giorni} ${unita}di ${nome}`;
      })
      .join(' · ');
    return { minuti, giorni, dettaglio, dettaglioGiorni };
  }, [counted]);

  // Competenze del mese nelle stesse voci del cedolino, così che le due colonne
  // si possano affiancare davvero. Il punto delicato è il lavoro oltre soglia: la
  // busta scrive quelle ore INTERE al 130% (6,50 h → 77,89 €), non il solo +30%
  // (17,98 €) che invece resterebbe fuori dalla base. Sotto la stessa parola
  // c'erano due grandezze diverse, e il confronto dava sempre torto all'app.
  //
  // È una riaffettatura di sola lettura degli stessi totali: le voci sommano a
  // `pay.total`, che resta il numero in cima.
  const competenze = useMemo(() => {
    if (!pay) return [];
    const otPct = Number(settings.overtimeSurchargePct) || 0;
    const extraPctRaw = settings.straordinarioSurchargePct;
    const extraPct = (extraPctRaw === '' || extraPctRaw == null) ? otPct : (Number(extraPctRaw) || 0);
    // Chi lavora a chiamata non ha una soglia part-time/full-time da
    // distinguere: resta un'unica fascia, chiamata straordinario come sempre.
    const tier1Label = settings.onCall ? 'Straordinario' : 'Supplementare';
    return [
      {
        // Ferie e permessi restano DENTRO questa riga: è così che li scrive la
        // busta (a luglio 2026 le ore «Retribuzione» sono 103,20 anche con
        // ferie godute nel periodo, senza una voce a parte). La malattia no:
        // in busta è una voce sua, quindi si sottrae qui e compare sotto.
        label: 'Retribuzione',
        value: pay.base - pay.overtimeBase - pay.straordinarioBase - pay.malattiaBase,
        minutes: totalMins - pay.overtimeMinutes - pay.straordinarioMinutes - pay.malattiaMinutes,
        nota: (pay.ferieMinutes > 0 || pay.permessoMinutes > 0) ? [
          pay.ferieMinutes > 0 ? `${formatMinutesShort(pay.ferieMinutes)} di ferie` : '',
          pay.permessoMinutes > 0 ? `${formatMinutesShort(pay.permessoMinutes)} di permesso` : '',
        ].filter(Boolean).join(' · ') : null,
      },
      {
        label: `${tier1Label} +${fmtPct(otPct)}%`, tag: 'overtime',
        value: pay.overtimeBase + pay.surchargeOvertime, minutes: pay.overtimeMinutes,
      },
      {
        label: `Straordinario +${fmtPct(extraPct)}%`, tag: 'overtime',
        value: pay.straordinarioBase + pay.surchargeStraordinario, minutes: pay.straordinarioMinutes,
      },
      { label: 'Malattia', value: pay.malattiaBase, minutes: pay.malattiaMinutes },
      { label: 'Magg. domenicali', value: pay.surchargeSunday },
      { label: 'Magg. festive', value: pay.surchargeHoliday },
      // Le ore, qui, sono quelle in FASCIA — non quelle del turno: è l'unico
      // modo per capire il numero, visto che la maggiorazione si paga solo su
      // quelle. Con il cumulo a «solo la più alta» l'importo può essere zero
      // pur essendoci ore notturne (le assorbe il domenicale), e va comunque
      // mostrato: sparire proprio lì lascerebbe il dubbio di un conto perso.
      {
        label: 'Magg. notturne', value: pay.surchargeNight,
        minutes: pay.nightMinutes,
      },
      { label: 'Magg. manuali', value: pay.surchargeManual },
      // La malattia può valere zero (carenza non pagata) ma le sue ORE esistono
      // e vanno mostrate: senza questa eccezione la riga sparirebbe proprio nei
      // giorni in cui serve di più capire dove sono finite le ore.
    ].filter(v => v.value >= 0.005 || v.minutes > 0);
  }, [pay, settings, totalMins]);

  // Festività del mese senza alcun turno segnato. Una festività non lavorata
  // viene pagata — in busta è un giustificativo a sé — ed è la cosa più facile
  // da dimenticare: sono undici giorni sparsi nell'anno, e chi non lavora quel
  // giorno non ha motivo di aprire l'app. Qui si PROPONE soltanto: chi è
  // mensilizzato o non ne ha diritto non tocca niente.
  const festivitaDaSegnare = useMemo(
    () => festivitaSenzaTurno(year, month, allShifts || shifts, settings),
    [year, month, allShifts, shifts, settings],
  );
  const oreFestivita = minutiGiornoAssenza(settings);

  // Bonus busta paga: quanto manca alla soglia.
  //
  // Si misura sulla PROIEZIONE dell'anno, non sul maturato. Le soglie del
  // trattamento integrativo valgono sul reddito dell'anno intero: calcolare il
  // margine su quanto si e' incassato finora annuncia uno spazio che non
  // esiste, perche' i mesi che restano arrivano comunque. Ad agosto, con
  // 10.000 incassati e la soglia a 16.600, il vecchio conto diceva «puoi
  // ancora guadagnare 6.600» mentre quattro stipendi se li mangiavano quasi
  // tutti. E' anche cio' che faceva dire numeri diversi a questa pagina e a
  // Statistiche, che la proiezione la usava gia'.
  const bonus = useMemo(
    () => calcBonusMargin(annualProjection || annualGross, settings),
    [annualProjection, annualGross, settings],
  );

  // Quanto rischia di dover RIDARE INDIETRO. E' la domanda che la gente si fa
  // davvero, e fino a settembre 2026 l'app non la sfiorava: sapeva dire se il
  // bonus spetta adesso, mai quanto costa scoprire a dicembre che non spettava.
  // Vedi utils/restituzione.js per il modello e per cosa l'app NON puo' sapere.
  const rischio = useMemo(
    () => rischioRestituzione({ settings, proiezioneAnnua: annualProjection || annualGross }),
    [settings, annualProjection, annualGross],
  );

  // LA FORMA DELLA BUCA attorno ai 15.000, e dove ci si trova dentro.
  // Costa una trentina di valutazioni del netto annuo, tutte per bisezione: si
  // memoizza sulle sole impostazioni perché non dipende dal mese guardato.
  const costo = useMemo(() => costoSoglia(settings), [settings]);
  const proiezione = annualProjection || annualGross;
  const posizione = useMemo(
    () => posizioneRispettoSoglia(proiezione, settings, costo),
    [proiezione, settings, costo],
  );
  const mancaPareggio = useMemo(
    () => mancaAlPareggio(proiezione, settings, costo),
    [proiezione, settings, costo],
  );
  const mancaOre = useMemo(() => margineInOre(mancaPareggio, settings), [mancaPareggio, settings]);

  // UNA spiegazione sola, riusata dai tre casi. Non più un tooltip: i conti
  // non ci stavano, e il punto da far capire — il bonus in busta torna
  // indietro se superi la soglia — ha bisogno dei conti per essere creduto.
  // Non chiamarlo «anticipo»: per chi lo riceve sono soldi del datore, e la
  // parola suona come un prestito.
  // Il popup lo apre chi tocca «perché?»: non interrompe nessuno.
  const spiegazione = (
    <button type="button" className="linklike" onClick={() => setContiBonusAperti(true)}>
      perché?
    </button>
  );
  const fmt0 = (n) => formatCurrency(Math.round(n));

  // Gli euro sul singolo turno sono un'OPZIONE, spenta di default: chi non
  // l'accende trova la griglia e l'agenda identiche a prima. Il totale del mese
  // ce l'ha comunque, nella barra in alto.
  const mostraEuro = !!settings.mostraEuroPerTurno;

  // Nella cella l'importo va SENZA decimali: `formatCurrency` scrive «55,00 €»
  // e in uno spazio da tre cifre quei due zeri sono rumore che allontana le
  // cifre che contano. La cifra esatta resta nel `title` e nell'agenda — è la
  // stessa distinzione che l'app fa già fra la griglia (colpo d'occhio) e
  // l'agenda (dettaglio).
  // `useGrouping: 'always'` non è un vezzo: in italiano il punto delle migliaia
  // parte da cinque cifre (16.600 sì, 1200 no), e in un riquadro che spiega un
  // conto «1200» accanto a «16.600» sembrano scritti da due mani diverse.
  // Fallback per le WebView vecchie, dove l'opzione non esiste.
  const numeroIt = (n) => {
    const v = Math.round(n);
    try {
      return new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 }).format(v);
    } catch {
      return v.toLocaleString('it-IT');
    }
  };
  const euroCella = (n) => `${numeroIt(n)} €`;

  // Quanto vale una giornata. `null` — non zero — quando la paga oraria manca o
  // non copre quei turni: uno «0 €» in cella sembrerebbe un turno non pagato,
  // che è una cosa diversa e falsa. `lordoTurno` sta in pay.js apposta, così
  // questa somma e il totale del riepilogo escono dalla stessa riga di codice
  // (riscontro: scripts/check-lordo-turno.mjs).
  const euroDelGiorno = useCallback((turni) => {
    if (!payByShift) return null;
    let somma = 0;
    let noti = 0;
    for (const s of turni) {
      const voce = payByShift[s.id];
      if (!voce || voce.missingRate) continue;
      somma += lordoTurno(voce);
      noti += 1;
    }
    return noti > 0 ? somma : null;
  }, [payByShift]);

  // Montante + confine automatico (granularità MESE): composizione del reddito e avviso.
  const montante = Number(settings.priorTaxableIncome) || 0;
  const priorDate = settings.priorIncomeDate || '';
  const priorMonth = priorDate.slice(0, 7); // 'YYYY-MM'
  const priorMonthLabel = priorMonth
    ? formatMonthYear(new Date(Number(priorMonth.slice(0, 4)), Number(priorMonth.slice(5, 7)) - 1, 1))
    : '';
  const shiftsCovered = useMemo(() => {
    if (!(montante > 0 && priorMonth && priorMonth.slice(0, 4) === String(year))) return 0;
    const covered = (allShifts || []).filter(
      s => s.date.slice(0, 4) === String(year) && s.date.slice(0, 7) <= priorMonth);
    // Contesto straordinari = tutti i turni (le settimane a cavallo d'anno
    // devono restare intere), come in App.annualGross.
    const p = calcTotalPay(covered, settings, allShifts || covered, payByShift);
    return p ? p.total : 0;
  }, [montante, priorMonth, year, allShifts, settings, payByShift]);
  const montanteMismatch = montante > 0 && shiftsCovered > 0
    && Math.abs(montante - shiftsCovered) > Math.max(500, 0.30 * shiftsCovered);

  // Netto stimato del mese (beta): calcolo estratto in useMonthlyNet per
  // leggibilità (logica invariata). Riceve pay del mese e reddito annuo.
  const {
    monthKey, perMonthBonus, fixedMonthlyTotal,
    netProjection, netBasis, extraThisMonth, monthGross,
    netMonth, monthNet, monthTrattenute, monthBonus, monthTfr,
    tiInfo, effectiveRatePct, addizionaliPct, showNetPanel: showNetPanelRaw,
    riferimento,
  } = useMonthlyNet({ year, month, settings, pay, annualGross, annualExtras, daysInMonth });
  // Senza nemmeno un turno segnato nel mese non c'è niente da stimare: voci
  // fisse mensili o mensilità aggiuntive maturate da sole (senza turni)
  // farebbero comunque comparire trattamento integrativo/cuneo, dando
  // l'impressione di un netto "inventato" per un mese ancora vuoto.
  const showNetPanel = showNetPanelRaw && counted.length > 0;

  // Quanto è "coperta" la proiezione dal maturato: i mesi dell'anno in cui ci
  // sono turni, contro quelli già trascorsi. Se chi usa l'app ha cominciato a
  // segnare i turni a metà anno, i mesi precedenti valgono zero e il reddito
  // annuo stimato esce molto più basso del vero — con effetti a cascata su
  // detrazioni, trattamento integrativo e indennità.
  const mesiTrascorsi = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  const mesiConTurni = useMemo(() => {
    const mesi = new Set();
    (allShifts || []).forEach(s => {
      if (s.date.slice(0, 4) === String(year)) mesi.add(s.date.slice(5, 7));
    });
    return mesi.size;
  }, [allShifts, year]);
  // Si avvisa solo quando la proiezione dipende DAVVERO dai soli turni: chi ha
  // già messo il montante o il reddito annuo a mano ha risolto, e un avviso in
  // quel caso sarebbe solo rumore.
  const proiezioneParziale = netProjection.source === 'maturato'
    && !(Number(settings.priorTaxableIncome) > 0)
    && !(Number(settings.annualGrossManual) > 0)
    && mesiConTurni > 0 && mesiConTurni < mesiTrascorsi;

  // Costante di build: il modulo gemini resta caricato pigramente (riga ~242).
  const hasImportAI = !!import.meta.env.VITE_AI_PROXY_URL;

  const closeNameModal = useCallback(() => { setPendingImportFile(null); setEditingName(false); setPickAfterName(false); }, []);
  useModalDismiss(nameModalRef, closeNameModal, !!pendingImportFile || editingName);

  // Bonus del mese: importo fisso (impostato una volta in Impostazioni),
  // spuntato mese per mese. `true` = preso questo mese; i valori numerici sono
  // il formato legacy di quando si digitava un importo diverso ogni volta.
  const monthlyBonusEntry = settings.monthlyBonus?.[monthKey];
  const bonusTakenThisMonth = !!monthlyBonusEntry;
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;


  async function runImport(file, name) {
    setImportLoading(true);
    setImportError(null);
    const meta = { named: !!name, imageBytes: file?.size ?? null, imageType: file?.type ?? null };
    try {
      // Client del proxy caricato on-demand: serve solo a chi importa da
      // immagine, non deve pesare sull'avvio (come services/export.js).
      const { parseShiftsFromImage } = await import('../services/gemini');
      const { shifts: parsed, usage } = await parseShiftsFromImage(file, name);
      setImportUsage(usage);
      setImportParsed(parsed);
      sendImportTelemetry({ ok: true, ...usage, shifts: parsed.length, ...meta });
    } catch (err) {
      setImportError(err.message || 'Errore durante l\'analisi dell\'immagine');
      sendImportTelemetry({ ok: false, error: String(err.message || err), ...meta });
    } finally {
      setImportLoading(false);
    }
  }

  // Avvio import dal pulsante: il nome è obbligatorio. Se manca, si chiede PRIMA
  // di aprire il selettore immagini (così non si carica nulla senza nome).
  function startImport() {
    // La prima volta si dice dove va la foto, PRIMA di sceglierla: è l'unico
    // momento in cui l'avvertenza può ancora cambiare la decisione. Dopo, il
    // file è già scelto e il messaggio diventa un ostacolo da scacciare.
    if (!accettatoInvioFoto()) { setMostraAvvisoFoto(true); return; }
    if (settings.workerName) { fileInputRef.current?.click(); return; }
    setNameInput('');
    setPickAfterName(true);
    setEditingName(true);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    // Sicurezza: senza nome non si importa (non dovrebbe accadere, startImport lo
    // chiede prima). Se capita, tieni il file in attesa e chiedi il nome.
    if (!settings.workerName) {
      setPendingImportFile(file);
      setNameInput('');
      return;
    }
    runImport(file, settings.workerName);
  }

  function handleNameSubmit() {
    const name = nameInput.trim();
    if (!name) return; // il nome è obbligatorio
    if (onUpdateSettings) onUpdateSettings({ workerName: name });
    const file = pendingImportFile;
    const pick = pickAfterName;
    setPendingImportFile(null);
    setEditingName(false);
    setPickAfterName(false);
    if (file) runImport(file, name);
    // Click SINCRONO, senza setTimeout: WebKit consuma l'indicatore di gesto
    // utente appena il click esce dal turno dell'evento, e su iOS Safari il
    // selettore immagini non si aprirebbe — in silenzio, proprio al primo
    // import. L'input vive fuori dalla modale (è nella barra import), quindi
    // è già montato: non serve aspettare il re-render.
    else if (pick) fileInputRef.current?.click();
  }

  function handleImportConfirm(parsedShifts) {
    onImportShifts(parsedShifts);
    setImportParsed(null);
  }

  function handleMonthBonusToggle(e) {
    if (!onUpdateSettings) return;
    const map = { ...(settings.monthlyBonus || {}) };
    if (e.target.checked) map[monthKey] = true;
    else delete map[monthKey];
    onUpdateSettings({ monthlyBonus: map });
  }

  async function handleExport(format) {
    setExportBusy(true);
    setExportError(null);
    try {
      // Scelta esplicita fra mese di calendario (come l'utente segna i turni,
      // default) e mese di paga a settimane intere (utile solo per confrontare
      // con la busta aziendale) — vedi selettore accanto ai pulsanti. Il
      // periodo finisce nel titolo del documento solo se non è il calendario.
      const exportShifts = exportPeriod === 'payroll' ? counted : shifts;
      const periodo = exportPeriod === 'payroll' ? (payrollRange || '') : '';
      if (format === 'xlsx') await exportShiftsExcel(exportShifts, currentMonth, periodo);
      else await exportShiftsPDF(exportShifts, currentMonth, periodo);
    } catch (e) {
      setExportError(e.message || 'Errore durante l\'esportazione');
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="calendar-view">
      {/* Month navigation & Layout toggle */}
      <div className="cal-header">
        <button
          className="week-nav-btn"
          onClick={() => onMonthChange(addMonths(currentMonth, -1))}
          aria-label="Mese precedente"
        >
          ‹
        </button>
        <div className="cal-header-center">
          <span className="cal-month-name">{formatMonthYear(currentMonth)}</span>
          {!isCurrentMonth(currentMonth) && (
            <button
              className="week-today-btn"
              onClick={() => onMonthChange(getMonthStart(new Date()))}
            >
              Oggi
            </button>
          )}
        </div>
        <div className="cal-header-right">
          <button
            className="week-nav-btn"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            aria-label="Mese successivo"
          >
            ›
          </button>
          <div className="cal-mode-toggle" role="group" aria-label="Modalità di visualizzazione">
            <button
              type="button"
              className={`cal-mode-btn ${calLayout === 'grid' ? 'active' : ''}`}
              onClick={() => handleSetLayout('grid')}
              title="Vista griglia mensile"
              aria-label="Vista griglia mensile"
              aria-pressed={calLayout === 'grid'}
            >
              ⊞
            </button>
            <button
              type="button"
              className={`cal-mode-btn ${calLayout === 'timeline' ? 'active' : ''}`}
              onClick={() => handleSetLayout('timeline')}
              title="Vista agenda"
              aria-label="Vista agenda"
              aria-pressed={calLayout === 'timeline'}
            >
              ≡
            </button>
          </div>
        </div>

        {/* IL NUMERO PER CUI SI APRE L'APP, dove lo si vede sempre.
            «Retribuzione stimata» esisteva già, ma sotto l'intera griglia: non
            era mai sullo schermo insieme al calendario, e in vista agenda
            finiva sotto trenta schede. Qui sta nella barra agganciata, quindi
            segue lo scorrimento e c'è mentre si segna un turno.
            Sotto resta il riepilogo completo, con le voci di busta: questa è la
            risposta, quello è il perché. */}
        {pay !== null && (
          <div className="cal-header-soldi">
            <span className="cal-header-soldi-val" title={`${formatCurrency(pay.total)} lordi in ${formatMonthYear(currentMonth)}`}>
              {euroCella(pay.total)}
            </span>
            <span className="cal-header-soldi-ore">{formatMinutesShort(totalMins)}</span>
            <span className="cal-header-soldi-eti">lordo stimato</span>
          </div>
        )}
      </div>

      {/* Import bar */}
      {hasImportAI && (
        <div className="import-bar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="btn-import"
            onClick={startImport}
            disabled={importLoading}
          >
            {importLoading ? '⏳ Analisi in corso…' : '📤 Importa turni da immagine'}
          </button>
          {settings.workerName && (
            <span className="import-asname">
              Importi i turni di <strong>{settings.workerName}</strong>{' '}
              <button
                type="button"
                className="linklike"
                onClick={() => { setNameInput(settings.workerName); setEditingName(true); }}
              >
                cambia
              </button>
            </span>
          )}
          {importError && <span className="import-error">{importError}</span>}
          {ENABLE_DEBUG && importUsage && (
            <div className="debug-usage">
              <span className="debug-usage-tag">🐛 DEBUG token</span>
              <span>prompt <strong>{importUsage.prompt ?? '—'}</strong></span>
              <span>output <strong>{importUsage.output ?? '—'}</strong></span>
              <span>thinking <strong>{importUsage.thinking ?? '—'}</strong></span>
              <span>totale <strong>{importUsage.total ?? '—'}</strong></span>
              <span className="debug-usage-meta">{importUsage.model} · {importUsage.finishReason || 'STOP'}</span>
            </div>
          )}
        </div>
      )}

      {/* Main shifts view: Timeline or Grid */}
      {calLayout === 'timeline' ? (
        <TimelineView
          daysInMonth={daysInMonth}
          year={year}
          month={month}
          byDate={byDate}
          onAddShift={onAddShift}
          onEditShift={onEditShift}
          settings={settings}
          focusDate={focusDate}
          // L'agenda non riceveva `payByShift`: sapeva le ore e non gli euro,
          // ed era l'unica vista dell'app a non avere in mano il numero che
          // l'utente cerca.
          payByShift={payByShift}
          mostraEuro={mostraEuro}
        />
      ) : (
        <div className="cal-grid">
          {DAY_HEADERS.map(d => (
            <div key={d} className="cal-day-header">{d}</div>
          ))}

          {cells.map((dayNum, i) => {
            if (!dayNum) return <div key={`e${i}`} className="cal-cell cal-cell--empty" />;

            const date = new Date(year, month, dayNum);
            const dateStr = formatDate(date);
            const dayShifts = byDate[dateStr] || [];
            const today = isToday(date);
            const weekend = isWeekend(date);

            // La cella è un contenitore cliccabile, non un pulsante: annidare
            // controlli dentro un role="button" è invalido e confonde gli screen
            // reader. I comandi veri sono i <button> qui dentro.
            return (
              <div
                key={dateStr}
                ref={dateStr === focusDate ? focusCellRef : null}
                className={[
                  'cal-cell',
                  today ? 'cal-cell--today' : '',
                  weekend ? 'cal-cell--weekend' : '',
                  dateStr === focusDate ? 'cal-cell--focus' : '',
                ].join(' ')}
                onClick={e => { if (e.target === e.currentTarget) onAddShift(dateStr); }}
              >
                <button
                  type="button"
                  className="cal-cell-add"
                  onClick={() => onAddShift(dateStr)}
                  aria-label={`Aggiungi turno il ${dayNum}/${month + 1}`}
                >
                  <span className={`cal-day-num${today ? ' cal-day-num--today' : ''}`}>
                    {dayNum}
                  </span>
                </button>
                <div className="cal-shifts">
                  {dayShifts.map(s => {
                    const t = tipoTurno(s);
                    // Un'assenza non ha un orario da mostrare: al suo posto va
                    // l'icona del tipo, che è l'informazione vera di quel giorno.
                    const assente = t !== TIPO.LAVORO;
                    const ore = calcShiftMinutes(s) / 60;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`cal-shift-pill${assente ? ` cal-shift-pill--${t}` : ''}`}
                        onClick={e => { e.stopPropagation(); onEditShift(s); }}
                        title={assente
                          ? `${ETICHETTA[t]} · ${ore} h${s.note ? ` | ${s.note}` : ''}`
                          : `${s.startTime}–${s.endTime}${s.note ? ` | ${s.note}` : ''}`}
                        aria-label={assente
                          ? `Modifica ${ETICHETTA[t].toLowerCase()} del ${dayNum}/${month + 1}`
                          : `Modifica turno ${s.startTime}–${s.endTime}`}
                      >
                        {assente ? ICONA[t] : s.startTime}
                      </button>
                    );
                  })}
                </div>
                {/* Le pill dicono solo l'ora di INIZIO: senza il totale, per
                    sapere quanto dura la giornata bisogna aprire i turni. Vale
                    anche con un turno solo — la durata non è scritta da nessuna
                    parte nella cella — e a maggior ragione con più turni, dove
                    andrebbe pure sommata a mente. */}
                {dayShifts.length > 0 && (
                  <span
                    className="cal-day-total"
                    title={dayShifts.length > 1
                      ? `${dayShifts.length} turni, ${formatMinutesShort(minutiDelGiorno(dayShifts))} in totale`
                      : `${formatMinutesShort(minutiDelGiorno(dayShifts))} in questa giornata`}
                  >
                    {formatMinutesShort(minutiDelGiorno(dayShifts))}
                  </span>
                )}
                {/* Quanto vale la giornata, se l'utente ha chiesto di vederlo.
                    Arrotondato all'euro: nella cella servono tre cifre che si
                    leggano di sfuggita, non il centesimo — quello sta
                    nell'agenda e nel riepilogo. Niente «0 €» quando manca la
                    paga oraria: uno zero sembrerebbe un turno non pagato invece
                    che un dato che non c'è. */}
                {mostraEuro && euroDelGiorno(dayShifts) !== null && (
                  <span
                    className="cal-day-euro"
                    title={`${formatCurrency(euroDelGiorno(dayShifts))} lordi in questa giornata`}
                  >
                    {euroCella(euroDelGiorno(dayShifts))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Monthly summary */}
      <div className="cal-summary">
        {/* Il periodo si dichiara PRIMA dei numeri, non in mezzo a una riga.
            Col mese di paga i conteggi arrivano oltre la fine del mese — agosto
            2026 si conta fino al 6 settembre — e senza dirlo in cima si legge
            «7 giorni di ferie» sotto un mese in cui se ne vede uno: gli altri
            sei sono nella settimana a cavallo. Vale già per le ore e per la
            retribuzione; le ferie, contandosi a giornate, lo rendono evidente.

            Il toggle compare solo sui CCNL mensilizzati: altrove i due periodi
            coincidono e sarebbe un comando che non cambia niente.

            CAMBIA anche il calcolo delle ore in più, non solo cosa si vede: la
            soglia è mensile, quindi spostare la finestra sposta quali ore ci
            finiscono dentro. Qui c'era scritto il contrario fino al 13
            settembre 2026, ed era già falso da quando `computePayByShift` ha
            imparato a raggruppare per mese di calendario.

            Il default è «calendario» perché lo ha deciso la busta di agosto
            2026: vedi DEFAULT_SETTINGS in App.jsx. */}
        {mensilizzato && ENABLE_MESE_PAGA && (
          <div className="periodo-testata">
            <span className="periodo-toggle">
              <button
                type="button"
                className={`periodo-btn${periodoPaga ? ' active' : ''}`}
                onClick={() => onUpdateSettings?.({ periodoConteggio: 'paga' })}
                aria-pressed={periodoPaga}
              >
                Mese di paga
              </button>
              <button
                type="button"
                className={`periodo-btn${periodoPaga ? '' : ' active'}`}
                onClick={() => onUpdateSettings?.({ periodoConteggio: 'calendario' })}
                aria-pressed={!periodoPaga}
              >
                Mese di calendario
              </button>
            </span>
            <em className="periodo-nota">
              {periodoPaga
                ? `Conteggi del periodo ${formatPayrollRange(year, month)}: settimane intere, come in busta`
                : `Conteggi del mese: dal 1 al ${daysInMonth} ${formatMonthYear(currentMonth).split(' ')[0].toLowerCase()}`}
            </em>
          </div>
        )}
        <div className="cal-summary-row">
          <div className="summary-item">
            <span className="summary-label">Turni</span>
            <span className="summary-value">{counted.length - assenze.giorni}</span>
            {assenze.giorni > 0 && (
              <span className="summary-sublabel">
                + {assenze.dettaglioGiorni}
              </span>
            )}
          </div>
          <div className="summary-item">
            {/* «Ore lavorate» deve contare SOLO il lavoro: sommarci ferie e
                malattia renderebbe falsa proprio l'etichetta. Le ore pagate
                senza turno contano eccome per la busta, e stanno nella riga
                sotto — visibili, col loro nome, ma non spacciate per lavoro. */}
            <span className="summary-label">Ore lavorate</span>
            <span className="summary-value">{formatMinutesShort(totalMins - assenze.minuti)}</span>
            {assenze.minuti > 0 && (
              <span className="summary-sublabel">
                + {assenze.dettaglio}
              </span>
            )}
            {festivitaDaSegnare.length > 0 && oreFestivita > 0 && onAddShifts && (
              <span className="summary-sublabel festivita-proposta">
                {festivitaDaSegnare.length === 1 ? 'Festivo' : 'Festivi'} senza turno:{' '}
                {festivitaDaSegnare.map(d => Number(d.slice(8))).join(', ')}
                {' '}{formatMonthYear(currentMonth).split(' ')[0].toLowerCase().slice(0, 3)}.
                <button
                  type="button"
                  className="linklike festivita-proposta-btn"
                  onClick={() => onAddShifts(giornateFestive(festivitaDaSegnare, oreFestivita))}
                >
                  Aggiungi
                </button>
              </span>
            )}
          </div>
          {pay !== null && (
            <div className="summary-item">
              <span className="summary-label">Retribuzione stimata</span>
              <span className="summary-value diff-positive">{formatCurrency(pay.total)}</span>
              {/* Con una sola voce la scomposizione ripeterebbe il totale. */}
              {competenze.length > 1 && competenze.map(v => (
                <span className="summary-sublabel" key={v.label}>
                  {v.tag === 'overtime' ? (
                    <span className="tooltip-wrap">
                      <button type="button" className="linklike" aria-describedby={`ot-tip-${v.label}`}>
                        {v.label}
                      </button>
                      <span className="tooltip-bubble" role="tooltip" id={`ot-tip-${v.label}`}>
                        Le ore di straordinari sono chiamate "supplementari" se non
                        superano quelle di un full-time.
                      </span>
                    </span>
                  ) : v.label}
                  {v.minutes > 0 && ` (${formatMinutesShort(v.minutes)})`}
                  {' '}{formatCurrency(v.value)}
                  {v.nota && <em className="summary-sublabel-nota"> di cui {v.nota}</em>}
                </span>
              ))}
              {pay.shiftsWithoutRate > 0 && (
                <span className="summary-sublabel summary-sublabel--warn">
                  ⚠️ {pay.shiftsWithoutRate} turn{pay.shiftsWithoutRate === 1 ? 'o conteggiato' : 'i conteggiati'} a 0 €:
                  nessuna paga oraria valida per quelle date
                </span>
              )}
            </div>
          )}
          {pay === null && (
            <div className="summary-item">
              <span className="summary-label">Retribuzione stimata</span>
              <button type="button" className="linklike" onClick={() => onNavigate?.('settings')}>
                Imposta la paga oraria →
              </button>
            </div>
          )}
        </div>

        {/* Il contratto, chiesto dove c'è un importo da qualificare.
            Non è una finestra: si legge, si sceglie o si lascia lì, e resta
            finché il contratto manca. È l'unico parametro che sbaglia verso
            l'ALTO — senza, il motore perde la mensilizzazione, il divisore
            orario e i contributi minori — quindi la cifra sta nel messaggio:
            «45 € in più del vero» si capisce, «configura il CCNL» no. */}
        {pay !== null && contrattoMancante(settings) && (
          <div className="contratto-avviso">
            <div className="contratto-avviso-testo">
              <strong>Senza contratto conto ~45 € in più del vero</strong>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('settings')}>
              Scegli il contratto
            </button>
          </div>
        )}


        {/* Netto stimato del mese — beta (gated dal feature flag) */}
        {showNetPanel && (
          <div className="net-strip">
            {/* Niente «Lordo del mese» in testa: è il totale della barra in alto,
                ripeterlo qui era una cifra in più da leggere. */}

            {monthlyBonusAmount > 0 && (
              <div className="month-bonus-row">
                <label className="check-row" htmlFor="month-bonus">
                  <input
                    id="month-bonus"
                    type="checkbox"
                    checked={bonusTakenThisMonth}
                    onChange={handleMonthBonusToggle}
                  />
                  <span>
                    Prenderò il bonus di {formatMonthYear(currentMonth)}
                    {' '}<strong>(+{fmt0(monthlyBonusAmount)})</strong>
                  </span>
                </label>
              </div>
            )}

            <div className="net-strip-body">
              <span className="bonus-strip-label">
                Netto stimato del mese <span className="beta-tag">beta</span>
              </span>
              <span className="net-strip-value">{fmt0(monthNet)}</span>
              <span className="bonus-strip-note">
                trattenute {fmt0(monthTrattenute)} ({effectiveRatePct.toFixed(1)}% del lordo)
                {monthBonus > 0 && <> · bonus +{fmt0(monthBonus)}</>}
                {monthTfr > 0 && <> · TFR +{fmt0(monthTfr)}</>}
              </span>
              {(extraThisMonth > 0 || fixedMonthlyTotal > 0 || perMonthBonus > 0) && (
                <span className="bonus-strip-note">
                  include {[
                    extraThisMonth > 0 && `${month === EXTRA_MONTHS.tredicesima ? '13ª' : '14ª'} +${fmt0(extraThisMonth)}`,
                    fixedMonthlyTotal > 0 && `voci fisse +${fmt0(fixedMonthlyTotal)}`,
                    perMonthBonus > 0 && `bonus +${fmt0(perMonthBonus)}`,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            <p className="net-disclaimer--prominent">
              ⚠️ Funzione beta: i calcoli possono contenere errori. Fai sempre controllare
              questi dati a un professionista prima di usarli.
            </p>

            <button
              type="button"
              className="net-toggle"
              onClick={() => setShowNetDetail(v => !v)}
              aria-expanded={showNetDetail}
            >
              {showNetDetail ? 'Nascondi dettaglio ▲' : 'Come è calcolato? ▼'}
            </button>

            {showNetDetail && (
              <div className="net-detail">
                {/* Stile busta paga: un solo lordo in cima */}
                <div className="net-line net-line--head">
                  <span>Lordo del mese</span><span>{fmt0(netMonth.gross)}</span>
                </div>

                <div className="net-group-label">Trattenute</div>
                {netMonth.contributiRighe.map(r => (
                  <div className="net-line net-line--ded" key={r.label}>
                    <span>{r.label} ({fmtPct(r.pct)}%)</span>
                    <span>−{fmt0(r.importo)}</span>
                  </div>
                ))}
                <div className="net-line net-line--info">
                  <span>Imponibile fiscale</span><span>{fmt0(netMonth.imponibile)}</span>
                </div>
                {netMonth.imponibileExtra > 0 && (
                  <div className="net-subnote">
                    di cui {fmt0(netMonth.imponibileExtra)} di mensilità aggiuntiva, tassata a parte
                    (aliquota {(netMonth.irpefExtra / netMonth.imponibileExtra * 100).toFixed(0)}%, senza detrazioni)
                  </div>
                )}

                {/* IRPEF come in busta paga: lorda, detrazioni, netta */}
                <div className="net-irpef-label">IRPEF</div>
                <div className="net-line net-line--calc">
                  <span>Lorda ({netMonth.imponibile > 0 ? (netMonth.irpefLorda / netMonth.imponibile * 100).toFixed(0) : 0}% dell'imponibile)</span>
                  <span>{fmt0(netMonth.irpefLorda)}</span>
                </div>
                {/* Si mostra la quota CAPIENTE: quando la detrazione supera
                    l'imposta il conto resta giusto lo stesso, ma «157 − 161 = 0»
                    si legge come uno sbaglio. In busta compare la parte capiente. */}
                <div className="net-line net-line--calc">
                  <span>− Detrazioni lavoro dip.</span><span className="pos">−{fmt0(netMonth.detrazioniApplicate)}</span>
                </div>
                {netMonth.detrazioni - netMonth.detrazioniApplicate > 0.5 && (
                  <div className="net-subnote">
                    ne spetterebbero {fmt0(netMonth.detrazioni)}, ma l'imposta del mese è più
                    bassa: la parte eccedente non si recupera qui
                  </div>
                )}
                <div className="net-line net-line--calc net-line--calc-strong">
                  <span>= Netta (trattenuta)</span><span>−{fmt0(netMonth.irpefNetta)}</span>
                </div>

                {(netMonth.addRegionale + netMonth.addComunale) > 0 && (
                  <div className="net-line net-line--ded">
                    <span className="tooltip-wrap">
                      <button type="button" className="linklike" aria-describedby="net-tip-add">Addizionali reg./com.</button>
                      <span className="tooltip-bubble" role="tooltip" id="net-tip-add">
                        Tasse locali (regione e comune) calcolate sul reddito imponibile,
                        trattenute ogni mese in busta.
                      </span>
                      {' '}({addizionaliPct}%)
                    </span>
                    <span>−{fmt0(netMonth.addRegionale + netMonth.addComunale)}</span>
                  </div>
                )}
                {netMonth.trattenuteFisse > 0 && (
                  <div className="net-line net-line--ded">
                    <span>Trattenute fisse</span>
                    <span>−{fmt0(netMonth.trattenuteFisse)}</span>
                  </div>
                )}
                <div className="net-line net-line--subtotal">
                  <span>Totale trattenute ({(netMonth.trattenute / netMonth.gross * 100).toFixed(1)}%)</span>
                  <span>−{fmt0(netMonth.trattenute)}</span>
                </div>

                {/* Competenze aggiuntive (quote mensili) */}
                {(netMonth.bonus > 0 || netMonth.tfr > 0) && (
                  <>
                    <div className="net-group-label">Competenze in busta (a parte)</div>
                    {netMonth.trattamentoIntegrativo > 0 && (
                      <div className="net-line net-line--bonus">
                        <span className="tooltip-wrap">
                          <button type="button" className="linklike" aria-describedby="net-tip-ti">Trattamento integrativo</button>
                          <span className="tooltip-bubble" role="tooltip" id="net-tip-ti">
                            Ex bonus Renzi: spetta con un reddito imponibile fino a 28.000
                            €/anno, se l'imposta dovuta supera le detrazioni.
                          </span>
                          {' '}(quota mese)
                        </span>
                        <span>+{fmt0(netMonth.trattamentoIntegrativo)}</span>
                      </div>
                    )}
                    {netMonth.bonusCuneo > 0 && (
                      <div className="net-line net-line--bonus">
                        <span className="tooltip-wrap">
                          <button type="button" className="linklike" aria-describedby="net-tip-cuneo">Indennità 207/2024</button>
                          <span className="tooltip-bubble" role="tooltip" id="net-tip-cuneo">
                            Sconto sui contributi (legge di bilancio 2025) per redditi fino
                            a 40.000 €/anno: aumenta il netto senza toccare il lordo.
                          </span>
                          {' '}({(netMonth.cuneoPct * 100).toFixed(1).replace('.', ',')}% dell'imponibile)
                        </span>
                        <span>+{fmt0(netMonth.bonusCuneo)}</span>
                      </div>
                    )}
                    {netMonth.tfr > 0 && (
                      <>
                        <div className="net-line net-line--bonus"><span>Anticipo TFR (quota mese)</span><span>+{fmt0(netMonth.tfr)}</span></div>
                        <div className="net-subnote">
                          lordo {fmt0(netMonth.tfrLordo)} − imposta separata ~{(netMonth.aliqTfr * 100).toFixed(0)}% {fmt0(netMonth.tfrImposta)}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* La decisione sul TI è MENSILE e segue quella del software
                    paghe. Va spiegata dove compare il numero, perché altrimenti
                    un bonus che sparisce da un mese all'altro sembra un
                    capriccio dell'app — e invece dipende da quanto si è
                    lavorato in quel mese. */}
                {netMonth?.esitoTi && (
                  <div className="net-subnote">
                    {netMonth.esitoTi.spetta ? (
                      <>
                        <strong>Trattamento integrativo incluso.</strong> Il tuo datore lo eroga
                        nei mesi in cui il lordo sta sotto i <strong>1.250 €</strong>: questo mese
                        sei a {fmt0(netMonth.esitoTi.baseMese)} €.
                      </>
                    ) : (
                      <>
                        <strong>Trattamento integrativo non incluso questo mese.</strong> Il tuo
                        datore lo toglie quando il lordo del mese supera i <strong>1.250 €</strong>
                        {' '}(qui {fmt0(netMonth.esitoTi.baseMese)} €): moltiplicato per dodici
                        supererebbe i 15.000 € oltre i quali non spetta. Se a fine anno hai
                        guadagnato meno, te lo restituisce il conguaglio di dicembre.
                      </>
                    )}
                  </div>
                )}
                {/* QUALE numero ha prodotto questo netto. Prima qui c'era
                    scritto «proiezione annua usata», e dal 14 settembre 2026 non
                    è più vero: il netto del mese esce dal lordo del mese × 12,
                    come fa il software paghe. La proiezione dell'anno resta
                    sotto, dove serve ancora — il bonus e il rischio di
                    restituzione sono domande annuali. Tenerle separate è l'unico
                    modo perché un utente possa ritrovare i propri numeri. */}
                <div className="net-subnote">
                  Questo netto esce da <strong>{fmt0(netMonth?.esitoTi?.baseMese ?? monthGross)} €</strong>
                  {' '}di lordo del mese: il tuo datore calcola tasse e bonus mese per mese,
                  moltiplicando per dodici quello che hai guadagnato.
                  {riferimento > 0 && netMonth?.esitoTi && !netMonth.esitoTi.spetta && (
                    <> Un mese pieno come questo ti colloca nella fascia sopra i 15.000, dove la
                    detrazione è più alta e il bonus non spetta.</>
                  )}
                  {' '}A dicembre il conguaglio rifà il conto sull'anno vero e rimette a posto
                  la differenza.
                </div>
                <div className="net-subnote">
                  Sull'anno, la stima è {fmt0(netBasis)} € lordi ({PROJECTION_LABEL[netProjection.source]}):
                  serve per il bonus e per il rischio di restituzione qui sotto, non per questo netto.
                  Puoi correggerla in Impostazioni.
                </div>
                {/* Proiezione costruita su pochi mesi di turni: i mesi dell'anno
                    senza turni inseriti contano come ZERO e schiacciano la stima
                    verso il basso. È il modo più facile di farsi negare il
                    trattamento integrativo per una finta incapienza, quindi va
                    detto qui, accanto al numero che lo causa. */}
                {proiezioneParziale && (
                  <div className="net-subnote net-subnote--warn">
                    ⚠️ La stima usa solo i turni inseriti, e nel {year} ne hai in {mesiConTurni}{' '}
                    mes{mesiConTurni === 1 ? 'e' : 'i'} su {mesiTrascorsi}: i mesi vuoti contano come
                    zero e abbassano il reddito annuo stimato. Se hai lavorato anche prima, in
                    Impostazioni metti il <strong>reddito annuo previsto</strong> o il{' '}
                    <strong>montante già maturato</strong> — da quel numero dipendono detrazioni,
                    trattamento integrativo e indennità.
                  </div>
                )}

                <div className="net-line net-line--total"><span>Netto del mese</span><span>{fmt0(netMonth.net)}</span></div>
                <p className="net-disclaimer">
                  Stima indicativa (fiscalità 2026). Le trattenute sono quelle vere della busta paga
                  (contributi + IRPEF netta + addizionali). Il trattamento integrativo (€1.200/anno)
                  è rapportato ai giorni del mese (÷365); l'Indennità 207/2024 è la percentuale di
                  fascia sull'imponibile del mese.
                  {netMonth.tfr > 0 && ` L'anticipo TFR è ~6,91% del lordo, tassato a parte (tassazione separata ~${(netMonth.aliqTfr * 100).toFixed(0)}%, stima).`}
                  {' '}Non sostituisce la busta paga né il conguaglio.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Trattamento integrativo (ex bonus Renzi): riga minima sempre visibile, con
            dettaglio (soglie, importi) aperto solo se rilevante — vicino o
            oltre soglia — oppure a richiesta per chi vuole controllare. */}
        {bonus.status !== BONUS_STATUS.ATTESA && (
          <div className="bonus-strip">
            <div className="bonus-strip-head">
              <span className="bonus-strip-title">💶 Trattamento integrativo (ex bonus Renzi)</span>
            </div>

            {/* TRE CASI, NON QUATTRO INTENSITÀ DELLO STESSO ALLARME.
                Prima qui si gridava «devi restituire ~805 €» a chiunque avesse
                passato i 15.000 — anche a chi li aveva passati da un pezzo e
                non ci stava più perdendo niente. Quel numero è vero come colpo
                di cassa e falso come perdita: il bonus che sparisce (−1.200) se
                lo riprende quasi tutto la detrazione che sale da 1.955 a 3.100.
                Quello che resta scoperto sono ~130 € l'anno, e solo per i primi
                ~200 € di lordo oltre la soglia (`costoSoglia`).

                Da lì i tre messaggi: quanto margine resta (SOTTO), quanto manca
                per tornare in pari (DENTRO — l'unico caso in cui la risposta è
                «guadagna di più», ed è l'unico azionabile), niente da temere
                (OLTRE). La cassa resta detta, ma come cassa. */}
            {rischio.causa === CAUSA.RINUNCIATO ? (
              <span className="bonus-strip-note">
                {/* Deve dire PERCHÉ il riquadro è sparito: la casella sta a un
                    dito da «perché?», e una spunta per sbaglio lasciava solo
                    questa riga, senza far capire di averla causata. */}
                Hai segnato il bonus come sospeso: niente da restituire.{' '}
                <button
                  type="button"
                  className="linklike"
                  onClick={() => onUpdateSettings({ noTrattamentoIntegrativo: false })}
                >
                  Annulla
                </button>
              </span>
            ) : posizione === POSIZIONE.OLTRE ? (
              // Il rischio vero qui non è perdere soldi, è averli già spesi:
              // chi non sa del conguaglio tratta il bonus in busta come
              // stipendio. Per questo il titolo dice cosa FARE, non uno stato.
              <div className={`bonus-rischio ${rischio.daRestituire > 0 ? 'bonus-rischio--anteprima' : 'bonus-rischio--ok'}`}>
                <span className="bonus-rischio-titolo">
                  {rischio.daRestituire > 0 ? '⚠️ Non spendere il bonus in busta' : '✓ Oltre la soglia, niente da restituire'}
                </span>
                {rischio.daRestituire > 0 && (
                  <>
                    {/* A frasi, come il popup: «Lo restituisci 845 €» accanto a
                        «Torni in pari con 119 €» faceva credere che guadagnando
                        di più la restituzione sparisse. Non dipende da quanto
                        sopra si va: si restituisce tutto quello già preso. */}
                    <p className="bonus-spiega">
                      Supererai i 15.000 €, quindi a dicembre il datore si riprende tutto il
                      bonus che ti ha dato: finora <strong>{euroCella(rischio.daRestituire)}</strong>
                      {rischio.rateizzabile ? ', a rate' : ''}.
                    </p>
                    <p className="bonus-spiega">
                      In compenso paghi meno tasse, e non ci perdi niente. {spiegazione}
                    </p>
                    <label className="check-row bonus-rischio-scelta">
                      <input
                        type="checkbox"
                        checked={!!settings.noTrattamentoIntegrativo}
                        onChange={(e) => onUpdateSettings({ noTrattamentoIntegrativo: e.target.checked })}
                      />
                      <span>Chiedi al datore di sospenderlo, poi spunta qui</span>
                    </label>
                  </>
                )}
              </div>
            ) : posizione === POSIZIONE.DENTRO ? (
              <div className="bonus-rischio">
                <span className="bonus-rischio-titolo">⚠️ Non spendere il bonus in busta</span>
                {rischio.daRestituire > 0 && (
                  <p className="bonus-spiega">
                    Supererai i 15.000 €, quindi a dicembre il datore si riprende tutto il
                    bonus che ti ha dato: finora <strong>{euroCella(rischio.daRestituire)}</strong>.
                  </p>
                )}
                <p className="bonus-spiega">
                  Paghi meno tasse, ma non abbastanza: sull'anno ci perdi {euroCella(costo.perditaMax)}.
                  Con altri <strong>{euroCella(mancaPareggio)}</strong>
                  {mancaOre !== null && ` (~${mancaOre} h)`} torni in pari, ma il bonus
                  lo restituisci comunque. {spiegazione}
                </p>
                {rischio.daRestituire > 0 && (
                  <label className="check-row bonus-rischio-scelta">
                    <input
                      type="checkbox"
                      checked={!!settings.noTrattamentoIntegrativo}
                      onChange={(e) => onUpdateSettings({ noTrattamentoIntegrativo: e.target.checked })}
                    />
                    <span>Chiedi al datore di sospenderlo, poi spunta qui</span>
                  </label>
                )}
              </div>
            ) : bonus.status === BONUS_STATUS.PIENO && bonus.nearThreshold ? (
              <div className="bonus-rischio bonus-rischio--anteprima">
                {/* Il margine nel titolo, perché è la cosa su cui si decide; le
                    ore sotto, perché è l'unità in cui si ragiona davvero — «2.400
                    €» va diviso a mente per una paga oraria che nemmeno è quella
                    base, visto che le ore in più sono maggiorate. */}
                <span className="bonus-rischio-titolo">
                  ⚠️ Ancora {euroCella(bonus.marginToFull)}
                  {bonus.oreResidue !== null && <> (~{bonus.oreResidue} h)</>} e superi i 15.000 €
                </span>
                <p className="bonus-spiega">
                  Se li superi, a dicembre il datore si riprende tutto il bonus che ti ha
                  dato: finora <strong>{euroCella(quotaPotenziale())}</strong>. {spiegazione}
                </p>
                <label className="check-row bonus-rischio-scelta">
                  <input
                    type="checkbox"
                    checked={!!settings.noTrattamentoIntegrativo}
                    onChange={(e) => onUpdateSettings({ noTrattamentoIntegrativo: e.target.checked })}
                  />
                  <span>Chiedi al datore di sospenderlo, poi spunta qui</span>
                </label>
              </div>
            ) : (
              <span className="bonus-strip-note">
                {bonus.status === BONUS_STATUS.PIENO && bonus.marginToFull > 0 && (
                  <>
                    Margine prima della soglia: <strong>{euroCella(bonus.marginToFull)}</strong>
                    {bonus.oreResidue !== null && <> (~{bonus.oreResidue} h)</>}
                  </>
                )}
                {bonus.status === BONUS_STATUS.PARZIALE && 'Sei oltre la soglia del bonus.'}
                {bonus.status === BONUS_STATUS.OLTRE && '🚨 Oltre i 28.000 €: il bonus non spetta.'}
              </span>
            )}

            {/* Una riga fissa al posto di «Dettagli ▼»: previsto e maturato
                stanno insieme, e la soglia dei 28.000 la dice già il caso OLTRE. */}
            {/* La scomposizione appartiene al MATURATO, non alla proiezione:
                sottrarre montante ed extra da un numero proiettato darebbe una
                voce «turni» che non corrisponde a nessun turno inserito. Il
                margine non si ripete qui: lo dice già il riquadro sopra. */}
            <span className="bonus-strip-income">
              Previsto a fine anno <strong>{euroCella(bonus.income)}</strong>
              {' · '}maturato {euroCella(annualGross)}
              {montante > 0 && ` (montante ${euroCella(montante)})`}
            </span>
            {montanteMismatch && (
              <span className="bonus-strip-note bonus-strip-note--warn">
                ⚠️ Il montante ({fmt0(montante)}) non torna coi turni fino a {priorMonthLabel} ({fmt0(shiftsCovered)}).
              </span>
            )}
          </div>
        )}

        {/* ESPORTA IN FONDO, e non è una rifinitura: stava incastrato FRA il
            lordo e il netto, cioè in mezzo a un ragionamento sui soldi che
            andava letto di fila — lordo, netto, bonus. Due pulsanti di
            esportazione nel mezzo spezzavano la lettura proprio dove serviva
            continuità. Esportare è quello che si fa DOPO aver guardato i conti,
            quindi sta dopo. */}
        {/* Esporta i turni del mese */}
        <div className="export-bar">
          <span className="export-label">Esporta il mese:</span>
          {/* Anche l'export segue il flag: offrire di esportare una finestra
              che l'app non conta più sarebbe un comando che produce un foglio
              diverso dai numeri appena letti a schermo. */}
          {ENABLE_MESE_PAGA && payrollRange && (
            <select
              className="export-period-select"
              value={exportPeriod}
              onChange={e => setExportPeriod(e.target.value)}
              aria-label="Periodo da esportare"
            >
              <option value="calendar">Mese di calendario</option>
              <option value="payroll">Mese di paga ({payrollRange})</option>
            </select>
          )}
          <button
            type="button"
            className="btn-export"
            disabled={(exportPeriod === 'payroll' ? counted : shifts).length === 0 || exportBusy}
            onClick={() => handleExport('xlsx')}
          >
            📊 Excel
          </button>
          <button
            type="button"
            className="btn-export"
            disabled={(exportPeriod === 'payroll' ? counted : shifts).length === 0 || exportBusy}
            onClick={() => handleExport('pdf')}
          >
            📄 PDF
          </button>
        </div>
        {exportError && <p className="import-error">{exportError}</p>}

        {/* Il riepilogo AI del mese è stato rimosso insieme a services/ai.js:
            teneva due chiavi API in chiaro nel sorgente. Per riproporlo, la
            generazione va nel proxy (worker/), come l'import da immagine. */}
      </div>

      {importParsed && (
        <ImportModal
          shifts={importParsed}
          workerName={settings.workerName}
          onConfirm={handleImportConfirm}
          onClose={() => setImportParsed(null)}
        />
      )}

      {/* I CONTI DELLA SOGLIA, per chi tocca «perché?». Il pericolo da
          togliere è uno solo: considerare i ~100 € al mese già spesi.
          «Meno tasse e altre voci» non si scompone in detrazione (+1.145) e
          indennità 207/2024 (−~70): a schermo basta la somma, che esce dal
          motore (`costoSoglia`) e non da costanti scritte qui. */}
      {contiBonusAperti && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setContiBonusAperti(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Come funziona il bonus">
            <div className="modal-header">
              <h2 className="modal-title">Come funziona il bonus</h2>
            </div>
            <div className="modal-form conti-bonus">
              <p className="form-hint">
                Il bonus spetta a chi sta sotto i 15.000 €. Se li superi, anche di 1 €, a
                dicembre il datore si riprende
                tutto: {euroCella(rischio.erogato || quotaPotenziale())} finora.
              </p>
              {/* La tabella è un'ALTRA grandezza rispetto alla cifra qui sopra:
                  quella è cassa, questa è il saldo di un anno intero. Senza
                  questa riga i due numeri sembrano lo stesso conto fatto male.
                  Le righe stanno in un blocco loro per stringere gli spazi:
                  il popup deve stare in uno schermo senza scorrere. */}
              {/* L'intestazione dice RISPETTO A COSA, altrimenti «ci perdi
                  129 €» è un confronto con un termine che non si vede. */}
              <div className="net-group-label">Rispetto a restare sotto i 15.000, in un anno</div>
              <div className="conti-bonus-righe">
                <div className="bonus-cifre">
                  <span>Bonus che non ti spetta più</span>
                  <strong>{euroCella(costo.voci.bonus)}</strong>
                </div>
                <div className="bonus-cifre">
                  <span>Tasse in meno: la detrazione sale
                    da {numeroIt(costo.voci.detrazioneSotto)} a {euroCella(costo.voci.detrazioneSopra)}</span>
                  <strong>+{euroCella(costo.voci.tasse)}</strong>
                </div>
                {/* Il nome che la voce ha IN BUSTA («Indennit L.207/24» sui
                    cedolini letti): «sconto sui contributi» spiegava cos'è ma
                    non si poteva cercare sul cedolino, che è ciò che uno fa. */}
                <div className="bonus-cifre">
                  <span>Indennità L. 207/24, che cala</span>
                  <strong>{euroCella(costo.voci.indennita + costo.voci.altro)}</strong>
                </div>
                <div className="bonus-cifre bonus-cifre--totale">
                  <span><strong>Ci perdi</strong></span>
                  <strong>{euroCella(-costo.perditaMax)}</strong>
                </div>
              </div>
              {/* LA FASCIA MORTA, non la curva. Le versioni prima dicevano «il
                  netto torna quello di prima della soglia» e «li ritrovi solo
                  a X»: descrivevano il grafico, con un confronto controfattuale
                  («se ti fossi fermato») che nessuno si fa. La domanda vera è
                  «mi conviene lavorare di più?», e la risposta è che per due
                  soli centoni la risposta è no, dopo torna sì. */}
              {costo.larghezzaBuca > 0 && (
                <p className="form-hint">
                  Ma solo qui in mezzo: fra {euroCella(costo.tetto)}
                  {' '}e {euroCella(costo.pareggio)} lordi l'anno il netto non cresce.
                  Sopra, riprende a salire.
                </p>
              )}
              <p className="form-hint form-hint--warn">
                Con due datori ti riprendono di più.
              </p>
              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={() => setContiBonusAperti(false)}>
                  Ho capito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostraAvvisoFoto && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMostraAvvisoFoto(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Prima di inviare la foto">
            <div className="modal-header">
              <h2 className="modal-title">Prima di inviare la foto</h2>
            </div>
            <div className="modal-form">
              <p className="form-hint">
                Per leggere i turni, la foto viene inviata a un servizio di riconoscimento
                di <strong>Google</strong>, passando da un server intermedio di chi sviluppa
                l'app. Non viene conservata da nessuno dei due.
              </p>
              <p className="form-hint form-hint--warn">
                ⚠️ Se il foglio contiene i <strong>nomi dei tuoi colleghi</strong>, partono
                anche quelli — e loro non hanno scelto nulla. Puoi ritagliare la foto sulla
                tua riga prima di caricarla.
              </p>
              <p className="form-hint">
                Tutto il resto — turni, orari, paga — resta sul tuo telefono e non viene
                inviato mai. Questo avviso compare una volta sola.
              </p>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostraAvvisoFoto(false)}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    accettaInvioFoto();
                    setMostraAvvisoFoto(false);
                    startImport();
                  }}
                >
                  Ho capito, scegli la foto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pulsante rapido flottante: solo in vista agenda/timeline */}
      {calLayout === 'timeline' && (
        <button
          type="button"
          className="cal-floating-add-btn"
          onClick={() => onAddShift(focusDate || formatDate(new Date()))}
          aria-label="Aggiungi turno"
        >
          <span className="cal-floating-add-icon" aria-hidden="true">+</span>
          <span className="cal-floating-add-text">Aggiungi turno</span>
        </button>
      )}

      {(pendingImportFile || editingName) && (
        <div className="modal-overlay" onClick={closeNameModal}>
          <div
            ref={nameModalRef}
            className="modal name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Il tuo nome sul foglio"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="modal-title">Il tuo nome sul foglio</h2>
            <p className="modal-desc">
              Il foglio turni può contenere più persone. Il tuo nome è <strong>obbligatorio</strong>:
              serve all'AI per estrarre solo i tuoi turni ed evitare elaborazioni (e costi) inutili.
              Lo salviamo e potrai cambiarlo quando vuoi dal pulsante di import.
            </p>
            <input
              type="text"
              className="form-input"
              placeholder="Es. Mario Rossi"
              value={nameInput}
              autoFocus
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNameSubmit(); }}
            />
            <div className="name-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeNameModal}>
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNameSubmit}
                disabled={!nameInput.trim()}
              >
                {(pendingImportFile || pickAfterName) ? 'Salva e continua' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
