import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';
import {
  formatDate, formatMonthYear, isToday, isWeekend,
  addMonths, getMonthStart, getDaysInMonth, isCurrentMonth, formatPayrollRange,
} from '../utils/dates';
import { calcShiftMinutes, calcTotalPay, formatCurrency, lordoTurno } from '../motore/pay';
import { TIPO, ETICHETTA, tipoTurno } from '../motore/assenze';
import Icona, { ICONA_TIPO } from './Icona';
import { isMensilizzato } from '../motore/ccnl';
import { calcBonusMargin, BONUS_STATUS, margineInOre } from '../motore/bonus';
import { rischioRestituzione, quotaPotenziale, dataDiRiferimento, costoSoglia, posizioneRispettoSoglia, mancaAlPareggio, POSIZIONE, confrontoConSoglia } from '../motore/restituzione';
import { festivitaSenzaTurno, giornateFestive } from '../utils/festivita-non-lavorate';
import { contrattoMancante } from '../utils/configurazione';
import { ENABLE_MESE_PAGA } from '../config/features';
import { accettatoInvioFoto, accettaInvioFoto } from '../services/gemini';
import { minutiGiornoAssenza } from '../motore/assenze';
import { EXTRA_MONTHS, projectAnnualIncome } from '../motore/net';
import { ENABLE_NET_CALC } from '../config/features';
import useMonthlyNet from '../hooks/useMonthlyNet';

// Aliquota contributiva: fino a 3 decimali, senza zeri inutili in coda
// (9,19% e 0,267%, non 9,190% né 0,300%).
const fmtPct = (pct) => String(Number(pct.toFixed(3))).replace('.', ',');

// Da dove arriva il reddito annuo di riferimento, per dirlo all'utente.
const PROJECTION_LABEL = {
  // 'previsione' è il caso normale; gli altri tre rispondono a domande diverse (projectAnnualIncome).
  previsione: 'da quanto hai segnato più i mesi che restano',
  contratto: 'da contratto',
  maturato: 'dal maturato annualizzato',
  manuale: 'inserita a mano',
};
import { exportShiftsExcel, exportShiftsPDF } from '../services/export';
import ImportModal from './ImportModal';
import ImportTesto from './ImportTesto';
import CifraCheCambia from './CifraCheCambia';
import FlussoOre from './FlussoOre';
import { flussoOre } from '../motore/flusso-ore';
import DebugUso from './DebugUso';
import TimelineView from './TimelineView';
import ShareWeekModal from './ShareWeekModal';
import useOccupato from '../hooks/useOccupato';
import useOggi from '../hooks/useOggi';
import useSfoglio from '../hooks/useSfoglio';
import { KEY_CAL_LAYOUT } from '../services/backup';

import { intervalloCella } from '../utils/orario-cella';
import { stimaConguaglio } from '../motore/conguaglio';
import { numeroIt, euroCella, scriviForchetta } from '../utils/formato';
import { PopupMese, PopupConguaglio, PopupSoglia } from './PopupFiscali';
import RiquadroTI from './RiquadroTI';
import NetPillole, { PillolaPremio } from './NetPillole';
import { confrontoMontante } from '../utils/confronto-montante';
import { lordoMeseMinimoTi } from '../motore/soglia-lorda';
import { tipoDiErrore, TITOLO_ERRORE } from '../utils/errore-import';

