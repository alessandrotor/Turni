import { useState, useEffect, useRef } from 'react';
import { formatCurrency, parseNum } from '../utils/pay';
import { CCNL_LIST, getCcnl } from '../utils/ccnl';
import { FASCE_DIPENDENTI, FASCIA_DEFAULT, contributiDiLegge } from '../utils/contributi-legge';
import { isTelemetryEnabled, setTelemetryEnabled, telemetriaDisponibile } from '../services/telemetry';
import { esportaBackup, importaBackup, contaTurniSalvati } from '../services/backup';
import { ESITO } from '../services/export';
import { elencoOrariDaCorreggere, applicaCorrezioneOrari } from '../services/correzioni';
import { ENABLE_NET_CALC } from '../config/features';
import { genId } from '../utils/id';
import { minutiGiornoAssenza } from '../utils/assenze';
import { fasciaNotturnaRisolta, CUMULO_DEFAULT } from '../utils/notturno';
import { normalizzaMaggiorazione, messaggioMaggiorazione } from '../utils/maggiorazioni';

// Mostra un numero salvato come stringa con la virgola (vuoto se 0/assente).
const toInput = (n) => {
  if (n === '' || n == null) return '';
  const num = Number(n);
  if (!num) return '';
  return String(num).replace('.', ',');
};

// Mese di riferimento del montante, come 'YYYY-MM' per <input type="month">.
const currentMonthValue = () => new Date().toISOString().slice(0, 7);

