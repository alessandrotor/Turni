// Esportazione dei turni del mese in Excel (.xlsx) e PDF.
// Librerie pesanti caricate on-demand (dynamic import) per non appesantire l'avvio.
// Su Android il file viene scritto e aperto col foglio di condivisione nativo;
// su browser viene scaricato.
import { Capacitor } from '@capacitor/core';
import { calcShiftMinutes } from '../utils/pay';
import { tipoTurno, ETICHETTA, TIPO } from '../utils/assenze';
import { parseDate, formatMonthYear } from '../utils/dates';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const HEADERS = ['Data', 'Giorno', 'Tipo', 'Inizio', 'Fine', 'Pausa (min)', 'Ore', 'Note'];

// Ferie, permessi e malattia non hanno orari: al loro posto il tipo, altrimenti
// nel foglio esportato comparirebbero righe con due colonne vuote e nessuna
// spiegazione di dove vengano quelle ore.
const tipoLabel = (s) => (tipoTurno(s) === TIPO.LAVORO ? 'Lavoro' : ETICHETTA[tipoTurno(s)]);

const itDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtHM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// `periodo` (opzionale) descrive l'intervallo quando NON è il mese di calendario:
// per i CCNL mensilizzati il mese di paga è fatto di settimane intere e può
// contenere giorni del mese prima o dopo. Scriverlo nel titolo evita che il
// documento sembri sbagliato a chi conta i giorni.
function prepare(shifts, monthDate, periodo = '') {
  const sorted = shifts.slice().sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')
  );
  const totalMins = shifts.reduce((sum, s) => sum + calcShiftMinutes(s), 0);
  const mm = String(monthDate.getMonth() + 1).padStart(2, '0');
  return {
    sorted,
    totalMins,
    title: `Turni – ${formatMonthYear(monthDate)}${periodo ? ` (${periodo})` : ''}`,
    baseName: `Turni_${monthDate.getFullYear()}-${mm}`,
  };
}

// ── Consegna di un file all'utente ─────────────────────────────────────────
//
// COSA C'ERA PRIMA, E PERCHÉ ERA IL DIFETTO PIÙ CARO DELL'APP
// Questa funzione finiva con `a.click()` e non restituiva niente. `a.click()`
// non lancia e non riferisce: se il download è bloccato — Safari su iOS in
// modalità PWA, i browser interni di Instagram e Facebook, impostazioni
// restrittive — la promessa si risolveva ugualmente, e l'app annunciava
// «Backup scaricato: N turni al sicuro».
//
// Cioè: proprio nel momento in cui l'utente mette in salvo il suo lavoro, gli si
// diceva una cosa che nessuno aveva verificato. E lo si scopre il giorno in cui
// il backup serve, che è il giorno peggiore.
//
// LA REGOLA NUOVA: non si dichiara mai un successo che non si è visto.
// Ogni strada dice cosa è successo davvero, e chi chiama sceglie le parole di
// conseguenza. Dove il browser non permette di saperlo, l'esito si chiama
// NON_VERIFICABILE — che è la verità — e l'interfaccia offre una seconda via
// invece di rassicurare.
export const ESITO = {
  /** L'utente ha scelto dove salvare e la scrittura è andata a buon fine. */
  SALVATO: 'salvato',
  /** Consegnato al foglio di condivisione di sistema (Android/iOS). */
  CONDIVISO: 'condiviso',
  /** Download avviato dal browser: non c'è modo di sapere se è arrivato. */
  NON_VERIFICABILE: 'non-verificabile',
  /** L'utente ha annullato: nessun file scritto, e non è un errore. */
  ANNULLATO: 'annullato',
};

// Il browser sa dire se il file è stato scritto davvero solo con la File System
// Access API: `showSaveFilePicker` apre la finestra «salva con nome», e la
// scrittura che segue o riesce o lancia. È l'unica strada che permette di
// promettere qualcosa. Dove non c'è (Firefox, Safari, iOS) si ripiega sul
// vecchio download, dichiarandolo per quello che è.
//
// Funzione a parte, e pura, perché la decisione si possa riscontrare senza un
// browser: vedi `scripts/check-consegna-file.mjs`.
export function stradaDiConsegna({ nativo, salvaConNome }) {
  if (nativo) return 'condivisione';
  if (salvaConNome) return 'salvaConNome';
  return 'download';
}