// La forchetta a dieci euro: una cifra al centesimo prometterebbe una
// precisione che la stima non ha.

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// I minuti non sono sempre interi (24 × 4,3 = 103,19999…): senza arrotondare uscirebbe
// «6h 30.00000000000091m».
function formatMinutesShort(mins) {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Ore di una giornata, assenze comprese: è il totale che quel giorno vale in
// busta, non le sole ore lavorate.
const minutiDelGiorno = (turni) => turni.reduce((somma, s) => somma + calcShiftMinutes(s), 0);

// «18–23³⁰»: inizio E fine del turno, nel formato corto di utils/orario-cella.js.
function Ora({ p }) {
  return <>{p.ore}{p.minuti && <sup className="cal-ora-min">{p.minuti}</sup>}</>;
}
function IntervalloCella({ s }) {
  const { inizio, fine } = intervalloCella(s.startTime, s.endTime);
  return <><Ora p={inizio} />{fine && <>–<Ora p={fine} /></>}</>;
}

export default function CalendarView({
  currentMonth,
  onMonthChange,
  shifts,
  // Turni del mese di PAGA: coincidono con `shifts` salvo contratti mensilizzati. La griglia
  // resta sul mese di calendario, i totali si contano su questi.
  payrollShifts,
  onAddShift,
  onEditShift,
  onImportShifts,
  // Più giornate in una scrittura sola, per la proposta delle festività non lavorate.
  onAddShifts,
  settings,
  onUpdateSettings,
  allShifts,
  payByShift,
  annualGross,
  // Reddito dell'anno PROIETTATO a dicembre: la grandezza su cui valgono le soglie del bonus.
  annualProjection = 0,
  annualExtras = 0,
  onNavigate,
  // Giorno da evidenziare arrivando da un'altra pagina: la cella si illumina e ci si scorre sopra.
  focusDate = null,
}) {
  const [importParsed, setImportParsed] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [showNetDetail, setShowNetDetail] = useState(false);
  const [showNetBusta, setShowNetBusta] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [nameInput, setNameInput] = useState('');
  // Modifica del nome fuori dall'import (nessun file in attesa): riusa la stessa modale.
  const [editingName, setEditingName] = useState(false);
  // Quando la modale del nome è aperta per importare: dopo il salvataggio si apre il
  // selettore immagini. Il nome è OBBLIGATORIO prima di caricare una foto.
  const [pickAfterName, setPickAfterName] = useState(false);
  const [importUsage, setImportUsage] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Un import da foto in corso tiene occupata l'app (richiesta già pagata, turni non ancora
  // confermati): l'aggiornamento aspetta. Vedi utils/occupato.js.
  useOccupato('import', importLoading || !!pendingImportFile || !!importParsed);
  // Default al mese di CALENDARIO: chi segna i turni pensa in mesi solari.
  const [exportPeriod, setExportPeriod] = useState('calendar');
  // Avvertenza sull'invio della foto: mostrata una volta sola, ricordata nel
  // browser. Vedi `accettatoInvioFoto` in services/gemini.js.
  const [mostraAvvisoFoto, setMostraAvvisoFoto] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [contiBonusAperti, setContiBonusAperti] = useState(false);
  const [conguaglioAperto, setConguaglioAperto] = useState(false);
  const [meseSpiegato, setMeseSpiegato] = useState(false);
  // Il bonus dei mesi del montante copiato dalle buste: campo facoltativo nel
  // popup, scritto in `settings` solo quando si lascia il campo.
  const [busteBozza, setBusteBozza] = useState({});
  const [calLayout, setCalLayout] = useState(() => {
    try { return localStorage.getItem(KEY_CAL_LAYOUT) || 'grid'; } catch { return 'grid'; }
  });
  const handleSetLayout = useCallback((mode) => {
    setCalLayout(mode);
    try { localStorage.setItem(KEY_CAL_LAYOUT, mode); } catch { /* storage non disponibile: la scelta vale per questa sessione */ }
  }, []);
  const fileInputRef = useRef(null);
  const nameModalRef = useRef(null);
  // Anche queste due finestre si chiudono con Esc e tengono il Tab dentro.
  const avvisoFotoRef = useRef(null);
  useModalDismiss(avvisoFotoRef, () => setMostraAvvisoFoto(false), mostraAvvisoFoto);
  const focusCellRef = useRef(null);

  // Porta sotto gli occhi il giorno arrivato da un'altra pagina. `block: 'center'` e non
  // 'nearest': su un mese lungo la cella può restare sul bordo.
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

  // Turni raggruppati per data e ordinati per ora di inizio (non per inserimento).
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
  // Periodo di paga diverso dal mese di calendario: va detto, o le ore sembrano sbagliate.
  const payrollRange = payrollShifts && payrollShifts !== shifts
    ? formatPayrollRange(year, month)
    : null;
  // Il toggle del periodo esiste solo dove i due periodi differiscono. Si guarda il CONTRATTO
  // e non `payrollRange`, che diventa null col mese di calendario (il comando sparirebbe subito).
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

  // Giornate pagate senza turno del mese, contate dai turni e non da `pay` (senza paga oraria
  // `calcTotalPay` è null, ma le ore esistono). A schermo non si chiamano «assenze»: ogni voce
  // ha il suo nome (ferie, permesso, malattia, festività), come in busta.
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
    // «3 giorni di ferie · 1 di festività»: «giorni» una volta sola, il «di» su tutte, il
    // singolare scritto (1 giorno).
    const dettaglioGiorni = voci
      .map(([t, v], i) => {
        const nome = ETICHETTA[t].toLowerCase();
        const unita = i === 0 ? `${v.giorni === 1 ? 'giorno' : 'giorni'} ` : '';
        return `${v.giorni} ${unita}di ${nome}`;
      })
      .join(' · ');
    return { minuti, giorni, dettaglio, dettaglioGiorni };
  }, [counted]);

  // Competenze del mese nelle stesse voci del cedolino, per affiancare le due colonne. Le ore
  // oltre soglia la busta le scrive INTERE al 130%. Sono le voci di `flussoOre`, le stesse di
  // «Dove vanno le ore»: due conti diversi davano «Retribuzione 117h 30m» qui e 103,2 h là.
  const competenze = useMemo(() => {
    if (!pay || !payByShift) return [];
    const otPct = Number(settings.overtimeSurchargePct) || 0;
    const extraPctRaw = settings.straordinarioSurchargePct;
    const extraPct = (extraPctRaw === '' || extraPctRaw == null) ? otPct : (Number(extraPctRaw) || 0);
    const ore = (h) => `${String(Number(h) || 0).replace('.', ',')} h`;
    const f = flussoOre(counted, payByShift, settings);
    const voce = {
      // Ferie e permessi restano DENTRO la retribuzione, come li scrive la busta.
      retribuzione: { label: 'Retribuzione', nota: [pay.ferieMinutes > 0 && `${formatMinutesShort(pay.ferieMinutes)} di ferie`,
        pay.permessoMinutes > 0 && `${formatMinutesShort(pay.permessoMinutes)} di permesso`].filter(Boolean).join(' · ') || null },
      // A chiamata non c'è soglia part-time/full-time: una fascia, lo straordinario.
      supplementare: { label: `${settings.onCall ? 'Straordinario' : 'Supplementare'} +${fmtPct(otPct)}%`, tag: 'overtime',
        tip: settings.onCall ? `Ore oltre le ${ore(settings.dailyOvertimeThreshold)} della giornata.`
          : `Ore oltre le ${ore(settings.expectedWeeklyHours)} settimanali del contratto, fino a ${ore(settings.fullTimeWeeklyHours)}.` },
      straordinario: { label: `Straordinario +${fmtPct(extraPct)}%`, tag: 'overtime', tip: `Ore oltre le ${ore(settings.fullTimeWeeklyHours)} della settimana.` },
      festivo: { label: 'Lavoro festivo' }, malattia: { label: 'Malattia' },
      domenicale: { label: 'Magg. domenicali', senzaOre: true }, notturno: { label: 'Magg. notturne' }, manuale: { label: 'Magg. manuali', senzaOre: true },
    };
    // Le ore oltre il monte ore non hanno euro: nel riepilogo non sono una voce.
    return [...f.voci, ...f.maggiorazioni].filter((v) => voce[v.id])
      .map((v) => ({ ...voce[v.id], value: v.euro, minutes: voce[v.id].senzaOre ? 0 : v.minuti }))
      .filter(v => v.value >= 0.005 || v.minutes > 0);
  }, [pay, payByShift, counted, settings]);

  // Festività del mese senza alcun turno segnato: una festività non lavorata è pagata e
  // facile da dimenticare. Qui si PROPONE soltanto.
  const festivitaDaSegnare = useMemo(
    () => festivitaSenzaTurno(year, month, allShifts || shifts, settings),
    [year, month, allShifts, shifts, settings],
  );
  const oreFestivita = minutiGiornoAssenza(settings);

  // Bonus busta paga: quanto manca alla soglia. Si misura sulla PROIEZIONE dell'anno, non sul
  // maturato: le soglie valgono sull'anno intero, e così questa pagina e Statistiche dicono
  // lo stesso numero.
  const bonus = useMemo(
    () => calcBonusMargin(annualProjection || annualGross, settings),
    [annualProjection, annualGross, settings],
  );

  // Quanto rischia di dover RIDARE INDIETRO (motore/restituzione.js).
  // Il conguaglio di dicembre, come forchetta (motore/conguaglio.js): solo per l'anno in
  // corso, perché per un anno chiuso è già in busta.
  const oggi = useOggi();
  const oggiAnno = oggi.getFullYear();
  const conguaglio = useMemo(
    () => (year === oggiAnno ? stimaConguaglio({
      anno: year, allShifts, settings, payMap: payByShift || {}, proiezioneAnnua: (annualProjection || annualGross) || null,
      oggi,
    }) : null),
    [year, oggiAnno, oggi, allShifts, settings, payByShift, annualProjection, annualGross],
  );
  // Il bonus preso finora è UNO per tutte le schermate: quello mese per mese
  // del conguaglio. Per un anno chiuso, la quota piena come prima.
  const tiFinora = conguaglio ? conguaglio.tiFinora : quotaPotenziale(dataDiRiferimento(year, new Date()));
  const rischio = useMemo(
    () => rischioRestituzione({
      settings, proiezioneAnnua: annualProjection || annualGross, oggi: dataDiRiferimento(year, new Date()),
      erogatoStimato: conguaglio ? conguaglio.tiFinora : null,
    }),
    [settings, annualProjection, annualGross, year, conguaglio],
  );

  // LA FORMA DELLA BUCA attorno ai 15.000: una trentina di valutazioni, memoizzate sulle sole
  // impostazioni perché non dipende dal mese guardato.
  const costo = useMemo(() => costoSoglia(settings), [settings]);
  // La tabella del popup «Come funziona»: al lordo previsto per chi è già
  // oltre il tetto, nel punto appena sopra per chi è ancora sotto.
  const alTuoLordo = (annualProjection || annualGross) > costo.tetto;
  const tabellaSoglia = useMemo(() => {
    if (!alTuoLordo) {
      return { ...costo.voci, indennita: costo.voci.indennita + costo.voci.altro, lavoro: 0, totale: -costo.perditaMax };
    }
    const r = confrontoConSoglia(annualProjection || annualGross, settings, costo);
    return { ...r.voci, totale: r.totale };
  }, [alTuoLordo, costo, annualProjection, annualGross, settings]);
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

  // Coi centesimi del motore: arrotondare all'euro e scrivere «,00» fingeva precisione.
  const fmt0 = (n) => formatCurrency(n);

  // Gli euro sul singolo turno sono un'OPZIONE, spenta di default.
  const mostraEuro = !!settings.mostraEuroPerTurno;

  // Nella cella l'importo va SENZA decimali (lo spazio è da tre cifre); la cifra esatta sta
  // nel `title` e nell'agenda.

  // Quanto vale una giornata. `null`, non zero, quando la paga oraria manca o non copre quei
  // turni. `lordoTurno` (pay.js) tiene questa somma uguale al totale del riepilogo
  // (src/motore/riscontri/check-lordo-turno.mjs).
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
  // Il confronto col montante ha senso solo se ogni mese coperto ha turni, e
  // si fa sul lordo del mese del motore: vedi utils/confronto-montante.js.
  const confronto = useMemo(
    () => confrontoMontante({ anno: year, settings, allShifts: allShifts || [], payMap: payByShift }),
    [year, settings, allShifts, payByShift],
  );
  const montanteMismatch = !!confronto?.avvisa;
  const shiftsCovered = confronto?.lordoTurni ?? 0;

  // Netto stimato del mese (beta), in useMonthlyNet. Il tratt. integrativo si
  // può simulare presente o assente, mese per mese, dal suo riquadro.
  const [tiSimulati, setTiSimulati] = useState(/** @type {Record<string, boolean>} */ ({}));
  const chiaveMese = `${year}-${String(month + 1).padStart(2, '0')}`;
  const {
    monthKey, perMonthBonus, fixedMonthlyTotal,
    netProjection, netBasis, extraThisMonth, monthGross,
    netMonth, netMonthSimulato, tiSePresente, monthNet, monthTfr,
    tiInfo, effectiveRatePct, addizionaliPct, showNetPanel: showNetPanelRaw,
    riferimento,
  } = useMonthlyNet({
    year, month, settings, pay, annualGross, annualExtras, daysInMonth, allShifts, payMap: payByShift,
    tiSimulato: tiSimulati[chiaveMese] ?? null,
  });
  const netVisto = netMonthSimulato || netMonth; // il riquadro del netto mostra la simulazione
  // Senza turni nel mese niente netto: voci fisse e 13ª/14ª da sole facevano comparire TI e cuneo.
  const showNetPanel = showNetPanelRaw && counted.length > 0;
  // Quello che la busta aggiunge ai turni, dal motore (`lordoDelMese`): con
  // le competenze dei turni somma al lordo mostrato in barra e nel riepilogo.
  const vociOltreTurni = [
    extraThisMonth > 0 && { label: month === EXTRA_MONTHS.tredicesima ? 'Tredicesima' : 'Quattordicesima', value: extraThisMonth },
    fixedMonthlyTotal > 0 && { label: 'Voci fisse', value: fixedMonthlyTotal },
    perMonthBonus > 0 && (showNetPanel || !onUpdateSettings) && { label: `Bonus di ${formatMonthYear(currentMonth)}`, value: perMonthBonus },
  ].filter(Boolean);

  // Quanto è «coperta» la proiezione dal maturato: i mesi dell'anno con turni contro quelli
  // trascorsi. Chi ha cominciato a metà anno ha i mesi precedenti a zero e un reddito stimato
  // troppo basso.
  const mesiTrascorsi = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  const mesiConTurni = useMemo(() => {
    const mesi = new Set();
    (allShifts || []).forEach(s => {
      if (s.date.slice(0, 4) === String(year)) mesi.add(s.date.slice(5, 7));
    });
    return mesi.size;
  }, [allShifts, year]);
  // Si avvisa solo quando la proiezione dipende DAVVERO dai soli turni (non con montante o
  // reddito annuo a mano).
  const proiezioneParziale = netProjection.source === 'maturato'
    && !(Number(settings.priorTaxableIncome) > 0)
    && !(Number(settings.annualGrossManual) > 0)
    && mesiConTurni > 0 && mesiConTurni < mesiTrascorsi;

  // SOSPESA mentre si prova la lettura sul telefono (ImportTesto): `false &&` e basta per riaccenderla.
  const hasImportAI = false && !!import.meta.env.VITE_AI_PROXY_URL;

  const closeNameModal = useCallback(() => { setPendingImportFile(null); setEditingName(false); setPickAfterName(false); }, []);
  useModalDismiss(nameModalRef, closeNameModal, !!pendingImportFile || editingName);

  // Bonus del mese: importo fisso (Impostazioni), spuntato mese per mese. `true` = preso;
  // i numeri sono il formato legacy.
  const monthlyBonusEntry = settings.monthlyBonus?.[monthKey];
  const bonusTakenThisMonth = !!monthlyBonusEntry;
  const monthlyBonusAmount = Number(settings.monthlyBonusAmount) || 0;

  // «E se lo prendessi tutti i mesi?»: una SIMULAZIONE accanto alla spunta, che non scrive in
  // `settings` e non sostituisce la cifra vera.
  const nomeMese = (m) => new Date(year, m, 1).toLocaleDateString('it-IT', { month: 'long' });
  // «fino ad agosto», «fino a luglio»: la d eufonica davanti ad a-.
  const finoA = (m) => { const n = nomeMese(m); return `fino ${/^a/i.test(n) ? 'ad' : 'a'} ${n}`; };
  // Le cifre delle buste del montante: scritte in `settings` solo quando si
  // lascia il campo, legate al mese del montante (motore/conguaglio.js).
  const salvaBuste = (chiave) => {
    const bozza = busteBozza[chiave];
    if (bozza == null || !conguaglio) return;
    const v = Number(String(bozza).replace(',', '.'));
    const fino = String(settings.priorIncomeDate || '').slice(0, 7);
    onUpdateSettings?.({ [chiave]: String(bozza).trim() === '' || !(v >= 0) ? null : { importo: v, fino } });
    setBusteBozza((b) => ({ ...b, [chiave]: null }));
  };
  // IL PERCHÉ di IRPEF e bonus, coi mesi che lo causano: dove la stima del datore supera i
  // 15.000 non c'è il bonus ma la detrazione più alta, sotto il contrario; per questo le due
  // voci hanno segni opposti.
  const elencoMesi = (idx) => {
    const nomi = idx.map(nomeMese);
    const testo = nomi.length > 4 ? `${nomi.length} mesi`
      : nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
    return testo.charAt(0).toUpperCase() + testo.slice(1);
  };
  const perchéConguaglio = (() => {
    if (!conguaglio) return null;
    const c = conguaglio.centrale;
    const sopra = conguaglio.mesiSopraSoglia;
    const sotto = conguaglio.mesiSottoSoglia;
    if (c.annoSottoSoglia && c.voci.trattamentoIntegrativo <= -1 && sopra?.length) {
      return `${elencoMesi(sopra)} ${sopra.length === 1 ? 'ha' : 'hanno'} una stima oltre i 15.000: niente tratt. integrativo, ma meno IRPEF. `
        + "Sull'anno resti sotto i 15.000: si inverte.";
    }
    if (!c.annoSottoSoglia && c.voci.trattamentoIntegrativo >= 1 && sotto?.length) {
      return `${elencoMesi(sotto)} ${sotto.length === 1 ? 'ha' : 'hanno'} una stima sotto i 15.000: tratt. integrativo, ma più IRPEF. `
        + "Sull'anno superi i 15.000: si inverte.";
    }
    return null;
  })();
  // IL MESE NON È COSA FATTA: se l'anno, di questo passo, finisce dall'altra
  // parte dei 15.000, a dicembre la decisione del mese si rovescia. Mese e anno
  // dal motore (`tiSpettaQuestoMese` con la capienza, `stimaConguaglio`).
  const tiNelMese = !!netMonth?.esitoTi?.spetta && !netMonth.esitoTi.senzaCapienza;
  const minimoTi = useMemo(() => lordoMeseMinimoTi(settings), [settings]);
  const meseSiInverte = !!(conguaglio && netMonth?.esitoTi?.proiezione != null
    && conguaglio.centrale.dettaglio.trattamentoIntegrativo.anno > 0 !== tiNelMese);
  const forchettaScritta = scriviForchetta(conguaglio);

  const [simulaBonus, setSimulaBonus] = useState(false);
  const settingsBonusOgniMese = useMemo(() => {
    // Da questo mese a dicembre: i mesi passati sono andati come sono andati.
    const tutti = {};
    const primo = year === oggiAnno ? new Date().getMonth() : (year > oggiAnno ? 0 : 12);
    for (let m = primo; m < 12; m += 1) tutti[`${year}-${String(m + 1).padStart(2, '0')}`] = true;
    // I mesi già spuntati vincono: possono avere un importo diverso (formato legacy).
    return { ...settings, monthlyBonus: { ...tutti, ...(settings.monthlyBonus || {}) } };
  }, [settings, year, oggiAnno]);
  const proiezioneBonusOgniMese = useMemo(
    () => projectAnnualIncome(annualGross, annualExtras, settingsBonusOgniMese, year, {
      enableNetCalc: ENABLE_NET_CALC, oggi: new Date(),
    }),
    [annualGross, annualExtras, settingsBonusOgniMese, year],
  );
  // Confronto sulla stessa base della striscia del trattamento integrativo (`proiezione`).
  const differenzaBonus = proiezioneBonusOgniMese.value - proiezione;
  // IL CONGUAGLIO DELLA SIMULAZIONE: stesso motore, impostazioni e proiezione simulate; la
  // cifra vera sopra non si tocca.
  const conguaglioSimulato = useMemo(
    () => (simulaBonus && year === oggiAnno ? stimaConguaglio({
      anno: year, allShifts, settings: settingsBonusOgniMese, payMap: payByShift || {},
      proiezioneAnnua: proiezioneBonusOgniMese.value, oggi: new Date(),
    }) : null),
    [simulaBonus, year, oggiAnno, allShifts, settingsBonusOgniMese, payByShift, proiezioneBonusOgniMese],
  );
  // Solo se un bonus esiste E se simularlo cambierebbe qualcosa: a chi li ha
  // già spuntati tutti la domanda non ha nessuna risposta da dare.
  const puoSimulareBonus = monthlyBonusAmount > 0 && differenzaBonus >= 0.005;

  // COSA FA AL TRATTAMENTO INTEGRATIVO: i tre casi (sotto, buca, oltre) vogliono tre risposte
  // diverse (motore/restituzione.js).
  const posizioneSimulata = useMemo(
    () => posizioneRispettoSoglia(proiezioneBonusOgniMese.value, settings, costo),
    [proiezioneBonusOgniMese, settings, costo],
  );
  const esitoSimulazione = useMemo(() => {
    if (posizione === POSIZIONE.SOTTO) {
      if (posizioneSimulata === POSIZIONE.SOTTO) {
        return { tono: 'ok', testo: 'Resteresti sotto la soglia: il trattamento integrativo non cambia.' };
      }
      if (posizioneSimulata === POSIZIONE.DENTRO) {
        return {
          tono: 'avviso',
          testo: `Ti porterebbe oltre i ${fmt0(costo.tetto)} di lordo: il trattamento integrativo non spetta più, e nel punto peggiore ci rimetti ~${fmt0(costo.perditaMax)} l'anno.`,
        };
      }
      // Oltre la buca: il TI non spetta ma la detrazione più alta l'ha già compensato.
      return {
        tono: 'neutro',
        testo: `Ti porterebbe oltre i ${fmt0(costo.tetto)}: il trattamento integrativo non spetta più, ma saresti abbastanza oltre da non rimetterci niente.`,
      };
    }
    // Già dentro la buca: prenderlo ogni mese può farne USCIRE, l'unico caso azionabile.
    if (posizione === POSIZIONE.DENTRO && posizioneSimulata === POSIZIONE.OLTRE) {
      return { tono: 'ok', testo: 'Ti farebbe uscire dalla buca dei 15.000: torneresti in pari.' };
    }
    return null;
  }, [posizione, posizioneSimulata, costo]);

  async function runImport(file, name) {
    setImportLoading(true);
    setImportError(null);
    try {
      // Client del proxy caricato on-demand: non deve pesare sull'avvio.
      const { parseShiftsFromImage } = await import('../services/gemini');
      const { shifts: parsed, usage } = await parseShiftsFromImage(file, name);
      setImportUsage(usage);
      setImportParsed(parsed);
    } catch (err) {
      // Due famiglie, due gesti: rifare la foto o controllare la rete.
      const tipo = tipoDiErrore(err);
      setImportError({ tipo, messaggio: err.message || 'Il riconoscimento non è riuscito.' });
    } finally {
      setImportLoading(false);
    }
  }

  // Avvio import dal pulsante: il nome è obbligatorio. Se manca, si chiede PRIMA
  // di aprire il selettore immagini (così non si carica nulla senza nome).
  function startImport() {
    // La prima volta si dice dove va la foto, PRIMA di sceglierla: dopo diventa un ostacolo.
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
    // Click SINCRONO, senza setTimeout: WebKit consuma l'indicatore di gesto utente appena il
    // click esce dal turno dell'evento, e su iOS Safari il selettore non si aprirebbe. L'input
    // vive fuori dalla modale, quindi è già montato.
    else if (pick) fileInputRef.current?.click();
  }

  function handleImportConfirm(parsedShifts) {
    onImportShifts(parsedShifts);
    setImportParsed(null);
  }

  function handleMonthBonusToggle() {
    if (!onUpdateSettings) return;
    const map = { ...(settings.monthlyBonus || {}) };
    if (!bonusTakenThisMonth) map[monthKey] = true;
    else delete map[monthKey];
    onUpdateSettings({ monthlyBonus: map });
  }

  async function handleExport(format) {
    setExportBusy(true);
    setExportError(null);
    try {
      // Scelta esplicita fra mese di calendario (default) e mese di paga (per confrontare con la
      // busta). Il periodo finisce nel titolo del documento solo se non è il calendario.
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

  // Lo sfoglio col pollice e il mese che entra di lato (`hooks/useSfoglio.js`).
  const meseChiave = year * 12 + month;
  const { classeEntrata, contenuto, gestori } = useSfoglio(
    meseChiave, (verso) => onMonthChange(addMonths(currentMonth, verso)),
  );

  return (
    <div className="calendar-view">
      {/* Month navigation & Layout toggle */}
      <div className="cal-header">
        {/* Il mese fra le sue frecce, i comandi della vista a destra, tutto su
            una riga: su 360 px le frecce finivano una sopra l'altra e
            l'intestazione agganciata si mangiava due righe di calendario. */}
        <div className="cal-header-mese">
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
          <button
            className="week-nav-btn"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            aria-label="Mese successivo"
          >
            ›
          </button>
        </div>
        <div className="cal-header-right">
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
          <button
            type="button"
            className="cal-header-share-btn"
            onClick={() => setShowShareModal(true)}
            title="Condividi i turni della settimana"
            aria-label="Condividi i turni della settimana"
          >
            <Icona nome="chat" />
          </button>
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
            {/* UN SOLO LORDO in tutta la schermata: quello del mese come lo
                compone il motore (`lordoDelMese`: turni + voci fisse + bonus
                spuntato + 13ª/14ª), coi centesimi. La barra diceva 1.200 (i
                soli turni, arrotondati), il riepilogo 1199,86 e il netto
                partiva da 1329,86: tre cifre per la stessa domanda.
                La 13ª/14ª si dice: a dicembre, a turni vuoti, sembrava paga. */}
            <CifraCheCambia className="cal-header-soldi-val" valore={monthGross} chiave={monthKey} segnale={totalMins}
              title={`${formatCurrency(monthGross)} lordi in ${formatMonthYear(currentMonth)}`} />
            <span className="cal-header-soldi-ore">{formatMinutesShort(totalMins)}</span>
            <span className="cal-header-soldi-eti">lordo stimato{extraThisMonth > 0 && <span className="cal-header-soldi-extra">
              di cui {currentMonth.getMonth() === 11 ? '13ª' : '14ª'} {formatCurrency(extraThisMonth)}</span>}</span>
          </div>
        )}
      </div>

      {/* Il calendario vuoto non dice da dove si comincia. Non è una domanda e
          non ha ✕: nasce dallo stato dei dati (zero turni in assoluto, non nel
          mese) e sparisce da sé al primo turno. */}
      {allShifts.length === 0 && (
        <p className="cal-vuoto">
          Tocca un giorno per segnare il primo turno
          {hasImportAI ? ', o importa la foto del tabellone qui sotto.' : '.'}
        </p>
      )}

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
            {importLoading ? <><Icona nome="attesa" /> Analisi in corso…</> : <><Icona nome="carica" /> Importa turni da immagine</>}
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
          {importError && (
            <span className="import-error" role="alert">
              <strong>{TITOLO_ERRORE[importError.tipo]}</strong> {importError.messaggio}
            </span>
          )}
          <DebugUso uso={importUsage} />
        </div>
      )}

      {/* Da testo: locale, c'è anche senza il servizio di riconoscimento. */}
      <div className="import-bar">
        <ImportTesto esistenti={allShifts} onConfirm={onImportShifts} nome={settings.workerName} onNome={(workerName) => onUpdateSettings?.({ workerName })} />
      </div>

      {/* Main shifts view: Timeline or Grid. Scorrere di lato sui giorni cambia
          mese (`utils/swipe.js`): le frecce stanno in alto, fuori dalla portata
          del pollice. Solo qui — l'intestazione e il netto non sfogliano. */}
      <div className="cal-sfoglia" {...gestori}>
      {/* La chiave è il mese: cambiandolo il contenuto si rimonta e l'animazione
          d'entrata riparte da capo. */}
      <div key={meseChiave} ref={contenuto} className={classeEntrata}>
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
          // L'agenda riceve `payByShift` per mostrare anche gli euro.
          payByShift={payByShift}
          mostraEuro={mostraEuro}
        />
      ) : (
        // Le righe dei giorni hanno TUTTE la stessa altezza, quella della più alta (`1fr` con un
        // contenitore senza altezza): altrimenti una pill a capo allunga una sola settimana.
        <div
          className="cal-grid"
          style={{ gridTemplateRows: `auto repeat(${Math.ceil(cells.length / 7)}, minmax(4.5rem, 1fr))` }}
        >
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

            // La cella è un contenitore cliccabile, non un pulsante (annidare controlli in un
            // role="button" è invalido): i comandi veri sono i <button> qui dentro.
            return (
              <div
                key={dateStr}
                ref={dateStr === focusDate ? focusCellRef : null}
                className={[
                  'cal-cell',
                  today ? 'cal-cell--today' : '',
                  weekend ? 'cal-cell--weekend' : '',
                  dateStr === focusDate ? 'cal-cell--focus' : '',
                  dayShifts.some(s => s.note) ? 'cal-cell--nota' : '', // una nota si vede a colpo d'occhio
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
                        {assente ? <Icona nome={ICONA_TIPO[t]} piastrella /> : <IntervalloCella s={s} />}
                      </button>
                    );
                  })}
                </div>
                {/* Il totale della giornata: le pill dicono quando, questo
                    quanto. Con più turni andrebbe sommato a mente, e la pausa
                    di un turno spezzato non si conta. */}
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
      </div>
      </div>

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
            {assenze.minuti > 0 && <span className="summary-sublabel">+ {assenze.dettaglio}</span>}
            {pay !== null && totalMins > 0 && payByShift && (
              <span className="summary-sublabel"><FlussoOre turni={counted} tutti={allShifts || counted} byShift={payByShift} settings={settings} titolo={formatMonthYear(currentMonth)} extra={vociOltreTurni} lordo={monthGross} /></span>)}
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
              <span className="summary-value diff-positive">{formatCurrency(monthGross)}</span>
              {/* Con una sola voce la scomposizione ripeterebbe il totale.
                  Le voci sommano al lordo della barra: prima i turni, poi
                  quello che la busta aggiunge ogni mese. */}
              {vociOltreTurni.length + competenze.length > 1 && competenze.map(v => (
                <span className="summary-sublabel" key={v.label}>
                  {v.tag === 'overtime' ? (
                    <span className="tooltip-wrap">
                      <button type="button" className="linklike" aria-describedby={`ot-tip-${v.label}`}>{v.label}</button>
                      <span className="tooltip-bubble" role="tooltip" id={`ot-tip-${v.label}`}>{v.tip}</span>
                    </span>
                  ) : v.label}
                  {v.minutes > 0 && ` (${formatMinutesShort(v.minutes)})`}
                  {' '}{formatCurrency(v.value)}
                  {v.nota && <em className="summary-sublabel-nota"> di cui {v.nota}</em>}
                </span>
              ))}
              {vociOltreTurni.map(v => (
                <span className="summary-sublabel" key={v.label}>{v.label} {formatCurrency(v.value)}</span>
              ))}
              {/* Il riquadro del premio sta nel netto, che senza turni non c'è. */ !showNetPanel && monthlyBonusAmount > 0 && onUpdateSettings && (
                <div className="net-pillole"><PillolaPremio importo={monthlyBonusAmount} preso={bonusTakenThisMonth} onTocca={handleMonthBonusToggle} /></div>)}
              {pay.shiftsWithoutRate > 0 && (
                <span className="summary-sublabel summary-sublabel--warn">
                  <Icona nome="avviso" /> {pay.shiftsWithoutRate} turn{pay.shiftsWithoutRate === 1 ? 'o conteggiato' : 'i conteggiati'} a 0 €:
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
            {/* Niente «Lordo del mese» in testa: è già nella barra in alto. */}

            <div className="net-strip-body">
              <span className="bonus-strip-label">
                Netto stimato del mese <span className="beta-tag">beta</span>
              </span>
              {/* IL PASSAGGIO DAL LORDO AL NETTO, coi centesimi del motore.
                  Prima: «1.200» in barra, «1199,86» nel riepilogo, «1156,00»
                  qui, e niente che le legasse. Il netto partiva da un lordo
                  che non compariva da nessuna parte (turni + voci fisse), e
                  «1156,00» era arrotondato all'euro ma scritto coi centesimi.
                  «Bonus +157» sommava trattamento integrativo e indennità
                  L. 207/24, proprio sotto la casella del premio chiamato
                  «bonus»: tre cose con un nome solo. */}
              <span className="net-strip-value">{formatCurrency(netVisto?.net ?? monthNet)}</span>
              <NetPillole
                lordo={monthGross} net={netVisto} effectiveRatePct={effectiveRatePct} tfr={monthTfr}
                bonusImporto={monthlyBonusAmount} bonusPreso={bonusTakenThisMonth} onBonus={handleMonthBonusToggle}
                tiCifra={tiSePresente} tiSimulato={netMonthSimulato != null}
                tiAttivo={netVisto?.trattamentoIntegrativo > 0}
                onTi={() => setTiSimulati((m) => {
                  const vero = netMonth?.trattamentoIntegrativo > 0;
                  const ora = m[chiaveMese] ?? vero;
                  const { [chiaveMese]: _, ...altri } = m;
                  return !ora === vero ? altri : { ...altri, [chiaveMese]: !ora };
                })}
              />
              {/* LA REGOLA DEL MESE, dove si vede il suo effetto. Ad agosto la
                  busta tratteneva 8,38 € di IRPEF e nessuno capiva perché: il
                  stima dell'anno superava i 15.000, e il programma paghe aveva
                  tolto il tratt. integrativo e messo la detrazione alta. La
                  spiegazione stava in «Come è calcolato?», chiusa. */}
              {/* Prima il lordo, da confrontare con la busta, poi il reddito
                  dei 15.000. Il conto per esteso è nel popup di «perché?», e resta
                  nel popup di «perché?» per chi lo vuole vedere. */}
              {netMonth?.esitoTi?.proiezione != null && (
                <span className="bonus-strip-note">
                  {netMonthSimulato ? <>Simulazione: tocca il riquadro per tornare al calcolo.</>
                    : tiNelMese ? <>Il datore stima ~{numeroIt(netMonth.esitoTi.lordoPresunto ?? 0)} € lordi nell'anno ({numeroIt(netMonth.esitoTi.proiezione)} di reddito): sotto i 15.000, c'è il tratt. integrativo.</>
                    : netMonth.esitoTi.spetta ? <>Niente tratt. integrativo: la media dell'anno{netMonth.esitoTi.media != null && <>, ~{numeroIt(Math.round(netMonth.esitoTi.media))} € al mese,</>} è sotto i ~{numeroIt(minimoTi ?? 0)} € lordi che danno IRPEF da compensare.</>
                    : <>Il datore stima ~{numeroIt(netMonth.esitoTi.lordoPresunto ?? 0)} € lordi nell'anno ({numeroIt(netMonth.esitoTi.proiezione)} di reddito): sopra i 15.000, niente tratt. integrativo, ma meno IRPEF.</>}
                  {meseSiInverte && <strong> A dicembre si inverte.</strong>}{' '}
                  <button type="button" className="linklike" onClick={() => setMeseSpiegato(true)}>perché?</button>
                </span>
              )}
            </div>

            {/* L'avviso BETA resta (CLAUDE.md), ma a voce bassa: il riquadro
                giallo gridava più forte del netto che accompagnava. */}
            <p className="net-disclaimer--discreto">
              Stima beta: può contenere errori, fatti controllare da un professionista.
            </p>

            <button
              type="button"
              className="net-toggle"
              onClick={() => setShowNetDetail(v => !v)}
              aria-expanded={showNetDetail}
            >
              {showNetDetail ? 'Chiudi ▲' : 'Vedi i passaggi ▼'}
            </button>

            {/* TRE PASSI prima, la busta voce per voce dopo, a richiesta. Il
                dettaglio completo non sparisce: è quello che serve a chi
                confronta con il cedolino, ma non deve essere la prima cosa. */}
            {showNetDetail && (
              <div className="net-passi">
                <div className="net-passo">
                  <span className="net-passo-nome">
                    1. Turni
                    <span className="net-passo-sotto">
                      {counted.length - assenze.giorni} {counted.length - assenze.giorni === 1 ? 'turno' : 'turni'}, {formatMinutesShort(totalMins - assenze.minuti)}
                      {assenze.giorni > 0 && `, ${assenze.dettaglioGiorni}`}
                      {vociOltreTurni.length > 0 && ' e voci fisse'}
                    </span>
                  </span>
                  <span className="net-passo-cifra">{fmt0(netVisto.gross)}</span>
                </div>
                <div className="net-passo">
                  <span className="net-passo-nome">
                    2. Trattenute
                    <span className="net-passo-sotto">contributi INPS e tasse</span>
                  </span>
                  <span className="net-passo-cifra">−{fmt0(netVisto.trattenute)}</span>
                </div>
                {netVisto.bonus > 0 || netVisto.tfr > 0 ? (
                  <div className="net-passo net-passo--piu">
                    <span className="net-passo-nome">
                      3. In più in busta
                      <span className="net-passo-sotto">
                        {[
                          netVisto.trattamentoIntegrativo > 0 && 'tratt. integrativo',
                          netVisto.bonusCuneo > 0 && 'indennità L. 207/24',
                          netVisto.tfr > 0 && 'anticipo TFR',
                        ].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    <span className="net-passo-cifra">
                      +{fmt0(netVisto.bonus + netVisto.tfr)}
                    </span>
                  </div>
                ) : null}
                <div className="net-passo net-passo--totale">
                  <span className="net-passo-nome">Netto stimato</span>
                  <span className="net-passo-cifra">{fmt0(netVisto.net)}</span>
                </div>
                {proiezioneParziale && !showNetBusta && (
                  <div className="net-subnote net-subnote--warn">
                    <Icona nome="avviso" /> Nel {year} hai turni in {mesiConTurni} mes{mesiConTurni === 1 ? 'e' : 'i'} su{' '}
                    {mesiTrascorsi}: i mesi vuoti contano zero e possono cambiare questi numeri.
                  </div>
                )}
                <button
                  type="button"
                  className="net-toggle"
                  onClick={() => setShowNetBusta(v => !v)}
                  aria-expanded={showNetBusta}
                >
                  {showNetBusta ? 'Nascondi le voci ▲' : 'Voce per voce, come in busta ▼'}
                </button>
              </div>
            )}

            {showNetDetail && showNetBusta && (
              <div className="net-detail">
                {/* Stile busta paga: un solo lordo in cima */}
                <div className="net-line net-line--head">
                  <span>Lordo del mese</span><span>{fmt0(netVisto.gross)}</span>
                </div>

                <div className="net-group-label">Trattenute</div>
                {netVisto.contributiRighe.map(r => (
                  <div className="net-line net-line--ded" key={r.label}>
                    <span>{r.label}{r.pct != null && ` (${fmtPct(r.pct)}%)`}</span>
                    <span>−{fmt0(r.importo)}</span>
                  </div>
                ))}
                <div className="net-line net-line--info">
                  <span>Imponibile fiscale</span><span>{fmt0(netVisto.imponibile)}</span>
                </div>
                {netVisto.imponibileExtra > 0 && (
                  <div className="net-subnote">
                    di cui {fmt0(netVisto.imponibileExtra)} di mensilità aggiuntiva, tassata a parte
                    (aliquota {(netVisto.irpefExtra / netVisto.imponibileExtra * 100).toFixed(0)}%, senza detrazioni)
                  </div>
                )}

                {/* IRPEF come in busta paga: lorda, detrazioni, netta */}
                <div className="net-irpef-label">IRPEF</div>
                <div className="net-line net-line--calc">
                  <span>Lorda ({netVisto.imponibile > 0 ? (netVisto.irpefLorda / netVisto.imponibile * 100).toFixed(0) : 0}% dell'imponibile)</span>
                  <span>{fmt0(netVisto.irpefLorda)}</span>
                </div>
                {/* Si mostra la quota CAPIENTE: quando la detrazione supera
                    l'imposta il conto resta giusto lo stesso, ma «157 − 161 = 0»
                    si legge come uno sbaglio. In busta compare la parte capiente. */}
                <div className="net-line net-line--calc">
                  <span>− Detrazioni lavoro dip.</span><span className="pos">−{fmt0(netVisto.detrazioniApplicate)}</span>
                </div>
                {netVisto.detrazioni - netVisto.detrazioniApplicate > 0.5 && (
                  <div className="net-subnote">
                    ne spetterebbero {fmt0(netVisto.detrazioni)}, ma l'imposta del mese è più
                    bassa: la parte eccedente non si recupera qui
                  </div>
                )}
                <div className="net-line net-line--calc net-line--calc-strong">
                  <span>= Netta (trattenuta)</span><span>−{fmt0(netVisto.irpefNetta)}</span>
                </div>

                {(netVisto.addRegionale + netVisto.addComunale) > 0 && (
                  <div className="net-line net-line--ded">
                    <span className="tooltip-wrap">
                      <button type="button" className="linklike" aria-describedby="net-tip-add">Addizionali reg./com.</button>
                      <span className="tooltip-bubble" role="tooltip" id="net-tip-add">
                        Tasse locali (regione e comune) calcolate sul reddito imponibile,
                        trattenute ogni mese in busta.
                      </span>
                      {' '}({addizionaliPct}%)
                    </span>
                    <span>−{fmt0(netVisto.addRegionale + netVisto.addComunale)}</span>
                  </div>
                )}
                {netVisto.trattenuteFisse > 0 && (
                  <div className="net-line net-line--ded">
                    <span>Trattenute fisse</span>
                    <span>−{fmt0(netVisto.trattenuteFisse)}</span>
                  </div>
                )}
                <div className="net-line net-line--subtotal">
                  <span>Totale trattenute ({(netVisto.trattenute / netVisto.gross * 100).toFixed(1)}%)</span>
                  <span>−{fmt0(netVisto.trattenute)}</span>
                </div>

                {/* Competenze aggiuntive (quote mensili) */}
                {(netVisto.bonus > 0 || netVisto.tfr > 0) && (
                  <>
                    <div className="net-group-label">Competenze in busta (a parte)</div>
                    {netVisto.trattamentoIntegrativo > 0 && (
                      <div className="net-line net-line--bonus">
                        <span className="tooltip-wrap">
                          <button type="button" className="linklike" aria-describedby="net-tip-ti">Trattamento integrativo</button>
                          <span className="tooltip-bubble" role="tooltip" id="net-tip-ti">
                            Ex bonus Renzi: spetta con un reddito imponibile fino a 28.000
                            €/anno, se l'imposta dovuta supera le detrazioni.
                          </span>
                          {' '}(quota mese)
                        </span>
                        <span>+{fmt0(netVisto.trattamentoIntegrativo)}</span>
                      </div>
                    )}
                    {netVisto.bonusCuneo > 0 && (
                      <div className="net-line net-line--bonus">
                        <span className="tooltip-wrap">
                          <button type="button" className="linklike" aria-describedby="net-tip-cuneo">Indennità 207/2024</button>
                          <span className="tooltip-bubble" role="tooltip" id="net-tip-cuneo">
                            Sconto sui contributi (legge di bilancio 2025) per redditi fino
                            a 40.000 €/anno: aumenta il netto senza toccare il lordo.
                          </span>
                          {' '}({(netVisto.cuneoPct * 100).toFixed(1).replace('.', ',')}% dell'imponibile)
                        </span>
                        <span>+{fmt0(netVisto.bonusCuneo)}</span>
                      </div>
                    )}
                    {netVisto.tfr > 0 && (
                      <>
                        <div className="net-line net-line--bonus"><span>Anticipo TFR (quota mese)</span><span>+{fmt0(netVisto.tfr)}</span></div>
                        <div className="net-subnote">
                          lordo {fmt0(netVisto.tfrLordo)} − imposta separata ~{(netVisto.aliqTfr * 100).toFixed(0)}% {fmt0(netVisto.tfrImposta)}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* La regola del mese (la stima dell'anno) non sta più qui: ha la sua
                    riga nel riquadro del netto e il suo popup, «perché?». */}
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
                    <Icona nome="avviso" /> La stima usa solo i turni inseriti, e nel {year} ne hai in {mesiConTurni}{' '}
                    mes{mesiConTurni === 1 ? 'e' : 'i'} su {mesiTrascorsi}: i mesi vuoti contano come
                    zero e abbassano il reddito annuo stimato. Se hai lavorato anche prima, in
                    Impostazioni metti il <strong>reddito annuo previsto</strong> o il{' '}
                    <strong>montante già maturato</strong> — da quel numero dipendono detrazioni,
                    trattamento integrativo e indennità.
                  </div>
                )}

                <div className="net-line net-line--total"><span>Netto del mese</span><span>{fmt0(netVisto.net)}</span></div>
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

        {/* Il riquadro del trattamento integrativo vive in RiquadroTI.jsx:
            le cifre gliele passa questo file, che le prende dal motore. */}
        {bonus.status !== BONUS_STATUS.ATTESA && (
          <RiquadroTI
            bonus={bonus} rischio={rischio} posizione={posizione} costo={costo}
            mancaPareggio={mancaPareggio} mancaOre={mancaOre} tiFinora={tiFinora} annualGross={annualGross}
            settings={settings} onUpdateSettings={onUpdateSettings} onPerche={() => setContiBonusAperti(true)}
            avvisoMontante={montanteMismatch && (
              <span className="bonus-strip-note bonus-strip-note--warn">
                <Icona nome="avviso" /> Il montante ({fmt0(montante)}) non torna coi mesi segnati {priorMonthLabel ? `fino ${/^a/i.test(priorMonthLabel) ? 'ad' : 'a'} ${priorMonthLabel.toLowerCase()}` : ''} ({fmt0(shiftsCovered)}).
              </span>
            )}
            conguaglio={conguaglio} forchettaScritta={forchettaScritta} onApriConguaglio={() => setConguaglioAperto(true)}
            puoSimulareBonus={puoSimulareBonus} simulaBonus={simulaBonus} setSimulaBonus={setSimulaBonus}
            monthlyBonusAmount={monthlyBonusAmount} proiezioneBonusOgniMese={proiezioneBonusOgniMese}
            differenzaBonus={differenzaBonus} esitoSimulazione={esitoSimulazione} conguaglioSimulato={conguaglioSimulato}
          />
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
            <Icona nome="statistiche" /> Excel
          </button>
          <button
            type="button"
            className="btn-export"
            disabled={(exportPeriod === 'payroll' ? counted : shifts).length === 0 || exportBusy}
            onClick={() => handleExport('pdf')}
          >
            <Icona nome="documento" /> PDF
          </button>
          <button
            type="button"
            className="btn-export"
            onClick={() => setShowShareModal(true)}
          >
            <Icona nome="chat" /> Settimana
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
          esistenti={allShifts || shifts}
          workerName={settings.workerName}
          onConfirm={handleImportConfirm}
          onClose={() => setImportParsed(null)}
        />
      )}

      {/* I popup fiscali (PopupFiscali.jsx) ricevono i numeri, non li rifanno. */}
      {meseSpiegato && netMonth?.esitoTi?.proiezione != null && (
        <PopupMese
          netMonth={netMonth} currentMonth={currentMonth} conguaglio={conguaglio}
          meseSiInverte={meseSiInverte} forchettaScritta={forchettaScritta} tiNelMese={tiNelMese} minimoTi={minimoTi}
          onChiudi={() => setMeseSpiegato(false)}
          onApriConguaglio={() => { setMeseSpiegato(false); setConguaglioAperto(true); }}
        />
      )}
      {conguaglioAperto && conguaglio && (
        <PopupConguaglio
          conguaglio={conguaglio} forchettaScritta={forchettaScritta} perchéConguaglio={perchéConguaglio}
          settings={settings} busteBozza={busteBozza} setBusteBozza={setBusteBozza}
          salvaBuste={salvaBuste} finoA={finoA}
          onChiudi={() => setConguaglioAperto(false)}
        />
      )}
      {contiBonusAperti && (
        <PopupSoglia
          erogato={rischio.erogato || tiFinora} alTuoLordo={alTuoLordo} proiezione={proiezione}
          costo={costo} tabellaSoglia={tabellaSoglia} posizione={posizione} mancaPareggio={mancaPareggio}
          onChiudi={() => setContiBonusAperti(false)}
        />
      )}

      {mostraAvvisoFoto && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMostraAvvisoFoto(false)}>
          <div ref={avvisoFotoRef} className="modal" role="dialog" aria-modal="true" aria-label="Prima di inviare la foto">
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
                <Icona nome="avviso" /> Se il foglio contiene i <strong>nomi dei tuoi colleghi</strong>, partono
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

      {/* Durante il riconoscimento la pagina resta ferma. Senza velo la barra
          in alto restava toccabile: passando a Statistiche il calendario si
          smontava, la chiave `import` di `occupato` si spegneva con la
          richiesta ancora in volo, e i turni riconosciuti — già pagati —
          arrivavano su un componente che non c'era più. */}
      {importLoading && (
        <div className="modal-overlay import-velo" role="status" aria-live="polite">
          <div className="import-velo-testo">⏳ Sto leggendo la foto…</div>
        </div>
      )}

      {showShareModal && (
        <ShareWeekModal
          // TUTTI i turni: la settimana scavalca il mese, e con i soli turni
          // del mese il 31 agosto finiva nel messaggio come «Riposo».
          shifts={allShifts || shifts}
          // Sul mese in corso si parte dalla settimana di oggi, che è quella
          // che si condivide; sugli altri mesi dal loro inizio.
          initialDate={
            currentMonth.getFullYear() === new Date().getFullYear()
              && currentMonth.getMonth() === new Date().getMonth()
              ? new Date() : currentMonth
          }
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
