// Le giornate disegnate dal calendario di un mese.
//
// Non sempre sono «dal 1 al 31»: con un contratto mensilizzato la busta non
// taglia a fine mese ma a fine settimana, e l'app conta le ore su quel periodo
// (vedi payrollMonthKey in dates.js). Finché la griglia restava ferma al mese
// di calendario, il riepilogo poteva dire «7 giorni di ferie» sotto un mese in
// cui se ne vedeva uno solo: gli altri sei erano nella prima settimana del mese
// dopo, contati ma invisibili. Valeva già per le ore e per la retribuzione.
//
// Le settimane del mese di paga combaciano con le righe della griglia — sono
// lunedì→domenica per costruzione — quindi il periodo si ottiene riempiendo le
// celle di coda coi giorni del mese dopo e marcando come FUORI PERIODO i giorni
// iniziali che cadono prima del primo lunedì: quelli stanno nella busta
// precedente, e si contano lì.
//
// Estensioni esplicite sugli import: il file resta importabile da Node puro per
// il riscontro in `scripts/check-griglia-periodo.mjs`.
import { formatDate, getDaysInMonth, payrollMonthRange } from './dates.js';

/**
 * @param {number} year
 * @param {number} month 0-11
 * @param {boolean} periodoPaga true = griglia sul mese di PAGA (settimane
 *   intere), false = mese di calendario
 * @returns {Array<null|{iso, date, dayNum, altroMese, fuoriPeriodo}>} celle in
 *   ordine di lettura, lunedì per primo; `null` è una casella vuota di testa.
 */
export function celleMese(year, month, periodoPaga = false) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7; // lunedì = 0
  const totalCells = Math.ceil((firstOffset + daysInMonth) / 7) * 7;
  const isoInizioPaga = periodoPaga ? formatDate(payrollMonthRange(year, month).start) : null;

  return Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstOffset + 1;
    const dentroMese = d >= 1 && d <= daysInMonth;
    // Celle di testa: sono giorni del mese PRECEDENTE, e il posto in cui si
    // vedono per intero è la griglia di quel mese. Restano vuote.
    if (!dentroMese && !(periodoPaga && d > daysInMonth)) return null;
    const date = new Date(year, month, d); // oltre fine mese Date normalizza da sé
    const iso = formatDate(date);
    return {
      iso,
      date,
      dayNum: date.getDate(),
      altroMese: !dentroMese,
      fuoriPeriodo: periodoPaga && iso < isoInizioPaga,
    };
  });
}