export default function Settings({ settings, onSave }) {
  const [form, setForm] = useState({
    hourlyRate: toInput(settings.hourlyRate),
    expectedWeeklyHours: settings.expectedWeeklyHours ?? 40,
    fullTimeWeeklyHours: settings.fullTimeWeeklyHours ?? 40,
    sundaySurchargePct: settings.sundaySurchargePct ?? 0,
    overtimeSurchargePct: settings.overtimeSurchargePct ?? 0,
    straordinarioSurchargePct: settings.straordinarioSurchargePct === '' || settings.straordinarioSurchargePct == null
      ? '' : toInput(settings.straordinarioSurchargePct),
    holidaySurchargePct: settings.holidaySurchargePct ?? 0,
    holidaySundayMode: settings.holidaySundayMode || 'max',
    nightSurchargePct: settings.nightSurchargePct ?? 0,
    // Non più il ripiego di legge: se l'utente non ha scelto, i campi partono
    // dalla fascia del suo contratto (per il turismo le 23:00, non le 22:00).
    nightStart: fasciaNotturnaRisolta(settings).inizio,
    nightEnd: fasciaNotturnaRisolta(settings).fine,
    nightCumuloMode: settings.nightCumuloMode || CUMULO_DEFAULT,
    patronSaintDate: settings.patronSaintDate || '',
    priorTaxableIncome: toInput(settings.priorTaxableIncome),
    // Mese fino al quale il montante è comprensivo dei turni. Va scelto
    // dall'utente: dedurlo dalla data di salvataggio sbagliava di un mese chi
    // inseriva il dato a inizio mese pensando "fino al mese scorso".
    priorIncomeMonth: (settings.priorIncomeDate || '').slice(0, 7) || currentMonthValue(),
    workerName: settings.workerName ?? '',
    onCall: !!settings.onCall,
    annualGrossManual: toInput(settings.annualGrossManual),
    dailyOvertimeThreshold: settings.dailyOvertimeThreshold ?? '',
    hasTredicesima: !!settings.hasTredicesima,
    hasQuattordicesima: !!settings.hasQuattordicesima,
    hireDate: settings.hireDate || '',
    ccnl: settings.ccnl || '',
    aziendaDipendenti: settings.aziendaDipendenti || FASCIA_DEFAULT,
    tfrInBusta: !!settings.tfrInBusta,
    tfrTaxRate: settings.tfrTaxRate === '' || settings.tfrTaxRate == null ? '' : toInput(settings.tfrTaxRate),
    previousRates: (Array.isArray(settings.previousRates) ? settings.previousRates : []).map(c => ({
      id: c.id ?? genId(),
      until: c.until ?? '',
      rate: toInput(c.rate),
    })),
    fixedMonthlyItems: (Array.isArray(settings.fixedMonthlyItems) ? settings.fixedMonthlyItems : []).map(v => ({
      id: v.id ?? genId(),
      label: v.label ?? '',
      amount: toInput(v.amount),
    })),
    fixedMonthlyDeductions: (Array.isArray(settings.fixedMonthlyDeductions) ? settings.fixedMonthlyDeductions : []).map(v => ({
      id: v.id ?? genId(),
      label: v.label ?? '',
      amount: toInput(v.amount),
    })),
    monthlyBonusAmount: toInput(settings.monthlyBonusAmount),
    addRegionalePct: toInput(settings.addRegionalePct),
    addComunalePct: toInput(settings.addComunalePct),
    addizionaliAltrove: !!settings.addizionaliAltrove,
    noAddizionali: !!settings.noAddizionali,
    noTrattamentoIntegrativo: !!settings.noTrattamentoIntegrativo,
    tiProjectionMode: settings.tiProjectionMode === 'ytd' ? 'ytd' : 'stimato',
    workingDaysPerWeek: toInput(settings.workingDaysPerWeek ?? 6),
    absenceDailyHours: settings.absenceDailyHours === '' || settings.absenceDailyHours == null
      ? '' : toInput(settings.absenceDailyHours),
    malattiaCarenzaGiorni: toInput(settings.malattiaCarenzaGiorni ?? 3),
    malattiaCarenzaPct: toInput(settings.malattiaCarenzaPct ?? 0),
    malattiaPct: toInput(settings.malattiaPct ?? 100),
    // Non passa da `onSave`: vive in localStorage, gestito da services/telemetry.
    telemetry: isTelemetryEnabled(),
  });
  const [saved, setSaved] = useState(false);
  // Backup: stato locale alla sezione, non passa da onSave (agisce direttamente
  // su localStorage). `turniSalvati` è letto una volta all'apertura della pagina.
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  // Il backup in chiaro, mostrato SOLO quando la consegna non è verificabile:
  // è la via di riserva, non un'opzione da tenere sempre a schermo.
  const [backupTesto, setBackupTesto] = useState(null);
  const backupInputRef = useRef(null);
  const [turniSalvati] = useState(contaTurniSalvati);
  // Turni con l'orario a :50 da correggere: letti una volta sola all'apertura,
  // come turniSalvati. Lista vuota = il blocco non compare proprio.
  const [daCorreggere] = useState(elencoOrariDaCorreggere);
  // Testo digitato nel selettore CCNL (ricerca per nome). Salviamo il codice in
  // form.ccnl, ma l'utente cerca per denominazione: teniamo separati testo e codice.
  const [ccnlQuery, setCcnlQuery] = useState(() => getCcnl(settings.ccnl || '').label);
  // Apertura della tendina custom (la <datalist> nativa è illeggibile in WebView).
  const [ccnlOpen, setCcnlOpen] = useState(false);
  const ccnlBlurTimer = useRef(null);
  useEffect(() => () => clearTimeout(ccnlBlurTimer.current), []);
  // Il timer del messaggio "Salvato!" va annullato allo smontaggio: cambiando
  // vista entro 2 secondi si aggiornerebbe lo stato di un componente sparito.
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSaved(false);
  };

  const setCheck = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.checked }));
    setSaved(false);
  };

  // Le percentuali si normalizzano quando si LASCIA il campo, non mentre si
  // scrive: chi digita «120» passa da «1», «12», «120», e convertire a metà
  // strada sarebbe un campo che combatte con chi ci scrive dentro.
  // La regola, e il perché sopra il 100% non è un indovinello, stanno in
  // utils/maggiorazioni.js.
  const [avvisiMagg, setAvvisiMagg] = useState({});
  const controllaMagg = (field) => () => {
    const esito = normalizzaMaggiorazione(form[field]);
    if (esito.convertito) {
      setForm(f => ({ ...f, [field]: esito.valore }));
      setSaved(false);
    }
    setAvvisiMagg(a => ({ ...a, [field]: messaggioMaggiorazione(esito) }));
  };
  const avvisoMagg = (field) => (avvisiMagg[field]
    ? <p className="form-hint form-hint--attenzione">⚠️ {avvisiMagg[field]}</p>
    : null);

  const addPreviousRate = () => {
    setForm(f => ({ ...f, previousRates: [...f.previousRates, { id: genId(), until: '', rate: '' }] }));
    setSaved(false);
  };

  const updatePreviousRate = (id, field) => (e) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      previousRates: f.previousRates.map(c => (c.id === id ? { ...c, [field]: value } : c)),
    }));
    setSaved(false);
  };

  const removePreviousRate = (id) => {
    setForm(f => ({ ...f, previousRates: f.previousRates.filter(c => c.id !== id) }));
    setSaved(false);
  };

  const addFixedItem = () => {
    setForm(f => ({ ...f, fixedMonthlyItems: [...f.fixedMonthlyItems, { id: genId(), label: '', amount: '' }] }));
    setSaved(false);
  };

  const updateFixedItem = (id, field) => (e) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      fixedMonthlyItems: f.fixedMonthlyItems.map(v => (v.id === id ? { ...v, [field]: value } : v)),
    }));
    setSaved(false);
  };

  const removeFixedItem = (id) => {
    setForm(f => ({ ...f, fixedMonthlyItems: f.fixedMonthlyItems.filter(v => v.id !== id) }));
    setSaved(false);
  };

  const addFixedDeduction = () => {
    setForm(f => ({ ...f, fixedMonthlyDeductions: [...f.fixedMonthlyDeductions, { id: genId(), label: '', amount: '' }] }));
    setSaved(false);
  };

  const updateFixedDeduction = (id, field) => (e) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      fixedMonthlyDeductions: f.fixedMonthlyDeductions.map(v => (v.id === id ? { ...v, [field]: value } : v)),
    }));
    setSaved(false);
  };

  const removeFixedDeduction = (id) => {
    setForm(f => ({ ...f, fixedMonthlyDeductions: f.fixedMonthlyDeductions.filter(v => v.id !== id) }));
    setSaved(false);
  };

  // Le parole seguono quello che è successo DAVVERO, non l'assenza di errori.
  // Prima si scriveva «Backup creato» in ogni caso, anche quando il browser
  // aveva rifiutato il download in silenzio: chi lo leggeva restava senza copia
  // e senza saperlo. Ora l'unico caso che promette qualcosa è quello in cui il
  // file è stato scritto sotto i nostri occhi.
  async function handleEsportaBackup() {
    setBackupBusy(true);
    setBackupMsg(null);
    setBackupTesto(null);
    try {
      const { turni, esito, testo } = await esportaBackup();

      if (esito === ESITO.SALVATO) {
        setBackupMsg({ testo: `Backup salvato: ${turni} turni.` });
      } else if (esito === ESITO.CONDIVISO) {
        setBackupMsg({ testo: `Backup di ${turni} turni pronto. Controlla di averlo salvato dove volevi: finché resta solo fra i file temporanei, il telefono può cancellarlo.` });
      } else if (esito === ESITO.ANNULLATO) {
        setBackupMsg({ testo: 'Backup annullato: non è stato salvato nessun file.' });
      } else {
        // NON_VERIFICABILE: il download è partito, ma il browser non dice se è
        // arrivato. Si chiede all'utente di guardare, e intanto gli si mette in
        // mano la seconda via — che è l'unica cosa utile da fare qui.
        setBackupMsg({
          attenzione: true,
          testo: `Backup di ${turni} turni avviato. Controlla che il file sia davvero fra i download: alcuni browser (Safari in modalità app, quelli dentro Instagram o Facebook) li bloccano senza dirlo. Se non lo trovi, copia il testo qui sotto e incollalo in una nota o in una mail.`,
        });
        setBackupTesto(testo);
      }
    } catch (err) {
      setBackupMsg({ errore: true, testo: err.message || 'Impossibile creare il backup.' });
    } finally {
      setBackupBusy(false);
    }
  }

  async function copiaBackup() {
    try {
      await navigator.clipboard.writeText(backupTesto);
      setBackupMsg({ testo: 'Backup copiato: incollalo subito da qualche parte.' });
    } catch {
      // Gli appunti possono essere negati (permesso rifiutato, contesto non
      // sicuro). Il riquadro di testo resta visibile e selezionabile a mano:
      // è il motivo per cui non lo si nasconde dopo aver copiato.
      setBackupMsg({ attenzione: true, testo: 'Non riesco a copiare da solo: seleziona il testo qui sotto e copialo a mano.' });
    }
  }

  async function handleImportaBackup(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Il ripristino sovrascrive mesi di turni: la conferma non è una formalità.
    const conferma = window.confirm(
      'Il ripristino sostituisce TUTTI i turni e le impostazioni presenti su questo telefono. Continuare?'
    );
    if (!conferma) return;

    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const { turni } = await importaBackup(file);
      setBackupMsg({ testo: `Ripristinati ${turni} turni. Ricarico l'app…` });
      // Gli hook useLocalStorage leggono solo all'inizializzazione: senza reload
      // la schermata continuerebbe a mostrare i dati vecchi.
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setBackupMsg({ errore: true, testo: err.message || 'Ripristino non riuscito.' });
      setBackupBusy(false);
    }
  }

  function handleCorreggiOrari() {
    const conferma = window.confirm(
      `Vengono corretti ${daCorreggere.length} turni, portando i minuti da :50 a :30. Continuare?`
    );
    if (!conferma) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const corretti = applicaCorrezioneOrari();
      setBackupMsg({ testo: `Corretti ${corretti} turni. Ricarico l'app…` });
      // Come per il ripristino: useLocalStorage legge solo all'inizializzazione.
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setBackupMsg({ errore: true, testo: err.message || 'Correzione non riuscita.' });
      setBackupBusy(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const previousRates = form.previousRates
      .filter(c => c.until && parseNum(c.rate) > 0)
      .map(c => ({ id: c.id, until: c.until, rate: parseNum(c.rate) }))
      .sort((a, b) => a.until.localeCompare(b.until));

    const fixedMonthlyItems = form.fixedMonthlyItems
      .filter(v => parseNum(v.amount) > 0)
      .map(v => ({ id: v.id, label: (v.label || '').trim() || 'Voce fissa', amount: parseNum(v.amount) }));

    const fixedMonthlyDeductions = form.fixedMonthlyDeductions
      .filter(v => parseNum(v.amount) > 0)
      .map(v => ({ id: v.id, label: (v.label || '').trim() || 'Trattenuta fissa', amount: parseNum(v.amount) }));

    // Montante: il mese di riferimento (confine turni) è quello scelto
    // dall'utente. Si conserva come data ISO al primo giorno del mese, perché
    // il resto dell'app lavora su 'YYYY-MM' via slice. Azzerato se il montante
    // va a 0.
    const newMontante = parseNum(form.priorTaxableIncome);
    const month = /^\d{4}-\d{2}$/.test(form.priorIncomeMonth)
      ? form.priorIncomeMonth
      : currentMonthValue();
    const priorIncomeDate = newMontante > 0 ? `${month}-01` : '';

    onSave({
      hourlyRate: parseNum(form.hourlyRate),
      expectedWeeklyHours: parseNum(form.expectedWeeklyHours),
      fullTimeWeeklyHours: parseNum(form.fullTimeWeeklyHours),
      sundaySurchargePct: parseNum(form.sundaySurchargePct),
      overtimeSurchargePct: parseNum(form.overtimeSurchargePct),
      straordinarioSurchargePct: form.straordinarioSurchargePct === '' ? '' : parseNum(form.straordinarioSurchargePct),
      holidaySurchargePct: parseNum(form.holidaySurchargePct),
      holidaySundayMode: form.holidaySundayMode,
      nightSurchargePct: parseNum(form.nightSurchargePct),
      nightStart: form.nightStart || '',
      nightEnd: form.nightEnd || '',
      nightCumuloMode: form.nightCumuloMode,
      patronSaintDate: form.patronSaintDate,
      priorTaxableIncome: newMontante,
      priorIncomeDate,
      workerName: form.workerName.trim(),
      onCall: form.onCall,
      annualGrossManual: parseNum(form.annualGrossManual),
      dailyOvertimeThreshold: parseNum(form.dailyOvertimeThreshold),
      hasTredicesima: form.hasTredicesima,
      hasQuattordicesima: form.hasQuattordicesima,
      hireDate: form.hireDate,
      ccnl: form.ccnl,
      aziendaDipendenti: form.aziendaDipendenti,
      tfrInBusta: form.tfrInBusta,
      tfrTaxRate: form.tfrTaxRate === '' ? '' : parseNum(form.tfrTaxRate),
      previousRates,
      fixedMonthlyItems,
      fixedMonthlyDeductions,
      monthlyBonusAmount: parseNum(form.monthlyBonusAmount),
      monthlyBonus: settings.monthlyBonus || {}, // gestito dal calendario, va preservato
      addRegionalePct: parseNum(form.addRegionalePct),
      addComunalePct: parseNum(form.addComunalePct),
      addizionaliAltrove: form.addizionaliAltrove,
      noAddizionali: form.noAddizionali,
      noTrattamentoIntegrativo: form.noTrattamentoIntegrativo,
      tiProjectionMode: form.tiProjectionMode,
      workingDaysPerWeek: parseNum(form.workingDaysPerWeek),
      absenceDailyHours: form.absenceDailyHours === '' ? '' : parseNum(form.absenceDailyHours),
      malattiaCarenzaGiorni: parseNum(form.malattiaCarenzaGiorni),
      malattiaCarenzaPct: parseNum(form.malattiaCarenzaPct),
      malattiaPct: parseNum(form.malattiaPct),
    });
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  };

  const ccnlPreset = getCcnl(form.ccnl);
  // Le aliquote degli ammortizzatori non stanno nel CCNL: si ricavano dalla
  // fascia dimensionale scelta qui sopra, così l'elenco mostra quelle vere.
  const contributiLegge = contributiDiLegge(
    { aziendaDipendenti: form.aziendaDipendenti },
    ccnlPreset.ammortizzatori,
  );
  // 0,2666… non va mostrato per intero: due decimali bastano, e gli interi
  // restano interi (0,30 e non 0,3000).
  const fmtPct = (pct) => String(Number(Number(pct).toFixed(2))).replace('.', ',');
  // Digitando nel campo CCNL: aggiorna il testo, apri la tendina; se il campo è
  // vuoto azzera il contratto selezionato.
  const onCcnlQuery = (e) => {
    const text = e.target.value;
    setCcnlQuery(text);
    setCcnlOpen(true);
    setSaved(false);
    if (text.trim() === '') setForm(f => ({ ...f, ccnl: '' }));
  };
  // Voci mostrate nella tendina: filtro per nome, cap a 50 (l'elenco ha 1000+ voci).
  const ccnlMatches = (() => {
    const q = ccnlQuery.trim().toLowerCase();
    const selected = getCcnl(form.ccnl).label;
    // Se il testo coincide col contratto già scelto, mostro l'elenco intero (l'utente
    // sta riaprendo per cambiare), altrimenti filtro su quello che sta scrivendo.
    const src = (!q || q === selected.toLowerCase()) ? CCNL_LIST : CCNL_LIST.filter(c => c.label.toLowerCase().includes(q));
    return src.slice(0, 50);
  })();
  // Scelta di una voce dalla tendina.
  const pickCcnl = (c) => {
    setForm(f => ({ ...f, ccnl: c.codice }));
    setCcnlQuery(c.label);
    setCcnlOpen(false);
    setSaved(false);
  };
  const hourlyRate = parseNum(form.hourlyRate);
  const weeklyHours = parseNum(form.expectedWeeklyHours);
  const weeklyPay = hourlyRate * weeklyHours;
  // Stessa base della mensilità usata dal motore: il divisore orario dipende dal CCNL.
  const monthlyPay = weeklyPay * ccnlPreset.monthlyHoursFactor;
  // Contratto mensilizzato (es. Turismo): le ore contrattuali sono un numero
  // fisso al mese e il supplementare si conta su quello, non sulla settimana.
  const mensilizzato = !form.onCall && ccnlPreset.mensilizzato;
  const oreMensili = (weeklyHours * ccnlPreset.monthlyHoursFactor).toFixed(2).replace('.', ',');
  // Ore di una giornata non lavorata calcolate dal contratto, mostrate come
  // suggerimento accanto al campo che le può sovrascrivere.
  const oreAssenzaCalcolate = (
    minutiGiornoAssenza({
      expectedWeeklyHours: weeklyHours,
      workingDaysPerWeek: parseNum(form.workingDaysPerWeek),
    }) / 60
  ).toFixed(2).replace('.', ',');
  // Fascia notturna del contratto scelto, e se quella impostata se ne discosta.
  // Non si allinea da sola: chi ha copiato gli orari dal proprio cedolino ha
  // ragione anche quando il contratto dice altro, e sovrascriverglieli in
  // silenzio sarebbe il modo peggiore di «aiutarlo».
  const fasciaCcnl = ccnlPreset.fasciaNotturna;
  const fasciaDiversaDalCcnl = !!fasciaCcnl
    && (form.nightStart !== fasciaCcnl.inizio || form.nightEnd !== fasciaCcnl.fine);
  const fullTimeWeeklyHours = parseNum(form.fullTimeWeeklyHours);
  const oreMensiliFullTime = (fullTimeWeeklyHours * ccnlPreset.monthlyHoursFactor).toFixed(2).replace('.', ',');
  // Soglia degli straordinari attiva solo se il full-time supera davvero le
  // ore da contratto: altrimenti (già full-time) non c'è fascia intermedia.
  const haStraordinari = !form.onCall && fullTimeWeeklyHours > weeklyHours;

  return (
    <div className="settings-page">
      <h1 className="page-title">Impostazioni</h1>

      <form onSubmit={handleSubmit} className="settings-form">

        {/* ══ ESSENZIALI ══════════════════════════════════════════ */}

        {/* Paga oraria attuale */}
        <details className="settings-section" open>
          <summary className="settings-section-title">💰 Paga oraria</summary>
          <p className="settings-section-desc">
            Inserisci la tua paga oraria lorda <strong>attuale</strong>. È quella usata per i
            turni di oggi e futuri. Se durante l'anno hai avuto un aumento, registra le paghe
            precedenti nel blocco <strong>Avanzate</strong> qui sotto. Puoi usare la virgola per i decimali (es. 9,3542).
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="hourly-rate">Paga oraria attuale (€/ora)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="hourly-rate"
                type="text"
                inputMode="decimal"
                className="form-input form-input--with-symbol"
                placeholder="0,00"
                value={form.hourlyRate}
                onChange={set('hourlyRate')}
              />
            </div>
          </div>

          {/* Anteprima settimanale/mensile: ha senso solo con un orario da
              contratto. A chiamata le ore settimanali non esistono — quelle in
              memoria sono il default a 40 — e mostrare «per 40h/settimana» a chi
              lavora quando lo chiamano è una mensilità inventata. Il motore del
              netto lo sa già: monthlyBaseGross ritorna 0 per onCall. */}
          {hourlyRate > 0 && form.onCall && (
            <p className="form-hint">
              A chiamata la paga oraria è l'unico dato certo: quanto entra in un mese
              dipende dai turni, e lo trovi sul calendario.
            </p>
          )}

          {hourlyRate > 0 && !form.onCall && (
            <div className="pay-preview">
              <div className="pay-preview-row">
                <span>Per {weeklyHours}h/settimana:</span>
                <strong>{formatCurrency(weeklyPay)}</strong>
              </div>
              <div className="pay-preview-row">
                {/* Il divisore NON è sempre 4,33: il Turismo usa 4,3 (103,20 h
                    al mese su 24 settimanali). Scriverlo fisso faceva leggere
                    "×4,33" accanto a un importo calcolato con 4,3. */}
                <span>Stima mensile (×{String(Number(ccnlPreset.monthlyHoursFactor.toFixed(2))).replace('.', ',')}):</span>
                <strong>{formatCurrency(monthlyPay)}</strong>
              </div>
              <p className="pay-preview-note">
                * Importi lordi stimati. Non include straordinari, indennità, detrazioni fiscali o contributi.
              </p>
            </div>
          )}
        </details>

        {/* Ore previste / lavoro a chiamata */}
        <details className="settings-section">
          <summary className="settings-section-title">📋 Orario di lavoro</summary>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.onCall}
              onChange={setCheck('onCall')}
            />
            <span>Lavoratore a chiamata (senza ore settimanali fisse)</span>
          </label>

          {!form.onCall ? (
            <>
              <p className="settings-section-desc">
                Quante ore dovresti lavorare ogni settimana secondo il tuo contratto.
                Le ore oltre questa soglia diventano <strong>supplementari</strong>; oltre
                le ore full-time (sotto) diventano <strong>straordinari</strong>, con una
                maggiorazione diversa.
              </p>
              {mensilizzato && (
                <p className="settings-section-desc">
                  Il CCNL {ccnlPreset.label} è <strong>mensilizzato</strong>: in busta la
                  retribuzione è un numero fisso di ore al mese ({oreMensili} h), e sono
                  supplementari le ore che superano quel totale nel mese — non quelle oltre
                  le {weeklyHours || 0} h della singola settimana. Il mese, per la busta, va
                  da lunedì a domenica: la settimana a cavallo conta tutta nel mese in cui
                  comincia.
                </p>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="expected-hours">Ore settimanali</label>
                <input
                  id="expected-hours"
                  type="number"
                  className="form-input"
                  min="0"
                  max="84"
                  step="0.5"
                  value={form.expectedWeeklyHours || ''}
                  onChange={set('expectedWeeklyHours')}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="fulltime-hours">Ore settimanali full-time</label>
                <input
                  id="fulltime-hours"
                  type="number"
                  className="form-input"
                  min="0"
                  max="84"
                  step="0.5"
                  value={form.fullTimeWeeklyHours || ''}
                  onChange={set('fullTimeWeeklyHours')}
                />
                <p className="form-hint">
                  Se lavori part-time: le ore oltre questa soglia sono straordinari, non
                  supplementari. Uguale alle "ore settimanali" se sei già full-time.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="settings-section-desc">
                Senza ore fisse, lo straordinario e il reddito annuo vanno impostati a mano.
                Lo straordinario scatta per le ore che superano la soglia <strong>giornaliera</strong>.
                Il reddito annuo serve solo a stimare l'aliquota fiscale; se lo lasci vuoto viene
                stimato annualizzando i turni che hai inserito.
              </p>
              {/* Chi sceglie un CCNL mensilizzato E «a chiamata» non vede il mese
                  di paga a settimane intere, e senza una riga che lo dica sembra
                  che l'app se ne sia dimenticata. */}
              {ccnlPreset.mensilizzato && (
                <p className="settings-section-desc">
                  Il CCNL {ccnlPreset.label} è mensilizzato, ma <strong>il lavoro a chiamata
                  non lo è</strong>: non esiste un monte ore fisso da retribuire ogni mese, si
                  paga quello che si lavora. Del CCNL restano i contributi, non l'orario.
                </p>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="daily-ot">Soglia straordinario giornaliera (ore)</label>
                <input
                  id="daily-ot"
                  type="number"
                  className="form-input"
                  min="0"
                  max="24"
                  step="0.5"
                  placeholder="es. 8"
                  value={form.dailyOvertimeThreshold || ''}
                  onChange={set('dailyOvertimeThreshold')}
                />
              </div>
            </>
          )}

          {/* Il reddito annuo previsto serve a tutti, non solo a chi è a
              chiamata: decide aliquota, detrazioni e bonus. Automatico va bene
              finché le ore sono regolari, ma su lavoro a turni la previsione
              può sbagliare di parecchio, e qui la si corregge. */}
          <div className="form-group">
            <label className="form-label" htmlFor="annual-manual">Reddito annuo lordo previsto (opzionale)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="annual-manual"
                type="text"
                inputMode="decimal"
                className="form-input form-input--with-symbol"
                placeholder="es. 14000"
                value={form.annualGrossManual}
                onChange={set('annualGrossManual')}
              />
            </div>
            <p className="form-hint">
              Da qui dipendono aliquota IRPEF, detrazioni e bonus. Se lo lasci vuoto viene stimato
              da solo, prendendo il più alto fra la proiezione da contratto e i turni già inseriti
              annualizzati. Compilalo se sai che il resto dell'anno sarà diverso dai mesi appena
              passati — con i turni capita spesso.
            </p>
          </div>
        </details>

        {/* Maggiorazioni */}
        <details className="settings-section">
          <summary className="settings-section-title">📈 Maggiorazioni</summary>
          <p className="settings-section-desc">
            Domenicale e festivo vengono applicate <strong>automaticamente</strong> ai turni di
            domenica e nelle festività nazionali (incluse Pasqua e Pasquetta). Gli straordinari
            si applicano alle ore oltre la soglia
            {form.onCall ? ' giornaliera' : mensilizzato ? ' mensile da contratto' : ' settimanale da contratto'}. Per altre maggiorazioni
            (notturni…) usa la percentuale manuale sul singolo turno.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="sunday-surcharge">Maggiorazione domenicale (%)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                id="sunday-surcharge"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="200"
                step="0.5"
                placeholder="es. 30"
                value={form.sundaySurchargePct || ''}
                onChange={set('sundaySurchargePct')}
                onBlur={controllaMagg('sundaySurchargePct')}
              />
            </div>
            {avvisoMagg('sundaySurchargePct')}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="holiday-surcharge">Maggiorazione festivi (%)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                id="holiday-surcharge"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="200"
                step="0.5"
                placeholder="es. 50"
                value={form.holidaySurchargePct || ''}
                onChange={set('holidaySurchargePct')}
                onBlur={controllaMagg('holidaySurchargePct')}
              />
            </div>
            {avvisoMagg('holidaySurchargePct')}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="holiday-sunday-mode">Se un festivo cade di domenica</label>
            <select
              id="holiday-sunday-mode"
              className="form-input"
              value={form.holidaySundayMode}
              onChange={set('holidaySundayMode')}
            >
              <option value="max">Applica solo la più alta</option>
              <option value="sum">Somma festivo + domenicale</option>
              <option value="holiday">Solo festivo</option>
            </select>
            <p className="form-hint">Dipende dal CCNL: alcuni cumulano le due maggiorazioni, altri no.</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="night-surcharge">Maggiorazione notturna (%)</label>
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                id="night-surcharge"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="200"
                step="0.5"
                placeholder="es. 20"
                value={form.nightSurchargePct || ''}
                onChange={set('nightSurchargePct')}
                onBlur={controllaMagg('nightSurchargePct')}
              />
            </div>
            {avvisoMagg('nightSurchargePct')}
            <p className="form-hint">
              Si applica <strong>alle sole ore che cadono nella fascia</strong>, non a tutto il
              turno: un 20:00–02:00 ha quattro ore notturne e due diurne. Lascia vuoto se il tuo
              contratto non la prevede.
            </p>
          </div>

          {form.nightSurchargePct > 0 && (
            <>
              <div className="form-group">
                <label className="form-label">Fascia notturna</label>
                <div className="form-row">
                  <input
                    type="time"
                    className="form-input"
                    aria-label="Inizio della fascia notturna"
                    value={form.nightStart}
                    onChange={set('nightStart')}
                  />
                  <input
                    type="time"
                    className="form-input"
                    aria-label="Fine della fascia notturna"
                    value={form.nightEnd}
                    onChange={set('nightEnd')}
                  />
                </div>
                {fasciaCcnl && fasciaDiversaDalCcnl && (
                  <p className="form-hint form-hint--warn">
                    ⚠️ Il contratto <strong>{ccnlPreset.label}</strong> usa la fascia{' '}
                    <strong>{fasciaCcnl.inizio}–{fasciaCcnl.fine}</strong>, diversa da quella
                    qui sopra. Se l'hai copiata dal tuo cedolino tienila com'è — la busta
                    batte il contratto. Altrimenti{' '}
                    <button
                      type="button"
                      className="linklike"
                      onClick={() => {
                        setForm(f => ({ ...f, nightStart: fasciaCcnl.inizio, nightEnd: fasciaCcnl.fine }));
                        setSaved(false);
                      }}
                    >
                      usa quella del contratto
                    </button>.
                  </p>
                )}
                <p className="form-hint">
                  <strong>22:00–06:00</strong> è la fascia di legge, e vale per vigilanza,
                  commercio e metalmeccanici.{' '}
                  <strong>Nel turismo non è questa</strong>, e non lo è di sicuro: lì comincia
                  più tardi e cambia da settore a settore — si trovano 23:00, 23:30 e 24:00 —
                  e non coincide nemmeno fra i vari contratti firmati sotto quel nome. L'app
                  parte dalle 23:00, che è il più prudente fra i valori plausibili.{' '}
                  <strong>Copiala dal tuo cedolino</strong>: è l'unico posto dove il numero è
                  quello vero.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="night-cumulo">Se il turno notturno è anche domenica o festivo</label>
                <select
                  id="night-cumulo"
                  className="form-input"
                  value={form.nightCumuloMode}
                  onChange={set('nightCumuloMode')}
                >
                  <option value="max">Applica solo la più alta</option>
                  <option value="somma">Somma notturna + domenicale/festiva</option>
                </select>
                <p className="form-hint">
                  Quasi tutti i CCNL non cumulano: la maggiorazione più alta assorbe la più bassa.
                  Scegli la somma solo se hai un accordo aziendale che lo prevede davvero.
                </p>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="patron-saint">Santo patrono (festività locale)</label>
            <input
              id="patron-saint"
              type="date"
              className="form-input"
              value={form.patronSaintDate ? `2000-${form.patronSaintDate}` : ''}
              onChange={(e) => {
                setForm(f => ({ ...f, patronSaintDate: e.target.value ? e.target.value.slice(5) : '' }));
                setSaved(false);
              }}
            />
            <p className="form-hint">Opzionale. Conta solo giorno e mese (es. 29/06 Roma, 07/12 Milano).</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="overtime-surcharge">
              {form.onCall ? 'Maggiorazione straordinari (%)' : 'Maggiorazione supplementari (%)'}
            </label>
            <div className="input-with-symbol">
              <span className="input-symbol">%</span>
              <input
                id="overtime-surcharge"
                type="number"
                className="form-input form-input--with-symbol"
                min="0"
                max="200"
                step="0.5"
                placeholder="es. 15"
                value={form.overtimeSurchargePct || ''}
                onChange={set('overtimeSurchargePct')}
                onBlur={controllaMagg('overtimeSurchargePct')}
              />
            </div>
            {avvisoMagg('overtimeSurchargePct')}
            <p className="form-hint">
              {form.onCall
                ? `Applicata alle ore oltre le ${parseNum(form.dailyOvertimeThreshold) || 0}h giornaliere.`
                : mensilizzato
                  ? `Applicata alle ore oltre le ${oreMensili}h del mese${haStraordinari ? '' : ' (contratto mensilizzato)'}.`
                  : `Applicata alle ore oltre le ${weeklyHours || 0}h settimanali da contratto.`}
              {!form.onCall && haStraordinari && ' Oltre il full-time scattano gli straordinari, sotto.'}
            </p>
          </div>

          {!form.onCall && (
            <div className="form-group">
              <label className="form-label" htmlFor="straordinario-surcharge">
                Maggiorazione straordinari (%)
              </label>
              <div className="input-with-symbol">
                <span className="input-symbol">%</span>
                <input
                  id="straordinario-surcharge"
                  type="number"
                  className="form-input form-input--with-symbol"
                  min="0"
                  max="200"
                  step="0.5"
                  placeholder="es. 30"
                  value={form.straordinarioSurchargePct}
                  onChange={set('straordinarioSurchargePct')}
                onBlur={controllaMagg('straordinarioSurchargePct')}
                />
              </div>
            {avvisoMagg('straordinarioSurchargePct')}
              <p className="form-hint">
                {haStraordinari
                  ? `Applicata alle ore oltre le ${mensilizzato ? `${oreMensiliFullTime}h del mese` : `${fullTimeWeeklyHours || 0}h settimanali`} full-time.`
                  : 'Imposta le ore full-time sopra per attivare questa soglia.'}
                {' '}Vuoto = stessa aliquota dei supplementari.
              </p>
            </div>
          )}
        </details>

        {/* Ferie, permessi e malattia */}
        <details className="settings-section">
          <summary className="settings-section-title">🏖 Ferie, permessi e malattia</summary>
          <p className="settings-section-desc">
            In busta una giornata di ferie, permesso, malattia o festività vale un
            <strong> numero fisso di ore</strong>, non l'orario che avresti fatto. Senza
            segnarle, le ore dell'app restano sotto quelle del cedolino.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="working-days">Giorni lavorativi a settimana</label>
              <input
                id="working-days"
                type="number"
                className="form-input"
                min="1"
                max="7"
                step="1"
                value={form.workingDaysPerWeek}
                onChange={set('workingDaysPerWeek')}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="absence-hours-setting">Ore di una giornata non lavorata</label>
              <input
                id="absence-hours-setting"
                type="number"
                className="form-input"
                min="0"
                max="24"
                step="0.5"
                placeholder={String(oreAssenzaCalcolate)}
                value={form.absenceDailyHours}
                onChange={set('absenceDailyHours')}
              />
            </div>
          </div>
          <p className="form-hint">
            Vuoto = calcolato dal contratto: {weeklyHours || 0} h ÷ {form.workingDaysPerWeek || 6} giorni
            = <strong>{oreAssenzaCalcolate} h</strong> al giorno.
          </p>

          <p className="settings-section-desc" style={{ marginTop: '1rem' }}>
            <strong>Malattia.</strong> Molti contratti pagano i primi giorni di ogni malattia
            in modo diverso dai successivi. La carenza si conta per <strong>evento</strong>:
            due malattie separate hanno ciascuna i propri giorni iniziali.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="carenza-giorni">Primi giorni</label>
              <input
                id="carenza-giorni"
                type="number"
                className="form-input"
                min="0"
                max="30"
                step="1"
                value={form.malattiaCarenzaGiorni}
                onChange={set('malattiaCarenzaGiorni')}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="carenza-pct">% in quei giorni</label>
              <div className="input-with-symbol">
                <span className="input-symbol">%</span>
                <input
                  id="carenza-pct"
                  type="number"
                  className="form-input form-input--with-symbol"
                  min="0"
                  max="100"
                  step="1"
                  value={form.malattiaCarenzaPct}
                  onChange={set('malattiaCarenzaPct')}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="malattia-pct">% dopo</label>
              <div className="input-with-symbol">
                <span className="input-symbol">%</span>
                <input
                  id="malattia-pct"
                  type="number"
                  className="form-input form-input--with-symbol"
                  min="0"
                  max="100"
                  step="1"
                  value={form.malattiaPct}
                  onChange={set('malattiaPct')}
                />
              </div>
            </div>
          </div>
          <p className="form-hint form-hint--warn">
            ⚠️ Questi valori <strong>non sono verificati</strong>, a differenza di contributi e
            aliquote fiscali. La struttura è quella dello schema INPS (primi giorni a parte), ma
            quanto prendi davvero dipende dal contratto <em>e dall'azienda</em>.
          </p>
          <p className="form-hint">
            I primi giorni sono proposti a <strong>0%</strong> perché molti contratti non li
            pagano — ma <strong>certe aziende li pagano lo stesso</strong>, per scelta propria:
            in due cedolini esaminati compare una voce «Carenza malattia» con un importo. Se hai
            una busta con un periodo di malattia, guardala prima di lasciare zero: la differenza
            su una settimana di malattia non è piccola.
          </p>
        </details>

        {/* Reddito e bonus Renzi */}
        <details className="settings-section">
          <summary className="settings-section-title">💶 Reddito e trattamento integrativo (ex bonus Renzi)</summary>
          <p className="settings-section-desc">
            Nel calendario vedi il tuo <strong>reddito totale</strong> dell'anno e quanto puoi
            ancora guadagnare prima di superare le soglie del trattamento integrativo (ex bonus
            Renzi). Inserisci il <strong>lordo totale già guadagnato quest'anno</strong> e
            <strong> fino a quale mese</strong> è compreso: dai mesi successivi l'app
            <strong> aggiunge automaticamente</strong> i turni che inserisci, senza contare due volte
            quelli già compresi. Può includere anche redditi da altri lavori. Se inserisci tutti i
            turni dell'anno da zero, lascia 0.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="prior-income">Reddito lordo già guadagnato quest'anno</label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="prior-income"
                type="text"
                inputMode="decimal"
                className="form-input form-input--with-symbol"
                placeholder="0,00"
                value={form.priorTaxableIncome}
                onChange={set('priorTaxableIncome')}
              />
            </div>
          </div>

          {parseNum(form.priorTaxableIncome) > 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="prior-month">Comprende i turni fino a tutto il mese di</label>
              <input
                id="prior-month"
                type="month"
                className="form-input"
                value={form.priorIncomeMonth}
                onChange={set('priorIncomeMonth')}
              />
              <p className="form-hint">
                I turni di questo mese e dei precedenti sono considerati già inclusi nell'importo
                qui sopra; quelli dei mesi successivi vengono sommati.
              </p>
            </div>
          )}
        </details>

        {/* CCNL: contributi minori e divisore orario */}
        <details className="settings-section settings-section--beta">
          <summary className="settings-section-title">📜 CCNL (beta)</summary>
          <p className="settings-section-desc">
            Oltre all'IVS (9,19%) quasi tutti i contratti prevedono trattenute minori — FIS, CIGS,
            Ente Bilaterale — che pesano qualche euro al mese e che senza il contratto non si possono
            indovinare. Il CCNL determina anche il <strong>divisore orario</strong> con cui si calcola
            la mensilità (e quindi 13ª e 14ª).
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="ccnl">Contratto</label>
            <div className="combobox">
              <input
                id="ccnl"
                className="form-input"
                type="text"
                role="combobox"
                aria-expanded={ccnlOpen}
                value={ccnlQuery}
                onChange={onCcnlQuery}
                onFocus={() => setCcnlOpen(true)}
                onBlur={() => { ccnlBlurTimer.current = setTimeout(() => setCcnlOpen(false), 150); }}
                onKeyDown={(e) => { if (e.key === 'Escape') setCcnlOpen(false); }}
                placeholder="Cerca il tuo contratto per nome…"
                autoComplete="off"
              />
              {ccnlOpen && ccnlMatches.length > 0 && (
                <ul className="combobox-list">
                  {ccnlMatches.map(c => (
                    <li key={c.codice}>
                      <button
                        type="button"
                        className={'combobox-option' + (c.codice === form.ccnl ? ' is-active' : '')}
                        // onMouseDown (non onClick): scatta prima del blur, che altrimenti
                        // chiuderebbe la lista prima di registrare la scelta.
                        onMouseDown={(e) => { e.preventDefault(); pickCcnl(c); }}
                      >
                        {c.label}{c.verificato ? ' ✓' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="form-hint">
              {form.ccnl
                ? (ccnlPreset.verificato ? '✓ Contratto verificato su busta reale.' : 'Contratto selezionato.')
                : 'Digita e scegli dall\'elenco. Sono elencati i CCNL vigenti dall\'archivio CNEL.'}
            </p>
            {form.ccnl && ccnlPreset.note && (
              <p className="form-hint">ℹ️ {ccnlPreset.note}</p>
            )}
          </div>

          {ccnlPreset.ammortizzatori && (
            <div className="form-group">
              <label className="form-label" htmlFor="azienda-dipendenti">Dipendenti dell'azienda</label>
              <select
                id="azienda-dipendenti"
                className="form-input"
                value={form.aziendaDipendenti}
                onChange={set('aziendaDipendenti')}
              >
                {FASCE_DIPENDENTI.map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <p className="form-hint">
                Serve davvero: FIS e CIGS sono contributi di <strong>legge</strong>, non del
                contratto, e cambiano a scaglioni. Il FIS passa da 0,50% a 0,80% oltre i 5
                dipendenti, e la CIGS si paga <strong>solo oltre i 15</strong>. Lo stesso CCNL,
                in un'azienda piccola, trattiene meno.
              </p>
            </div>
          )}

          {contributiLegge.length > 0 || ccnlPreset.contributiExtra.length > 0 || ccnlPreset.enteBilaterale ? (
            <>
              <p className="form-hint">Trattenute aggiuntive applicate alla stima del netto:</p>
              <ul className="settings-list">
                {contributiLegge.map(c => (
                  <li key={c.label}>
                    {c.label} — {fmtPct(c.pct)}% del lordo <em>(di legge, per fascia dimensionale)</em>
                  </li>
                ))}
                {ccnlPreset.contributiExtra.map(c => (
                  <li key={c.label}>{c.label} — {fmtPct(c.pct)}% del lordo</li>
                ))}
                {ccnlPreset.enteBilaterale && (
                  <li>
                    {ccnlPreset.enteBilaterale.label} — {fmtPct(ccnlPreset.enteBilaterale.pct)}%
                    della retribuzione contrattuale
                  </li>
                )}
              </ul>
            </>
          ) : (
            <p className="form-hint">Nessuna trattenuta aggiuntiva: viene applicato il solo IVS 9,19%.</p>
          )}

          {form.ccnl && !ccnlPreset.verificato && (
            <p className="form-hint">
              ⚠️ Aliquote indicative, <strong>non riscontrate su una busta reale</strong>. Se hai il
              cedolino sotto mano, confronta le voci: dove non tornano, il dato giusto è quello.
            </p>
          )}
        </details>

        {/* Import turni da foto (AI) */}
        <details className="settings-section">
          <summary className="settings-section-title">🤖 Import turni da foto</summary>
          <p className="settings-section-desc">
            L'immagine viene inviata a Google Gemini per la lettura e non viene conservata.
            I turni restano sul tuo telefono. Il <strong>nome</strong> da cercare sul foglio
            te lo chiede l'app al primo import da immagine (e potrai cambiarlo da lì).
          </p>

          {/* L'interruttore compare SOLO dove la telemetria esiste davvero (l'APK
              di prova). Nel sito non c'è endpoint: mostrarlo lo stesso sarebbe un
              comando che non governa niente e che lascia credere che qualcosa
              parta. Vedi `telemetriaDisponibile` in services/telemetry.js. */}
          {telemetriaDisponibile ? (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.telemetry}
                  onChange={(e) => { setTelemetryEnabled(e.target.checked); setForm(f => ({ ...f, telemetry: e.target.checked })); }}
                />
                <span>Invia statistiche anonime d'uso dell'import</span>
              </label>
              <p className="form-hint">
                Solo il numero di token consumati e un identificativo casuale dell'installazione:
                nessun turno, nessuna immagine, niente che ti identifichi. Serve a capire quanto
                costa la funzione durante la beta.
              </p>
            </>
          ) : (
            <p className="form-hint">
              Di questa app non viene raccolta nessuna statistica d'uso: né quante volte
              importi, né quanto costa. Non c'è niente da spegnere.
            </p>
          )}
        </details>

        {/* Backup e ripristino: i dati vivono solo in localStorage */}
        <details className="settings-section">
          <summary className="settings-section-title">💾 Backup e ripristino</summary>
          <p className="settings-section-desc">
            Turni e impostazioni esistono <strong>solo su questo telefono</strong>: non c'è nessun
            account e nessuna copia altrove. Esporta un backup prima di cambiare telefono,
            reinstallare l'app o aggiornarla da una fonte diversa — in quei casi Android cancella
            i dati e senza backup non si recuperano.
          </p>

          <div className="backup-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEsportaBackup}
              disabled={backupBusy}
            >
              ⬇️ Esporta backup
            </button>
            <span className="form-hint">
              {turniSalvati === 0
                ? 'Nessun turno da salvare'
                : `${turniSalvati} turn${turniSalvati === 1 ? 'o' : 'i'} + impostazioni`}
            </span>
          </div>

          <div className="backup-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => backupInputRef.current?.click()}
              disabled={backupBusy}
            >
              ⬆️ Ripristina da file
            </button>
            <span className="form-hint">Sostituisce tutti i dati attuali</span>
          </div>

          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportaBackup}
          />

          {backupMsg && (
            <p
              className={backupMsg.errore ? 'ai-error' : (backupMsg.attenzione ? 'form-hint form-hint--warn' : 'form-hint')}
              role="status"
            >
              {backupMsg.testo}
            </p>
          )}

          {/* Seconda via, quando non sappiamo se il file è arrivato. Resta
              visibile anche dopo aver copiato: se gli appunti non funzionano,
              questo riquadro è tutto ciò che separa l'utente dalla perdita dei
              dati, e nasconderlo per pulizia sarebbe la scelta sbagliata. */}
          {backupTesto && (
            <div className="backup-riserva">
              <button type="button" className="btn-secondary" onClick={copiaBackup}>
                📋 Copia il backup
              </button>
              <textarea
                className="backup-riserva-testo"
                readOnly
                value={backupTesto}
                aria-label="Backup in formato testo, da copiare a mano"
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
        </details>

        {/* Correzione degli orari a :50. È una MIGRAZIONE, non una funzione:
            compare solo se c'è qualcosa da correggere e sparisce da sola dopo. */}
        {daCorreggere.length > 0 && (
          <details className="settings-section">
            <summary className="settings-section-title">🛠 Correggi orari a :50</summary>
            <p className="settings-section-desc">
              Sul foglio turni «16,50» vuol dire <strong>16:30</strong>. Gli import da foto
              più vecchi sono entrati con i minuti sbagliati: <strong>{daCorreggere.length} turni</strong>
              {' '}hanno un orario che finisce per <code>:50</code>. Portandoli a <code>:30</code> le ore
              del mese tornano a corrispondere a quelle della busta.
            </p>

            <ul className="correzioni-elenco">
              {daCorreggere.map(t => (
                <li key={t.id}>
                  <strong>{t.date.slice(8)}/{t.date.slice(5, 7)}</strong>{' '}
                  {t.startTime}–{t.endTime} → {t.nuovoStart}–{t.nuovoEnd}
                </li>
              ))}
            </ul>

            <div className="backup-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleEsportaBackup}
                disabled={backupBusy}
              >
                ⬇️ Esporta backup prima
              </button>
            </div>

            <div className="backup-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCorreggiOrari}
                disabled={backupBusy}
              >
                🛠 Correggi {daCorreggere.length} turni
              </button>
              <span className="form-hint">Modifica i turni salvati</span>
            </div>
          </details>
        )}

        {/* ══ AVANZATE — fisco e dettagli ═════════════════════════ */}
        <details className="settings-advanced">
          <summary className="settings-advanced-title">⚙️ Avanzate — fisco e dettagli</summary>

        {/* Tredicesima e quattordicesima */}
        <details className="settings-section">
          <summary className="settings-section-title">🎁 Tredicesima e quattordicesima</summary>
          <p className="settings-section-desc">
            {/* Lo spazio esplicito serve: JSX mangia il ritorno a capo fra un
                tag e il testo della riga dopo, e si leggeva «tredicesimaarriva». */}
            Attiva le mensilità aggiuntive previste dal tuo CCNL. La <strong>tredicesima</strong>{' '}
            arriva a dicembre, la <strong>quattordicesima</strong> a giugno; ciascuna vale circa una
            mensilità (ore settimanali × paga oraria). Vengono incluse nel reddito annuo (quindi
            nell'aliquota fiscale) e mostrate nel mese in cui arrivano.
          </p>
          {/* Senza ore contrattuali la mensilità vale 0 (monthlyBaseGross ritorna
              0 per onCall): le caselle resterebbero due interruttori che non
              accendono niente, e va detto invece di lasciarlo scoprire. */}
          {form.onCall && (
            <p className="settings-section-desc">
              Lavorando a chiamata non ci sono ore contrattuali da cui ricavare l'importo:
              queste caselle non cambiano il calcolo. Se in busta ti arriva un rateo,
              segnalo come <strong>bonus del mese</strong> nel mese in cui lo prendi.
            </p>
          )}

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.hasTredicesima}
              onChange={setCheck('hasTredicesima')}
            />
            <span>Tredicesima (dicembre)</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.hasQuattordicesima}
              onChange={setCheck('hasQuattordicesima')}
            />
            <span>Quattordicesima (giugno)</span>
          </label>

          {(form.hasTredicesima || form.hasQuattordicesima) && (
            <div className="form-group">
              <label className="form-label" htmlFor="hire-date">Data di assunzione</label>
              <input
                id="hire-date"
                type="date"
                className="form-input"
                value={form.hireDate}
                onChange={set('hireDate')}
              />
              <p className="form-hint">
                Serve per il <strong>rateo</strong>: la mensilità aggiuntiva si matura in dodicesimi,
                la quattordicesima da luglio a giugno e la tredicesima nell'anno solare. Chi è assunto
                da sei mesi ne prende metà. Un mese conta solo se lavorato per almeno 15 giorni.
                Lascia vuoto per calcolare sempre la mensilità piena.
              </p>
            </div>
          )}
        </details>

        {/* TFR in busta */}
        <details className="settings-section">
          <summary className="settings-section-title">💼 TFR in busta (anticipo)</summary>
          <p className="settings-section-desc">
            Se hai scelto di ricevere il TFR mensilmente in busta invece di accantonarlo,
            attiva questa opzione. Viene aggiunta al netto una quota di circa il
            <strong> 6,91%</strong> del lordo (1/13,5 meno lo 0,50% del Fondo di garanzia).
            Il TFR ha tassazione separata: è una stima indicativa.
          </p>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.tfrInBusta}
              onChange={setCheck('tfrInBusta')}
            />
            <span>Aggiungi la quota TFR in busta (anticipo sul netto)</span>
          </label>

          {form.tfrInBusta && (
            <div className="form-group">
              <label className="form-label" htmlFor="tfr-tax">Aliquota TFR — tassazione separata (%)</label>
              <div className="input-with-symbol">
                <span className="input-symbol">%</span>
                <input
                  id="tfr-tax"
                  type="text"
                  inputMode="decimal"
                  className="form-input form-input--with-symbol"
                  placeholder="23"
                  value={form.tfrTaxRate}
                  onChange={set('tfrTaxRate')}
                />
              </div>
              <p className="form-hint">
                Il TFR è tassato a parte con l'aliquota media dei tuoi redditi (niente addizionali).
                Se la conosci dalla busta mettila qui; vuoto = stima al 23%.
              </p>
            </div>
          )}
        </details>

        {/* Addizionali IRPEF — stima netto (gated dal feature flag) */}
        {ENABLE_NET_CALC && (
          <details className="settings-section">
            <summary className="settings-section-title">🧾 Addizionali IRPEF</summary>
            <p className="settings-section-desc">
              Usate per la stima del netto. Variano in base alla tua residenza:
              l'addizionale regionale va da ~1,23% a ~3,33%, la comunale da 0% a ~0,9%.
              Imposta le aliquote del tuo Comune/Regione per una stima più precisa.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="add-reg">Addizionale regionale (%)</label>
                <div className="input-with-symbol">
                  <span className="input-symbol">%</span>
                  <input
                    id="add-reg"
                    type="text"
                    inputMode="decimal"
                    className="form-input form-input--with-symbol"
                    placeholder="1,23"
                    value={form.addRegionalePct}
                    onChange={set('addRegionalePct')}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-com">Addizionale comunale (%)</label>
                <div className="input-with-symbol">
                  <span className="input-symbol">%</span>
                  <input
                    id="add-com"
                    type="text"
                    inputMode="decimal"
                    className="form-input form-input--with-symbol"
                    placeholder="0,00"
                    value={form.addComunalePct}
                    onChange={set('addComunalePct')}
                  />
                </div>
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={form.addizionaliAltrove}
                onChange={setCheck('addizionaliAltrove')}
              />
              <span>Addizionali già trattenute da un altro datore (non applicarle → 0)</span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={form.noAddizionali}
                onChange={setCheck('noAddizionali')}
              />
              <span>Primo anno di lavoro: addizionali non ancora attive (nessun anno precedente da cui calcolarle)</span>
            </label>

            <div className="form-group">
              <label className="form-label" htmlFor="ti-mode">Trattamento integrativo — proiezione automatica</label>
              <select
                id="ti-mode"
                className="form-input"
                value={form.tiProjectionMode}
                onChange={set('tiProjectionMode')}
              >
                <option value="stimato">Reddito annuo stimato (contratto/RAL + voci fisse + bonus)</option>
                <option value="ytd">Dinamica dal maturato (annualizza il guadagnato finora)</option>
              </select>
              <p className="form-hint">
                Il TI viene incluso o escluso da solo in base a questa proiezione (soglie 15.000/28.000€
                e capienza), come fa un software paghe. Il dettaglio del netto mostra la decisione.
              </p>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={form.noTrattamentoIntegrativo}
                onChange={setCheck('noTrattamentoIntegrativo')}
              />
              <span>Forza esclusione TI (override, va a conguaglio)</span>
            </label>
          </details>
        )}

        {/* Paghe precedenti (aumenti) */}
        <details className="settings-section">
          <summary className="settings-section-title">🔄 Paghe precedenti (aumenti)</summary>
          <p className="settings-section-desc">
            Hai avuto un aumento durante l'anno? Elenca qui le paghe che avevi <strong>prima</strong>,
            indicando fino a quale giorno erano in vigore. I turni <strong>fino a</strong> quella data
            useranno la paga indicata; tutti gli altri usano la paga attuale qui sopra.
          </p>

          {form.previousRates.length > 0 && (
            <div className="rate-changes">
              {form.previousRates.map(c => (
                <div key={c.id} className="rate-change-row">
                  <div className="rate-change-fields">
                    <div className="form-group">
                      <label className="form-label form-label--sm">Fino al giorno</label>
                      <input
                        type="date"
                        className="form-input"
                        value={c.until}
                        onChange={updatePreviousRate(c.id, 'until')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label form-label--sm">Paga di allora (€/ora)</label>
                      <div className="input-with-symbol">
                        <span className="input-symbol">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input form-input--with-symbol"
                          placeholder="0,00"
                          value={c.rate}
                          onChange={updatePreviousRate(c.id, 'rate')}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rate-change-remove"
                    onClick={() => removePreviousRate(c.id)}
                    aria-label="Rimuovi paga precedente"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-secondary btn--full" onClick={addPreviousRate}>
            + Aggiungi paga precedente
          </button>
        </details>

        {/* Voci fisse mensili */}
        <details className="settings-section">
          <summary className="settings-section-title">➕ Voci fisse mensili</summary>
          <p className="settings-section-desc">
            Importi che ricevi <strong>ogni mese</strong> oltre ai turni (indennità di
            flessibilità, superminimo, elemento fisso…). Vengono <strong>sommati al lordo del
            mese</strong> nella stima del netto.
          </p>

          {form.fixedMonthlyItems.length > 0 && (
            <div className="rate-changes">
              {form.fixedMonthlyItems.map(v => (
                <div key={v.id} className="rate-change-row">
                  <div className="rate-change-fields">
                    <div className="form-group">
                      <label className="form-label form-label--sm">Descrizione</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="es. Indennità flessibilità"
                        value={v.label}
                        onChange={updateFixedItem(v.id, 'label')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label form-label--sm">Importo mensile (€)</label>
                      <div className="input-with-symbol">
                        <span className="input-symbol">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input form-input--with-symbol"
                          placeholder="0,00"
                          value={v.amount}
                          onChange={updateFixedItem(v.id, 'amount')}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rate-change-remove"
                    onClick={() => removeFixedItem(v.id)}
                    aria-label="Rimuovi voce fissa"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-secondary btn--full" onClick={addFixedItem}>
            + Aggiungi voce fissa
          </button>

          <div className="net-group-label">Bonus mensile (occasionale)</div>
          <div className="form-group">
            <label className="form-label" htmlFor="monthly-bonus-amount">
              Importo del bonus, quando lo prendi
            </label>
            <div className="input-with-symbol">
              <span className="input-symbol">€</span>
              <input
                id="monthly-bonus-amount"
                type="text"
                inputMode="decimal"
                className="form-input form-input--with-symbol"
                placeholder="0,00"
                value={form.monthlyBonusAmount}
                onChange={set('monthlyBonusAmount')}
              />
            </div>
            <p className="form-hint">
              Per un bonus fisso che non prendi per forza ogni mese (es. bonus presenza, premio a
              scaglioni): l'importo è sempre lo stesso, imposta qui una volta sola. Dal calendario
              poi spunti i mesi in cui l'hai preso.
            </p>
          </div>
        </details>

        {/* Trattenute fisse mensili */}
        <details className="settings-section">
          <summary className="settings-section-title">➖ Trattenute fisse mensili</summary>
          <p className="settings-section-desc">
            Importi che ti vengono trattenuti <strong>ogni mese</strong> oltre alle tasse (quota
            associativa, rata di un prestito, altro). Vengono <strong>sottratti dal netto</strong>
            senza toccare imponibile o tasse, come in busta.
          </p>

          {form.fixedMonthlyDeductions.length > 0 && (
            <div className="rate-changes">
              {form.fixedMonthlyDeductions.map(v => (
                <div key={v.id} className="rate-change-row">
                  <div className="rate-change-fields">
                    <div className="form-group">
                      <label className="form-label form-label--sm">Descrizione</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="es. Quota associativa, rata prestito…"
                        value={v.label}
                        onChange={updateFixedDeduction(v.id, 'label')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label form-label--sm">Importo mensile (€)</label>
                      <div className="input-with-symbol">
                        <span className="input-symbol">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input form-input--with-symbol"
                          placeholder="0,00"
                          value={v.amount}
                          onChange={updateFixedDeduction(v.id, 'amount')}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rate-change-remove"
                    onClick={() => removeFixedDeduction(v.id)}
                    aria-label="Rimuovi trattenuta fissa"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-secondary btn--full" onClick={addFixedDeduction}>
            + Aggiungi trattenuta fissa
          </button>
        </details>

        </details>
        {/* ══ fine Avanzate ═══════════════════════════════════════ */}

        <div className="settings-footer">
          <button type="submit" className="btn btn-primary btn--full">
            {saved ? '✓ Salvato!' : 'Salva impostazioni'}
          </button>
          {/* Un'informativa che nessuno incontra non informa nessuno. Sta qui in
              fondo alle impostazioni, che è dove la si cerca, e punta a una
              pagina statica: resta leggibile anche se l'app è rotta.
              `target="_blank"` per non far perdere le modifiche non salvate. */}
          <p className="settings-privacy">
            <a href="/privacy/" target="_blank" rel="noopener">
              Come vengono trattati i tuoi dati
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
