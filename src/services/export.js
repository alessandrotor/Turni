// Esportazione dei turni del mese in Excel (.xlsx) e PDF.
// Librerie pesanti caricate on-demand (dynamic import) per non appesantire l'avvio.
// Su Android il file viene scritto e aperto col foglio di condivisione nativo;
// su browser viene scaricato.
import { Capacitor } from '@capacitor/core';
import { calcShiftMinutes } from '../utils/pay';
import { parseDate, formatMonthYear } from '../utils/dates';

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const HEADERS = ['Data', 'Giorno', 'Inizio', 'Fine', 'Pausa (min)', 'Ore', 'Note'];

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

// Scrive/condivide il file: nativo → Filesystem + Share; browser → download.
// Esportata perché la usa anche il backup JSON (services/backup.js): è l'unico
// punto in cui l'app sa come consegnare un file su entrambe le piattaforme.
export async function deliver(filename, base64, mime) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    await Share.share({ title: filename, files: [uri], dialogTitle: 'Esporta turni' });
  } else {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
        s.startTime || '',
        s.endTime || '',
        s.breakMinutes || 0,
        Number((mins / 60).toFixed(2)),
        s.note || '',
      ];
    }),
    [],
    ['', '', '', '', 'Totale ore', Number((totalMins / 60).toFixed(2)), ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 11 }, { wch: 8 }, { wch: 8 }, { wch: 11 }, { wch: 8 }, { wch: 28 }];
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
        s.startTime || '',
        s.endTime || '',
        String(s.breakMinutes || 0),
        fmtHM(mins),
        s.note || '',
      ];
    }),
    foot: [['', '', '', '', 'Totale ore', fmtHM(totalMins), '']],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
  });

  const base64 = doc.output('datauristring').split(',')[1];
  await deliver(`${baseName}.pdf`, base64, 'application/pdf');
}