function base64ToBlob(base64, mime) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Consegna un file all'utente.
 *
 * Esportata perché la usa anche il backup JSON (`services/backup.js`): è
 * l'unico punto in cui l'app sa come consegnare un file su entrambe le
 * piattaforme.
 *
 * @returns {Promise<{esito: string}>} MAI un successo generico: vedi `ESITO`.
 */
export async function deliver(filename, base64, mime) {
  const strada = stradaDiConsegna({
    nativo: Capacitor.isNativePlatform(),
    salvaConNome: typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function',
  });

  if (strada === 'condivisione') {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    try {
      await Share.share({ title: filename, files: [uri], dialogTitle: 'Esporta turni' });
    } catch (err) {
      // Chiudere il foglio di condivisione senza scegliere non è un guasto:
      // trattarlo come tale farebbe comparire un errore rosso a chi ha
      // semplicemente cambiato idea. Ma non è nemmeno un successo — il file è
      // rimasto nella cache, che il sistema può svuotare quando vuole.
      if (/cancel/i.test(String(err?.message || err))) return { esito: ESITO.ANNULLATO };
      throw err;
    }
    return { esito: ESITO.CONDIVISO };
  }

  if (strada === 'salvaConNome') {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: filename.split('.').pop().toUpperCase(), accept: { [mime]: [`.${filename.split('.').pop()}`] } }],
      });
    } catch (err) {
      if (err?.name === 'AbortError') return { esito: ESITO.ANNULLATO };
      // Qualunque altro intoppo nella finestra di salvataggio non deve lasciare
      // l'utente senza file: si ripiega sul download, dichiarato per quello che è.
      scaricaConLink(filename, base64, mime);
      return { esito: ESITO.NON_VERIFICABILE };
    }
    const stream = await handle.createWritable();
    await stream.write(base64ToBlob(base64, mime));
    await stream.close();
    // Qui, e soltanto qui, il file è stato scritto dove l'utente ha detto.
    return { esito: ESITO.SALVATO };
  }

  scaricaConLink(filename, base64, mime);
  return { esito: ESITO.NON_VERIFICABILE };
}

function scaricaConLink(filename, base64, mime) {
  const url = URL.createObjectURL(base64ToBlob(base64, mime));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportShiftsExcel(shifts, monthDate, periodo = '') {
  if (!shifts.length) throw new Error('Nessun turno da esportare in questo mese');
  const XLSX = await import('xlsx');
  const { sorted, totalMins, title, baseName } = prepare(shifts, monthDate, periodo);

  const aoa = [
    [title],
    [],
    HEADERS,
    ...sorted.map(s => {
      const mins = calcShiftMinutes(s);
      return [
        itDate(s.date),
        GIORNI[parseDate(s.date).getDay()],
        tipoLabel(s),
        s.startTime || '',
        s.endTime || '',
        s.breakMinutes || 0,
        Number((mins / 60).toFixed(2)),
        s.note || '',
      ];
    }),
    [],
    ['', '', '', '', '', 'Totale ore', Number((totalMins / 60).toFixed(2)), ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 11 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 11 }, { wch: 8 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Turni');
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

  await deliver(`${baseName}.xlsx`, base64,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportShiftsPDF(shifts, monthDate, periodo = '') {
  if (!shifts.length) throw new Error('Nessun turno da esportare in questo mese');
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default;
  const { sorted, totalMins, title, baseName } = prepare(shifts, monthDate, periodo);

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [HEADERS],
    body: sorted.map(s => {
      const mins = calcShiftMinutes(s);
      return [
        itDate(s.date),
        GIORNI[parseDate(s.date).getDay()],
        tipoLabel(s),
        s.startTime || '',
        s.endTime || '',
        String(s.breakMinutes || 0),
        fmtHM(mins),
        s.note || '',
      ];
    }),
    foot: [['', '', '', '', '', 'Totale ore', fmtHM(totalMins), '']],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
  });

  const base64 = doc.output('datauristring').split(',')[1];
  await deliver(`${baseName}.pdf`, base64, 'application/pdf');
}
